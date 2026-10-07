"use client";

import { useEffect, useState } from "react";
import { Check, CircleAlert, Clock, LoaderCircle, Lock, RotateCcw, Send } from "lucide-react";
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
  /** Le richieste dell'esecuzione, tenute da chi sta sopra: il banner le legge anche lui. */
  approvals: Approval[];
  onApprovals: (next: Approval[]) => void;
  onAssets: (assets: Asset[]) => void;
}

/** Le richieste di un'esecuzione, lette una volta e poi tenute in mano. */
export function useApprovals(runId: string): [Approval[], (next: Approval[]) => void] {
  const [approvals, setApprovals] = useState<Approval[]>([]);
  useEffect(() => {
    let alive = true;
    fetch(`/api/approvals?runId=${encodeURIComponent(runId)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { approvals: Approval[] } | null) => {
        if (alive && data) setApprovals(data.approvals);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [runId]);
  return [approvals, setApprovals];
}

/** La richiesta piu' recente per una variante. */
export function latestFor(approvals: Approval[], variant: number): Approval | null {
  const mine = approvals.filter((a) => a.variant_index === variant);
  return mine.length > 0 ? mine[mine.length - 1] : null;
}

/**
 * L'approvazione di una variante, vista da chi lavora nella console.
 *
 * Chi chiede scrive due righe e manda; chi approva decide nel banner sopra
 * al lavoro, oppure qui. Lo stato arriva sempre dal server: il pulsante
 * chiede, non decide.
 */
export function ApprovalStep({ run, selected, guardOk, user, approvals, onApprovals, onAssets }: Props) {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mailed, setMailed] = useState<boolean | null>(null);

  const latest = latestFor(approvals, selected);
  const upsert = (approval: Approval) =>
    onApprovals(approvals.some((a) => a.id === approval.id) ? approvals.map((a) => (a.id === approval.id ? approval : a)) : [...approvals, approval]);

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

  const approver = can(user, "approve");

  /* ---------------- approvata ---------------- */
  if (latest?.status === "approved") {
    return (
      <section className="flex items-start gap-2.5 rounded-card px-3.5 py-3 text-[13px] leading-[1.45]" style={{ background: "var(--color-success-bg)", color: "var(--color-success)" }}>
        <Check size={16} strokeWidth={2.4} className="mt-[1px] shrink-0" />
        <span>
          <span className="font-semibold">Approvata</span> da {latest.approver_email === user.email ? "te" : latest.approver_name}
          {latest.decided_at ? <span suppressHydrationWarning> · {timeAgo(latest.decided_at)}</span> : null}
          {latest.comment ? <span className="block text-[12.5px]">«{latest.comment}»</span> : null}
        </span>
      </section>
    );
  }

  /* ---------------- in attesa ---------------- */
  if (latest?.status === "pending") {
    return (
      <section className="flex flex-col gap-2 rounded-card px-3.5 py-3" style={{ background: "var(--color-warm-tint)" }}>
        <p className="flex items-start gap-2.5 text-[13px] leading-[1.45]" style={{ color: "var(--color-warning)" }}>
          <Clock size={16} strokeWidth={2.2} className="mt-[1px] shrink-0" />
          <span>
            <span className="font-semibold">{approver ? "In attesa della tua decisione" : "In attesa di un approvatore"}</span>
            <span className="block text-[12.5px]">
              chiesta da {latest.requested_by === user.email ? "te" : latest.requested_by}
              {latest.created_at ? <span suppressHydrationWarning> · {timeAgo(latest.created_at)}</span> : null}
              {mailed === false ? " · email non inviata (RESEND_API_KEY assente)" : null}
            </span>
            {latest.note ? <span className="block text-[12.5px]" style={{ color: "var(--color-ink-soft)" }}>«{latest.note}»</span> : null}
            {approver ? <span className="block text-[12.5px]">Decidi nel riquadro sopra al lavoro.</span> : null}
          </span>
        </p>
      </section>
    );
  }

  /* ---------------- da chiedere (o rimandata indietro) ---------------- */
  return (
    <section className="flex flex-col gap-2.5">
      {latest?.status === "rejected" ? (
        <p className="flex items-start gap-2.5 rounded-card px-3.5 py-3 text-[13px] leading-[1.45]" style={{ background: "var(--color-danger-bg)", color: "var(--color-danger)" }}>
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
        aria-label="Messaggio per chi approva"
        className="tv-scroll w-full resize-none rounded-[10px] px-3 py-2 text-[12.5px] leading-[1.5] outline-none focus:shadow-focus"
        style={{ border: "1px solid var(--color-line)", background: guardOk ? "var(--color-paper)" : "var(--color-line-soft)", color: "var(--color-ink)" }}
      />

      <button
        type="button"
        onClick={() => request(false)}
        disabled={!guardOk || busy !== null}
        className="tv-pill h-[46px] w-full justify-center gap-2 text-[14px] transition-all"
        style={{
          background: guardOk ? "var(--color-coral)" : "var(--color-mute)",
          color: guardOk ? "var(--color-ink)" : "var(--color-ink-soft)",
          boxShadow: guardOk ? "var(--shadow-coral)" : "none",
          cursor: guardOk ? "pointer" : "not-allowed",
        }}
        title={guardOk ? undefined : "Prima il controllo del brand deve passare"}
      >
        {busy === "request" ? <LoaderCircle size={16} strokeWidth={2.2} className="tv-anim-spin" /> : guardOk ? <Send size={16} strokeWidth={2.2} /> : <Lock size={16} strokeWidth={2} />}
        {latest?.status === "rejected" ? "Richiedi di nuovo" : "Richiedi approvazione"}
      </button>

      {approver ? (
        <button
          type="button"
          onClick={() => request(true)}
          disabled={!guardOk || busy !== null}
          className="tv-pill h-[40px] w-full justify-center gap-2 text-[13px] transition-colors hover:bg-line-soft"
          style={{ background: "var(--color-paper)", border: "1px solid var(--color-line)", color: guardOk ? "var(--color-ink)" : "var(--color-ink-faint)", cursor: guardOk && !busy ? "pointer" : "not-allowed" }}
        >
          {busy === "auto" ? <LoaderCircle size={14} strokeWidth={2.2} className="tv-anim-spin" /> : latest?.status === "rejected" ? <RotateCcw size={14} strokeWidth={2.2} /> : <Check size={14} strokeWidth={2.2} />}
          Approva subito
        </button>
      ) : null}

      {error ? (
        <p role="alert" className="text-[12px] leading-[1.45]" style={{ color: "var(--color-danger)" }}>
          {error}
        </p>
      ) : null}
    </section>
  );
}

