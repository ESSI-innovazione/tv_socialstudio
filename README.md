# Time Vision Marketing Studio

App interna per il team marketing di Time Vision. Dal brief al post pubblicato, in una pagina sola.

**Produzione:** https://tv-socialstudio.vercel.app

## La regola architetturale

Il prodotto è **una pagina sola**. Chi lavora apre `/studio` e non naviga mai altrove: scrive
un'istruzione, sceglie i formati, esegue, guarda l'esecuzione, rivede e pubblica. Tre stati di
una sola macchina, non tre schermate:

| Stato | Cosa mostra |
|---|---|
| `composing` | editor dell'istruzione, formati, template, strumenti salvati |
| `running` | elenco dei passi in tempo reale, log, anteprime parziali |
| `results` | griglia delle varianti, declinazioni per formato, pannello di pubblicazione |

Le transizioni avvengono sul posto. Un refresh ripristina lo stato dell'esecuzione dal server.

## Stack

Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS 4, Anthropic API per copy e parsing
del brief, Supabase per i dati, deploy su Vercel.

## Avvio locale

```bash
npm install
cp .env.example .env.local   # facoltativo: l'app gira anche senza chiavi
npm run dev
```

Senza credenziali l'app funziona comunque end-to-end: autenticazione disattivata con un utente di
sviluppo, dati in memoria, copy da un generatore deterministico, Figma e i social sui mock. Ogni
integrazione si accende aggiungendo la sua chiave, una alla volta.

## Database

Su un progetto Supabase nuovo, dal SQL Editor:

1. `supabase/schema.sql` — tabelle, vincoli e RLS
2. `supabase/seed.sql` — i sei strumenti, le campagne e i template base

Poi inserisci i profili del team in `profiles`, con ruolo `editor` oppure `approver`.

## I sei strumenti

Ognuno è un'istruzione salvata e parametrica, eseguibile con un clic. Vivono nella tabella
`tools`: il marketing ne aggiunge di nuovi senza un deploy.

| slug | cosa fa |
|---|---|
| `poster-bando` | poster A4 per bandi, con countdown e disclaimer normativo |
| `catalogo-servizi` | catalogo PDF multipagina dai servizi selezionati |
| `visual-3d` | key visual 3D e mockup da un concept testuale |
| `social-kit` | LinkedIn, IG feed e story dallo stesso layout, caption incluse |
| `figma-sync` | importa i frame aggiornati dalla libreria del brand |
| `brand-guard` | verifica palette, font, logo e claim; gira a ogni esecuzione |

## Formati

Rendering server-side alle dimensioni esatte: A4 794×1123 (authoring a 96 dpi, export a
210×297 mm / 300 dpi), LinkedIn 1200×627, Instagram feed 1080×1080, story 1080×1920.

## Le garanzie, che sono parte del prodotto

- Ogni asset registra da quale template, brief e documenti sorgente è nato.
- `brand-guard` gira a ogni esecuzione e blocca la pubblicazione se una verifica fallisce.
- Pubblicare richiede un `approver`. Le approvazioni in attesa si vedono nella pagina.
- Il copy generato non può contenere una cifra o una data che non sia nei documenti allegati.
  Quello che manca resta `[DA VERIFICARE]`, mai un numero plausibile.

## Deploy

```bash
vercel link
vercel env add <NOME>   # una chiave alla volta, preview e production
vercel --prod
```
