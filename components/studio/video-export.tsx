"use client";

import { useEffect, useState } from "react";
import { Download, Loader2, Play, RotateCcw } from "lucide-react";
import { FORMATS, type FormatId } from "@/lib/brand";
import type { AssetLayout } from "@/lib/layout-model";
import type { Run, VariantCopy } from "@/lib/types";
import type { VideoView } from "@/lib/video/jobs";

/**
 * L'export MP4 nel pannello Esporta.
 *
 * Una riga per variante e formato. Il video non esiste finche' non lo si
 * chiede: un bottone lo avvia, la riga mostra lo stato, e a fine corsa
 * offre il file e un'anteprima. I lavori vivono sul server: chi ricarica
 * la pagina ritrova quelli gia' fatti per questa esecuzione.
 */

interface Props {
  run: Run;
  variants: VariantCopy[];
  formats: FormatId[];
  layouts: Record<string, AssetLayout>;
}

const OPEN = new Set<VideoView["status"]>(["pending", "rendering"]);

function keyOf(variant: number, format: FormatId): string {
  return `${variant}:${format}`;
}

function placeholder(variant: number, format: FormatId): VideoView {
  return {
    id: "",
    status: "pending",
    format,
    variant,
    url: null,
    downloadUrl: null,
    width: null,
    height: null,
    durationMs: null,
    music: null,
    error: null,
    attempts: 0,
    createdAt: "",
  };
}

