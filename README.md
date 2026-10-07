# TV Social Studio

App interna per il team marketing di Time Vision. Dal brief al post pubblicato, in una pagina sola.

**Produzione:** https://tv-socialstudio.vercel.app

## La regola architetturale

Il prodotto è **una pagina sola**. Chi lavora apre `/studio` e non naviga mai altrove per creare:
sceglie uno strumento, compila il suo modulo, esegue, guarda l'esecuzione, rivede e pubblica. Tre
stati di una sola macchina, non tre schermate:

| Stato | Cosa mostra |
|---|---|
| `composing` | la home degli strumenti, oppure il modulo guidato di uno strumento, oppure il brief libero |
| `running` | elenco dei passi in tempo reale, log, anteprime parziali |
| `results` | la variante in grande, il controllo del brand, l'approvazione, l'export, il calendario |

Le transizioni avvengono sul posto. Appena un'esecuzione parte l'indirizzo diventa
`/studio?run=<id>`: un refresh ripristina lo stato dell'esecuzione dal server.

Le altre pagine stanno **intorno** a questa macchina, dentro la barra laterale vino
(`app/studio/layout.tsx`):

| Pagina | Cosa fa | Chi la vede |
|---|---|---|
| `/studio` | la home: strumenti, da approvare, in programma, scadenze, riprendi | tutti |
| `/studio/strumenti/[slug]` | il modulo guidato di uno strumento, che avvia l'esecuzione sul posto | tutti |
| `/studio/storico` | le proprie creazioni | tutti |
| `/studio/archivio` | gli asset approvati di tutto il team | tutti |
| `/studio/approvazioni` | la coda delle richieste | chi approva |
| `/studio/calendario` | i post programmati e pubblicati, gli asset pronti da programmare | tutti (programma chi pubblica) |
| `/studio/template` | la libreria dei template e la sincronizzazione da Figma | tutti (sincronizza designer e approvatori) |
| `/studio/admin/strumenti/[slug]` | l'editor degli strumenti, con bozze e versioni | chi modifica gli strumenti |
| `/studio/admin/team` | persone, ruoli, inviti, accessi | admin |

La pagina di accesso `/` non cambia.

## Stack

Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS 4, Anthropic API per copy e parsing
del brief, Supabase per i dati, deploy su Vercel.

## Avvio locale

```bash
npm install
cp .env.example .env.local   # facoltativo: l'app gira anche senza chiavi
npm run dev
```

Senza credenziali l'app funziona comunque end-to-end: autenticazione disattivata con una persona
di sviluppo (approvatrice e admin), dati in memoria, copy da un generatore deterministico, Figma
sui mock con una libreria di prova, i social sui mock. Ogni integrazione si accende aggiungendo la
sua chiave, una alla volta.

Per il PDF e il video in locale serve `CHROME_PATH`.

## Ruoli e permessi

Tre ruoli e una spunta. La matrice è in `lib/permissions.ts`, letta dalle rotte, dalla barra
laterale e dalla pagina del team: non può esistere una tabella nella UI diversa da quella che il
server applica.

| azione | editor | designer | approver | admin (spunta) |
|---|---|---|---|---|
| creare, salvare bozze, esportare | sì | sì | sì | sì |
| sincronizzare i template Figma e renderli disponibili | — | sì | sì | sì |
| approvare, pubblicare, programmare | — | — | sì | sì |
| modificare gli strumenti e le loro istruzioni | — | — | sì | sì |
| invitare, cambiare ruoli, togliere accessi | — | — | — | sì |

Il primo admin si nomina con `STUDIO_ADMIN_EMAILS` (indirizzi separati da virgola): da lì in poi
si invita e si cambiano i ruoli da `/studio/admin/team`, senza SQL. Un profilo con `active = false`
viene respinto alla porta con un messaggio; il suo lavoro resta. Ogni cambio di ruolo finisce in
`profile_events`.

## Database

Su un progetto Supabase nuovo, dal SQL Editor:

1. `supabase/schema.sql` — tabelle, vincoli e RLS (già allineato a tutte le migrazioni)
2. `supabase/seed.sql` — i sei strumenti con i loro moduli, le campagne e i template base
3. le migrazioni `supabase/migrations-00N-*.sql`, in ordine di numero, su un database esistente

Le ultime:

| migrazione | cosa porta |
|---|---|
| `010-publishing` | `scheduled_posts`: autore, variante, tentativi, presa in carico del cron |
| `011-roles-admin` | ruolo `designer`, `is_admin`, inviti, ultimo accesso, `active`, tabella `profile_events` |
| `012-tool-fields` | `tools.fields` (il modulo), `cta_label`, categoria, foto, template e varianti di partenza, `published_version`; tabella `tool_versions` |
| `013-template-syncs` | tabella `template_syncs`, lo storico delle sincronizzazioni |

