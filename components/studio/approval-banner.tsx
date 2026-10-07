"use client";

import { useState } from "react";
import { Check, LoaderCircle, MessageSquare, Undo2 } from "lucide-react";
import { timeAgo } from "@/lib/format";
import { can } from "@/lib/permissions";
import type { Approval, Asset } from "@/lib/types";
import type { StudioUser } from "@/auth";

interface Props {
  approval: Approval | null;
  variantIndex: number;
  user: StudioUser;
  onApproval: (approval: Approval) => void;
  onAssets: (assets: Asset[]) => void;
}

/** Entro quanto chi ha approvato puo' annullare da qui: lo stesso del server. */
const UNDO_WINDOW_MS = 30 * 60_000;

/**
 * Il riquadro sopra al lavoro. Per chi approva, quando c'e' una richiesta in
 * attesa: chi chiede, cosa scrive, e i due pulsanti. Dopo aver approvato
 * diventa verde e offre di annullare, per un po'. Chi non approva vede solo
 * che il lavoro aspetta qualcuno.
 */
export function ApprovalBanner({ approval, variantIndex, user, onApproval, onAssets }: Props) {
  const [comment, setComment] = useState("");
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState<"approve" | "changes" | "undo" | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!approval || approval.variant_index !== variantIndex) return null;
  const approver = can(user, "approve");

  const call = async (kind: "approve" | "changes" | "undo") => {
    setBusy(kind);
    setError(null);
    try {
      const url = kind === "undo" ? `/api/approvals/${approval.id}/undo` : `/api/approvals/${approval.id}/decide`;
      const body = kind === "undo" ? undefined : JSON.stringify({ decision: kind === "approve" ? "approved" : "rejected", comment: comment || null });
      const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body });
      const data = (await res.json().catch(() => ({}))) as { approval?: Approval; assets?: Asset[]; error?: string };
      if (!res.ok || !data.approval) throw new Error(data.error ?? "Non e' andata.");
      onApproval(data.approval);
      if (data.assets) onAssets(data.assets);
      setComment("");
      setAsking(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  const who = approval.requested_by === user.email ? "Tu" : (approval.requested_by?.split("@")[0] ?? "Qualcuno");
  const initials = (approval.requested_by ?? "?").split("@")[0].split(/[._-]+/).map((p) => p[0]?.toUpperCase() ?? "").join("").slice(0, 2) || "TV";

  /* ---------------- approvata ---------------- */
  if (approval.status === "approved") {
    const mine = approval.approver_email === user.email;
    const recent = approval.decided_at ? Date.now() - new Date(approval.decided_at).getTime() < UNDO_WINDOW_MS : false;
    return (
      <section role="status" className="flex flex-wrap items-center gap-3 rounded-card px-4 py-3" style={{ background: "var(--color-success-bg)", color: "var(--color-success)" }}>
        <Check size={18} strokeWidth={2.4} className="shrink-0" />
        <p className="min-w-0 flex-1 text-[13.5px] leading-[1.45]">
          <span className="font-semibold">
            Variante {variantIndex + 1} approvata {mine ? "da te" : `da ${approval.approver_name}`}
            {approval.decided_at ? ` alle ${new Date(approval.decided_at).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}` : ""}
          </span>
          {approval.comment ? <span className="block text-[12.5px]">«{approval.comment}»</span> : null}
        </p>
        {mine && recent ? (
          <button
            type="button"
            onClick={() => call("undo")}
            disabled={busy !== null}
            className="tv-pill h-[36px] cursor-pointer gap-1.5 px-3.5 text-[12.5px]"
            style={{ border: "1px solid rgb(31 84 54 / .35)", color: "var(--color-success)", background: "var(--color-paper)" }}
          >
            {busy === "undo" ? <LoaderCircle size={13} strokeWidth={2.2} className="tv-anim-spin" /> : <Undo2 size={13} strokeWidth={2.2} />}
            Annulla
          </button>
        ) : null}
        {error ? <span className="w-full text-[12px]" style={{ color: "var(--color-danger)" }}>{error}</span> : null}
      </section>
    );
  }

  if (approval.status !== "pending") return null;

  /* ---------------- in attesa, per chi non approva ---------------- */
  if (!approver) {
    return (
      <section role="status" className="flex items-center gap-3 rounded-card px-4 py-3 text-[13.5px]" style={{ background: "var(--color-warm-tint)", color: "var(--color-warning)" }}>
        <span className="font-semibold">In attesa di un approvatore</span>
        <span className="text-[12.5px]" suppressHydrationWarning>
          chiesta {timeAgo(approval.created_at)}
        </span>
      </section>
    );
  }

  /* ---------------- in attesa, per chi approva ---------------- */
  return (
    <section aria-labelledby="approval-banner-title" className="rounded-card-lg p-4" style={{ background: "var(--color-paper)", border: "1.5px solid var(--color-rose)", boxShadow: "var(--shadow-focus)" }}>
      <div className="flex flex-wrap items-start gap-3">
        <span className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-full text-[12px] font-bold" style={{ background: "var(--color-wine-tint)", color: "var(--color-wine)" }} aria-hidden>
          {initials}
        </span>
        <div className="min-w-0 flex-1">
          <p id="approval-banner-title" className="text-[14.5px] font-semibold" style={{ color: "var(--color-ink)" }}>
            {who} {approval.requested_by === user.email ? "hai" : "ha"} chiesto l&apos;approvazione della variante {variantIndex + 1}
            <span className="ml-2 text-[12px] font-normal" style={{ color: "var(--color-ink-faint)" }} suppressHydrationWarning>
              {timeAgo(approval.created_at)}
            </span>
          </p>
          <p className="mt-0.5 text-[13px] leading-[1.5]" style={{ color: "var(--color-ink-soft)" }}>
            {approval.note ? `«${approval.note}»` : "Nessun messaggio allegato."}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setAsking((v) => !v)}
            aria-expanded={asking}
            className="tv-pill h-[44px] cursor-pointer gap-2 px-4 text-[13px] transition-colors hover:bg-line-soft"
            style={{ border: "1px solid var(--color-line)", color: "var(--color-ink)" }}
          >
            <MessageSquare size={14} strokeWidth={2} />
            Chiedi modifiche
          </button>
          <button
            type="button"
            onClick={() => call("approve")}
            disabled={busy !== null}
            className="tv-pill h-[44px] cursor-pointer gap-2 px-5 text-[13.5px]"
            style={{ background: "var(--color-wine)", color: "#ffffff" }}
          >
            {busy === "approve" ? <LoaderCircle size={15} strokeWidth={2.2} className="tv-anim-spin" /> : <Check size={15} strokeWidth={2.4} />}
            Approva variante {variantIndex + 1}
          </button>
        </div>
      </div>

      {asking ? (
        <div className="tv-anim-rise mt-3 flex flex-col gap-2">
          <label htmlFor="approval-comment" className="tv-label">
            COSA CAMBIARE
          </label>
          <textarea
            id="approval-comment"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={2}
            placeholder="Il commento e' obbligatorio: chi ha chiesto deve sapere cosa cambiare."
            className="tv-scroll w-full resize-none rounded-[10px] px-3 py-2.5 text-[13px] leading-[1.5] outline-none focus:shadow-focus"
            style={{ border: "1px solid var(--color-line)", background: "var(--color-paper)", color: "var(--color-ink)" }}
          />
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => call("changes")}
              disabled={busy !== null || comment.trim().length === 0}
              className="tv-pill h-[40px] gap-2 px-4 text-[13px]"
              style={{ background: comment.trim() ? "var(--color-ink)" : "var(--color-mute)", color: comment.trim() ? "#ffffff" : "var(--color-ink-soft)", cursor: comment.trim() ? "pointer" : "not-allowed" }}
            >
              {busy === "changes" ? <LoaderCircle size={14} strokeWidth={2.2} className="tv-anim-spin" /> : null}
              Rimanda indietro con il commento
            </button>
          </div>
        </div>
      ) : null}

      {error ? (
        <p role="alert" className="mt-2 text-[12.5px]" style={{ color: "var(--color-danger)" }}>
          {error}
        </p>
      ) : null}
    </section>
  );
}
