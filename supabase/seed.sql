-- Dati iniziali: i sei strumenti, le campagne e i due template base.
-- Idempotente: si puo rieseguire.

insert into campaigns (name, slug, active) values
  ('Voucher Cloud MIMIT', 'voucher-cloud-mimit', true),
  ('Fondi STEP 2026',     'fondi-step-2026',     false),
  ('Master Academy',      'master-academy',      false),
  ('Donna in Progress',   'donna-in-progress',   false)
on conflict (slug) do nothing;

insert into tools (slug, title, description, prompt_template, default_formats, run_count, note, automatic, position) values
  ('poster-bando', 'Poster per un bando',
   'Poster A4 per bandi e finanziamenti, con countdown e disclaimer normativo',
   'Costruisci un poster A4 per il bando {{bando}}. Metti in evidenza il countdown alla scadenza {{scadenza}} e chiudi con il disclaimer normativo obbligatorio. Tono istituzionale e diretto, destinatario {{target}}. CTA: {{cta}}.',
   '{poster-a4}', 34, null, false, 1),

  ('catalogo-servizi', 'Catalogo servizi',
   'Catalogo PDF multipagina costruito dai servizi selezionati',
   'Costruisci un catalogo PDF multipagina dai servizi {{servizi}}. Una pagina di copertina, una pagina per servizio, una pagina di contatto. Tono {{tono}}, destinatario {{target}}.',
   '{poster-a4}', 9, null, false, 2),

  ('visual-3d', 'Visual 3D',
   'Key visual 3D e mockup a partire da un concept testuale',
   'Genera un key visual 3D dal concept {{concept}}. Rendi disponibili i mockup nei formati richiesti. Palette istituzionale, nessun colore fuori brand.',
   '{linkedin,ig-feed}', 6, null, false, 3),

  ('social-kit', 'Kit social',
   'LinkedIn, IG feed e story dallo stesso layout, con caption gia scritte',
   'Declina {{argomento}} in LinkedIn 1200x627, Instagram feed 1080x1080 e story 1080x1920 dallo stesso impianto. Scrivi anche le caption per canale. CTA: {{cta}}.',
   '{linkedin,ig-feed,ig-story}', 47, null, false, 4),

  ('figma-sync', 'Figma sync',
   'Importa i frame aggiornati dalla libreria Brand 2026 e li rende usabili',
   'Sincronizza la libreria Figma Time Vision Brand 2026 e aggiorna i template disponibili.',
   '{}', 0, 'ultima sincronizzazione da Figma', true, 5),

  ('brand-guard', 'Brand guard',
   'Verifica palette, font, logo e claim prima di ogni pubblicazione',
   'Verifica che palette, font, logo e claim siano conformi al Brand Kit e che ogni dato numerico abbia una fonte nei documenti allegati.',
   '{}', 0, 'automatico a ogni esecuzione', true, 6)
on conflict (slug) do update set
  title = excluded.title,
  description = excluded.description,
  default_formats = excluded.default_formats,
  note = excluded.note,
  automatic = excluded.automatic,
  position = excluded.position,
  updated_at = now();

-- Il modulo di ogni strumento (migrazione 012): una domanda per segnaposto.
-- Si aggiorna solo dove il modulo e ancora vuoto, per non sovrascrivere le
-- modifiche fatte dall'editor degli strumenti.
update tools set
  fields = '[
    {"key":"bando","label":"Il bando","type":"text","required":true,"example":"Voucher Cloud e Cybersecurity MIMIT"},
    {"key":"scadenza","label":"La scadenza","type":"datetime","required":true,"example":"2026-11-10T12:00"},
    {"key":"target","label":"A chi si rivolge","type":"text","required":true,"example":"imprenditori e titolari di PMI"},
    {"key":"cta","label":"Chiamata all''azione","type":"choice_link","required":true,"example":"Scopri il voucher","options":["Scopri il voucher","Prenota una consulenza gratuita","Iscriviti al corso","Scarica la scheda","Contattaci"]}
  ]'::jsonb,
  cta_label = 'Crea il poster', cover_image = 'site-bandi.jpg', category = 'stampa', estimated_minutes = 3
where slug = 'poster-bando' and fields = '[]'::jsonb;

update tools set
  fields = '[
    {"key":"servizi","label":"I servizi da includere","type":"longtext","required":true,"example":"Consulenza per bandi e finanza agevolata\nFormazione finanziata\nAcademy e master"},
    {"key":"tono","label":"Il tono","type":"choice","required":true,"example":"istituzionale","options":["istituzionale","diretto","caldo"]},
    {"key":"target","label":"A chi si rivolge","type":"text","required":false,"example":"imprese e professionisti"}
  ]'::jsonb,
  cta_label = 'Crea il catalogo', cover_image = 'site-consulenza.webp', category = 'stampa', estimated_minutes = 5
where slug = 'catalogo-servizi' and fields = '[]'::jsonb;

update tools set
  fields = '[
    {"key":"concept","label":"Il concept","type":"longtext","required":true,"example":"Una nuvola di dati che protegge una piccola impresa"}
  ]'::jsonb,
  cta_label = 'Genera il visual', cover_image = 'site-innovazione.webp', category = 'social', estimated_minutes = 2
where slug = 'visual-3d' and fields = '[]'::jsonb;

update tools set
  fields = '[
    {"key":"argomento","label":"L''argomento","type":"text","required":true,"example":"Corsi gratuiti CIG Puglia, indennita'' 2.400 euro"},
    {"key":"cta","label":"Chiamata all''azione","type":"choice_link","required":true,"example":"Iscriviti al corso","options":["Scopri il voucher","Prenota una consulenza gratuita","Iscriviti al corso","Scarica la scheda","Contattaci"]}
  ]'::jsonb,
  cta_label = 'Crea il kit', cover_image = 'site-network.webp', category = 'social', estimated_minutes = 3
where slug = 'social-kit' and fields = '[]'::jsonb;

insert into templates (figma_node_id, name, description, frame_count, formats, synced_at) values
  ('1:2', 'Bando con countdown',
   'Impianto per bandi e finanziamenti: importo dominante, banda countdown, disclaimer in calce.',
   6, '{poster-a4,linkedin,ig-feed,ig-story}', now()),
  ('1:3', 'Corso e academy',
   'Impianto per corsi e percorsi formativi: foto di aula, elenco moduli, CTA iscrizione.',
   5, '{poster-a4,linkedin,ig-feed,ig-story}', now())
on conflict (figma_node_id) do update set
  name = excluded.name,
  description = excluded.description,
  frame_count = excluded.frame_count,
  formats = excluded.formats,
  synced_at = now();
