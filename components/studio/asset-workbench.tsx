"use client";

import { useEffect, useState } from "react";
import {
  ArrowLeft,
  Building2,
  Camera,
  Download,
  FileImage,
  FileText,
  Hash,
  Image as ImageIcon,
  Layers,
  Minus,
  Palette,
  Plus,
  Presentation,
  RotateCcw,
  Send,
  Share2,
  Type,
  Video,
} from "lucide-react";
import { BRAND, FORMATS, type FormatId } from "@/lib/brand";
import { DEFAULT_FONT, FONTS, FONT_IDS, fontFamilyFor } from "@/lib/fonts";
import {
  BLOCK_LABELS,
  encodeLayout,
  fontSizeOf,
  ladderFor,
  minStepOf,
  normalizeHex,
  updateBlock,
  type ArchetypeId,
  type AssetLayout,
  type Block,
  type BlockKind,
  type LayoutStyle,
} from "@/lib/layout-model";
import { defaultTextColor, groundOf } from "./asset-canvas";
import type { Caption, Run, VariantCopy } from "@/lib/types";
import type { StudioUser } from "@/auth";
import { AssetEditor } from "./asset-editor";
import { ImagePicker } from "./image-picker";
import { VideoExport } from "./video-export";

interface Props {
  run: Run;
  variant: VariantCopy;
  format: FormatId;
  onFormat: (f: FormatId) => void;
  layout: AssetLayout;
  /** Tutte le impaginazioni toccate, per chiave `variante:formato`: servono ai link di export. */
  layouts: Record<string, AssetLayout>;
  archetype: ArchetypeId;
  onLayoutChange: (layout: AssetLayout) => void;
  /** Carattere e fondo: valgono per tutti i formati della variante. */
  onStyleChange: (patch: Partial<LayoutStyle>) => void;
  /** Il colore di un testo, su tutti i formati. `undefined` torna al Brand Kit. */
  onColorChange: (kind: BlockKind, color: string | undefined) => void;
  onEdit: (patch: Partial<VariantCopy>) => void;
  onPhoto: (url: string) => void;
  user: StudioUser;
  channelsLive: boolean;
  onClose: () => void;
}

type Panel = "testo" | "foto" | "esporta" | "pubblica";
type FileType = "png" | "mp4" | "pdf" | "svg" | "pptx";

/** Larghezza della tela per formato: il landscape ha bisogno di respiro. */
const CANVAS_WIDTH: Record<FormatId, number> = {
  linkedin: 720,
  "ig-feed": 520,
  "poster-a4": 430,
  "ig-story": 330,
};

/**
 * L'editor a tutto schermo: la tela al centro, gli strumenti a sinistra, il
 * pannello a destra. Un solo posto per ritoccare, esportare e pubblicare.
 *
 * Quello che oggi parte davvero e' l'export PNG e il video MP4. PDF, SVG,
 * PPTX e i canali social sono al loro posto ma si dichiarano non ancora
 * attivi: un bottone che finge sarebbe peggio di un bottone che aspetta.
 *
 * Il pannello Testo e' anche quello dello stile: carattere, fondo, corpo e
 * colore di ogni testo. Il Brand Kit resta il punto di partenza — ogni
 * controllo ha un ritorno al brand — ma non e' piu' un lucchetto.
 */
