import { redirect } from "next/navigation";
import { currentUser } from "@/auth";
import { ApprovalQueue, type QueueItem } from "@/components/studio/approval-queue";
import { PageFrame } from "@/components/studio/page-frame";
import { getCampaigns, getRun, listApprovals } from "@/lib/db";
import type { Approval } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * La coda degli approvatori: le richieste in attesa, con l'anteprima
 * dell'asset come e' stato controllato, e le ultime decisioni prese.
 */
export default async function ApprovazioniPage() {
  const user = await currentUser();
  if (!user) redirect("/");
  if (user.role !== "approver") redirect("/studio");

  const [pending, approved, rejected, campaigns] = await Promise.all([
    listApprovals("pending"),
    listApprovals("approved", 10),
    listApprovals("rejected", 10),
    getCampaigns(),
  ]);

  const items = await hydrate(pending, campaigns);
  const decided = (await hydrate([...approved, ...rejected], campaigns)).sort((a, b) =>
    (b.approval.decided_at ?? "").localeCompare(a.approval.decided_at ?? ""),
  );

  return (
    <PageFrame
      user={user}
      title="Approvazioni"
      description={items.length === 0 ? "Nessuna richiesta in attesa." : `${items.length} ${items.length === 1 ? "richiesta in attesa" : "richieste in attesa"}, dalla più vecchia`}
    >
      <ApprovalQueue pending={items} decided={decided.slice(0, 10)} />
    </PageFrame>
  );
}

async function hydrate(approvals: Approval[], campaigns: { id: string; name: string }[]): Promise<QueueItem[]> {
  const runs = new Map<string, Awaited<ReturnType<typeof getRun>>>();
  for (const a of approvals) {
    if (!runs.has(a.run_id)) runs.set(a.run_id, await getRun(a.run_id));
  }

  const out: QueueItem[] = [];
  for (const approval of approvals) {
    const run = runs.get(approval.run_id);
    if (!run) continue;
    const variant = run.variants.find((v) => v.index === approval.variant_index);
    if (!variant) continue;
    out.push({
      approval,
      run,
      variant,
      assets: run.assets.filter((a) => a.variant_index === approval.variant_index),
      campaign: campaigns.find((c) => c.id === run.campaign_id)?.name ?? run.brief?.campaign_name ?? "—",
    });
  }
  return out;
}
