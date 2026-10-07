"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Check, FlaskConical, GripVertical, LoaderCircle, Lock, Plus, RotateCcw, Send, Trash2 } from "lucide-react";
import { FORMATS, FORMAT_ORDER, PHOTOS, type FormatId } from "@/lib/brand";
import { timeAgo } from "@/lib/format";
import { archetypeFromLabel, templateLayout } from "@/lib/layout-model";
import { draftCopy, exampleValues, FIELD_TYPES, FIELD_TYPE_HINT, labelFromKey, splitTemplate, validateTool, type ToolField } from "@/lib/tool-fields";
import type { Template, Tool, ToolSnapshot, ToolVersion, VariantCopy } from "@/lib/types";
import { AssetPreview } from "./asset-preview";
import { toolIcon } from "./tool-icons";
import { Card, FieldRow, PageHeader, StatusChip, Toggle, inputClass, inputStyle } from "./ui";

interface Props {
  tools: Tool[];
  tool: Tool;
  versions: ToolVersion[];
  templates: Template[];
  me: string;
}

function snapshotOf(tool: Tool | ToolSnapshot): ToolSnapshot {
  return {
    title: tool.title,
    description: tool.description,
    prompt_template: tool.prompt_template,
    fields: tool.fields,
    cta_label: tool.cta_label,
    default_formats: tool.default_formats,
    category: tool.category,
    estimated_minutes: tool.estimated_minutes,
    cover_image: tool.cover_image,
    default_template: tool.default_template,
    default_variants: tool.default_variants,
  };
}

const same = (a: ToolSnapshot, b: ToolSnapshot) => JSON.stringify(a) === JSON.stringify(b);

function clock(iso: string | null): string {
  return iso ? new Date(iso).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" }) : "";
}

/**
 * L'editor di uno strumento. Ogni modifica e' una bozza, salvata da sola
 * dopo un attimo; il team continua a usare la versione pubblicata finche'
 * non si preme «Pubblica». La validazione e' la stessa di lib/tool-fields.ts
 * che il server applica alla pubblicazione, cosi' l'editor segnala i
 * problemi prima e il server li rifiuta comunque.
 */
