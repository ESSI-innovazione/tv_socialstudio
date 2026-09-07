"use client";

import { useCallback, useEffect, useState } from "react";
import {
  BookmarkCheck,
  BookmarkPlus,
  Check,
  ImageIcon,
  Loader2,
  Maximize2,
  RefreshCw,
  Sparkles,
  TriangleAlert,
  X,
} from "lucide-react";
import { DEFAULT_STYLE, STYLES } from "@/lib/integrations/visual-styles";
import type { ImageChoice, ImagePurpose, VisualEngine, VisualStyle } from "@/lib/integrations/types";

/**
 * La scelta del visual, sotto i formati.
 *
 * L'archivio aziendale viene prima: sono fotografie vere di Time Vision, e un
 * render non le sostituisce quando servono persone o aule. La generazione e'
 * un secondo passo esplicito, per i key visual dove una fotografia non c'e'.
 *
 * Il visual entra nella campagna solo quando lo si seleziona. E quando non
 * convince, «rigenera» ne rifa' una variante con lo stesso prompt: e' la via
 * normale per cambiare immagine, molto piu' corta che riscrivere la richiesta.
 *
 * Generare non e' archiviare. Un visual appena fatto resta in questa sessione:
 * si puo' usare subito, ma fra quelli proposti a tutti entra solo se qualcuno
 * lo salva. Prima ogni tentativo finiva in archivio, scarti compresi.
 */

export interface ImagePickerProps {
  /** L'id del visual scelto: un file d'archivio o un generato. */
  selectedId: string | null;
  onSelect: (choice: ImageChoice | null) => void;
  /** Il formato principale, che decide la proporzione del visual generato. */
  purpose: ImagePurpose;
}

interface Catalogue {
  archive: ImageChoice[];
  generated: ImageChoice[];
  remainingToday: number;
  /** Il motore configurato su questo ambiente. */
  engine: VisualEngine;
  gammaAvailable: boolean;
  /** Riguarda solo Pollinations: Gamma l'italiano lo capisce da se'. */
  translates: boolean;
}

