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
