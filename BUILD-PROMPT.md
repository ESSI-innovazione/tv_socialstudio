# Build prompt — Time Vision Marketing Studio

Paste everything between the lines into Claude Code (or Cursor) in an empty directory.
Attach the PDF export of the design canvas alongside it if you can — the agent will match the layout far more closely with the artboards in front of it.

---

Build and deploy an internal web app called **Time Vision Marketing Studio** for the marketing team of Time Vision (timevision.it, Italian consulting and professional-training company). Deploy it to Vercel.

## The one architectural rule

**The product is ONE page.** A marketer opens `/studio` and never navigates away: they write an instruction, pick formats, hit Run, watch it execute, then review and publish — all in the same route. Do not build a multi-step wizard, do not build separate pages for brief / results / publish. The page has three states of a single state machine:

- `composing` — instruction editor, format picker, template picker, the saved tools
- `running` — live step list + log stream, partial previews appearing as they finish
- `results` — variant grid, auto-generated format declinations, publish panel

State transitions happen in place. A refresh restores the current run's state from the server.

## Stack

- Next.js 15 (App Router) + TypeScript + React 19
- Tailwind CSS 4
- shadcn/ui (`npx shadcn@latest init`) for primitives only — build the studio chrome yourself
- Supabase (Postgres + Auth + Storage) for runs, assets, templates cache, approvals
- Anthropic API (`@anthropic-ai/sdk`, model `claude-sonnet-5`) for copy generation and brief parsing
- Deploy on Vercel; long generations run in a Route Handler with streaming, not a client loop

## Auth

Google OAuth via NextAuth, restricted to the `@timevision.it` email domain. Anyone else is rejected at the callback. Two roles: `editor` (can run and draft) and `approver` (can publish). Read them from a `profiles` table.

## Visual system — use these exact values

Font: **Lexend** (Google Fonts, weights 300–800), fallback `'Segoe UI', system-ui, sans-serif`. One family only. UI copy is **in Italian**.

```css
--wine:      #720026;  /* top bar, primary dark, poster ground */
--rose:      #ce4257;  /* primary action, active state, links */
--coral:     #ff7f51;  /* the Run button, countdown bands, in-progress */
--apricot:   #ff9b54;  /* highlight, accent line, status dot */

--ink:       #2a1119;  /* primary text */
--ink-soft:  #5c4850;  /* secondary text */
--ink-faint: #7e6a73;  /* labels, meta — do NOT go lighter, this is the AA floor */

--line:      #ecdfe2;
--line-soft: #f6eff1;
--canvas:    #fbf7f5;  /* app background */
--paper:     #ffffff;  /* cards, rails */
--wine-tint: #fbeef0;  /* active nav row, brand callouts */
--warm-tint: #fff2ea;  /* in-progress chips */

--success:   #1f5436;  on #e8f1ec
--warning:   #a8481a;  on #fff2ea
```

Cards: `border-radius: 14–18px`, `1px solid var(--line)`, white, shadow `0 12px 30px -24px rgba(114,0,38,.45)`. Buttons and chips: fully rounded (`999px`), `font-weight: 600`, heights 32 / 38 / 44 / 50. Every pill gets `white-space: nowrap`. Icons: lucide-react, 17px in nav, `stroke-width: 1.9`. No emoji anywhere in the UI.

Contrast is a hard requirement: all body and label text must clear WCAG AA (4.5:1) against its actual background. Do not introduce lighter greys than `--ink-faint`.

## Screen layout of `/studio`

- **Top bar, 60px, `--wine`, full width.** White Time Vision mark + wordmark on the left, then a campaign selector pill. Right side: Figma sync status, active Brand Kit, avatar.
- **Left rail, 236px, white.** `STRUMENTI` (the six tools below), a divider, `CAMPAGNE` (list, active one dotted in `--apricot`), and a footer card. Active row: `--wine-tint` background, `--wine` text, weight 600.
- **Centre column, flex-grow.** The console. In `composing`: a large instruction card with a `--rose` 1.5px border and a `0 0 0 4px rgba(206,66,87,.10)` focus ring, attachment chips under the text, then a formats row, then the selected template row with the **Esegui istruzione** button in `--coral`. Below it, `ISTRUZIONI PRONTE` — a 3-column grid of the saved tools. Below that, the last two runs as a compact list.
- **Right rail, 372px, white.** In `composing`: what will be produced (ghost frames per format) + active brand rules + connected channels. In `running`: a live preview of the first finished asset. In `results`: the publish panel.

