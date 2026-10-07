"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";
import { FORMATS, type FormatId } from "@/lib/brand";
import type { Campaign } from "@/lib/types";

interface Props {
  campaigns: Campaign[];
  formats: FormatId[];
  authors: string[];
  query: { campaign?: string; format?: string; author?: string; from?: string; to?: string; q?: string };
}

/**
 * I filtri dell'archivio vivono nell'indirizzo: un filtro e' un link che si
 * puo' condividere, e la pagina si ricarica dal server con i dati giusti.
 */
export function ArchiveFilters({ campaigns, formats, authors, query }: Props) {
  const router = useRouter();
  const params = useSearchParams();

  const set = (key: string, value: string) => {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    router.replace(`/studio/archivio${next.toString() ? `?${next}` : ""}`);
  };

  const active = Object.values(query).some(Boolean);

  return (
    <div className="tv-card flex flex-wrap items-end gap-3 px-4 py-3.5">
      <label className="flex min-w-[220px] flex-1 flex-col gap-1">
        <span className="tv-label">CERCA NEL COPY</span>
        <span className="relative">
          <Search size={15} strokeWidth={2} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2" style={{ color: "var(--color-ink-faint)" }} />
          <input
            type="search"
            defaultValue={query.q ?? ""}
            onKeyDown={(e) => e.key === "Enter" && set("q", (e.target as HTMLInputElement).value)}
            onBlur={(e) => e.target.value !== (query.q ?? "") && set("q", e.target.value)}
            placeholder="titolo, testo, caption, campagna…"
            className={input + " pl-9"}
            style={inputStyle}
          />
        </span>
      </label>

      <Select label="CAMPAGNA" value={query.campaign ?? ""} onChange={(v) => set("campaign", v)}>
        <option value="">Tutte</option>
        {campaigns.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </Select>

      <Select label="FORMATO" value={query.format ?? ""} onChange={(v) => set("format", v)}>
        <option value="">Tutti</option>
        {formats.map((f) => (
          <option key={f} value={f}>
            {FORMATS[f].label}
          </option>
        ))}
      </Select>

      <Select label="AUTORE" value={query.author ?? ""} onChange={(v) => set("author", v)}>
        <option value="">Tutti</option>
        {authors.map((a) => (
          <option key={a} value={a}>
            {a}
          </option>
        ))}
      </Select>

      <label className="flex flex-col gap-1">
        <span className="tv-label">APPROVATO DAL</span>
        <input type="date" value={query.from ?? ""} onChange={(e) => set("from", e.target.value)} className={input} style={inputStyle} />
      </label>
      <label className="flex flex-col gap-1">
        <span className="tv-label">AL</span>
        <input type="date" value={query.to ?? ""} onChange={(e) => set("to", e.target.value)} className={input} style={inputStyle} />
      </label>

      {active ? (
        <button
          type="button"
          onClick={() => router.replace("/studio/archivio")}
          className="tv-pill h-[38px] cursor-pointer gap-1.5 px-3.5 text-[12.5px] transition-colors hover:bg-line-soft"
          style={{ border: "1px solid var(--color-line)", color: "var(--color-ink-soft)" }}
        >
          <X size={14} strokeWidth={2.2} />
          Azzera
        </button>
      ) : null}
    </div>
  );
}

const input = "h-[38px] rounded-[10px] px-3 text-[13px] outline-none focus:shadow-focus";
const inputStyle = { border: "1px solid var(--color-line)", background: "var(--color-paper)", color: "var(--color-ink)" } as const;

function Select({ label, value, onChange, children }: { label: string; value: string; onChange: (v: string) => void; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="tv-label">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className={input + " min-w-[140px] cursor-pointer"} style={inputStyle}>
        {children}
      </select>
    </label>
  );
}
