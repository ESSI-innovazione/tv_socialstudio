"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, ImageIcon, Loader2, Sparkles, TriangleAlert } from "lucide-react";
import type { ImageChoice, ImagePurpose } from "@/lib/integrations/types";

/**
 * La scelta del visual, sotto i formati.
 *
 * L'archivio aziendale viene prima ed e' gia' pagato: sono fotografie vere di
 * Time Vision. La generazione e' un secondo passo esplicito, perche' consuma
 * crediti e perche' un render non sostituisce una fotografia quando servono
 * persone o aule.
 *
 * Chi genera vede prima cosa sta per spendere, poi sceglie: il visual entra
 * nella campagna solo quando lo si seleziona.
 */

const STYLES: { id: "abstract" | "illustration" | "photo" | "scene"; label: string }[] = [
  { id: "abstract", label: "Astratto 3D" },
  { id: "illustration", label: "Illustrazione" },
  { id: "scene", label: "Scena" },
  { id: "photo", label: "Fotografico" },
];

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
  canGenerate: boolean;
  remainingToday: number;
}

export function ImagePicker({ selectedId, onSelect, purpose }: ImagePickerProps) {
  const [catalogue, setCatalogue] = useState<Catalogue | null>(null);
  const [prompt, setPrompt] = useState("");
  const [style, setStyle] = useState<(typeof STYLES)[number]["id"]>("abstract");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  /** L'ultimo visual arrivato: si segnala, perche' fra dieci miniature sparisce. */
  const [fresh, setFresh] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetch("/api/images")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled && data) setCatalogue(data);
      })
      .catch(() => {
        if (!cancelled) setCatalogue({ archive: [], generated: [], canGenerate: false, remainingToday: 0 });
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const generate = useCallback(async () => {
    if (prompt.trim().length < 8 || busy) return;

    setBusy(true);
    setError(null);

    try {
      const response = await fetch("/api/images", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, purpose, style }),
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error ?? "Generazione non riuscita.");
        return;
      }

      // Il visual nuovo compare fra i generati ma non si seleziona da solo:
      // e' chi guarda a decidere se entra nella campagna.
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
      setPrompt("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Generazione non riuscita.");
    } finally {
      setBusy(false);
    }
  }, [prompt, purpose, style, busy]);

  const all = [...(catalogue?.generated ?? []), ...(catalogue?.archive ?? [])];
  const selected = all.find((c) => c.id === selectedId) ?? null;

  return (
    <section>
      <div className="flex flex-wrap items-baseline justify-between gap-2 pb-2.5">
        <p className="tv-label">VISUAL</p>
        <span className="text-[11.5px]" style={{ color: "var(--color-ink-faint)" }}>
          {selected
            ? selected.origin === "archive"
              ? `dall'archivio · ${selected.label}`
              : "visual generato"
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
              className="relative h-[68px] w-[92px] shrink-0 overflow-hidden rounded-[10px] transition-all"
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
                  className="absolute top-1 left-1 flex h-[16px] items-center gap-1 rounded-[5px] px-1 text-[9px] font-semibold"
                  style={{ background: "rgba(114,0,38,.82)", color: "#ffffff" }}
                >
                  <Sparkles size={9} strokeWidth={2.4} />
                  generato
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
            </button>
          );
        })}

        {all.length === 0 ? (
          <p className="py-3 text-[12px]" style={{ color: "var(--color-ink-faint)" }}>
            Nessun visual disponibile.
          </p>
        ) : null}
      </div>

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
                  {catalogue.canGenerate
                    ? `${catalogue.remainingToday} rimaste oggi · consuma crediti`
                    : "generazione non configurata"}
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
                disabled={busy || prompt.trim().length < 8 || !catalogue?.canGenerate}
                className="tv-pill h-[32px] gap-2 px-4 text-[12.5px] transition-colors"
                style={{
                  background:
                    busy || prompt.trim().length < 8 || !catalogue?.canGenerate
                      ? "var(--color-mute)"
                      : "var(--color-rose)",
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
                Ci vogliono dai 30 ai 60 secondi. Non ricaricare la pagina: il visual comparirà
                qui sopra, nel riquadro tratteggiato.
              </p>
            ) : !catalogue?.canGenerate ? (
              <p className="text-[11.5px]" style={{ color: "var(--color-ink-faint)" }}>
                La generazione non è configurata su questo ambiente.
              </p>
            ) : prompt.trim().length < 8 ? (
              <p className="text-[11.5px]" style={{ color: "var(--color-ink-faint)" }}>
                Scrivi almeno qualche parola per attivare il pulsante.
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
    </section>
  );
}
