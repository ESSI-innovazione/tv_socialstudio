"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Frame, LoaderCircle, RefreshCw } from "lucide-react";
import type { Template } from "@/lib/types";

interface Props {
  templates: Template[];
  /** L'ultima sincronizzazione, dal server. */
  lastSyncedAt: string | null;
  configured: boolean;
}

function when(iso: string | null): string {
  if (!iso) return "mai";
  return new Date(iso).toLocaleString("it-IT", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

/**
 * Il pulsante che rilegge la libreria Figma. L'esito si legge qui, sotto al
 * pulsante, in italiano: quanti template nuovi, quanti aggiornati, oppure
 * quale template ha un problema e quale.
 */
export function FigmaSync({ templates, lastSyncedAt, configured }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  const sync = async () => {
    setBusy(true);
    setResult(null);
    try {
      const res = await fetch("/api/templates/sync", { method: "POST" });
      const data = (await res.json().catch(() => ({}))) as { added?: number; updated?: number; at?: string; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Sincronizzazione non riuscita.");
      setResult({ ok: true, text: `Libreria letta: ${data.added ?? 0} ${data.added === 1 ? "template nuovo" : "template nuovi"}, ${data.updated ?? 0} ${data.updated === 1 ? "aggiornato" : "aggiornati"}.` });
      router.refresh();
    } catch (e) {
      setResult({ ok: false, text: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="tv-card flex flex-col gap-4 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-[16px] font-semibold" style={{ color: "var(--color-ink)" }}>
            <Frame size={17} strokeWidth={1.9} style={{ color: "var(--color-wine)" }} />
            Template da Figma
          </h2>
          <p className="mt-0.5 text-[12.5px]" style={{ color: "var(--color-ink-soft)" }}>
            I template nascono in Figma, nelle pagine «TPL/…» (vedi TEMPLATES.md). Lo Studio li legge solo quando glielo chiedi.
          </p>
        </div>
        <button
          type="button"
          onClick={sync}
          disabled={busy}
          className="tv-pill h-[38px] gap-2 px-4 text-[13px]"
          style={{ background: "var(--color-wine)", color: "#ffffff", cursor: busy ? "wait" : "pointer" }}
        >
          {busy ? <LoaderCircle size={14} strokeWidth={2.2} className="tv-anim-spin" /> : <RefreshCw size={14} strokeWidth={2.2} />}
          Aggiorna template da Figma
        </button>
      </div>

      <dl className="flex flex-wrap gap-x-8 gap-y-1 text-[13px]" style={{ color: "var(--color-ink-soft)" }}>
        <div className="flex gap-2">
          <dt style={{ color: "var(--color-ink-faint)" }}>Ultimo sync</dt>
          <dd suppressHydrationWarning>{when(lastSyncedAt)}</dd>
        </div>
        <div className="flex gap-2">
          <dt style={{ color: "var(--color-ink-faint)" }}>Template</dt>
          <dd>{templates.length}</dd>
        </div>
        <div className="flex gap-2">
          <dt style={{ color: "var(--color-ink-faint)" }}>Figma</dt>
          <dd style={{ color: configured ? "var(--color-success)" : "var(--color-warning)" }}>{configured ? "collegato" : "non collegato: mancano FIGMA_TOKEN o FIGMA_FILE_KEY"}</dd>
        </div>
      </dl>

      {result ? (
        <p className="rounded-[10px] px-3 py-2.5 text-[13px] leading-[1.5]" style={{ background: result.ok ? "var(--color-success-bg)" : "var(--color-warm-tint)", color: result.ok ? "var(--color-success)" : "var(--color-warning)" }}>
          {result.text}
        </p>
      ) : null}

      {templates.length > 0 ? (
        <ul className="flex flex-wrap gap-1.5">
          {templates.map((t) => (
            <li key={t.id} className="tv-pill h-[28px] gap-2 px-3 text-[12px]" style={{ background: "var(--color-line-soft)", color: "var(--color-ink)", fontWeight: 500 }}>
              {t.name}
              <span style={{ color: "var(--color-ink-faint)" }}>{t.formats.length} formati</span>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