export function ToolEditor({ tools, tool, versions: initialVersions, templates, me }: Props) {
  const router = useRouter();
  const published = useMemo(() => snapshotOf(tool), [tool]);
  const [versions, setVersions] = useState(initialVersions);
  const existingDraft = initialVersions.find((v) => v.published_at === null) ?? null;
  const [draft, setDraft] = useState<ToolSnapshot>(existingDraft?.snapshot ?? published);
  const [savedAt, setSavedAt] = useState<string | null>(existingDraft?.created_at ?? null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [sample, setSample] = useState(false);
  const [newTool, setNewTool] = useState<string | null>(null);

  const dirty = !same(draft, published);
  const hasDraft = versions.some((v) => v.published_at === null);
  const problems = useMemo(() => validateTool(draft), [draft]);

  /* ---------------- salvataggio della bozza ---------------- */

  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (!dirty) return;
    const t = setTimeout(async () => {
      setSaving(true);
      setSaveError(null);
      try {
        const res = await fetch(`/api/admin/tools/${tool.id}/draft`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ snapshot: draft }),
        });
        const data = (await res.json().catch(() => ({}))) as { version?: ToolVersion; error?: string };
        if (!res.ok || !data.version) throw new Error(data.error ?? "Bozza non salvata.");
        const version = data.version;
        setVersions((prev) => (prev.some((v) => v.id === version.id) ? prev.map((v) => (v.id === version.id ? version : v)) : [version, ...prev]));
        setSavedAt(new Date().toISOString());
      } catch (e) {
        setSaveError(e instanceof Error ? e.message : String(e));
      } finally {
        setSaving(false);
      }
    }, 900);
    return () => clearTimeout(t);
  }, [draft, dirty, tool.id]);

  const publish = async (versionId?: string) => {
    setPublishing(true);
    setPublishError(null);
    try {
      const res = await fetch(`/api/admin/tools/${tool.id}/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(versionId ? { versionId } : {}),
      });
      const data = (await res.json().catch(() => ({}))) as { tool?: Tool; versions?: ToolVersion[]; error?: string; problems?: string[] };
      if (!res.ok || !data.tool) throw new Error(data.error ?? "Pubblicazione non riuscita.");
      if (data.versions) setVersions(data.versions);
      setDraft(snapshotOf(data.tool));
      router.refresh();
    } catch (e) {
      setPublishError(e instanceof Error ? e.message : String(e));
    } finally {
      setPublishing(false);
    }
  };

  const restore = async (versionId: string) => {
    setPublishError(null);
    const res = await fetch(`/api/admin/tools/${tool.id}/restore`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ versionId }),
    });
    const data = (await res.json().catch(() => ({}))) as { version?: ToolVersion; versions?: ToolVersion[]; error?: string };
    if (!res.ok || !data.version) {
      setPublishError(data.error ?? "Ripristino non riuscito.");
      return;
    }
    first.current = true;
    setDraft(data.version.snapshot);
    if (data.versions) setVersions(data.versions);
    setSavedAt(new Date().toISOString());
  };

  const createTool = async (title: string) => {
    const res = await fetch("/api/admin/tools", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title }) });
    const data = (await res.json().catch(() => ({}))) as { tool?: Tool; error?: string };
    if (!res.ok || !data.tool) {
      setPublishError(data.error ?? "Strumento non creato.");
      return;
    }
    router.push(`/studio/admin/strumenti/${data.tool.slug}`);
  };

  const patch = useCallback((p: Partial<ToolSnapshot>) => setDraft((prev) => ({ ...prev, ...p })), []);

  const saveState = saving
    ? "Salvataggio…"
    : saveError
      ? saveError
      : dirty || hasDraft
        ? `Bozza salvata${savedAt ? ` alle ${clock(savedAt)}` : ""} · non ancora visibile al team`
        : tool.published_version > 0
          ? `Il team usa già la v${tool.published_version}`
          : "Non ancora pubblicato: il team non lo vede";

  const Icon = toolIcon(tool.slug);
  const values = sample ? exampleValues(draft) : {};
  const previewCopy: VariantCopy = { index: 0, layout: "dato dominante", ...draftCopy(draft, values, "Campagna") };
  const previewFormat: FormatId = draft.default_formats[0] ?? "linkedin";

  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-5 px-4 py-6 md:px-8 md:py-7">
      <PageHeader
        breadcrumb={[{ label: "Amministrazione" }, { label: "Modifica strumenti", href: "/studio/admin/strumenti" }, { label: tool.title }]}
        title={
          <span className="flex items-center gap-3">
            <span className="flex h-[36px] w-[36px] items-center justify-center rounded-[10px]" style={{ background: "var(--color-wine-tint)", color: "var(--color-wine)" }}>
              <Icon size={18} strokeWidth={1.9} />
            </span>
            {draft.title || tool.title}
          </span>
        }
        subtitle={
          <span role="status" className="flex items-center gap-1.5" style={{ color: saveError ? "var(--color-danger)" : dirty || hasDraft ? "var(--color-warning)" : "var(--color-success)" }}>
            {saving ? <LoaderCircle size={13} strokeWidth={2.2} className="tv-anim-spin" /> : <Check size={13} strokeWidth={2.4} />}
            {saveState}
          </span>
        }
        actions={
          <>
            <button
              type="button"
              onClick={() => setSample((v) => !v)}
              aria-pressed={sample}
              className="tv-pill h-[44px] cursor-pointer gap-2 px-4 text-[13px] transition-colors"
              style={{ border: `1px solid ${sample ? "var(--color-rose)" : "var(--color-line)"}`, background: sample ? "var(--color-wine-tint)" : "var(--color-paper)", color: sample ? "var(--color-wine)" : "var(--color-ink)" }}
            >
              <FlaskConical size={15} strokeWidth={1.9} />
              Prova con dati di esempio
            </button>
            <button
              type="button"
              onClick={() => publish()}
              disabled={publishing || (!dirty && !hasDraft) || saving}
              className="tv-pill h-[44px] gap-2 px-5 text-[13.5px]"
              style={{
                background: dirty || hasDraft ? "var(--color-wine)" : "var(--color-mute)",
                color: dirty || hasDraft ? "#ffffff" : "var(--color-ink-soft)",
                cursor: dirty || hasDraft ? "pointer" : "not-allowed",
              }}
              title={problems.length > 0 ? problems[0] : undefined}
            >
              {publishing ? <LoaderCircle size={15} strokeWidth={2.2} className="tv-anim-spin" /> : <Send size={15} strokeWidth={2} />}
              Pubblica le modifiche
            </button>
          </>
        }
      />

      {publishError ? (
        <p role="alert" className="rounded-card px-4 py-3 text-[13px]" style={{ background: "var(--color-danger-bg)", color: "var(--color-danger)" }}>
          {publishError}
        </p>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[232px_minmax(0,1fr)_340px]">
        {/* ---------------- sinistra: gli strumenti ---------------- */}
        <aside className="flex flex-col gap-4 lg:sticky lg:top-6 lg:self-start" aria-label="Strumenti del team">
          <Card flush>
            <p className="tv-label px-4 pt-4 pb-2">STRUMENTI DEL TEAM</p>
            <ul className="flex flex-col px-2 pb-2">
              {tools.filter((t) => !t.automatic).map((t) => {
                const on = t.id === tool.id;
                const T = toolIcon(t.slug);
                return (
                  <li key={t.id}>
                    <Link
                      href={`/studio/admin/strumenti/${t.slug}`}
                      aria-current={on ? "page" : undefined}
                      className="flex min-h-[48px] items-center gap-2.5 rounded-[10px] px-2.5 py-2 text-[13px] transition-colors hover:bg-line-soft"
                      style={{ background: on ? "var(--color-wine-tint)" : "transparent", color: on ? "var(--color-wine)" : "var(--color-ink)", fontWeight: on ? 600 : 500 }}
                    >
                      <T size={15} strokeWidth={1.9} className="shrink-0" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate">{t.title}</span>
                        <span className="block text-[11.5px] font-normal" style={{ color: "var(--color-ink-faint)" }}>
                          {t.fields.length} {t.fields.length === 1 ? "campo" : "campi"} · v{t.published_version}
                        </span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
            <div className="px-3 pb-3">
              {newTool === null ? (
                <button type="button" onClick={() => setNewTool("")} className="tv-pill h-[40px] w-full cursor-pointer justify-center gap-1.5 text-[13px] hover:bg-line-soft" style={{ border: "1px dashed var(--color-line)", color: "var(--color-ink)" }}>
                  <Plus size={14} strokeWidth={2.2} />
                  Nuovo strumento
                </button>
              ) : (
                <div className="flex flex-col gap-2">
                  <label htmlFor="new-tool-title" className="tv-label">
                    NOME
                  </label>
                  <input
                    id="new-tool-title"
                    value={newTool}
                    autoFocus
                    onChange={(e) => setNewTool(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && newTool.trim().length >= 3) void createTool(newTool.trim());
                      if (e.key === "Escape") setNewTool(null);
                    }}
                    placeholder="Es. Locandina evento"
                    className={inputClass}
                    style={inputStyle}
                  />
                  <div className="flex gap-1.5">
                    <button type="button" onClick={() => setNewTool(null)} className="tv-pill h-[36px] flex-1 cursor-pointer justify-center text-[12.5px] hover:bg-line-soft" style={{ border: "1px solid var(--color-line)", color: "var(--color-ink)" }}>
                      Annulla
                    </button>
                    <button type="button" onClick={() => void createTool(newTool.trim())} disabled={newTool.trim().length < 3} className="tv-pill h-[36px] flex-1 justify-center text-[12.5px]" style={{ background: newTool.trim().length >= 3 ? "var(--color-wine)" : "var(--color-mute)", color: newTool.trim().length >= 3 ? "#ffffff" : "var(--color-ink-soft)", cursor: newTool.trim().length >= 3 ? "pointer" : "not-allowed" }}>
                      Crea
                    </button>
                  </div>
                </div>
              )}
            </div>
            <p className="tv-label px-4 pt-2 pb-2" style={{ borderTop: "1px solid var(--color-line-soft)" }}>
              AUTOMATICI
            </p>
            <ul className="flex flex-col px-2 pb-3">
              {tools.filter((t) => t.automatic).map((t) => {
                const T = toolIcon(t.slug);
                return (
                  <li key={t.id} className="flex min-h-[44px] items-center gap-2.5 px-2.5 py-2 text-[13px]" style={{ color: "var(--color-ink-faint)" }} title={t.note ?? "automatico"}>
                    <T size={15} strokeWidth={1.9} className="shrink-0" />
                    <span className="min-w-0 flex-1 truncate">{t.title}</span>
                    <Lock size={13} strokeWidth={2} aria-label="non modificabile" />
                  </li>
                );
              })}
            </ul>
          </Card>
        </aside>

        {/* ---------------- centro: l'editor ---------------- */}
        <div className="flex min-w-0 flex-col gap-4">
          <Card size="lg">
            <div className="grid gap-4 md:grid-cols-2">
              <FieldRow htmlFor="tool-title" label="Nome" required>
                <input id="tool-title" value={draft.title} onChange={(e) => patch({ title: e.target.value })} className={inputClass} style={inputStyle} />
              </FieldRow>
              <FieldRow htmlFor="tool-cta" label="Pulsante di avvio" help="L'etichetta del pulsante nel modulo.">
                <input id="tool-cta" value={draft.cta_label ?? ""} onChange={(e) => patch({ cta_label: e.target.value })} placeholder="Crea il poster" className={inputClass} style={inputStyle} />
              </FieldRow>
              <FieldRow htmlFor="tool-description" label="Descrizione" required help="Una riga: e' quella della card nella home." className="md:col-span-2">
                <input id="tool-description" value={draft.description} onChange={(e) => patch({ description: e.target.value })} className={inputClass} style={inputStyle} />
              </FieldRow>
            </div>
          </Card>

          <Card size="lg" as="section" aria-labelledby="tool-prompt-title">
            <h2 id="tool-prompt-title" className="text-[17px] font-semibold" style={{ color: "var(--color-ink)" }}>
              L&apos;istruzione
            </h2>
            <p className="mt-0.5 pb-3 text-[12.5px]" style={{ color: "var(--color-ink-soft)" }}>
              I segnaposto fra doppie graffe diventano le domande del modulo. Copia e incolla li conservano cosi&apos; come sono.
            </p>
            <PromptEditor value={draft.prompt_template} fields={draft.fields} onChange={(prompt_template) => patch({ prompt_template })} />
            <div className="flex flex-wrap items-center gap-1.5 pt-3">
              <span className="tv-label mr-1">INSERISCI UN CAMPO</span>
              {draft.fields.map((f) => (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => document.dispatchEvent(new CustomEvent("tool-editor:insert", { detail: f.key }))}
                  className="tv-pill h-[30px] cursor-pointer px-2.5 text-[12px] transition-colors hover:brightness-95"
                  style={{ background: "var(--color-wine-tint)", color: "var(--color-wine)" }}
                >
                  {f.label || f.key}
                </button>
              ))}
            </div>
          </Card>

          <Card size="lg" as="section" aria-labelledby="tool-fields-title" flush>
            <div className="flex flex-wrap items-start justify-between gap-3 px-5 pt-5 pb-3">
              <div>
                <h2 id="tool-fields-title" className="text-[17px] font-semibold" style={{ color: "var(--color-ink)" }}>
                  Le domande del modulo
                </h2>
                <p className="mt-0.5 text-[12.5px]" style={{ color: "var(--color-ink-soft)" }}>
                  Nell&apos;ordine in cui il team le vede. Trascina la maniglia o usa le frecce per spostarle.
                </p>
              </div>
              <button
                type="button"
                onClick={() => patch({ fields: [...draft.fields, { key: uniqueKey("domanda", draft.fields), label: "Nuova domanda", type: "text", required: false, example: "" }] })}
                className="tv-pill h-[40px] cursor-pointer gap-1.5 px-4 text-[13px]"
                style={{ background: "var(--color-wine)", color: "#ffffff" }}
              >
                <Plus size={14} strokeWidth={2.2} />
                Aggiungi domanda
              </button>
            </div>
            <FieldsTable fields={draft.fields} onChange={(fields) => patch({ fields })} />
          </Card>

          <Card size="lg" as="section" aria-labelledby="tool-options-title">
            <h2 id="tool-options-title" className="pb-3 text-[17px] font-semibold" style={{ color: "var(--color-ink)" }}>
              Formati, template e varianti
            </h2>
            <div className="flex flex-col gap-5">
              <div>
                <p className="tv-label pb-2">FORMATI</p>
                <div className="flex flex-wrap gap-2">
                  {FORMAT_ORDER.map((id) => {
                    const on = draft.default_formats.includes(id);
                    return (
                      <button
                        key={id}
                        type="button"
                        aria-pressed={on}
                        onClick={() => patch({ default_formats: on ? draft.default_formats.filter((f) => f !== id) : [...draft.default_formats, id] })}
                        className="tv-pill h-[40px] cursor-pointer gap-1.5 px-4 text-[13px]"
                        style={{ background: on ? "var(--color-wine-tint)" : "var(--color-paper)", border: `1px solid ${on ? "var(--color-rose)" : "var(--color-line)"}`, color: on ? "var(--color-wine)" : "var(--color-ink-soft)" }}
                      >
                        {on ? <Check size={13} strokeWidth={2.6} /> : null}
                        {FORMATS[id].label}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <FieldRow htmlFor="tool-template" label="Template di partenza">
                  <select id="tool-template" value={draft.default_template ?? ""} onChange={(e) => patch({ default_template: e.target.value || null })} className={`${inputClass} cursor-pointer`} style={inputStyle}>
                    <option value="">Il primo in libreria</option>
                    {templates.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </FieldRow>
                <FieldRow htmlFor="tool-variants" label="Varianti di partenza" help="Da 1 a 4. Il team puo' cambiarle.">
                  <select id="tool-variants" value={draft.default_variants} onChange={(e) => patch({ default_variants: Number(e.target.value) })} className={`${inputClass} cursor-pointer`} style={inputStyle}>
                    {[1, 2, 3, 4].map((n) => (
                      <option key={n} value={n}>
                        {n} {n === 1 ? "variante" : "varianti"}
                      </option>
                    ))}
                  </select>
                </FieldRow>
                <FieldRow htmlFor="tool-category" label="Categoria">
                  <select id="tool-category" value={draft.category ?? ""} onChange={(e) => patch({ category: e.target.value === "social" || e.target.value === "stampa" ? e.target.value : null })} className={`${inputClass} cursor-pointer`} style={inputStyle}>
                    <option value="">Nessuna</option>
                    <option value="social">Social</option>
                    <option value="stampa">Stampa</option>
                  </select>
                </FieldRow>
                <FieldRow htmlFor="tool-minutes" label="Tempo stimato (minuti)">
                  <input id="tool-minutes" type="number" min={1} max={60} value={draft.estimated_minutes ?? ""} onChange={(e) => patch({ estimated_minutes: e.target.value ? Number(e.target.value) : null })} className={inputClass} style={inputStyle} />
                </FieldRow>
                <FieldRow htmlFor="tool-cover" label="Foto della card" className="md:col-span-2">
                  <select id="tool-cover" value={draft.cover_image ?? ""} onChange={(e) => patch({ cover_image: e.target.value || null })} className={`${inputClass} cursor-pointer`} style={inputStyle}>
                    <option value="">Nessuna foto, solo il gradiente</option>
                    {PHOTOS.map((p) => (
                      <option key={p.file} value={p.file}>
                        {p.subject}
                      </option>
                    ))}
                  </select>
                </FieldRow>
              </div>
            </div>
          </Card>

          {problems.length > 0 ? (
            <section className="rounded-card px-4 py-3" style={{ background: "var(--color-warm-tint)", color: "var(--color-warning)" }} aria-live="polite">
              <p className="text-[13px] font-semibold">Prima di pubblicare:</p>
              <ul className="mt-1 flex list-disc flex-col gap-0.5 pl-5 text-[12.5px]">
                {problems.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>

        {/* ---------------- destra: anteprima e versioni ---------------- */}
        <aside className="flex flex-col gap-4 lg:sticky lg:top-6 lg:self-start" aria-label="Anteprima e versioni">
          <Card>
            <p className="tv-label pb-3">COME LO VEDE IL TEAM</p>
            <div className="rounded-[12px] p-3" style={{ background: "var(--color-canvas)", border: "1px solid var(--color-line)" }}>
              <p className="text-[13.5px] font-semibold" style={{ color: "var(--color-ink)" }}>
                {draft.title || "Senza nome"}
              </p>
              <p className="text-[11.5px]" style={{ color: "var(--color-ink-soft)" }}>
                {draft.description}
              </p>
              <ul className="mt-2.5 flex flex-col gap-2">
                {draft.fields.map((f) => (
                  <li key={f.key}>
                    <span className="block text-[10px] font-bold tracking-[0.08em] uppercase" style={{ color: "var(--color-ink-faint)" }}>
                      {f.label || f.key}
                      {f.required ? " *" : ""}
                    </span>
                    <span className="mt-0.5 block truncate rounded-[7px] px-2 py-1.5 text-[11.5px]" style={{ border: "1px solid var(--color-line)", background: "var(--color-paper)", color: sample && f.example ? "var(--color-ink)" : "var(--color-ink-faint)" }}>
                      {sample && f.example ? f.example.split("\n")[0] : FIELD_TYPE_HINT[f.type]}
                    </span>
                  </li>
                ))}
              </ul>
              <span className="tv-pill mt-3 h-[32px] px-3.5 text-[12px]" style={{ background: "var(--color-coral)", color: "var(--color-ink)" }}>
                {draft.cta_label || "Crea"}
              </span>
            </div>
            <div className="mt-3 flex justify-center rounded-[12px] py-3" style={{ background: "var(--color-line-soft)" }}>
              <AssetPreview
                variant={previewCopy}
                format={previewFormat}
                displayWidth={previewFormat === "linkedin" ? 280 : previewFormat === "ig-feed" ? 200 : 150}
                layout={templateLayout(previewFormat, archetypeFromLabel(previewCopy.layout), { eyebrow: previewCopy.eyebrow, headline: previewCopy.headline, subhead: previewCopy.subhead, body: previewCopy.body, badge: previewCopy.badge, disclaimer: previewCopy.disclaimer })}
                archetype={archetypeFromLabel(previewCopy.layout)}
              />
            </div>
            {!sample ? (
              <p className="pt-2 text-[11.5px]" style={{ color: "var(--color-ink-faint)" }}>
                «Prova con dati di esempio» riempie il modulo con gli esempi di ogni domanda.
              </p>
            ) : null}
          </Card>

          <Card flush>
            <p className="tv-label px-5 pt-5 pb-2">VERSIONI</p>
            <ul className="flex flex-col px-3 pb-3">
              {versions.length === 0 ? (
                <li className="px-2 py-2 text-[12.5px]" style={{ color: "var(--color-ink-faint)" }}>
                  Nessuna bozza: la v{tool.published_version} e&apos; quella del seme iniziale.
                </li>
              ) : null}
              {versions.map((v) => {
                const isDraft = v.published_at === null;
                const inUse = v.version === tool.published_version && !isDraft;
                return (
                  <li key={v.id} className="flex items-center gap-2.5 rounded-[10px] px-2 py-2.5" style={{ borderBottom: "1px solid var(--color-line-soft)" }}>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2 text-[13px] font-semibold" style={{ color: "var(--color-ink)" }}>
                        v{v.version}
                        {isDraft ? <StatusChip status="draft" size="sm" /> : inUse ? <StatusChip status="published" label="In uso" size="sm" /> : <StatusChip status="draft" label="Precedente" size="sm" />}
                      </span>
                      <span className="block text-[11.5px]" style={{ color: "var(--color-ink-faint)" }} suppressHydrationWarning>
                        {v.created_by === me ? "tu" : (v.created_by?.split("@")[0] ?? "—")} · {timeAgo(v.published_at ?? v.created_at)}
                      </span>
                    </span>
                    {isDraft ? (
                      <button type="button" onClick={() => publish(v.id)} disabled={publishing} className="tv-pill h-[34px] cursor-pointer px-3 text-[12px]" style={{ background: "var(--color-wine)", color: "#ffffff" }}>
                        Pubblica
                      </button>
                    ) : !inUse ? (
                      <button type="button" onClick={() => restore(v.id)} className="tv-pill h-[34px] cursor-pointer gap-1 px-3 text-[12px] hover:bg-line-soft" style={{ border: "1px solid var(--color-line)", color: "var(--color-ink)" }}>
                        <RotateCcw size={12} strokeWidth={2.2} />
                        Ripristina
                      </button>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </Card>
        </aside>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* L'istruzione con i chip                                              */
/* ------------------------------------------------------------------ */

/**
 * Un'area di testo con sopra una copia colorata: il testo vero resta un
 * testo semplice con i {{segnaposto}}, cosi' copiare e incollare li
 * conserva, e il colore viene da uno strato che non si tocca. I due strati
 * condividono carattere, corpo e margini, altrimenti il cursore sbaglia.
 */
function PromptEditor({ value, fields, onChange }: { value: string; fields: ToolField[]; onChange: (v: string) => void }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const parts = splitTemplate({ prompt_template: value, fields });

  const resize = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${Math.max(120, el.scrollHeight)}px`;
  }, []);
  useEffect(resize, [value, resize]);

  // I chip «Inserisci un campo» stanno fuori da qui: arrivano come evento.
  useEffect(() => {
    const insert = (e: Event) => {
      const key = (e as CustomEvent<string>).detail;
      const el = ref.current;
      if (!el) return;
      const start = el.selectionStart ?? value.length;
      const end = el.selectionEnd ?? start;
      const token = `{{${key}}}`;
      const next = `${value.slice(0, start)}${token}${value.slice(end)}`;
      onChange(next);
      requestAnimationFrame(() => {
        el.focus();
        el.setSelectionRange(start + token.length, start + token.length);
      });
    };
    document.addEventListener("tool-editor:insert", insert);
    return () => document.removeEventListener("tool-editor:insert", insert);
  }, [value, onChange]);

  const text = "relative w-full px-3.5 py-3 text-[14px] leading-[1.7] whitespace-pre-wrap break-words";

  return (
    <div className="relative rounded-[12px]" style={{ border: "1px solid var(--color-line)", background: "var(--color-paper)" }}>
      <div aria-hidden className={`${text} pointer-events-none absolute inset-0 overflow-hidden`} style={{ color: "var(--color-ink)" }}>
        {parts.map((p, i) =>
          p.kind === "text" ? (
            <span key={i}>{p.text}</span>
          ) : (
            <span
              key={i}
              className="rounded-[6px]"
              title={p.field ? p.field.label : "nessuna domanda con questa chiave"}
              style={{
                background: p.field ? "var(--color-wine-tint)" : "var(--color-warm-tint)",
                color: p.field ? "var(--color-wine)" : "var(--color-warning)",
                boxShadow: `0 0 0 2px ${p.field ? "var(--color-wine-tint)" : "var(--color-warm-tint)"}`,
                fontWeight: 600,
              }}
            >
              {`{{${p.key}}}`}
            </span>
          ),
        )}
        {"\n"}
      </div>
      <textarea
        ref={ref}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        spellCheck={false}
        aria-label="Istruzione"
        className={`${text} resize-none bg-transparent outline-none focus:shadow-focus`}
        style={{ color: "transparent", caretColor: "var(--color-ink)", WebkitTextFillColor: "transparent", borderRadius: 12 }}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Le domande                                                           */
/* ------------------------------------------------------------------ */

function uniqueKey(base: string, fields: ToolField[]): string {
  const taken = new Set(fields.map((f) => f.key));
  let key = base;
  for (let n = 2; taken.has(key); n++) key = `${base}_${n}`;
  return key;
}

function keyFromLabel(label: string): string {
  return label
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/^[^a-z]+/, "")
    .slice(0, 32);
}

function FieldsTable({ fields, onChange }: { fields: ToolField[]; onChange: (next: ToolField[]) => void }) {
  const [dragging, setDragging] = useState<number | null>(null);
  const [over, setOver] = useState<number | null>(null);

  const update = (index: number, p: Partial<ToolField>) => onChange(fields.map((f, i) => (i === index ? { ...f, ...p } : f)));
  const move = (from: number, to: number) => {
    if (to < 0 || to >= fields.length || from === to) return;
    const next = [...fields];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    onChange(next);
  };
  const remove = (index: number) => onChange(fields.filter((_, i) => i !== index));

  const onDrop = (e: DragEvent<HTMLLIElement>, index: number) => {
    e.preventDefault();
    if (dragging !== null) move(dragging, index);
    setDragging(null);
    setOver(null);
  };

  if (fields.length === 0) {
    return (
      <p className="px-5 pb-5 text-[13px]" style={{ color: "var(--color-ink-soft)" }}>
        Nessuna domanda: l&apos;istruzione verra&apos; usata cosi&apos; com&apos;e&apos;.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-2 px-3 pb-4">
      {fields.map((f, i) => {
        const choice = f.type === "choice" || f.type === "choice_link";
        const id = `q-${i}`;
        return (
          <li
            key={id}
            onDragOver={(e) => {
              e.preventDefault();
              setOver(i);
            }}
            onDragLeave={() => setOver(null)}
            onDrop={(e) => onDrop(e, i)}
            className="rounded-[12px] p-3 transition-colors"
            style={{ background: over === i && dragging !== i ? "var(--color-wine-tint)" : "var(--color-line-soft)", opacity: dragging === i ? 0.5 : 1 }}
          >
            <div className="flex flex-wrap items-start gap-2">
              <span
                draggable
                onDragStart={() => setDragging(i)}
                onDragEnd={() => {
                  setDragging(null);
                  setOver(null);
                }}
                className="flex h-[44px] w-[28px] shrink-0 cursor-grab items-center justify-center rounded-[8px] active:cursor-grabbing"
                style={{ color: "var(--color-ink-faint)" }}
                aria-hidden
              >
                <GripVertical size={16} strokeWidth={2} />
              </span>
              <div className="flex shrink-0 flex-col gap-0.5">
                <button type="button" onClick={() => move(i, i - 1)} disabled={i === 0} aria-label={`Sposta su ${f.label || f.key}`} className="flex h-[21px] w-[28px] items-center justify-center rounded-[6px] hover:bg-paper disabled:opacity-30" style={{ color: "var(--color-ink-soft)" }}>
                  <ArrowUp size={13} strokeWidth={2.2} />
                </button>
                <button type="button" onClick={() => move(i, i + 1)} disabled={i === fields.length - 1} aria-label={`Sposta giu' ${f.label || f.key}`} className="flex h-[21px] w-[28px] items-center justify-center rounded-[6px] hover:bg-paper disabled:opacity-30" style={{ color: "var(--color-ink-soft)" }}>
                  <ArrowDown size={13} strokeWidth={2.2} />
                </button>
              </div>
              <div className="grid min-w-0 flex-1 gap-2 md:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)_150px_minmax(0,1fr)]">
                <label className="flex flex-col gap-1">
                  <span className="tv-label">ETICHETTA</span>
                  <input
                    value={f.label}
                    onChange={(e) => {
                      const label = e.target.value;
                      // La chiave segue l'etichetta finche' nessuno l'ha toccata a mano.
                      const auto = f.key === keyFromLabel(f.label) || f.key.startsWith("domanda");
                      update(i, auto && keyFromLabel(label) ? { label, key: uniqueKey(keyFromLabel(label), fields.filter((_, j) => j !== i)) } : { label });
                    }}
                    className={inputClass}
                    style={inputStyle}
                    aria-label="Etichetta della domanda"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="tv-label">CHIAVE</span>
                  <input value={f.key} onChange={(e) => update(i, { key: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_") })} className={`tv-mono ${inputClass}`} style={inputStyle} aria-label="Chiave del segnaposto" />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="tv-label">TIPO</span>
                  <select value={f.type} onChange={(e) => update(i, { type: e.target.value as ToolField["type"] })} className={`${inputClass} cursor-pointer`} style={inputStyle} aria-label="Tipo">
                    {FIELD_TYPES.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1">
                  <span className="tv-label">ESEMPIO</span>
                  <input value={f.example} onChange={(e) => update(i, { example: e.target.value })} className={inputClass} style={inputStyle} aria-label="Esempio" placeholder={f.type === "datetime" ? "2026-11-10T12:00" : f.type === "date" ? "2026-11-10" : undefined} />
                </label>
                {choice ? (
                  <label className="flex flex-col gap-1 md:col-span-4">
                    <span className="tv-label">OPZIONI, SEPARATE DA VIRGOLA</span>
                    <input
                      value={(f.options ?? []).join(", ")}
                      onChange={(e) => update(i, { options: e.target.value.split(",").map((o) => o.trim()).filter(Boolean) })}
                      className={inputClass}
                      style={inputStyle}
                      aria-label="Opzioni"
                    />
                  </label>
                ) : null}
              </div>
              <div className="flex shrink-0 items-center gap-2 self-center">
                <span className="flex items-center gap-1.5">
                  <Toggle checked={f.required} onChange={(required) => update(i, { required })} aria-labelledby={`${id}-req`} size="sm" />
                  <span id={`${id}-req`} className="text-[11.5px]" style={{ color: "var(--color-ink-soft)" }}>
                    Obbligatoria
                  </span>
                </span>
                <button type="button" onClick={() => remove(i)} aria-label={`Togli ${f.label || f.key}`} className="flex h-[36px] w-[36px] cursor-pointer items-center justify-center rounded-full hover:bg-paper" style={{ color: "var(--color-danger)" }}>
                  <Trash2 size={15} strokeWidth={2} />
                </button>
              </div>
            </div>
          </li>
        );
      })}
      <li className="px-1 pt-1 text-[11.5px]" style={{ color: "var(--color-ink-faint)" }}>
        La chiave e&apos; quella che va fra le graffe nell&apos;istruzione: {fields.map((f) => `{{${f.key}}}`).join(" ")}. {labelFromKey("suggerimento")}: tieni le etichette corte.
      </li>
    </ul>
  );
}




