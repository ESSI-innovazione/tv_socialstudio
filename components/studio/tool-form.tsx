"use client";

import { useEffect, useId, useMemo, useRef, useState, type DragEvent } from "react";
import Link from "next/link";
import { ChevronDown, FileText, ImageIcon, Link2, Minus, PencilRuler, Play, Plus, ShieldCheck, Upload, X } from "lucide-react";
import { FORMATS, FORMAT_ORDER, type FormatId } from "@/lib/brand";
import { archetypeFromLabel, templateLayout } from "@/lib/layout-model";
import { draftCopy, fillTemplate, missingRequired, splitTemplate, type ToolField } from "@/lib/tool-fields";
import type { Attachment, Template, Tool, VariantCopy } from "@/lib/types";
import type { ImageChoice, ImagePurpose } from "@/lib/integrations/types";
import { AssetPreview } from "./asset-preview";
import { ImagePicker } from "./image-picker";
import { toolIcon } from "./tool-icons";
import { Card, FieldRow, inputClass, inputStyle } from "./ui";

interface Props {
  tool: Tool;
  campaignName: string;
  /** Valori gia' noti, dall'indirizzo: la scadenza di un bando dalla home, per esempio. */
  prefill: Record<string, string>;
  templates: Template[];
  templateId: string | null;
  onTemplate: (id: string) => void;
  formats: FormatId[];
  onToggleFormat: (f: FormatId) => void;
  variantCount: number;
  onVariantCount: (n: number) => void;
  attachments: Attachment[];
  onAttachments: (next: Attachment[]) => void;
  imageId: string | null;
  imageUrl: string | null;
  onImage: (choice: ImageChoice | null) => void;
  canEditTool: boolean;
  /** Avvia l'esecuzione con l'istruzione gia' composta. */
  onRun: (instruction: string) => void;
}

/** Larghezza dell'anteprima dal vivo, per formato. */
const PREVIEW_WIDTH: Record<FormatId, number> = { linkedin: 330, "ig-feed": 250, "poster-a4": 210, "ig-story": 160 };

/**
 * Il modulo guidato di uno strumento: le domande, le fonti, la foto, e a
 * destra il poster che prende forma mentre si risponde. L'istruzione la
 * compone lo Studio con fillTemplate: nessuno vede un prompt da compilare.
 */
