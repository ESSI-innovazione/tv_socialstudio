"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronDown, LoaderCircle, Lock } from "lucide-react";
import { FORMATS, FORMAT_ORDER, type FormatId } from "@/lib/brand";
import type { Tool } from "@/lib/types";
import { toolIcon } from "./tool-icons";

interface Props {
  tools: Tool[];
}

/**
 * Gli strumenti salvati, uno alla volta: titolo, descrizione, istruzione con
 * i segnaposto {{campo}}, formati di partenza. Si salva per strumento, e il
 * server rifiuta un'istruzione vuota o un formato sconosciuto.
 */
export function ToolsAdmin({ tools }: Props) {
  const [open, setOpen] = useState<string | null>(null);

  return (
    <section className="tv-card flex flex-col gap-4 p-5">
      <div>
        <h2 className="text-[16px] font-semibold" style={{ color: "var(--color-ink)" }}>
          Strumenti salvati
        </h2>
        <p className="mt-0.5 text-[12.5px]" style={{ color: "var(--color-ink-soft)" }}>
          L&apos;istruzione e&apos; il canovaccio che il team vede quando sceglie lo strumento. I segnaposto fra doppie graffe, come{" "}
          <span className="tv-mono" style={{ color: "var(--color-rose)" }}>{"{{scadenza}}"}</span>, restano da compilare.
        </p>
      </div>

      <ul className="flex flex-col gap-2">
        {tools.map((tool) => (
          <ToolRow key={tool.id} tool={tool} open={open === tool.id} onToggle={() => setOpen(open === tool.id ? null : tool.id)} />
        ))}
      </ul>
    </section>
  );
}

function ToolRow({ tool, open, onToggle }: { tool: Tool; open: boolean; onToggle: () => void }) {
  const router = useRouter();
  const Icon = toolIcon(tool.slug);
  const [title, setTitle] = useState(tool.title);
  const [description, setDescription] = useState(tool.description);
  const [prompt, setPrompt] = useState(tool.prompt_template);
  const [formats, setFormats] = useState<FormatId[]>(tool.default_formats);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  const dirty = title !== tool.title || description !== tool.description || prompt !== tool.prompt_template || formats.join() !== tool.default_formats.join();

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/tools/${tool.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, description, prompt_template: prompt, default_formats: formats }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Salvataggio non riuscito.");
      setSavedAt(new Date().toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" }));
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <li className="rounded-card" style={{ border: `1px solid ${open ? "var(--color-rose)" : "var(--color-line)"}` }}>
      <button type="button" onClick={onToggle} aria-expanded={open} disabled={tool.automatic} className="flex w-full items-center gap-3.5 px-4 py-3 text-left" style={{ cursor: tool.automatic ? "default" : "pointer" }}>
        <span className="flex h-[36px] w-[36px] shrink-0 items-center justify-center rounded-[10px]" style={{ background: "var(--color-wine-tint)", color: "var(--color-wine)" }}>
          <Icon size={17} strokeWidth={1.9} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2 text-[14px] font-semibold" style={{ color: "var(--color-ink)" }}>
            {tool.title}
            <span className="tv-mono text-[11.5px] font-normal" style={{ color: "var(--color-rose)" }}>
              {tool.slug}
            </span>
          </span>
          <span className="block truncate text-[12.5px]" style={{ color: "var(--color-ink-soft)" }}>
            {tool.description}
          </span>
        </span>
        <span className="shrink-0 text-[12px]" style={{ color: "var(--color-ink-faint)" }}>
          {tool.automatic ? tool.note : `${tool.run_count} esecuzioni`}
        </span>
        {tool.automatic ? (
          <Lock size={15} strokeWidth={2} style={{ color: "var(--color-ink-faint)" }} />
        ) : (
          <ChevronDown size={16} strokeWidth={2.2} className="transition-transform" style={{ color: "var(--color-ink-faint)", transform: open ? "rotate(180deg)" : "none" }} />
        )}
      </button>

      {open && !tool.automatic ? (
        <div className="tv-anim-rise flex flex-col gap-3 px-4 pb-4">
          <div className="grid gap-3 md:grid-cols-2">
            <label className="flex flex-col gap-1">
              <span className="tv-label">TITOLO</span>
              <input value={title} onChange={(e) => setTitle(e.target.value)} className={field} style={fieldStyle} />
            </label>
            <label className="flex flex-col gap-1">
              <span className="tv-label">DESCRIZIONE</span>
              <input value={description} onChange={(e) => setDescription(e.target.value)} className={field} style={fieldStyle} />
            </label>
          </div>
          <label className="flex flex-col gap-1">
            <span className="tv-label">ISTRUZIONE</span>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={4}
              spellCheck={false}
              className="tv-scroll w-full resize-y rounded-[10px] px-3 py-2.5 text-[13.5px] leading-[1.55] outline-none focus:shadow-focus"
              style={fieldStyle}
            />
          </label>
          <div>
            <p className="tv-label pb-2">FORMATI DI PARTENZA</p>
            <div className="flex flex-wrap gap-1.5">
              {FORMAT_ORDER.map((id) => {
                const on = formats.includes(id);
                return (
                  <button
                    key={id}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setFormats((prev) => (on ? prev.filter((f) => f !== id) : [...prev, id]))}
                    className="tv-pill h-[34px] cursor-pointer gap-1.5 px-3.5 text-[12.5px] transition-colors"
                    style={{
                      background: on ? "var(--color-wine-tint)" : "var(--color-paper)",
                      border: `1px solid ${on ? "var(--color-rose)" : "var(--color-line)"}`,
                      color: on ? "var(--color-wine)" : "var(--color-ink-soft)",
                    }}
                  >
                    {on ? <Check size={13} strokeWidth={2.6} /> : null}
                    {FORMATS[id].label}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={save}
              disabled={!dirty || busy}
              className="tv-pill h-[38px] gap-2 px-4 text-[13px]"
              style={{ background: dirty ? "var(--color-wine)" : "var(--color-mute)", color: "#ffffff", cursor: dirty ? "pointer" : "not-allowed" }}
            >
              {busy ? <LoaderCircle size={14} strokeWidth={2.2} className="tv-anim-spin" /> : <Check size={14} strokeWidth={2.4} />}
              Salva lo strumento
            </button>
            {error ? (
              <span className="text-[12.5px]" style={{ color: "var(--color-warning)" }}>
                {error}
              </span>
            ) : savedAt ? (
              <span className="text-[12.5px]" style={{ color: "var(--color-success)" }}>
                Salvato alle {savedAt}. Il team lo vede alla prossima apertura.
              </span>
            ) : null}
          </div>
        </div>
      ) : null}
    </li>
  );
}

const field = "h-[38px] rounded-[10px] px-3 text-[13.5px] outline-none focus:shadow-focus";
const fieldStyle = { border: "1px solid var(--color-line)", background: "var(--color-paper)", color: "var(--color-ink)" } as const;
