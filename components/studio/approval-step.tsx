"use client";

import { useEffect, useState } from "react";
import { Check, CircleAlert, Clock, LoaderCircle, Lock, RotateCcw, Send, Undo2 } from "lucide-react";
import { timeAgo } from "@/lib/format";
import { can } from "@/lib/permissions";
import type { Approval, Asset, Run } from "@/lib/types";
import type { StudioUser } from "@/auth";

interface Props {
  run: Run;
  selected: number;
  /** Vero quando il brand-guard e' positivo su tutti i formati della variante. */
  guardOk: boolean;
  user: StudioUser;
  onAssets: (assets: Asset[]) => void;
  /** Lo stato corrente, per chi sta sopra: serve a sbloccare la pubblicazione. */
  onStatus?: (status: Approval["status"] | null) => void;
}

/**
 * L'approvazione di una variante, vista da chi lavora nella console.
 *
 * Chi chiede scrive due righe e manda; chi approva vede la richiesta anche
 * qui, oltre che nella coda, e puo' decidere sul posto. Lo stato arriva
 * sempre dal server: il pulsante chiede, non decide.
 */
export function ApprovalStep({ run, selected, guardOk, user, onAssets, onStatus }: Props) {
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [note, setNote] = useState("");
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mailed, setMailed] = useState<boolean | null>(null);

  useEffect(() => {
    let alive = true;
    fetch(`/api/approvals?runId=${encodeURIComponent(run.id)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { approvals: Approval[] } | null) => {
        if (alive && data) setApprovals(data.approvals);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [run.id]);

  const forVariant = approvals.filter((a) => a.variant_index === selected);
  const latest = forVariant.length > 0 ? forVariant[forVariant.length - 1] : null;

  useEffect(() => {
    onStatus?.(latest?.status ?? null);
  }, [latest?.status, onStatus]);

  const upsert = (approval: Approval) =>
    setApprovals((prev) => (prev.some((a) => a.id === approval.id) ? prev.map((a) => (a.id === approval.id ? approval : a)) : [...prev, approval]));

  const request = async (autoApprove: boolean) => {
    setBusy(autoApprove ? "auto" : "request");
    setError(null);
    try {
      const res = await fetch("/api/approvals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ runId: run.id, variantIndex: selected, note: note || null, autoApprove }),
      });
      const data = (await res.json().catch(() => ({}))) as { approval?: Approval; assets?: Asset[]; mailed?: boolean; error?: string };
      if (!res.ok || !data.approval) throw new Error(data.error ?? "La richiesta non e' partita.");
      upsert(data.approval);
      if (data.assets) onAssets(data.assets);
      setMailed(data.mailed ?? null);
      setNote("");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  const decide = async (decision: "approved" | "rejected") => {
    if (!latest) return;
    setBusy(decision);
    setError(null);
    try {
      const res = await fetch(`/api/approvals/${latest.id}/decide`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision, comment: comment || null }),
      });
      const data = (await res.json().catch(() => ({}))) as { approval?: Approval; assets?: Asset[]; error?: string };
      if (!res.ok || !data.approval) throw new Error(data.error ?? "La decisione non e' stata registrata.");
      upsert(data.approval);
      if (data.assets) onAssets(data.assets);
      setComment("");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  const approver = can(user, "approve");

  /* ---------------- approvata ---------------- */
  if (latest?.status === "approved") {
    return (
      <section className="flex items-start gap-2.5 rounded-card px-3.5 py-3 text-[13px] leading-[1.45]" style={{ background: "var(--color-success-bg)", color: "var(--color-success)" }}>
        <Check size={16} strokeWidth={2.4} className="mt-[1px] shrink-0" />
        <span>
          <span className="font-semibold">Approvata</span> da {latest.approver_name}
          {latest.decided_at ? <span suppressHydrationWarning> · {timeAgo(latest.decided_at)}</span> : null}
          {latest.comment ? <span className="block text-[12.5px]">«{latest.comment}»</span> : null}
        </span>
      </section>
    );
  }

  /* ---------------- in attesa ---------------- */
  if (latest?.status === "pending") {
    return (
      <section className="flex flex-col gap-2.5 rounded-card px-3.5 py-3" style={{ background: "var(--color-warm-tint)" }}>
        <p className="flex items-start gap-2.5 text-[13px] leading-[1.45]" style={{ color: "var(--color-warning)" }}>
          <Clock size={16} strokeWidth={2.2} className="mt-[1px] shrink-0" />
          <span>
            <span className="font-semibold">In attesa di approvazione</span>
            <span className="block text-[12.5px]">
              chiesta da {latest.requested_by === user.email ? "te" : latest.requested_by}
              {latest.created_at ? <span suppressHydrationWarning> · {timeAgo(latest.created_at)}</span> : null}
              {mailed === false ? " · email non inviata (RESEND_API_KEY assente)" : null}
            </span>
            {latest.note ? <span className="block text-[12.5px]" style={{ color: "var(--color-ink-soft)" }}>«{latest.note}»</span> : null}
          </span>
        </p>

        {approver ? (
          <>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={2}
              placeholder="Commento (obbligatorio se rimandi indietro)"
              className="tv-scroll w-full resize-none rounded-[10px] px-3 py-2 text-[12.5px] leading-[1.5] outline-none focus:shadow-focus"
              style={{ border: "1px solid var(--color-line)", background: "var(--color-paper)", color: "var(--color-ink)" }}
            />
            <div className="grid grid-cols-2 gap-2">
              <Action onClick={() => decide("approved")} busy={busy === "approved"} primary icon={Check}>
                Approva
              </Action>
              <Action onClick={() => decide("rejected")} busy={busy === "rejected"} icon={Undo2}>
                Rimanda indietro
              </Action>
            </div>
          </>
        ) : null}
        {error ? <Problem text={error} /> : null}
      </section>
    );
  }

  /* ---------------- da chiedere (o rimandata indietro) ---------------- */
  return (
    <section className="flex flex-col gap-2.5">
      {latest?.status === "rejected" ? (
        <p className="flex items-start gap-2.5 rounded-card px-3.5 py-3 text-[13px] leading-[1.45]" style={{ background: "#fdecea", color: "#8c1d18" }}>
          <CircleAlert size={16} strokeWidth={2.2} className="mt-[1px] shrink-0" />
          <span>
            <span className="font-semibold">Rimandata indietro</span> da {latest.approver_name}
            {latest.decided_at ? <span suppressHydrationWarning> · {timeAgo(latest.decided_at)}</span> : null}
            {latest.comment ? <span className="block text-[12.5px]">«{latest.comment}»</span> : null}
          </span>
        </p>
      ) : null}

      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        rows={2}
        disabled={!guardOk}
        placeholder={guardOk ? "Due righe per chi approva (facoltative)" : "Prima il controllo del brand"}
        className="tv-scroll w-full resize-none rounded-[10px] px-3 py-2 text-[12.5px] leading-[1.5] outline-none focus:shadow-focus"
        style={{ border: "1px solid var(--color-line)", background: guardOk ? "var(--color-paper)" : "var(--color-line-soft)", color: "var(--color-ink)" }}
      />

      <button
        type="button"
        onClick={() => request(false)}
        disabled={!guardOk || busy !== null}
        className="tv-pill h-[46px] w-full justify-center gap-2 text-[14.5px] transition-all"
        style={{
          background: guardOk ? "var(--color-coral)" : "var(--color-mute)",
          color: "#ffffff",
          boxShadow: guardOk ? "var(--shadow-coral)" : "none",
          cursor: guardOk ? "pointer" : "not-allowed",
        }}
        title={guardOk ? undefined : "Prima il controllo del brand deve passare"}
      >
        {busy === "request" ? <LoaderCircle size={16} strokeWidth={2.2} className="tv-anim-spin" /> : guardOk ? <Send size={16} strokeWidth={2.2} /> : <Lock size={16} strokeWidth={2} />}
        {latest?.status === "rejected" ? "Richiedi di nuovo" : "Richiedi approvazione"}
      </button>

      {approver ? (
        <Action onClick={() => request(true)} busy={busy === "auto"} disabled={!guardOk} icon={latest?.status === "rejected" ? RotateCcw : Check}>
          Approva subito
        </Action>
      ) : null}

      {error ? <Problem text={error} /> : null}
    </section>
  );
}

function Action({
  onClick,
  busy,
  disabled = false,
  primary = false,
  icon: Icon,
  children,
}: {
  onClick: () => void;
  busy: boolean;
  disabled?: boolean;
  primary?: boolean;
  icon: typeof Check;
  children: string;
}) {
  const off = disabled || busy;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={off}
      className="tv-pill h-[40px] w-full justify-center gap-2 text-[13px] transition-colors hover:bg-line-soft"
      style={{
        background: primary ? "var(--color-wine)" : "var(--color-paper)",
        border: primary ? "none" : "1px solid var(--color-line)",
        color: primary ? "#ffffff" : disabled ? "var(--color-ink-faint)" : "var(--color-ink)",
        cursor: off ? "not-allowed" : "pointer",
      }}
    >
      {busy ? <LoaderCircle size={14} strokeWidth={2.2} className="tv-anim-spin" /> : <Icon size={14} strokeWidth={2.2} />}
      {children}
    </button>
  );
}

function Problem({ text }: { text: string }) {
  return (
    <p className="text-[12px] leading-[1.45]" style={{ color: "var(--color-warning)" }}>
      {text}
    </p>
  );
}