export function ImagePicker({ selectedId, onSelect, purpose }: ImagePickerProps) {
  const [catalogue, setCatalogue] = useState<Catalogue | null>(null);
  const [prompt, setPrompt] = useState("");
  const [style, setStyle] = useState<VisualStyle>(DEFAULT_STYLE);
  /** Il motore scelto per questa generazione. Null = quello configurato. */
  const [engine, setEngine] = useState<VisualEngine | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  /** L'ultimo visual arrivato: si segnala, perche' fra dieci miniature sparisce. */
  const [fresh, setFresh] = useState<string | null>(null);
  /** Il visual aperto a grandezza piena. Scegliere alla cieca da 92px non si puo'. */
  const [preview, setPreview] = useState<ImageChoice | null>(null);
  /** L'id del visual che si sta salvando in archivio, per lo spinner. */
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetch("/api/images")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled && data) setCatalogue(data);
      })
      .catch(() => {
        if (!cancelled) setCatalogue({
            archive: [],
            generated: [],
            remainingToday: 0,
            engine: "flux",
            gammaAvailable: false,
            translates: false,
          });
      });

    return () => {
      cancelled = true;
    };
  }, []);

  /**
   * Una richiesta al motore, comune alla prima generazione e alle varianti.
   *
   * Il visual nuovo compare fra i generati ma non si seleziona da solo: e' chi
   * guarda a decidere se entra nella campagna.
   */
  const send = useCallback(
    async (body: Record<string, unknown>): Promise<boolean> => {
      setError(null);

      try {
        const response = await fetch("/api/images", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ purpose, ...body }),
        });
        const data = await response.json();

        if (!response.ok) {
          setError(data.error ?? "Generazione non riuscita.");
          return false;
        }

        setCatalogue((current) =>
          current
            ? {
                ...current,
                generated: [data.image, ...current.generated],
                remainingToday: Math.max(0, current.remainingToday - 1),
              }
            : current,
        );
        setFresh(data.image.id);
        return true;
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Generazione non riuscita.");
        return false;
      }
    },
    [purpose],
  );

  const generate = useCallback(async () => {
    if (prompt.trim().length < 8 || busy) return;

    setBusy(true);
    const ok = await send({ prompt, style, ...(engine ? { engine } : {}) });
    if (ok) setPrompt("");
    setBusy(false);
  }, [prompt, style, engine, busy, send]);

  /**
   * Un'altra versione dello stesso visual: stesso prompt, stesso stile, seme
   * nuovo. Il prompt lo eredita il server dalla riga di provenienza, cosi' una
   * variante resta legata a cosa era stato chiesto davvero.
   */
  const regenerate = useCallback(
    async (source: ImageChoice) => {
      if (busy || !source.prompt) return;

      setBusy(true);
      setPreview(null);
      const ok = await send({
        from: { prompt: source.prompt, style: source.style, engine: source.engine },
      });
      if (ok) setOpen(false);
      setBusy(false);
    },
    [busy, send],
  );

  /**
   * Tenere un visual. Quello appena generato vive solo in questa sessione:
   * da qui in poi lo ritrova chiunque apra l'archivio.
   */
  const save = useCallback(
    async (choice: ImageChoice) => {
      if (saving || choice.saved) return;

      setSaving(choice.id);
      setError(null);
      try {
        const response = await fetch(`/api/images/${encodeURIComponent(choice.id)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ saved: true }),
        });
        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          setError(data.error ?? "Salvataggio non riuscito.");
          return;
        }

        setCatalogue((current) =>
          current
            ? {
                ...current,
                generated: current.generated.map((g) => (g.id === choice.id ? { ...g, saved: true } : g)),
              }
            : current,
        );
        setPreview((current) => (current && current.id === choice.id ? { ...current, saved: true } : current));
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Salvataggio non riuscito.");
      } finally {
        setSaving(null);
      }
    },
    [saving],
  );

  /** Il motore che verra' davvero usato: la scelta, o il default d'ambiente. */
  const current: VisualEngine = engine ?? catalogue?.engine ?? "flux";

  const all = [...(catalogue?.generated ?? []), ...(catalogue?.archive ?? [])];
  const selected = all.find((c) => c.id === selectedId) ?? null;
  /** L'ultimo arrivato, finche' e' ancora da decidere: tenerlo o no. */
  const freshChoice = catalogue?.generated.find((c) => c.id === fresh) ?? null;

  return (
    <section>
      <div className="flex flex-wrap items-baseline justify-between gap-2 pb-2.5">
        <p className="tv-label">VISUAL</p>
        <span className="text-[11.5px]" style={{ color: "var(--color-ink-faint)" }}>
          {selected
            ? selected.origin === "archive"
              ? `dall'archivio · ${selected.label}`
              : selected.saved
                ? "visual generato · passa sopra la miniatura per rigenerarlo"
                : "visual generato, non in archivio · salvalo per ritrovarlo"
            : "l'archivio aziendale è la prima scelta"}
        </span>
      </div>

      {/* --------- la griglia delle scelte --------- */}
      <div className="flex flex-wrap gap-2.5">
        {/* Mentre si genera, il posto si vede: e' li' che comparira'. */}
        {busy ? (
          <div
            className="flex h-[68px] w-[92px] shrink-0 flex-col items-center justify-center gap-1.5 rounded-[10px]"
            style={{
              border: "2px dashed var(--color-rose)",
              background: "var(--color-wine-tint)",
            }}
          >
            <Loader2 size={16} strokeWidth={2.2} className="tv-anim-spin" style={{ color: "var(--color-rose)" }} />
            <span className="text-[9.5px] font-semibold" style={{ color: "var(--color-wine)" }}>
              in arrivo…
            </span>
          </div>
        ) : null}

        {all.map((choice) => {
          const on = choice.id === selectedId;
          return (
            <button
              key={choice.id}
              type="button"
              onClick={() => onSelect(on ? null : choice)}
              aria-pressed={on}
              title={choice.prompt ?? choice.label}
              className="group relative h-[68px] w-[92px] shrink-0 overflow-hidden rounded-[10px] transition-all"
              style={{
                border: `2px solid ${
                  on
                    ? "var(--color-rose)"
                    : choice.id === fresh
                      ? "var(--color-coral)"
                      : "var(--color-line)"
                }`,
                boxShadow: on
                  ? "0 0 0 3px rgb(206 66 87 / 0.12)"
                  : choice.id === fresh
                    ? "0 0 0 3px rgb(255 127 81 / 0.22)"
                    : "none",
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={choice.url}
                alt={choice.label}
                className="h-full w-full object-cover"
                loading="lazy"
              />
              {choice.origin === "generated" ? (
                <span
                  className="absolute top-1 left-1 flex h-[16px] items-center gap-1 rounded-[5px] px-1 text-[9px] font-semibold transition-opacity group-hover:opacity-0"
                  style={{
                    background: choice.saved ? "rgba(114,0,38,.82)" : "rgba(255,127,81,.92)",
                    color: "#ffffff",
                  }}
                >
                  <Sparkles size={9} strokeWidth={2.4} />
                  {choice.saved ? "generato" : "non salvato"}
                </span>
              ) : null}
              {on ? (
                <span
                  className="absolute right-1 bottom-1 flex h-[18px] w-[18px] items-center justify-center rounded-full"
                  style={{ background: "var(--color-rose)", color: "#ffffff" }}
                >
                  <Check size={11} strokeWidth={3} />
                </span>
              ) : null}

              {/* Cambiare immagine senza riscrivere il prompt: e' il gesto piu'
                  frequente, quindi sta sulla miniatura e non in un menu. */}
              {choice.origin === "generated" && choice.prompt ? (
                <span
                  role="button"
                  tabIndex={0}
                  aria-label="Rigenera una variante"
                  title="Rigenera: stesso prompt, immagine diversa"
                  onClick={(event) => {
                    event.stopPropagation();
                    void regenerate(choice);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.stopPropagation();
                      void regenerate(choice);
                    }
                  }}
                  className="absolute bottom-1 left-1 flex h-[18px] w-[18px] items-center justify-center rounded-[5px] opacity-0 transition-opacity group-hover:opacity-100"
                  style={{ background: "rgba(42,17,25,.72)", color: "#ffffff" }}
                >
                  <RefreshCw size={10} strokeWidth={2.4} />
                </span>
              ) : null}

              {/* Tenere il visual: il generato nasce fuori dall'archivio. */}
              {choice.origin === "generated" && !choice.saved ? (
                <span
                  role="button"
                  tabIndex={0}
                  aria-label="Salva nell'archivio"
                  title="Salva nell'archivio: resta disponibile per le prossime campagne"
                  aria-busy={saving === choice.id}
                  onClick={(event) => {
                    event.stopPropagation();
                    void save(choice);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.stopPropagation();
                      void save(choice);
                    }
                  }}
                  className="absolute bottom-1 left-[26px] flex h-[18px] w-[18px] items-center justify-center rounded-[5px] opacity-0 transition-opacity group-hover:opacity-100"
                  style={{ background: "var(--color-coral)", color: "#ffffff" }}
                >
                  {saving === choice.id ? (
                    <Loader2 size={10} strokeWidth={2.4} className="tv-anim-spin" />
                  ) : (
                    <BookmarkPlus size={10} strokeWidth={2.4} />
                  )}
                </span>
              ) : null}

              {/* Ingrandire non e' scegliere: sono due gesti diversi. */}
              <span
                role="button"
                tabIndex={0}
                aria-label="Ingrandisci"
                title="Ingrandisci"
                onClick={(event) => {
                  event.stopPropagation();
                  setPreview(choice);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.stopPropagation();
                    setPreview(choice);
                  }
                }}
                className="absolute top-1 right-1 flex h-[18px] w-[18px] items-center justify-center rounded-[5px] opacity-0 transition-opacity group-hover:opacity-100"
                style={{ background: "rgba(42,17,25,.72)", color: "#ffffff" }}
              >
                <Maximize2 size={10} strokeWidth={2.4} />
              </span>
            </button>
          );
        })}

        {all.length === 0 ? (
          <p className="py-3 text-[12px]" style={{ color: "var(--color-ink-faint)" }}>
            Nessun visual disponibile.
          </p>
        ) : null}
      </div>

      {/* --------- l'ultimo generato: tenerlo o no --------- */}
      {freshChoice && !busy ? (
        <div
          className="mt-3 flex flex-wrap items-center gap-2.5 rounded-[10px] px-3 py-2.5"
          style={{
            background: freshChoice.saved ? "var(--color-success-bg)" : "var(--color-warm-tint)",
            color: freshChoice.saved ? "var(--color-success)" : "var(--color-warning)",
          }}
        >
          {freshChoice.saved ? (
            <>
              <BookmarkCheck size={14} strokeWidth={2.2} className="shrink-0" />
              <span className="flex-1 text-[12px] leading-[1.45]">
                Visual salvato nell&apos;archivio: lo ritrovi anche nelle prossime campagne.
              </span>
            </>
          ) : (
            <>
              <Sparkles size={14} strokeWidth={2.2} className="shrink-0" />
              <span className="min-w-[200px] flex-1 text-[12px] leading-[1.45]">
                Visual pronto. Puoi usarlo subito, ma resta solo in questa sessione: salvalo se
                vuoi ritrovarlo in archivio.
              </span>
              <button
                type="button"
                onClick={() => void save(freshChoice)}
                disabled={saving === freshChoice.id}
                className="tv-pill h-[30px] gap-1.5 px-3 text-[12px] transition-colors"
                style={{
                  background: "var(--color-coral)",
                  color: "#ffffff",
                  cursor: saving === freshChoice.id ? "wait" : "pointer",
                }}
              >
                {saving === freshChoice.id ? (
                  <Loader2 size={13} strokeWidth={2.4} className="tv-anim-spin" />
                ) : (
                  <BookmarkPlus size={13} strokeWidth={2.4} />
                )}
                Salva nell&apos;archivio
              </button>
            </>
          )}
        </div>
      ) : null}

      {error && !open ? (
        <p
          className="mt-2 flex items-start gap-1.5 rounded-[8px] px-2.5 py-2 text-[11.5px] leading-[1.45]"
          style={{ background: "var(--color-warm-tint)", color: "var(--color-warning)" }}
        >
          <TriangleAlert size={13} strokeWidth={2} className="mt-px shrink-0" />
          {error}
        </p>
      ) : null}

      {/* --------- generare un visual nuovo --------- */}
      <div className="pt-3">
        {!open ? (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="tv-pill h-[32px] gap-2 px-3.5 text-[12.5px] transition-colors"
            style={{
              border: "1px dashed var(--color-line)",
              color: "var(--color-ink-soft)",
              background: "transparent",
            }}
          >
            <ImageIcon size={14} strokeWidth={1.9} />
            Genera un visual
          </button>
        ) : (
          <div
            className="flex flex-col gap-2.5 rounded-[12px] p-3"
            style={{ background: "var(--color-line-soft)" }}
          >
            <div className="flex flex-wrap items-center gap-2">
              <p className="tv-label">NUOVO VISUAL</p>
              <div className="flex-1" />
              {catalogue ? (
                <span className="text-[11px]" style={{ color: "var(--color-ink-faint)" }}>
                  {current === "gamma"
                    ? `${catalogue.remainingToday} rimaste oggi · Gamma, consuma crediti`
                    : `${catalogue.remainingToday} rimaste oggi · gratuita`}
                </span>
              ) : null}
            </div>

            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={2}
              placeholder="Descrivi il visual: soggetto, atmosfera, cosa deve suggerire. Niente testo: quello lo mette il compositore."
              className="w-full resize-none rounded-[9px] px-3 py-2 text-[13px] leading-[1.5] outline-none"
              style={{
                background: "var(--color-paper)",
                border: "1px solid var(--color-line)",
                color: "var(--color-ink)",
              }}
            />

            {catalogue?.gammaAvailable ? (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px]" style={{ color: "var(--color-ink-faint)" }}>
                  MOTORE
                </span>
                {(
                  [
                    { id: "gamma" as const, label: "Gamma", note: "2048px · crediti" },
                    { id: "flux" as const, label: "Gratuito", note: "768px" },
                  ]
                ).map((e) => {
                  const on = e.id === current;
                  return (
                    <button
                      key={e.id}
                      type="button"
                      onClick={() => setEngine(e.id)}
                      aria-pressed={on}
                      title={e.note}
                      className="tv-pill h-[28px] px-3 text-[11.5px] transition-colors"
                      style={{
                        background: on ? "var(--color-wine)" : "var(--color-paper)",
                        color: on ? "#ffffff" : "var(--color-ink-soft)",
                        border: `1px solid ${on ? "var(--color-wine)" : "var(--color-line)"}`,
                      }}
                    >
                      {e.label}
                    </button>
                  );
                })}
              </div>
            ) : null}

            <div className="flex flex-wrap items-center gap-1.5">
              {STYLES.map((s) => {
                const on = s.id === style;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setStyle(s.id)}
                    aria-pressed={on}
                    className="tv-pill h-[28px] px-3 text-[11.5px] transition-colors"
                    style={{
                      background: on ? "var(--color-wine)" : "var(--color-paper)",
                      color: on ? "#ffffff" : "var(--color-ink-soft)",
                      border: `1px solid ${on ? "var(--color-wine)" : "var(--color-line)"}`,
                    }}
                  >
                    {s.label}
                  </button>
                );
              })}

              <div className="flex-1" />

              <button
                type="button"
                onClick={() => setOpen(false)}
                className="tv-pill h-[32px] px-3 text-[12px]"
                style={{ color: "var(--color-ink-faint)", background: "transparent" }}
              >
                Annulla
              </button>
              <button
                type="button"
                onClick={generate}
                disabled={busy || prompt.trim().length < 8}
                className="tv-pill h-[32px] gap-2 px-4 text-[12.5px] transition-colors"
                style={{
                  background:
                    busy || prompt.trim().length < 8 ? "var(--color-mute)" : "var(--color-rose)",
                  color: "#ffffff",
                  cursor: busy ? "wait" : "pointer",
                }}
              >
                {busy ? (
                  <>
                    <Loader2 size={13} strokeWidth={2.4} className="tv-anim-spin" />
                    In corso…
                  </>
                ) : (
                  <>
                    <Sparkles size={13} strokeWidth={2.2} />
                    Genera
                  </>
                )}
              </button>
            </div>

            {busy ? (
              <p
                className="flex items-center gap-1.5 rounded-[8px] px-2.5 py-2 text-[11.5px]"
                style={{ background: "var(--color-warm-tint)", color: "var(--color-warning)" }}
              >
                <Loader2 size={13} strokeWidth={2.2} className="tv-anim-spin" />
                Ci vogliono dai 10 ai 45 secondi. Non ricaricare la pagina: il visual comparirà
                qui sopra, nel riquadro tratteggiato.
              </p>
            ) : prompt.trim().length < 8 ? (
              <p className="text-[11.5px]" style={{ color: "var(--color-ink-faint)" }}>
                Scrivi almeno qualche parola per attivare il pulsante.
              </p>
            ) : null}

            {catalogue && current === "flux" && !catalogue.translates ? (
              <p
                className="flex items-start gap-1.5 rounded-[8px] px-2.5 py-2 text-[11.5px] leading-[1.45]"
                style={{ background: "var(--color-warm-tint)", color: "var(--color-warning)" }}
              >
                <TriangleAlert size={13} strokeWidth={2} className="mt-px shrink-0" />
                Il prompt parte in italiano: il modello e&apos; addestrato in inglese e tende a
                perdere il soggetto. Con ANTHROPIC_API_KEY impostata viene tradotto prima, e i
                visual somigliano molto di piu&apos; a quello che hai scritto.
              </p>
            ) : null}

            {error ? (
              <p
                className="flex items-start gap-1.5 rounded-[8px] px-2.5 py-2 text-[11.5px] leading-[1.45]"
                style={{ background: "var(--color-warm-tint)", color: "var(--color-warning)" }}
              >
                <TriangleAlert size={13} strokeWidth={2} className="mt-px shrink-0" />
                {error}
              </p>
            ) : null}
          </div>
        )}
      </div>
      {preview ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Anteprima del visual"
          onClick={() => setPreview(null)}
          className="fixed inset-0 z-50 flex items-center justify-center p-8"
          style={{ background: "rgba(42,17,25,.72)" }}
        >
          <div
            onClick={(event) => event.stopPropagation()}
            className="flex max-h-full w-full max-w-[720px] flex-col gap-3 overflow-auto rounded-card-lg p-4"
            style={{ background: "var(--color-paper)" }}
          >
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <p className="tv-label">
                  {preview.origin === "generated" ? "VISUAL GENERATO" : "ARCHIVIO AZIENDALE"}
                </p>
                <p
                  className="mt-1 text-[12.5px] leading-[1.5]"
                  style={{ color: "var(--color-ink-soft)" }}
                >
                  {preview.prompt ?? preview.label}
                </p>
                <p className="mt-1 text-[11px]" style={{ color: "var(--color-ink-faint)" }}>
                  {preview.width} × {preview.height}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPreview(null)}
                aria-label="Chiudi"
                className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full"
                style={{ background: "var(--color-line-soft)", color: "var(--color-ink-soft)" }}
              >
                <X size={15} strokeWidth={2.2} />
              </button>
            </div>

            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={preview.url}
              alt={preview.label}
              className="w-full rounded-[10px] object-contain"
              style={{ maxHeight: "60vh", background: "var(--color-canvas)" }}
            />

            <p className="text-[11.5px] leading-[1.5]" style={{ color: "var(--color-ink-faint)" }}>
              Sull&apos;asset finale il visual passa sotto il velo del brand: qui lo vedi grezzo,
              come lo ha prodotto il modello.
            </p>

            <div className="flex items-center gap-2">
              {preview.origin === "generated" && preview.prompt ? (
                <button
                  type="button"
                  onClick={() => void regenerate(preview)}
                  disabled={busy}
                  title="Stesso prompt, stesso stile, immagine diversa"
                  className="tv-pill h-[36px] gap-2 px-4 text-[13px]"
                  style={{
                    border: "1px solid var(--color-line)",
                    color: busy ? "var(--color-ink-faint)" : "var(--color-wine)",
                    cursor: busy ? "wait" : "pointer",
                  }}
                >
                  <RefreshCw size={14} strokeWidth={2.2} className={busy ? "tv-anim-spin" : undefined} />
                  Rigenera
                </button>
              ) : null}
              {preview.origin === "generated" && !preview.saved ? (
                <button
                  type="button"
                  onClick={() => void save(preview)}
                  disabled={saving === preview.id}
                  title="Resta disponibile per le prossime campagne"
                  className="tv-pill h-[36px] gap-2 px-4 text-[13px]"
                  style={{
                    border: "1px solid var(--color-coral)",
                    color: "var(--color-coral)",
                    cursor: saving === preview.id ? "wait" : "pointer",
                  }}
                >
                  {saving === preview.id ? (
                    <Loader2 size={14} strokeWidth={2.2} className="tv-anim-spin" />
                  ) : (
                    <BookmarkPlus size={14} strokeWidth={2.2} />
                  )}
                  Salva nell&apos;archivio
                </button>
              ) : null}
              {preview.origin === "generated" && preview.saved ? (
                <span
                  className="tv-pill h-[36px] gap-2 px-3 text-[12.5px]"
                  style={{ background: "var(--color-success-bg)", color: "var(--color-success)" }}
                >
                  <BookmarkCheck size={14} strokeWidth={2.2} />
                  In archivio
                </span>
              ) : null}
              <div className="flex-1" />
              <button
                type="button"
                onClick={() => setPreview(null)}
                className="tv-pill h-[36px] px-4 text-[13px]"
                style={{ border: "1px solid var(--color-line)", color: "var(--color-ink-soft)" }}
              >
                Chiudi
              </button>
              <button
                type="button"
                onClick={() => {
                  onSelect(preview);
                  setPreview(null);
                }}
                className="tv-pill h-[36px] gap-2 px-4 text-[13px]"
                style={{ background: "var(--color-rose)", color: "#ffffff" }}
              >
                <Check size={14} strokeWidth={2.4} />
                Usa questo visual
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