export function AssetWorkbench({
  run,
  variant,
  format,
  onFormat,
  layout,
  layouts,
  archetype,
  onLayoutChange,
  onStyleChange,
  onColorChange,
  onEdit,
  onPhoto,
  user,
  channelsLive,
  onClose,
}: Props) {
  const [panel, setPanel] = useState<Panel>("testo");

  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [onClose]);

  const photo = run.brief?.photo ?? "tv-digitale.jpg";

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-canvas" role="dialog" aria-modal="true" aria-label="Editor dell'asset">
      {/* ---------------- barra ---------------- */}
      <header className="flex h-[56px] shrink-0 items-center gap-4 bg-paper px-4" style={{ borderBottom: "1px solid var(--color-line)" }}>
        <button
          type="button"
          onClick={onClose}
          className="tv-pill h-[36px] cursor-pointer gap-2 px-3.5 text-[13px] transition-colors hover:bg-line-soft"
          style={{ color: "var(--color-ink-soft)" }}
        >
          <ArrowLeft size={16} strokeWidth={2} />
          Risultati
        </button>
        <span className="h-6 w-px" style={{ background: "var(--color-line)" }} />
        <p className="min-w-0 truncate text-[14px]" style={{ color: "var(--color-ink)" }}>
          <span className="font-semibold">Variante {variant.index + 1}</span>
          <span style={{ color: "var(--color-ink-faint)" }}> · {variant.layout}</span>
        </p>

        <div className="mx-auto flex items-center gap-1.5">
          {run.formats.map((f) => {
            const on = f === format;
            return (
              <button
                key={f}
                type="button"
                onClick={() => onFormat(f)}
                aria-pressed={on}
                className="tv-pill h-[32px] cursor-pointer px-3.5 text-[12.5px] transition-colors"
                style={{ background: on ? "var(--color-wine)" : "var(--color-line-soft)", color: on ? "#ffffff" : "var(--color-ink-soft)" }}
              >
                {FORMATS[f].label}
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => setPanel("esporta")}
          className="tv-pill h-[36px] cursor-pointer gap-2 px-4 text-[13px] transition-colors hover:bg-line-soft"
          style={{ border: "1px solid var(--color-line)", color: "var(--color-ink)" }}
        >
          <Download size={15} strokeWidth={2} />
          Esporta
        </button>
        <button
          type="button"
          onClick={() => setPanel("pubblica")}
          className="tv-pill h-[36px] cursor-pointer gap-2 px-4 text-[13px]"
          style={{ background: "var(--color-coral)", color: "#ffffff", boxShadow: "var(--shadow-coral)" }}
        >
          <Send size={15} strokeWidth={2} />
          Pubblica
        </button>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* ---------------- strumenti ---------------- */}
        <nav className="flex w-[76px] shrink-0 flex-col items-center gap-1 bg-paper py-3" style={{ borderRight: "1px solid var(--color-line)" }} aria-label="Strumenti">
          <Tool icon={Type} label="Testo" on={panel === "testo"} onClick={() => setPanel("testo")} />
          <Tool icon={ImageIcon} label="Foto" on={panel === "foto"} onClick={() => setPanel("foto")} />
          <Tool icon={Layers} label="Livelli" on={false} onClick={() => document.getElementById("workbench-layers")?.scrollIntoView({ behavior: "smooth", block: "nearest" })} />
          <Tool
            icon={Palette}
            label="Colori"
            on={false}
            onClick={() => {
              setPanel("testo");
              window.setTimeout(() => document.getElementById("workbench-style")?.scrollIntoView({ behavior: "smooth", block: "start" }), 60);
            }}
          />
          <div className="flex-1" />
          <Tool icon={Download} label="Esporta" on={panel === "esporta"} onClick={() => setPanel("esporta")} />
          <Tool icon={Share2} label="Pubblica" on={panel === "pubblica"} onClick={() => setPanel("pubblica")} />
        </nav>

        {/* ---------------- tela ---------------- */}
        <main className="tv-scroll flex min-w-0 flex-1 items-start justify-center overflow-auto p-8">
          <div id="workbench-layers" className="tv-card p-5">
            <AssetEditor copy={variant} layout={layout} archetype={archetype} photo={photo} onChange={onLayoutChange} width={CANVAS_WIDTH[format]} />
          </div>
        </main>

        {/* ---------------- pannello ---------------- */}
        <aside className="tv-scroll flex w-[340px] shrink-0 flex-col gap-5 overflow-y-auto bg-paper p-5" style={{ borderLeft: "1px solid var(--color-line)" }}>
          {panel === "testo" ? (
            <TextPanel
              variant={variant}
              layout={layout}
              archetype={archetype}
              onEdit={onEdit}
              onLayoutChange={onLayoutChange}
              onStyleChange={onStyleChange}
              onColorChange={onColorChange}
            />
          ) : null}
          {panel === "foto" ? <PhotoPanel current={photo} format={format} onPhoto={onPhoto} /> : null}
          {panel === "esporta" ? <ExportPanel run={run} variant={variant} layouts={layouts} /> : null}
          {panel === "pubblica" ? <PublishPanel run={run} user={user} channelsLive={channelsLive} /> : null}
        </aside>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function Tool({ icon: Icon, label, on, onClick }: { icon: typeof Type; label: string; on: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      title={label}
      className="flex w-[64px] cursor-pointer flex-col items-center gap-1 rounded-[10px] py-2 text-[11px] font-semibold transition-colors hover:bg-line-soft"
      style={{ background: on ? "var(--color-wine-tint)" : "transparent", color: on ? "var(--color-wine)" : "var(--color-ink-soft)" }}
    >
      <Icon size={19} strokeWidth={1.9} />
      {label}
    </button>
  );
}

function PanelTitle({ children, hint }: { children: string; hint?: string }) {
  return (
    <div>
      <p className="tv-label">{children}</p>
      {hint ? (
        <p className="mt-1 text-[12.5px] leading-[1.5]" style={{ color: "var(--color-ink-faint)" }}>
          {hint}
        </p>
      ) : null}
    </div>
  );
}

/* ---------------- testo ---------------- */

function TextPanel({
  variant,
  layout,
  archetype,
  onEdit,
  onLayoutChange,
  onStyleChange,
  onColorChange,
}: {
  variant: VariantCopy;
  layout: AssetLayout;
  archetype: ArchetypeId;
  onEdit: (patch: Partial<VariantCopy>) => void;
  onLayoutChange: (layout: AssetLayout) => void;
  onStyleChange: (patch: Partial<LayoutStyle>) => void;
  onColorChange: (kind: BlockKind, color: string | undefined) => void;
}) {
  const ground = groundOf(archetype, layout.style);

  /** Corpo e colore del blocco di quel tipo, se l'impianto lo prevede. */
  const styleRow = (kind: BlockKind) => {
    const block = layout.blocks.find((b) => b.kind === kind);
    if (!block) return null;
    return (
      <StyleRow
        block={block}
        format={layout.format}
        fallback={defaultTextColor(kind, ground.onDark)}
        onStep={(step) => onLayoutChange(updateBlock(layout, block.id, { step }))}
        onColor={(color) => onColorChange(kind, color)}
      />
    );
  };

  return (
    <>
      <PanelTitle hint="Il testo, il carattere, il fondo e i colori valgono per tutti i formati della variante. Il corpo vale per questo formato.">
        TESTO
      </PanelTitle>
      <StyleSection layout={layout} archetype={archetype} onStyleChange={onStyleChange} />
      <Field label="Occhiello" value={variant.eyebrow} onChange={(eyebrow) => onEdit({ eyebrow })}>
        {styleRow("eyebrow")}
      </Field>
      <Field label="Titolo" value={variant.headline} size="lg" onChange={(headline) => onEdit({ headline })}>
        {styleRow("headline")}
      </Field>
      <Field label="Sottotitolo" value={variant.subhead} onChange={(subhead) => onEdit({ subhead })}>
        {styleRow("subhead")}
      </Field>
      <Field label="Testo" value={variant.body} multiline onChange={(body) => onEdit({ body })}>
        {styleRow("body")}
      </Field>
      <Field label="Banda" value={variant.badge ?? ""} onChange={(badge) => onEdit({ badge: badge || null })}>
        {styleRow("badge")}
      </Field>
      <Field label="Pulsante" value={variant.cta_label} onChange={(cta_label) => onEdit({ cta_label })}>
        {styleRow("cta")}
      </Field>
      <Field label="Disclaimer" value={variant.disclaimer ?? ""} multiline onChange={(disclaimer) => onEdit({ disclaimer: disclaimer || null })}>
        {styleRow("disclaimer")}
      </Field>
    </>
  );
}

/** Le tinte proposte per il fondo. Le prime sono del Brand Kit, le altre due sono le richieste piu' frequenti. */
const BACKGROUNDS: { hex: string; label: string }[] = [
  { hex: BRAND.wine, label: "Vino" },
  { hex: BRAND.ink, label: "Inchiostro" },
  { hex: BRAND.rose, label: "Rosa" },
  { hex: BRAND.coral, label: "Corallo" },
  { hex: "#1f4e9c", label: "Blu" },
  { hex: "#0f5c4a", label: "Verde" },
  { hex: BRAND.warmTint, label: "Crema" },
  { hex: BRAND.paper, label: "Bianco" },
];

/** Carattere e fondo: le due scelte che cambiano l'asset intero. */
function StyleSection({ layout, archetype, onStyleChange }: { layout: AssetLayout; archetype: ArchetypeId; onStyleChange: (patch: Partial<LayoutStyle>) => void }) {
  const font = layout.style?.font ?? DEFAULT_FONT;
  const brandGround = groundOf(archetype);
  const background = layout.style?.background;
  const shown = background ?? brandGround.bg;

  return (
    <section id="workbench-style" className="flex flex-col gap-3.5 rounded-[12px] p-3" style={{ background: "var(--color-line-soft)" }}>
      <div>
        <p className="tv-label">CARATTERE</p>
        <div className="mt-2 grid grid-cols-2 gap-1.5">
          {FONT_IDS.map((id) => {
            const on = id === font;
            const spec = FONTS[id];
            return (
              <button
                key={id}
                type="button"
                onClick={() => onStyleChange({ font: id === DEFAULT_FONT ? undefined : id })}
                aria-pressed={on}
                className="flex h-[40px] cursor-pointer flex-col items-start justify-center rounded-[9px] px-2.5 text-left transition-colors"
                style={{
                  background: on ? "var(--color-wine)" : "var(--color-paper)",
                  color: on ? "#ffffff" : "var(--color-ink)",
                  border: `1px solid ${on ? "var(--color-wine)" : "var(--color-line)"}`,
                  fontFamily: fontFamilyFor(id, "browser"),
                }}
              >
                <span className="text-[13.5px] leading-none font-semibold">{spec.label}</span>
                <span className="mt-1 text-[10px] leading-none" style={{ color: on ? "rgba(255,255,255,.72)" : "var(--color-ink-faint)" }}>
                  {spec.note}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <p className="tv-label">FONDO</p>
        <p className="mt-1 text-[11.5px] leading-[1.45]" style={{ color: "var(--color-ink-faint)" }}>
          Il Brand Kit propone il vino. Scegli una tinta, incolla un codice o apri il selettore.
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {BACKGROUNDS.map((b) => {
            const on = shown === b.hex;
            return (
              <button
                key={b.hex}
                type="button"
                title={b.label}
                aria-label={`Fondo ${b.label}`}
                aria-pressed={on}
                onClick={() => onStyleChange({ background: b.hex === brandGround.bg ? undefined : b.hex })}
                className="h-[24px] w-[24px] cursor-pointer rounded-full transition-transform hover:scale-110"
                style={{ background: b.hex, border: `2px solid ${on ? "var(--color-rose)" : "var(--color-line)"}`, boxShadow: "inset 0 0 0 1.5px #ffffff" }}
              />
            );
          })}
        </div>
        <div className="mt-2">
          <ColorControl label="Fondo" value={background} fallback={brandGround.bg} onChange={(hex) => onStyleChange({ background: hex })} />
        </div>
      </div>
    </section>
  );
}

/** Corpo a passi e colore, sotto al campo di testo a cui si riferiscono. */
function StyleRow({ block, format, fallback, onStep, onColor }: { block: Block; format: FormatId; fallback: string; onStep: (step: number) => void; onColor: (color: string | undefined) => void }) {
  const ladder = ladderFor(format);
  const size = fontSizeOf(format, block);
  const current = block.step ?? ladder.indexOf(size);
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-[11px]" style={{ color: "var(--color-ink-faint)" }}>
        Corpo
      </span>
      <StepButton icon={Minus} label={`Riduci ${BLOCK_LABELS[block.kind].toLowerCase()}`} disabled={current <= minStepOf(block.kind)} onClick={() => onStep(current - 1)} />
      <span className="tv-mono w-[42px] text-center text-[11px]" style={{ color: "var(--color-ink)" }}>
        {size} px
      </span>
      <StepButton icon={Plus} label={`Ingrandisci ${BLOCK_LABELS[block.kind].toLowerCase()}`} disabled={current >= ladder.length - 1} onClick={() => onStep(current + 1)} />
      <div className="flex-1" />
      <ColorControl label={`Colore ${BLOCK_LABELS[block.kind].toLowerCase()}`} value={block.color} fallback={fallback} onChange={onColor} />
    </div>
  );
}

function StepButton({ icon: Icon, label, disabled, onClick }: { icon: typeof Minus; label: string; disabled: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="flex h-[24px] w-[24px] items-center justify-center rounded-[7px] transition-colors"
      style={{
        border: "1px solid var(--color-line)",
        background: "var(--color-paper)",
        color: disabled ? "var(--color-mute)" : "var(--color-ink-soft)",
        cursor: disabled ? "not-allowed" : "pointer",
      }}
    >
      <Icon size={12} strokeWidth={2.4} />
    </button>
  );
}

/**
 * Un colore in tre modi: il selettore del sistema, un codice incollato, o il
 * ritorno al brand. Il campo accetta solo esadecimali; quello che non lo e'
 * resta scritto ma non si applica, e al blur torna il valore vero.
 */
function ColorControl({ label, value, fallback, onChange }: { label: string; value: string | undefined; fallback: string; onChange: (hex: string | undefined) => void }) {
  const [draft, setDraft] = useState(value ?? "");
  useEffect(() => setDraft(value ?? ""), [value]);
  const shown = value ?? fallback;

  return (
    <div className="flex items-center gap-1.5">
      <label
        className="relative block h-[26px] w-[26px] shrink-0 cursor-pointer overflow-hidden rounded-[7px]"
        style={{ background: shown, border: "1px solid var(--color-line)", boxShadow: "inset 0 0 0 1.5px #ffffff" }}
        title={`${label}: apri il selettore`}
      >
        <input
          type="color"
          value={shown}
          onChange={(e) => onChange(e.target.value)}
          aria-label={`${label}, selettore`}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
        />
      </label>
      <input
        value={draft}
        placeholder={fallback}
        spellCheck={false}
        aria-label={`${label}, codice esadecimale`}
        onChange={(e) => {
          setDraft(e.target.value);
          const hex = normalizeHex(e.target.value);
          if (hex) onChange(hex);
        }}
        onBlur={() => setDraft(value ?? "")}
        className="tv-mono h-[26px] w-[84px] rounded-[7px] px-2 text-[11.5px] outline-none focus:shadow-focus"
        style={{ border: "1px solid var(--color-line)", background: "var(--color-paper)", color: "var(--color-ink)" }}
      />
      {value ? (
        <button
          type="button"
          onClick={() => onChange(undefined)}
          aria-label={`${label}: torna al Brand Kit`}
          title="Torna al Brand Kit"
          className="flex h-[26px] w-[26px] cursor-pointer items-center justify-center rounded-[7px] transition-colors hover:bg-paper"
          style={{ color: "var(--color-ink-faint)" }}
        >
          <RotateCcw size={12} strokeWidth={2.2} />
        </button>
      ) : null}
    </div>
  );
}

function Field({ label, value, onChange, size = "sm", multiline = false, children }: { label: string; value: string; onChange: (v: string) => void; size?: "sm" | "lg"; multiline?: boolean; children?: React.ReactNode }) {
  const style = {
    border: "1px solid var(--color-line)",
    background: "var(--color-paper)",
    color: "var(--color-ink)",
    fontSize: size === "lg" ? 16 : 13.5,
    fontWeight: size === "lg" ? 600 : 400,
  } as const;
  return (
    <div className="flex flex-col gap-1.5">
      <label className="flex flex-col gap-1.5">
        <span className="tv-label">{label.toUpperCase()}</span>
        {multiline ? (
          <textarea value={value} rows={3} onChange={(e) => onChange(e.target.value)} className="tv-scroll w-full resize-none rounded-[10px] px-3 py-2.5 leading-[1.5] outline-none focus:shadow-focus" style={style} />
        ) : (
          <input value={value} onChange={(e) => onChange(e.target.value)} className="w-full rounded-[10px] px-3 py-2.5 outline-none focus:shadow-focus" style={style} />
        )}
      </label>
      {children}
    </div>
  );
}

/* ---------------- foto ---------------- */

/**
 * La stessa scelta del visual del passo 3, dentro l'editor: archivio,
 * generati, e la generazione con lo stesso motore. E' un componente solo,
 * cosi' un visual fatto qui ha la stessa provenienza, lo stesso freno
 * giornaliero e lo stesso «salva» di uno fatto in composizione.
 */
function PhotoPanel({ current, format, onPhoto }: { current: string; format: FormatId; onPhoto: (url: string) => void }) {
  return (
    <>
      <PanelTitle hint="Cambia la fotografia di questa variante, o generane una nuova. Il punto di fuoco si sposta sulla tela, trascinando il cerchio.">
        FOTO
      </PanelTitle>
      {/* Togliere la selezione non ha senso qui: un asset ha sempre una foto. */}
      <ImagePicker selectedId={null} selectedUrl={current} onSelect={(choice) => choice && onPhoto(choice.url)} purpose={format} compact />
    </>
  );
}

/* ---------------- esporta ---------------- */

const FILE_TYPES: { id: FileType; label: string; hint: string; icon: typeof FileImage; ready: boolean }[] = [
  { id: "png", label: "PNG", hint: "alla dimensione esatta del formato", icon: FileImage, ready: true },
  { id: "mp4", label: "MP4", hint: "video di 8 secondi: l'asset prende vita", icon: Video, ready: true },
  { id: "pdf", label: "PDF", hint: "per la stampa, 300 dpi", icon: FileText, ready: false },
  { id: "svg", label: "SVG", hint: "vettoriale, per l'agenzia", icon: Hash, ready: false },
  { id: "pptx", label: "PPTX", hint: "una slide per formato", icon: Presentation, ready: false },
];

function ExportPanel({ run, variant, layouts }: { run: Run; variant: VariantCopy; layouts: Record<string, AssetLayout> }) {
  const [type, setType] = useState<FileType>("png");
  const [formats, setFormats] = useState<FormatId[]>(run.formats);
  const [all, setAll] = useState(false);

  const toggle = (f: FormatId) => setFormats((prev) => (prev.includes(f) ? prev.filter((x) => x !== f) : [...prev, f]));
  const chosen = FILE_TYPES.find((t) => t.id === type)!;
  const variants = all ? run.variants : [variant];

  return (
    <>
      <PanelTitle>ESPORTA</PanelTitle>

      <div className="flex flex-col gap-1.5">
        <p className="tv-label">FILE</p>
        {FILE_TYPES.map((t) => {
          const on = t.id === type;
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setType(t.id)}
              aria-pressed={on}
              className="flex cursor-pointer items-center gap-3 rounded-[10px] px-3 py-2.5 text-left transition-colors"
              style={{ border: `1.5px solid ${on ? "var(--color-rose)" : "var(--color-line)"}`, background: on ? "var(--color-wine-tint)" : "var(--color-paper)" }}
            >
              <Icon size={17} strokeWidth={1.9} style={{ color: on ? "var(--color-wine)" : "var(--color-ink-faint)" }} />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="text-[13.5px] font-semibold" style={{ color: "var(--color-ink)" }}>
                  {t.label}
                </span>
                <span className="text-[11.5px]" style={{ color: "var(--color-ink-faint)" }}>
                  {t.hint}
                </span>
              </span>
              {!t.ready ? (
                <span className="tv-pill h-[20px] px-2 text-[10.5px]" style={{ background: "var(--color-warm-tint)", color: "var(--color-warning)" }}>
                  in arrivo
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      <div className="flex flex-col gap-1.5">
        <p className="tv-label">FORMATI</p>
        {run.formats.map((f) => {
          const on = formats.includes(f);
          return (
            <label key={f} className="flex cursor-pointer items-center gap-2.5 text-[13.5px]" style={{ color: "var(--color-ink)" }}>
              <input type="checkbox" checked={on} onChange={() => toggle(f)} className="h-4 w-4 accent-[#ce4257]" />
              {FORMATS[f].label}
              <span className="text-[11.5px]" style={{ color: "var(--color-ink-faint)" }}>
                {FORMATS[f].exportNote}
              </span>
            </label>
          );
        })}
      </div>

      <label className="flex cursor-pointer items-center gap-2.5 text-[13.5px]" style={{ color: "var(--color-ink)" }}>
        <input type="checkbox" checked={all} onChange={(e) => setAll(e.target.checked)} className="h-4 w-4 accent-[#ce4257]" />
        Tutte le {run.variants.length} varianti
      </label>

      {chosen.id === "mp4" ? (
        <VideoExport run={run} variants={variants} formats={formats} layouts={layouts} />
      ) : chosen.ready ? (
        <div className="flex flex-col gap-1.5">
          <p className="tv-label">SCARICA</p>
          {variants.flatMap((v) =>
            formats.map((f) => {
              // L'impaginazione modificata non ha un posto nel database:
              // viaggia nel link, e il PNG esce come lo si vede.
              const custom = layouts[`${v.index}:${f}`];
              const href = `/api/render/${run.id}/${v.index}/${f}.png${custom ? `?layout=${encodeLayout(custom)}` : ""}`;
              return (
              <a
                key={`${v.index}-${f}`}
                href={href}
                download={`timevision-v${v.index + 1}-${f}.png`}
                className="tv-pill h-[38px] gap-2 px-3.5 text-[13px] transition-colors hover:bg-line-soft"
                style={{ border: "1px solid var(--color-line)", color: "var(--color-ink)" }}
              >
                <Download size={14} strokeWidth={2} style={{ color: "var(--color-rose)" }} />
                V{v.index + 1} · {FORMATS[f].label}
                <span className="ml-auto text-[11.5px] font-normal" style={{ color: "var(--color-ink-faint)" }}>
                  {FORMATS[f].width}×{FORMATS[f].height}
                </span>
              </a>
              );
            }),
          )}
          {formats.length === 0 ? (
            <p className="text-[12.5px]" style={{ color: "var(--color-ink-faint)" }}>
              Scegli almeno un formato.
            </p>
          ) : null}
        </div>
      ) : (
        <p className="rounded-[10px] px-3 py-2.5 text-[12.5px] leading-[1.5]" style={{ background: "var(--color-warm-tint)", color: "var(--color-warning)" }}>
          L&apos;export {chosen.label} non è ancora attivo. Nel frattempo il PNG esce alla dimensione esatta di ogni formato.
        </p>
      )}
    </>
  );
}

/* ---------------- pubblica ---------------- */

const SLACK_CHANNELS = ["#marketing", "#direzione", "#commerciale"];

function PublishPanel({ run, user, channelsLive }: { run: Run; user: StudioUser; channelsLive: boolean }) {
  const blocked = run.guard.some((c) => c.status === "fail");
  const approver = user.role === "approver";
  const linkedin = run.captions.find((c) => c.channel === "linkedin") ?? null;
  const instagram = run.captions.find((c) => c.channel === "instagram") ?? null;

  return (
    <>
      <PanelTitle hint={blocked ? "Il controllo del brand ha bloccato la pubblicazione." : approver ? `${user.name} può pubblicare.` : "Serve un approvatore: la richiesta parte da qui."}>
        PUBBLICA
      </PanelTitle>

      <Channel icon={Camera} name="Instagram" handle="@timevision" live={channelsLive} caption={instagram} blocked={blocked} approver={approver}>
        <div className="flex gap-1.5">
          {(["Feed", "Story"] as const).map((s, i) => (
            <label key={s} className="flex cursor-pointer items-center gap-1.5 text-[12.5px]" style={{ color: "var(--color-ink)" }}>
              <input type="checkbox" defaultChecked={i === 0 ? run.formats.includes("ig-feed") : run.formats.includes("ig-story")} className="h-3.5 w-3.5 accent-[#ce4257]" />
              {s}
            </label>
          ))}
        </div>
      </Channel>

      <Channel icon={Building2} name="LinkedIn" handle="Pagina Time Vision" live={channelsLive} caption={linkedin} blocked={blocked} approver={approver} />

      {/* Slack non e' ancora collegato: il canale c'e', il webhook arriva dopo. Il brand guard vale anche qui. */}
      <Channel icon={Hash} name="Slack" handle="condividi col team" live={false} caption={null} blocked={blocked} approver={true} verb="Condividi">
        <select className="h-[34px] w-full rounded-[8px] px-2 text-[12.5px]" style={{ border: "1px solid var(--color-line)", background: "var(--color-paper)", color: "var(--color-ink)" }} defaultValue={SLACK_CHANNELS[0]}>
          {SLACK_CHANNELS.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
      </Channel>
    </>
  );
}

function Channel({
  icon: Icon,
  name,
  handle,
  live,
  caption,
  blocked,
  approver,
  verb = "Pubblica",
  children,
}: {
  icon: typeof Camera;
  name: string;
  handle: string;
  live: boolean;
  caption: Caption | null;
  blocked: boolean;
  approver: boolean;
  verb?: string;
  children?: React.ReactNode;
}) {
  const [text, setText] = useState(caption ? `${caption.text}\n\n${caption.hashtags.map((h) => `#${h}`).join(" ")}` : "");
  const can = live && !blocked && approver;
  const label = blocked ? "Bloccato dal brand guard" : !live ? "Canale non collegato" : approver ? `${verb} su ${name}` : "Richiedi approvazione";

  return (
    <section className="flex flex-col gap-2.5 rounded-card p-3.5" style={{ border: "1px solid var(--color-line)" }}>
      <div className="flex items-center gap-2">
        <Icon size={16} strokeWidth={1.9} style={{ color: "var(--color-wine)" }} />
        <span className="text-[13.5px] font-semibold" style={{ color: "var(--color-ink)" }}>
          {name}
        </span>
        <span className="text-[11.5px]" style={{ color: "var(--color-ink-faint)" }}>
          {handle}
        </span>
        <span className="tv-pill ml-auto h-[20px] px-2 text-[10.5px]" style={{ background: live ? "var(--color-success-bg)" : "var(--color-line-soft)", color: live ? "var(--color-success)" : "var(--color-ink-faint)" }}>
          {live ? "collegato" : "da collegare"}
        </span>
      </div>
      {children}
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={caption ? 5 : 2}
        placeholder={caption ? undefined : "Un messaggio per il team…"}
        className="tv-scroll w-full resize-none rounded-[10px] px-3 py-2.5 text-[12.5px] leading-[1.5] outline-none focus:shadow-focus"
        style={{ border: "1px solid var(--color-line)", background: "var(--color-paper)", color: "var(--color-ink)" }}
      />
      <button
        type="button"
        disabled={!can && live}
        className="tv-pill h-[38px] w-full justify-center gap-2 text-[13px] transition-colors"
        style={{
          background: can ? "var(--color-coral)" : "var(--color-line-soft)",
          color: can ? "#ffffff" : "var(--color-ink-faint)",
          cursor: can ? "pointer" : "not-allowed",
        }}
        title={live ? undefined : "Collega il canale nelle impostazioni per pubblicare da qui"}
      >
        <Send size={14} strokeWidth={2.2} />
        {label}
      </button>
    </section>
  );
}