## The six tools (`ISTRUZIONI PRONTE`)

Each is a stored, parameterised instruction the team can run with one click. Show the slug in a monospace face in `--rose`, a one-line description, and a run count.

| slug | what it does |
|---|---|
| `poster-bando` | A4 poster for public funding calls, with countdown and the mandatory legal disclaimer |
| `catalogo-servizi` | multi-page PDF catalogue built from selected services |
| `visual-3d` | 3D key visual and mockups from a text concept |
| `social-kit` | LinkedIn + IG feed + story from one layout, captions included |
| `figma-sync` | pulls updated frames from the brand library |
| `brand-guard` | checks palette, fonts, logo and claims before publishing — runs automatically on every execution |

Store them in a `tools` table with an editable prompt template, so marketing can add new ones without a deploy.

## Output formats

Render server-side to exact pixel sizes: **A4 794×1123** (authored at 96 dpi, exported at 210×297 mm / 300 dpi), **LinkedIn 1200×627**, **Instagram feed 1080×1080**, **Instagram story 1080×1920**. Generate from HTML/CSS via `@vercel/og` or Playwright in a Node runtime, not client-side canvas. Editing text on one format propagates to the others while keeping each template's grid.

## Integrations — put each behind an interface with a working mock

Build `lib/integrations/*.ts` with a typed interface plus a mock implementation, so the whole app runs end to end before any credential exists. Wire the real ones one at a time.

- **Figma** — REST API, `GET /v1/files/:key` and `/v1/images/:key`, **read-only**. The agent reads brand templates; only the marketing team edits them in Figma. Needs a Figma Pro personal access token. Cache frames in Supabase and expose a manual "Sincronizza".
- **LinkedIn** — company-page posts via the Community Management API. Requires an approved LinkedIn app with `w_organization_social` and an admin of the Time Vision page to authorise it. Treat approval as a lead time, not a checkbox.
- **Instagram** — Instagram Graph API through a linked Facebook Business account; two-step container-then-publish flow. Stories and feed have different endpoints.
- **Copy generation** — Anthropic API. The system prompt must carry the brand voice and forbid any claim not present in the attached source documents.

Scheduled publishing runs on a Vercel Cron route that drains a `scheduled_posts` table.

## Guardrails that are part of the product, not extras

- Every asset records which template, which brief, and which source documents produced it.
- `brand-guard` runs on every execution and blocks publish on a failed check.
- Publishing requires an `approver`; show the pending approvals inline.
- Never let generated copy state a figure or a date that is not in the attached source. Bracket unknowns as `[DA VERIFICARE]` rather than inventing them.

## Also build `/` — the public entry

A hero page using the `dynamic-hero` pattern: centred nav, headline, tagline, an outlined CTA, and a rounded media card, with a dashed quadratic curve on a full-page `<canvas>` that tracks the cursor and points at the CTA. Put it at `components/ui/dynamic-hero.tsx`. Convert it to TypeScript with proper prop types, and make it render a correct static arrow before the first `mousemove` so it looks right on load and in screenshots.

## Deploy

```
vercel link
vercel env add   # per key, for preview + production
vercel --prod
```

Env: `NEXTAUTH_URL`, `NEXTAUTH_SECRET`, `GOOGLE_CLIENT_ID/SECRET`, `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`, `FIGMA_TOKEN`, `FIGMA_FILE_KEY`, `LINKEDIN_*`, `IG_*`, `CRON_SECRET`.

Then attach the domain in the Vercel dashboard under **Project → Settings → Domains** (or `vercel domains add <domain>`) and add the DNS records it shows you. Buy the domain yourself — either through Vercel or your existing registrar.

## Order of work

1. Scaffold, Tailwind tokens, Lexend, auth, Supabase schema, deploy a blank protected `/studio` to Vercel. **Verify it deploys before adding features.**
2. The `/studio` shell — top bar, both rails, the three states with mocked data.
3. The run engine: instruction → parse → generate copy → render the four formats. Mock Figma with two hardcoded templates.
4. Real Figma sync, then the template library.
5. Publishing: drafts, approvals, scheduling. LinkedIn first, Instagram second.
6. `catalogo-servizi` and `visual-3d`, which are the two heaviest tools.

Ship 1–3 first and put them in front of the marketing team before building 4–6.
