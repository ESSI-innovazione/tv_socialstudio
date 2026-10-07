import type { StudioUser } from "@/auth";
import { overallStatus } from "./brand-guard";
import {
  createApproval,
  decideApproval,
  getApproval,
  getApprovals,
  getCampaigns,
  getRun,
  listApprovers,
  markAssetsApproved,
} from "./db";
import { env } from "./env";
import { sendMail } from "./mail";
import type { Approval, Asset, Run } from "./types";

/**
 * Il flusso di approvazione, dal lato di chi lo guida.
 *
 * Un editor chiede su una variante che ha gia' passato il brand-guard; un
 * approvatore approva o rimanda indietro con un commento. Gli asset della
 * variante ricordano la decisione, e la posta avvisa chi deve agire.
 */

export class ApprovalError extends Error {
  readonly status: number;
  constructor(message: string, status = 409) {
    super(message);
    this.name = "ApprovalError";
    this.status = status;
  }
}

async function campaignName(run: Run): Promise<string> {
  const campaigns = await getCampaigns();
  return campaigns.find((c) => c.id === run.campaign_id)?.name ?? run.brief?.campaign_name ?? run.instruction.slice(0, 60);
}

export async function requestApproval(
  run: Run,
  variantIndex: number,
  user: StudioUser,
  note: string | null,
): Promise<{ approval: Approval; mailed: boolean }> {
  if (!run.variants.some((v) => v.index === variantIndex)) throw new ApprovalError("Variante non trovata", 404);

  const assets = run.assets.filter((a) => a.variant_index === variantIndex);
  if (assets.length === 0) throw new ApprovalError("L'esecuzione non ha ancora asset salvati.");

  const guard = overallStatus(assets.map((a) => a.guard_status));
  if (guard === null) throw new ApprovalError("Prima il controllo del brand: non tutti i formati sono stati verificati.");
  if (guard === "fail") throw new ApprovalError("Il controllo del brand ha bloccato questa variante: correggi e ricontrolla.");

  const existing = await getApprovals(run.id);
  if (existing.some((a) => a.variant_index === variantIndex && a.status === "pending")) {
    throw new ApprovalError("C'e' gia' una richiesta in attesa per questa variante.");
  }

  const approval = await createApproval({
    run_id: run.id,
    variant_index: variantIndex,
    requested_by: user.email,
    note: note?.trim() || null,
  });

  const approvers = await listApprovers();
  const to = approvers.map((p) => p.email).filter((e) => e !== user.email);
  const campaign = await campaignName(run);
  const result = await sendMail({
    to,
    subject: `Richiesta di approvazione · ${campaign}`,
    text: [
      `${user.name} chiede l'approvazione della variante ${variantIndex + 1} per «${campaign}».`,
      approval.note ? `\nMessaggio: ${approval.note}` : "",
      `\nFormati: ${assets.map((a) => a.format).join(", ")} · controllo del brand: ${guard === "pass" ? "ok" : "ok con avvisi"}.`,
      `\nApri la coda: ${env.siteUrl}/studio/approvazioni`,
    ].join("\n"),
  });

  return { approval, mailed: result.sent };
}

export async function decide(
  approvalId: string,
  decision: "approved" | "rejected",
  approver: StudioUser,
  comment: string | null,
): Promise<{ approval: Approval; assets: Asset[]; mailed: boolean }> {
  if (approver.role !== "approver") throw new ApprovalError("Solo un approvatore puo' decidere.", 403);

  const existing = await getApproval(approvalId);
  if (!existing) throw new ApprovalError("Richiesta non trovata", 404);
  if (existing.status !== "pending") throw new ApprovalError("Questa richiesta e' gia' stata decisa.");

  const trimmed = comment?.trim() || null;
  if (decision === "rejected" && !trimmed) {
    throw new ApprovalError("Per rimandare indietro serve un commento: chi ha chiesto deve sapere cosa cambiare.", 400);
  }

  const run = await getRun(existing.run_id);
  if (!run) throw new ApprovalError("Esecuzione non trovata", 404);

  // Il brand-guard vale anche al momento della decisione: se nel frattempo
  // l'asset e' stato ricontrollato e ha fallito, non si approva.
  if (decision === "approved") {
    const guard = overallStatus(run.assets.filter((a) => a.variant_index === existing.variant_index).map((a) => a.guard_status));
    if (guard === "fail" || guard === null) {
      throw new ApprovalError("Il controllo del brand non e' positivo su questa variante: non si puo' approvare.");
    }
  }

  const approval = (await decideApproval(approvalId, decision, { email: approver.email, name: approver.name }, trimmed)) ?? {
    ...existing,
    status: decision,
    comment: trimmed,
    approver_email: approver.email,
    approver_name: approver.name,
    decided_at: new Date().toISOString(),
  };

  const assets = await markAssetsApproved(
    run.id,
    existing.variant_index,
    decision === "approved" ? { id: approval.id, email: approver.email } : null,
  );

  const campaign = await campaignName(run);
  const result = await sendMail({
    to: existing.requested_by ? [existing.requested_by] : [],
    subject: decision === "approved" ? `Approvato · ${campaign}` : `Da rivedere · ${campaign}`,
    text: [
      decision === "approved"
        ? `${approver.name} ha approvato la variante ${existing.variant_index + 1} per «${campaign}». Ora si puo' pubblicare.`
        : `${approver.name} ha rimandato indietro la variante ${existing.variant_index + 1} per «${campaign}».`,
      trimmed ? `\nCommento: ${trimmed}` : "",
      `\nRiapri il lavoro: ${env.siteUrl}/studio?run=${run.id}`,
    ].join("\n"),
  });

  return { approval, assets, mailed: result.sent };
}
