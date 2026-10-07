"use client";

import { useState } from "react";
import { CircleAlert, Download, FileText, LoaderCircle } from "lucide-react";
import { encodeLayout, type AssetLayout } from "@/lib/layout-model";

interface Props {
  runId: string;
  variantIndex: number;
  variantCount: number;
  /** L'impaginazione ritoccata del poster, se c'e': viaggia nel link come per il PNG. */
  layout?: AssetLayout | null;
  /** Senza titolo, per quando sta gia' sotto un'intestazione. */
  compact?: boolean;
}

/**
 * Il PDF di stampa, con le sue tre opzioni. Lo stampa Chromium e ci mette
 * qualche secondo: il pulsante lo dice mentre aspetta, e se Chromium cade
 * l'errore si legge qui, in italiano, non in una scheda bianca.
 */
export function PdfDownload({ runId, variantIndex, variantCount, layout = null, compact = false }: Props) {
  const [bleed, setBleed] = useState(true);
  const [marks, setMarks] = useState(false);
  const [all, setAll] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const download = async () => {
    setBusy(true);
    setError(null);
    setDone(null);
    try {
      const query = new URLSearchParams();
      if (bleed) query.set("bleed", "1");
      if (marks) query.set("marks", "1");
      if (!all && layout) query.set("layout", encodeLayout(layout));
      const href = all ? `/api/render/${runId}/all/pdf?${query}` : `/api/render/${runId}/${variantIndex}/pdf?${query}`;
      const res = await fetch(href);
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? `Il PDF non e' uscito (${res.status}).`);
      }
      const name = /filename="([^"]+)"/.exec(res.headers.get("content-disposition") ?? "")?.[1] ?? `poster-v${variantIndex + 1}.pdf`;
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
      setDone(name);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-2.5">
      {!compact ? (
        <p className="flex items-center gap-2 text-[13.5px] font-semibold" style={{ color: "var(--color-ink)" }}>
          <FileText size={15} strokeWidth={1.9} style={{ color: "var(--color-wine)" }} />
          PDF per la stampa
          <span className="text-[11.5px] font-normal" style={{ color: "var(--color-ink-faint)" }}>
            A4 · 210 × 297 mm · testo vettoriale
          </span>
        </p>
      ) : null}
      <Option checked={bleed} onChange={setBleed} label="Abbondanza 3 mm" hint="il disegno continua oltre il taglio" />
      <Option checked={marks} onChange={setMarks} label="Segni di taglio" hint="per la tipografia" />
      {variantCount > 1 ? <Option checked={all} onChange={setAll} label="Tutte le varianti in un file" hint={`${variantCount} pagine`} /> : null}
      <button
        type="button"
        onClick={download}
        disabled={busy}
        aria-busy={busy}
        className="tv-pill h-[44px] w-full justify-center gap-2 text-[13.5px] transition-colors"
        style={{ background: "var(--color-wine)", color: "#ffffff", cursor: busy ? "wait" : "pointer" }}
      >
        {busy ? <LoaderCircle size={15} strokeWidth={2.2} className="tv-anim-spin" /> : <Download size={15} strokeWidth={2.2} />}
        {busy ? "Chromium sta stampando…" : all ? "Scarica il PDF con tutte le varianti" : `Scarica il PDF della variante ${variantIndex + 1}`}
      </button>
      {error ? (
        <p role="alert" className="flex items-start gap-1.5 rounded-[10px] px-3 py-2 text-[12.5px] leading-[1.45]" style={{ background: "var(--color-danger-bg)", color: "var(--color-danger)" }}>
          <CircleAlert size={14} strokeWidth={2.2} className="mt-[2px] shrink-0" />
          {error}
        </p>
      ) : done ? (
        <p role="status" className="text-[12px]" style={{ color: "var(--color-success)" }}>
          Scaricato {done}
        </p>
      ) : null}
    </div>
  );
}

function Option({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
  return (
    <label className="flex min-h-[32px] cursor-pointer items-center gap-2.5 text-[13px]" style={{ color: "var(--color-ink)" }}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4 accent-[#720026]" />
      {label}
      {hint ? (
        <span className="text-[11.5px]" style={{ color: "var(--color-ink-faint)" }}>
          {hint}
        </span>
      ) : null}
    </label>
  );
}