## Gli strumenti

Ognuno è un'istruzione salvata con un modulo: ogni segnaposto `{{chiave}}` dell'istruzione ha una
domanda dichiarata in `tools.fields` (etichetta, tipo, obbligatoria, esempio). Il team compila il
modulo; l'istruzione la compone `lib/tool-fields.ts`, e un segnaposto senza domanda o una domanda
obbligatoria vuota fermano l'avvio, non producono un buco nel prompt.

Chi può modificare gli strumenti lo fa da `/studio/admin/strumenti/[slug]`: ogni modifica è una
bozza in `tool_versions`, il team vede solo la versione pubblicata, una versione vecchia si
ripristina. Prima di pubblicare: ogni segnaposto ha una domanda, ogni domanda è usata, almeno un
formato.

| slug | cosa fa |
|---|---|
| `poster-bando` | poster A4 per bandi, con countdown e disclaimer normativo |
| `catalogo-servizi` | catalogo PDF multipagina dai servizi selezionati |
| `visual-3d` | key visual 3D e mockup da un concept testuale |
| `social-kit` | LinkedIn, IG feed e story dallo stesso layout, caption incluse |
| `figma-sync` | importa i frame aggiornati dalla libreria del brand (automatico, non si lancia) |
| `brand-guard` | verifica palette, font, logo e claim; gira a ogni esecuzione (automatico) |

## Formati ed export

Rendering server-side alle dimensioni esatte: A4 794×1123 (authoring a 96 dpi), LinkedIn
1200×627, Instagram feed 1080×1080, story 1080×1920.

- **PNG** da `/api/render/[run]/[variante]/[formato].png` (Satori).
- **JPEG** per Instagram, stessa rotta con `.jpg` (Chromium).
- **PDF** di stampa, A4 a 210×297 mm con testo vettoriale:
  `/api/render/[run]/[variante]/pdf?bleed=1&marks=1` e `/api/render/[run]/all/pdf` (tutte le
  varianti, una per pagina). `bleed=1` aggiunge 3 mm di abbondanza, `marks=1` i segni di taglio;
  la geometria è in `lib/render/print-geometry.ts` e il foglio al rifilo resta identico. Il nome del
  file è `campagna-strumento-vN.pdf`.
- **MP4** di otto secondi dall'editor (tabella `videos`, cron `/api/videos/drain`).
- SVG e PPTX non esistono ancora.

## Pubblicazione

Dai risultati, dopo l'approvazione, «Programma la pubblicazione» crea righe in `scheduled_posts`
(una per canale) con stato `scheduled`. Il cron `/api/publish/drain` passa ogni cinque minuti,
prende in carico i post maturi (`claimed_at`: due passaggi non pubblicano due volte) e li pubblica
su LinkedIn (Posts API) o Instagram (Graph API, contenitore e poi pubblicazione); un post fallito
resta in coda finché ha tentativi, poi diventa `failed` con il motivo. Il calendario mostra tutto e
permette di spostare, pubblicare subito, riprovare, togliere, e di programmare gli asset approvati
che non hanno ancora una data.

## Template e Figma

I template nascono in Figma nelle pagine `TPL/…` (vedi `TEMPLATES.md`) e arrivano in
`/studio/template` con una sincronizzazione in due passi: «Sincronizza ora» legge Figma e mostra
cosa è cambiato (nuovo, modificato, tolto) senza scrivere; «Rendi disponibili al team» scrive solo
le voci accettate e lascia una riga in `template_syncs`. Le esecuzioni già fatte tengono il
template com'era. Senza `FIGMA_TOKEN` si legge una libreria di prova.

## Le garanzie, che sono parte del prodotto

- Ogni asset registra da quale template, brief e documenti sorgente è nato.
- `brand-guard` gira a ogni esecuzione e blocca approvazione e pubblicazione se una verifica fallisce.
- Pubblicare richiede chi può farlo (`approver` o admin), sul server, non con un pulsante nascosto.
- Il copy generato non può contenere una cifra o una data che non sia nei documenti allegati.
  Quello che manca resta `[DA VERIFICARE]`, mai un numero plausibile.
- Il contrasto è un requisito: testo inchiostro sul corallo, mai bianco; `--color-rose-ink` per il
  rosa in corpo piccolo; nessun grigio più chiaro di `--color-ink-faint`.

## Verifiche

```bash
npm run lint
npm test            # layout e geometria di stampa, Figma, Gamma, immagini, video, strumenti
npm run test:tools  # solo il riempimento e la validazione degli strumenti
```

## Deploy

```bash
vercel link
vercel env add <NOME>   # una chiave alla volta, preview e production
vercel --prod
```

Un push su `main` pubblica in produzione. I cron sono in `vercel.json`.