export function ToolForm({
  tool,
  campaignName,
  prefill,
  templates,
  templateId,
  onTemplate,
  formats,
  onToggleFormat,
  variantCount,
  onVariantCount,
  attachments,
  onAttachments,
  imageId,
  imageUrl,
  onImage,
  canEditTool,
  onRun,
}: Props) {
  const [values, setValues] = useState<Record<string, string>>(() => {
    const out: Record<string, string> = {};
    for (const f of tool.fields) if (prefill[f.key]) out[f.key] = prefill[f.key];
    return out;
  });
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [showPrompt, setShowPrompt] = useState(false);
  const Icon = toolIcon(tool.slug);

  const set = (key: string, value: string) => setValues((prev) => ({ ...prev, [key]: value }));
  const missing = missingRequired(tool, values);
  const firstFormat = formats[0] ?? tool.default_formats[0] ?? "linkedin";

  const hint = missing.length > 0
    ? `Manca ${missing[0].label.toLowerCase()}`
    : formats.length === 0
      ? "Scegli almeno un formato"
      : `${variantCount} ${variantCount === 1 ? "variante" : "varianti"} in ${formats.length} ${formats.length === 1 ? "formato" : "formati"} · il controllo del brand e' automatico`;
  const ready = missing.length === 0 && formats.length > 0;

  const draft = useMemo<VariantCopy>(() => ({ index: 0, layout: "dato dominante", ...draftCopy(tool, values, campaignName) }), [tool, values, campaignName]);
  const template = templates.find((t) => t.id === templateId) ?? templates[0] ?? null;

  const run = () => {
    if (!ready) {
      // Si mostrano i mancanti, e il primo riceve il fuoco.
      setTouched(Object.fromEntries(tool.fields.map((f) => [f.key, true])));
      document.getElementById(`field-${missing[0]?.key}`)?.focus();
      return;
    }
    onRun(fillTemplate(tool, values));
  };

  return (
    <div className="mx-auto w-full max-w-[1180px] px-4 pt-6 md:px-8 md:pt-7">
      <header className="flex flex-wrap items-start justify-between gap-4 pb-5">
        <div className="flex min-w-0 items-start gap-4">
          <span className="flex h-[48px] w-[48px] shrink-0 items-center justify-center rounded-[14px]" style={{ background: "var(--color-wine)", color: "#ffffff" }}>
            <Icon size={22} strokeWidth={1.9} />
          </span>
          <div className="min-w-0">
            <nav aria-label="Percorso" className="flex items-center gap-1 text-[12.5px] font-semibold">
              <Link href="/studio" style={{ color: "var(--color-rose-ink)" }}>
                Strumenti
              </Link>
              <span style={{ color: "var(--color-ink-faint)" }}>/</span>
              <span style={{ color: "var(--color-ink-faint)" }}>{tool.title}</span>
            </nav>
            <h1 className="mt-0.5 text-[22px] font-semibold tracking-[-0.01em]" style={{ color: "var(--color-ink)" }}>
              {tool.title}
            </h1>
            <p className="mt-0.5 text-[13.5px]" style={{ color: "var(--color-ink-soft)" }}>
              {tool.description}
            </p>
          </div>
        </div>
        {canEditTool ? (
          <Link href={`/studio/admin/strumenti/${tool.slug}`} className="tv-pill h-[40px] gap-2 px-4 text-[13px] transition-colors hover:bg-line-soft" style={{ border: "1px solid var(--color-line)", color: "var(--color-ink)" }}>
            <PencilRuler size={14} strokeWidth={2} />
            Modifica lo strumento
          </Link>
        ) : null}
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="flex min-w-0 flex-col gap-4">
          {/* ---------------- 1 · le domande ---------------- */}
          <NumberedCard number={1} title={tool.category === "stampa" ? "Il bando" : "Di cosa parliamo"}>
            <div className="grid gap-4 md:grid-cols-2">
              {tool.fields.map((field) => (
                <FieldInput
                  key={field.key}
                  field={field}
                  value={values[field.key] ?? ""}
                  onChange={(v) => set(field.key, v)}
                  onBlur={() => setTouched((t) => ({ ...t, [field.key]: true }))}
                  error={touched[field.key] && field.required && !(values[field.key] ?? "").trim() ? `Manca ${field.label.toLowerCase()}.` : null}
                  wide={field.type === "longtext"}
                />
              ))}
            </div>
          </NumberedCard>

          {/* ---------------- 2 · le fonti ---------------- */}
          <NumberedCard number={2} title="Le fonti" hint="Cifre e date vengono solo da qui. Quello che manca resta [DA VERIFICARE], mai inventato.">
            <Sources attachments={attachments} onChange={onAttachments} />
          </NumberedCard>

          {/* ---------------- 3 · la foto ---------------- */}
          <NumberedCard number={3} title="La foto">
            <ImagePicker selectedId={imageId} selectedUrl={imageUrl} onSelect={onImage} purpose={firstFormat as ImagePurpose} compact />
          </NumberedCard>

          <details className="tv-card group" style={{ padding: 0 }}>
            <summary className="flex min-h-[52px] cursor-pointer list-none items-center justify-between gap-3 px-5 text-[14px] font-semibold" style={{ color: "var(--color-ink)" }}>
              <span>
                Opzioni avanzate
                <span className="ml-2 text-[12.5px] font-normal" style={{ color: "var(--color-ink-faint)" }}>
                  {template?.name ?? "template di default"} · {formats.map((f) => FORMATS[f].label).join(", ") || "nessun formato"}
                </span>
              </span>
              <ChevronDown size={16} strokeWidth={2} className="transition-transform group-open:rotate-180" style={{ color: "var(--color-ink-faint)" }} />
            </summary>
            <div className="flex flex-col gap-5 px-5 pb-5">
              <div>
                <p className="tv-label pb-2">FORMATI</p>
                <div className="flex flex-wrap gap-2">
                  {FORMAT_ORDER.map((id) => {
                    const on = formats.includes(id);
                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() => onToggleFormat(id)}
                        aria-pressed={on}
                        className="tv-pill h-[40px] cursor-pointer gap-2 px-4 text-[13px]"
                        style={{ background: on ? "var(--color-wine-tint)" : "var(--color-paper)", border: `1px solid ${on ? "var(--color-rose)" : "var(--color-line)"}`, color: on ? "var(--color-wine)" : "var(--color-ink-soft)" }}
                      >
                        {FORMATS[id].label}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <p className="tv-label pb-2">TEMPLATE</p>
                <div className="flex flex-wrap gap-1.5">
                  {templates.map((t) => {
                    const on = t.id === template?.id;
                    return (
                      <button key={t.id} type="button" onClick={() => onTemplate(t.id)} aria-pressed={on} className="tv-pill h-[36px] cursor-pointer px-3.5 text-[13px]" style={{ background: on ? "var(--color-wine)" : "var(--color-line-soft)", color: on ? "#ffffff" : "var(--color-ink-soft)" }}>
                        {t.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </details>

          {/* ---------------- la barra di avvio ---------------- */}
          <div
            className="sticky bottom-0 z-20 -mx-4 mt-2 flex flex-wrap items-center justify-between gap-3 px-4 py-3.5 md:-mx-8 md:px-8"
            style={{ background: "var(--color-night-glass)", color: "#ffffff" }}
          >
            <p className="flex min-w-0 items-center gap-2 text-[13px]" style={{ color: ready ? "var(--color-on-wine)" : "#ffffff" }}>
              <ShieldCheck size={15} strokeWidth={2} className="shrink-0" style={{ color: ready ? "var(--color-apricot)" : "var(--color-on-wine)" }} />
              <span className="truncate">{ready ? "Il brand-guard controlla ogni asset prima dell'approvazione." : hint}</span>
            </p>
            <div className="flex items-center gap-3">
              <span className="tv-pill h-[44px] gap-0.5 px-1.5 text-[13px]" style={{ background: "rgba(255,255,255,.10)", color: "#ffffff" }}>
                <StepButton label="Meno varianti" onClick={() => onVariantCount(Math.max(1, variantCount - 1))}>
                  <Minus size={14} strokeWidth={2.2} />
                </StepButton>
                <span className="w-[86px] text-center tabular-nums">
                  {variantCount} {variantCount === 1 ? "variante" : "varianti"}
                </span>
                <StepButton label="Piu' varianti" onClick={() => onVariantCount(Math.min(4, variantCount + 1))}>
                  <Plus size={14} strokeWidth={2.2} />
                </StepButton>
              </span>
              <button
                type="button"
                onClick={run}
                aria-disabled={!ready}
                className="tv-pill h-[48px] cursor-pointer gap-2.5 px-6 text-[14.5px] transition-[filter]"
                style={{ background: ready ? "var(--color-coral)" : "rgba(255,255,255,.18)", color: ready ? "var(--color-ink)" : "var(--color-on-wine)", boxShadow: ready ? "var(--shadow-coral)" : "none" }}
                title={ready ? undefined : hint}
              >
                <Play size={16} strokeWidth={2.4} fill="currentColor" />
                {tool.cta_label ?? "Crea gli asset"}
              </button>
            </div>
          </div>
        </div>

        {/* ---------------- la colonna di destra ---------------- */}
        <aside className="flex flex-col gap-4 lg:sticky lg:top-6 lg:self-start" aria-label="Anteprima">
          <Card>
            <p className="tv-label pb-3">ANTEPRIMA DAL VIVO</p>
            <div className="flex justify-center rounded-[12px] py-4" style={{ background: "var(--color-line-soft)" }}>
              <AssetPreview
                variant={draft}
                format={firstFormat}
                photo={imageUrl ?? undefined}
                displayWidth={PREVIEW_WIDTH[firstFormat]}
                layout={templateLayout(firstFormat, archetypeFromLabel(draft.layout), { eyebrow: draft.eyebrow, headline: draft.headline, subhead: draft.subhead, body: draft.body, badge: draft.badge, disclaimer: draft.disclaimer })}
                archetype={archetypeFromLabel(draft.layout)}
              />
            </div>
            <p className="pt-2.5 text-[12px] leading-[1.45]" style={{ color: "var(--color-ink-faint)" }}>
              Un&apos;idea di come verra&apos;: il copy definitivo lo scrive lo Studio dalle fonti.
            </p>
          </Card>

          <Card>
            <p className="tv-label pb-3">COSA OTTERRAI</p>
            <ul className="flex flex-col gap-2 text-[13px]" style={{ color: "var(--color-ink)" }}>
              {formats.map((f) => (
                <li key={f} className="flex items-center justify-between gap-2">
                  <span className="font-semibold">{FORMATS[f].label}</span>
                  <span style={{ color: "var(--color-ink-faint)" }}>{FORMATS[f].exportNote}</span>
                </li>
              ))}
              <li className="flex items-center justify-between gap-2">
                <span className="font-semibold">Varianti</span>
                <span style={{ color: "var(--color-ink-faint)" }}>{variantCount}</span>
              </li>
              <li className="flex items-center justify-between gap-2">
                <span className="font-semibold">Controllo del brand</span>
                <span style={{ color: "var(--color-success)" }}>automatico</span>
              </li>
            </ul>
          </Card>

          <Card flush>
            <button
              type="button"
              onClick={() => setShowPrompt((v) => !v)}
              aria-expanded={showPrompt}
              className="flex min-h-[48px] w-full cursor-pointer items-center justify-between gap-2 px-5 text-left text-[13px] font-semibold"
              style={{ color: "var(--color-ink)" }}
            >
              Vedi l&apos;istruzione che verra&apos; usata
              <ChevronDown size={15} strokeWidth={2} className="transition-transform" style={{ transform: showPrompt ? "rotate(180deg)" : "none", color: "var(--color-ink-faint)" }} />
            </button>
            {showPrompt ? (
              <p className="tv-anim-rise px-5 pb-5 text-[13px] leading-[1.7]" style={{ color: "var(--color-ink-soft)" }}>
                {splitTemplate(tool, values).map((part, i) =>
                  part.kind === "text" ? (
                    <span key={i}>{part.text}</span>
                  ) : (
                    <mark
                      key={i}
                      className="rounded-[6px] px-1.5 py-0.5 font-semibold"
                      style={{
                        background: part.value ? "var(--color-wine-tint)" : "var(--color-warm-tint)",
                        color: part.value ? "var(--color-wine)" : "var(--color-warning)",
                      }}
                    >
                      {part.value ?? `{{${part.field?.label.toLowerCase() ?? part.key}}}`}
                    </mark>
                  ),
                )}
              </p>
            ) : null}
          </Card>
        </aside>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function NumberedCard({ number, title, hint, children }: { number: number; title: string; hint?: string; children: React.ReactNode }) {
  const id = `tool-step-${number}`;
  return (
    <Card as="section" size="lg" aria-labelledby={id}>
      <div className="flex items-start gap-3.5 pb-4">
        <span className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full text-[13px] font-bold tabular-nums" style={{ background: "var(--color-wine)", color: "#ffffff" }} aria-hidden>
          {number}
        </span>
        <div>
          <h2 id={id} className="text-[17px] font-semibold" style={{ color: "var(--color-ink)" }}>
            {title}
          </h2>
          {hint ? (
            <p className="mt-0.5 text-[12.5px]" style={{ color: "var(--color-ink-faint)" }}>
              {hint}
            </p>
          ) : null}
        </div>
      </div>
      {children}
    </Card>
  );
}

/** Un campo del modulo, nel controllo giusto per il suo tipo. */
function FieldInput({ field, value, onChange, onBlur, error, wide }: { field: ToolField; value: string; onChange: (v: string) => void; onBlur: () => void; error: string | null; wide: boolean }) {
  const id = `field-${field.key}`;
  const listId = `${id}-options`;
  const help = field.example ? `Per esempio: ${field.example.split("\n")[0]}` : undefined;

  const control = (() => {
    switch (field.type) {
      case "longtext":
        return <textarea id={id} value={value} onChange={(e) => onChange(e.target.value)} onBlur={onBlur} rows={4} placeholder={field.example} className={`tv-scroll ${inputClass} resize-y py-3 leading-[1.5]`} style={inputStyle} aria-required={field.required} aria-invalid={Boolean(error)} />;
      case "date":
        return <input id={id} type="date" value={value} onChange={(e) => onChange(e.target.value)} onBlur={onBlur} className={inputClass} style={inputStyle} aria-required={field.required} aria-invalid={Boolean(error)} />;
      case "datetime":
        return <input id={id} type="datetime-local" value={value} onChange={(e) => onChange(e.target.value)} onBlur={onBlur} className={inputClass} style={inputStyle} aria-required={field.required} aria-invalid={Boolean(error)} />;
      case "choice":
        return (
          <select id={id} value={value} onChange={(e) => onChange(e.target.value)} onBlur={onBlur} className={`${inputClass} cursor-pointer`} style={inputStyle} aria-required={field.required} aria-invalid={Boolean(error)}>
            <option value="">Scegli…</option>
            {(field.options ?? []).map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        );
      case "choice_link":
        return <ChoiceLink id={id} listId={listId} field={field} value={value} onChange={onChange} onBlur={onBlur} invalid={Boolean(error)} />;
      default:
        return <input id={id} value={value} onChange={(e) => onChange(e.target.value)} onBlur={onBlur} placeholder={field.example} className={inputClass} style={inputStyle} aria-required={field.required} aria-invalid={Boolean(error)} />;
    }
  })();

  return (
    <FieldRow htmlFor={id} label={field.label} required={field.required} help={help} error={error} className={wide ? "md:col-span-2" : ""}>
      {control}
    </FieldRow>
  );
}

/**
 * Una scelta con link: il testo del pulsante fra le opzioni (o uno nuovo)
 * e l'indirizzo a cui porta. Nel prompt entrano insieme, «Scopri il
 * voucher → https://…», cosi' il copy sa dove manda.
 */
function ChoiceLink({ id, listId, field, value, onChange, onBlur, invalid }: { id: string; listId: string; field: ToolField; value: string; onChange: (v: string) => void; onBlur: () => void; invalid: boolean }) {
  const [label, url] = value.includes(" → ") ? value.split(" → ") : [value, ""];
  const compose = (l: string, u: string) => onChange(u.trim() ? `${l} → ${u.trim()}` : l);
  return (
    <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <input id={id} list={listId} value={label} onChange={(e) => compose(e.target.value, url)} onBlur={onBlur} placeholder={field.example} className={inputClass} style={inputStyle} aria-required={field.required} aria-invalid={invalid} />
      <datalist id={listId}>
        {(field.options ?? []).map((o) => (
          <option key={o} value={o} />
        ))}
      </datalist>
      <input value={url} onChange={(e) => compose(label, e.target.value)} placeholder="https://timevision.it/…" aria-label={`Indirizzo per ${field.label}`} inputMode="url" className={inputClass} style={inputStyle} />
    </div>
  );
}

function StepButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} aria-label={label} className="flex h-[36px] w-[36px] cursor-pointer items-center justify-center rounded-full transition-colors hover:bg-[rgba(255,255,255,.12)]" style={{ color: "#ffffff" }}>
      {children}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Le fonti                                                             */
/* ------------------------------------------------------------------ */

/** Com'e' stata letta una fonte, per dirlo accanto al nome. */
function parseStatus(a: Attachment): { text: string; tone: "ok" | "warn" | "neutral" } {
  if (a.kind === "link") return { text: "link", tone: "neutral" };
  if (a.kind === "photo") return { text: "foto", tone: "neutral" };
  if (a.content && a.content.trim().length > 0) return { text: `letto · ${a.content.length.toLocaleString("it-IT")} caratteri`, tone: "ok" };
  return { text: "testo non estratto: le cifre resteranno [DA VERIFICARE]", tone: "warn" };
}

function Sources({ attachments, onChange }: { attachments: Attachment[]; onChange: (next: Attachment[]) => void }) {
  const [over, setOver] = useState(false);
  const [link, setLink] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const linkId = useId();

  useEffect(() => {
    if (!note) return;
    const t = setTimeout(() => setNote(null), 6000);
    return () => clearTimeout(t);
  }, [note]);

  const addFiles = async (files: FileList | File[]) => {
    const added: Attachment[] = [];
    for (const file of Array.from(files)) {
      const name = file.name;
      const isText = /\.(txt|md|csv)$/i.test(name) || file.type.startsWith("text/");
      if (isText) {
        const content = await file.text();
        added.push({ kind: "document", label: name, content });
      } else if (/\.pdf$/i.test(name) || file.type === "application/pdf") {
        // Il PDF si allega, ma il testo non viene ancora estratto in
        // locale: meglio dirlo che fingere che le cifre siano al sicuro.
        added.push({ kind: "document", label: name });
      } else {
        setNote(`${name}: si accettano PDF e file di testo.`);
      }
    }
    if (added.length > 0) onChange([...attachments.filter((a) => !added.some((b) => b.label === a.label)), ...added]);
  };

  const addLink = () => {
    const raw = link.trim();
    if (!raw) return;
    const url = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    try {
      const parsed = new URL(url);
      onChange([...attachments.filter((a) => a.label !== parsed.host + parsed.pathname), { kind: "link", label: (parsed.host + parsed.pathname).replace(/\/$/, ""), url }]);
      setLink("");
    } catch {
      setNote("Non sembra un indirizzo valido.");
    }
  };

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setOver(false);
    if (e.dataTransfer.files.length > 0) void addFiles(e.dataTransfer.files);
  };

  return (
    <div className="flex flex-col gap-3">
      {attachments.length > 0 ? (
        <ul className="flex flex-col gap-1.5">
          {attachments.map((a) => {
            const status = parseStatus(a);
            const I = a.kind === "document" ? FileText : a.kind === "link" ? Link2 : ImageIcon;
            return (
              <li key={`${a.kind}-${a.label}`} className="flex min-h-[44px] items-center gap-3 rounded-[10px] px-3 py-2 text-[13px]" style={{ background: "var(--color-line-soft)" }}>
                <I size={15} strokeWidth={1.9} className="shrink-0" style={{ color: "var(--color-rose-ink)" }} />
                <span className="min-w-0 flex-1 truncate font-semibold" style={{ color: "var(--color-ink)" }}>
                  {a.label}
                </span>
                <span className="truncate text-[12px]" style={{ color: status.tone === "ok" ? "var(--color-success)" : status.tone === "warn" ? "var(--color-warning)" : "var(--color-ink-faint)" }}>
                  {status.text}
                </span>
                <button type="button" onClick={() => onChange(attachments.filter((x) => x !== a))} aria-label={`Togli ${a.label}`} className="flex h-[32px] w-[32px] shrink-0 cursor-pointer items-center justify-center rounded-full hover:bg-paper" style={{ color: "var(--color-ink-faint)" }}>
                  <X size={14} strokeWidth={2.2} />
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={onDrop}
        className="flex flex-col items-center justify-center gap-2 rounded-card px-4 py-5 text-center transition-colors"
        style={{ border: `1.5px dashed ${over ? "var(--color-rose)" : "var(--color-line)"}`, background: over ? "var(--color-wine-tint)" : "transparent" }}
      >
        <Upload size={18} strokeWidth={1.9} style={{ color: "var(--color-ink-faint)" }} aria-hidden />
        <p className="text-[13px]" style={{ color: "var(--color-ink-soft)" }}>
          Trascina qui un PDF o un file di testo, oppure{" "}
          <button type="button" onClick={() => fileInput.current?.click()} className="cursor-pointer font-semibold underline-offset-2 hover:underline" style={{ color: "var(--color-rose-ink)" }}>
            scegli un file
          </button>
        </p>
        <input ref={fileInput} type="file" accept=".pdf,.txt,.md,.csv,application/pdf,text/plain,text/markdown" multiple className="sr-only" onChange={(e) => e.target.files && addFiles(e.target.files)} aria-label="Allega un file" />
      </div>

      <div className="flex gap-2">
        <label htmlFor={linkId} className="sr-only">
          Aggiungi un link
        </label>
        <input id={linkId} value={link} onChange={(e) => setLink(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addLink()} placeholder="Oppure incolla un link: timevision.it/voucher-cloud" inputMode="url" className={inputClass} style={inputStyle} />
        <button type="button" onClick={addLink} disabled={!link.trim()} className="tv-pill h-[44px] shrink-0 gap-1.5 px-4 text-[13px]" style={{ border: "1px solid var(--color-line)", color: link.trim() ? "var(--color-ink)" : "var(--color-ink-faint)", cursor: link.trim() ? "pointer" : "not-allowed" }}>
          <Plus size={14} strokeWidth={2.2} />
          Aggiungi
        </button>
      </div>

      {note ? (
        <p role="status" className="text-[12.5px]" style={{ color: "var(--color-warning)" }}>
          {note}
        </p>
      ) : null}
    </div>
  );
}
