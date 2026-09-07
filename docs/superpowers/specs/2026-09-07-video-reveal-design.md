# Video breve dall'asset: il "reveal"

Data: 2026-09-07. Stato: approvato in chat, in implementazione.

## Cosa si costruisce

Dall'editor, per ogni variante e formato, un MP4 di 8 secondi in cui l'asset
prende vita: la foto scivola da un leggero zoom al riposo, il marchio appare
subito, i testi entrano uno dopo l'altro dall'alto verso il basso, poi tutto
resta fermo. Sotto, una base musicale del brand con dissolvenza in entrata e in
uscita. Il layout e' lo stesso che l'editor mostra: un solo compositore.

Formati: tutti e quattro. Le dimensioni video devono essere pari (H.264):

| formato    | cattura    | scala | video      |
|------------|------------|-------|------------|
| ig-story   | 1080x1920  | 1     | 1080x1920  |
| ig-feed    | 1080x1080  | 1     | 1080x1080  |
| linkedin   | 1200x627   | 1     | 1200x626 (ritaglio di 1 px) |
| poster-a4  | 794x1123   | 2     | 1588x2246  |

## Perche' cosi'

Ne' Figma ne' Gamma producono video. Il repo ha gia' Chromium headless per il
poster e lo stesso componente `AssetCanvas` per anteprima ed export. Il video
e' quel componente, animato con CSS, fotografato fotogramma per fotogramma a
tempi esatti, e codificato da un binario ffmpeg incluso nel pacchetto. Remotion
avrebbe aggiunto un secondo compositore e una licenza aziendale; WebCodecs nel
browser non scrive H.264.

## Movimento

Calcolato dal layout, quindi un'impaginazione modificata anima nell'ordine in
cui la si vede:

- `image`: trasformazione `scale(1.06)` a `scale(1)` sull'intera durata.
- `logo`: opacita' 0 a 1 in 500 ms, da subito.
- blocchi di testo (eyebrow, headline, subhead, body, badge, cta, disclaimer)
  ordinati per `y` crescente: opacita' 0 a 1 e `translateY(24px)` a 0 in
  600 ms, curva `cubic-bezier(0.2, 0.8, 0.2, 1)`, ritardo `400 + i * 260` ms.
- durata 8000 ms a 30 fps: 240 fotogrammi. Fotogramma `n` al tempo
  `n * 1000 / 30` ms.

La cattura e' deterministica: si mettono in pausa tutte le animazioni e si
imposta `currentTime` prima di ogni scatto, in un solo `page.evaluate`.

## Audio

`assets/audio/brand-bed.mp3` (nome fisso). ffmpeg lo ripete sotto la clip,
dissolvenza in entrata 0,5 s e in uscita 1 s. Se il file manca, il video ha
una traccia audio silenziosa (AAC) cosi' che ogni piattaforma lo accetti, e il
pannello lo dice. Il brano licenziato va aggiunto dal marketing.

## Lavoro durevole

Copia del pattern dei documenti Gamma (`documents`): tabella `videos` con la
richiesta intera in JSON (`copy`, `layout`, `photo`, `archetype`, formato,
variante), stato `pending | rendering | ready | failed`, `stored_path`,
dimensioni, `attempts`, `error`, `started_at`.

- `POST /api/videos` registra la riga, risponde 202, poi renderizza nella
  stessa funzione dopo la risposta (`after()` di Next), cosi' il poll non
  aspetta.
- `GET /api/videos/[id]` legge lo stato. Se il lavoro e' `pending` da piu' di
  20 s o `rendering` da piu' di 6 minuti (oltre il `maxDuration` di 300 s),
  lo riprende: un secondo tentativo, poi `failed`.
- `GET /api/videos?runId=` elenca i video di un'esecuzione, per sopravvivere
  a un refresh.
- `GET /api/videos/drain` (cron ogni 5 minuti, come i documenti) riprende
  quelli persi.
- `GET /api/videos/[id]/file` serve l'MP4 dallo store con supporto a `Range`
  (206), dietro `currentUser()`. `?download=1` forza l'allegato.

Freni: 2 render in volo, 40 al giorno. Come per Gamma, ma su CPU invece che
su crediti.

## Rendering

- `lib/render/chromium.ts`: il `launch()` estratto da `print-renderer.tsx`,
  condiviso.
- `AssetCanvas` emette `data-block-id` e `data-block-kind` su ogni blocco.
  Satori li ignora: il PNG non cambia.
- `lib/video/page.tsx`: HTML statico del canvas + `@font-face` in base64 dei
  pesi della famiglia scelta (piu' Lexend) + CSS del reveal.
- `lib/video/capture.ts`: viewport alla scala del formato, `setContent`,
  `document.fonts.ready`, immagini decodificate, poi il ciclo dei fotogrammi
  che produce PNG in memoria.
- `lib/video/encode.ts`: `ffmpeg-static`, fotogrammi via stdin
  (`image2pipe`), `libx264 yuv420p`, `+faststart`, audio AAC 128k, output su
  file temporaneo che viene letto e cancellato.
- `lib/video/render.ts`: mette insieme i pezzi e restituisce byte e misure.
- `lib/video/jobs.ts`: `startVideo`, `advance(id, render)`, `listForRun`. Il
  renderer e' iniettato: i test passano un finto.

## Deploy

- `next.config.ts`: `serverExternalPackages` + `ffmpeg-static`; tracciamento
  per `/api/videos/**` di Chromium, ffmpeg, `assets/fonts`, `assets/audio`.
- `vercel.json`: cron `/api/videos/drain` ogni 5 minuti.
- `supabase/migrations-007-videos.sql`, applicata al progetto.
- `CHROME_PATH` documentato in `.env.example`: in locale serve, in produzione no.

## Verifica

- `npm run test:video`: schedule del reveal (ordine, fine entro la durata,
  numero fotogrammi, dimensioni pari per ogni formato) e macchina a stati
  dei lavori con renderer finto (successo, errore, ripresa di un lavoro
  stantio, freni).
- A mano: Studio in demo, pannello Esporta, MP4, Genera; il file si apre e
  `ffmpeg -i` conferma codec, dimensioni, durata e traccia audio.
- In produzione: stesso giro sul deploy, controllando i log runtime.