export function VideoExport({ run, variants, formats, layouts }: Props) {
  const [jobs, setJobs] = useState<Record<string, VideoView>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [music, setMusic] = useState<boolean | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  // I video gia' fatti per questa esecuzione: il piu' recente per riga.
  useEffect(() => {
    let alive = true;
    fetch(`/api/videos?runId=${encodeURIComponent(run.id)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { videos: VideoView[]; music: boolean } | null) => {
        if (!alive || !data) return;
        setMusic(data.music);
        setJobs((prev) => {
          const next = { ...prev };
          for (const v of data.videos) {
            const k = keyOf(v.variant, v.format);
            if (!next[k]) next[k] = v;
          }
          return next;
        });
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [run.id]);

  // Finche' c'e' un lavoro aperto, si interroga ogni tre secondi.
  const openIds = Object.values(jobs)
    .filter((j) => j.id && OPEN.has(j.status))
    .map((j) => j.id)
    .join(",");

  useEffect(() => {
    if (!openIds) return;
    const timer = setInterval(async () => {
      for (const id of openIds.split(",")) {
        try {
          const r = await fetch(`/api/videos/${id}`);
          if (!r.ok) continue;
          const { video } = (await r.json()) as { video: VideoView };
          setJobs((prev) => ({ ...prev, [keyOf(video.variant, video.format)]: video }));
        } catch {
          // Un poll perso non e' un errore: il prossimo arriva fra tre secondi.
        }
      }
    }, 3000);
    return () => clearInterval(timer);
  }, [openIds]);

  const generate = async (variant: VariantCopy, format: FormatId) => {
    const k = keyOf(variant.index, format);
    setErrors((prev) => {
      const next = { ...prev };
      delete next[k];
      return next;
    });
    setJobs((prev) => ({ ...prev, [k]: placeholder(variant.index, format) }));

    try {
      const res = await fetch("/api/videos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          runId: run.id,
          variant: variant.index,
          format,
          copy: variant,
          layout: layouts[k] ?? null,
          photo: run.brief?.photo ?? null,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { video?: VideoView; error?: string };
      if (!res.ok || !data.video) {
        throw new Error(data.error ?? "Non sono riuscito ad avviare il video.");
      }
      setJobs((prev) => ({ ...prev, [k]: data.video! }));
    } catch (error) {
      setJobs((prev) => {
        const next = { ...prev };
        delete next[k];
        return next;
      });
      setErrors((prev) => ({ ...prev, [k]: error instanceof Error ? error.message : String(error) }));
    }
  };

  return (
    <div className="flex flex-col gap-1.5">
      <p className="tv-label">VIDEO</p>

      {variants.flatMap((v) =>
        formats.map((f) => {
          const k = keyOf(v.index, f);
          const job = jobs[k];
          const spec = FORMATS[f];
          const open = job ? OPEN.has(job.status) : false;

          return (
            <div
              key={k}
              className="flex flex-col gap-2 rounded-[10px] px-3 py-2.5"
              style={{ border: "1px solid var(--color-line)", background: "var(--color-paper)" }}
            >
              <div className="flex items-center gap-2 text-[13px]" style={{ color: "var(--color-ink)" }}>
                <span className="font-semibold">
                  V{v.index + 1} · {spec.label}
                </span>
                <span className="ml-auto text-[11.5px] font-normal" style={{ color: "var(--color-ink-faint)" }}>
                  {spec.width}×{spec.height} · 8 s
                </span>
              </div>

              {!job || job.status === "failed" ? (
                <div className="flex flex-col gap-1.5">
                  {job?.error ? (
                    <p className="text-[12px] leading-[1.45]" style={{ color: "var(--color-warning)" }}>
                      {job.error}
                    </p>
                  ) : null}
                  {errors[k] ? (
                    <p className="text-[12px] leading-[1.45]" style={{ color: "var(--color-warning)" }}>
                      {errors[k]}
                    </p>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => generate(v, f)}
                    className="tv-pill h-[34px] w-fit cursor-pointer gap-2 px-3.5 text-[12.5px] transition-colors hover:bg-line-soft"
                    style={{ border: "1px solid var(--color-line)", color: "var(--color-ink)" }}
                  >
                    {job ? <RotateCcw size={13} strokeWidth={2} /> : <Play size={13} strokeWidth={2} />}
                    {job ? "Riprova" : "Genera video"}
                  </button>
                </div>
              ) : null}

              {open ? (
                <p className="flex items-center gap-2 text-[12px]" style={{ color: "var(--color-ink-faint)" }}>
                  <Loader2 size={13} strokeWidth={2} className="animate-spin" />
                  In lavorazione, circa un minuto.
                </p>
              ) : null}

              {job?.status === "ready" && job.url ? (
                <div className="flex flex-col gap-2">
                  <div className="flex flex-wrap gap-1.5">
                    <a
                      href={job.downloadUrl ?? job.url}
                      className="tv-pill h-[34px] gap-2 px-3.5 text-[12.5px] transition-colors hover:bg-line-soft"
                      style={{ border: "1px solid var(--color-line)", color: "var(--color-ink)" }}
                    >
                      <Download size={13} strokeWidth={2} style={{ color: "var(--color-rose)" }} />
                      Scarica MP4
                    </a>
                    <button
                      type="button"
                      onClick={() => setPreview(preview === k ? null : k)}
                      className="tv-pill h-[34px] cursor-pointer gap-2 px-3.5 text-[12.5px] transition-colors hover:bg-line-soft"
                      style={{ border: "1px solid var(--color-line)", color: "var(--color-ink)" }}
                    >
                      <Play size={13} strokeWidth={2} />
                      {preview === k ? "Chiudi" : "Anteprima"}
                    </button>
                    <button
                      type="button"
                      onClick={() => generate(v, f)}
                      className="tv-pill h-[34px] cursor-pointer gap-2 px-3 text-[12.5px] transition-colors hover:bg-line-soft"
                      style={{ border: "1px solid var(--color-line)", color: "var(--color-ink-faint)" }}
                      title="Rifai il video con l'impaginazione attuale"
                    >
                      <RotateCcw size={13} strokeWidth={2} />
                    </button>
                  </div>
                  {preview === k ? (
                    <video
                      src={job.url}
                      controls
                      playsInline
                      preload="metadata"
                      className="w-full rounded-[8px]"
                      style={{ background: "#000", maxHeight: 360 }}
                    />
                  ) : null}
                </div>
              ) : null}
            </div>
          );
        }),
      )}

      {formats.length === 0 ? (
        <p className="text-[12.5px]" style={{ color: "var(--color-ink-faint)" }}>
          Scegli almeno un formato.
        </p>
      ) : null}

      {music === false ? (
        <p className="text-[11.5px] leading-[1.45]" style={{ color: "var(--color-ink-faint)" }}>
          Senza musica: la base del brand non è ancora nel repo (assets/audio/brand-bed.mp3).
        </p>
      ) : music === true ? (
        <p className="text-[11.5px] leading-[1.45]" style={{ color: "var(--color-ink-faint)" }}>
          Con la base musicale del brand, in dissolvenza.
        </p>
      ) : null}
    </div>
  );
}
