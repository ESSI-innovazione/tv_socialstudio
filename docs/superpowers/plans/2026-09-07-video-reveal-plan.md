# Piano: video reveal

Spec: `docs/superpowers/specs/2026-09-07-video-reveal-design.md`.
Ordine scelto perche' i pezzi puri arrivano prima, con i test, e quelli con
Chromium e ffmpeg si provano a mano una volta sola.

1. `lib/video/spec.ts` — misure video per formato, durata, fps, freni, percorso musica.
2. `lib/video/timeline.ts` — schedule del reveal dal layout; tempi dei fotogrammi.
3. `lib/db-videos.ts` — tabella `videos` con ripiego in memoria.
4. `lib/video/errors.ts` — `VideoError`, `VideoLimitError`, `VideoRenderError`.
5. `lib/video/jobs.ts` — `startVideo`, `advance(id, render)`, `listForRun`, `toVideoView`.
6. `scripts/video.test.cjs` + `test:video` in package.json. Rosso, poi verde.
7. `lib/render/chromium.ts` — `launch()` condiviso; `print-renderer.tsx` lo usa.
8. `components/studio/asset-canvas.tsx` — `data-block-id` / `data-block-kind`.
9. `lib/video/page.tsx`, `capture.ts`, `encode.ts`, `render.ts`.
10. Rotte: `app/api/videos/route.ts`, `[id]/route.ts`, `[id]/file/route.ts`, `drain/route.ts`.
11. Pannello Esporta: voce MP4, generazione, stato, anteprima, download.
12. `next.config.ts`, `vercel.json`, `.env.example`, README, `supabase/migrations-007-videos.sql`.
13. Verifica locale con `CHROME_PATH`; `ffmpeg -i` sul file.
14. Migrazione sul progetto Supabase; commit; push su main; controllo del deploy e dei log.
