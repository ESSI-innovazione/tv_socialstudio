-- Gli strumenti diventano moduli guidati, con versioni.
--
-- Fin qui uno strumento era un'istruzione con dei segnaposto {{campo}} da
-- riempire a mano in un'area di testo. Adesso ogni segnaposto ha un campo
-- dichiarato (etichetta, tipo, obbligatorio, esempio) e il team compila un
-- modulo; l'istruzione la compone lo Studio. Le modifiche di chi cura gli
-- strumenti passano da una bozza a una versione pubblicata, cosi' il team
-- vede solo quello che e' stato pubblicato e si puo' tornare indietro.

alter table tools add column if not exists fields            jsonb not null default '[]';
alter table tools add column if not exists cta_label         text;
alter table tools add column if not exists cover_image       text;
alter table tools add column if not exists category          text
  check (category is null or category in ('social','stampa'));
alter table tools add column if not exists estimated_minutes integer;
alter table tools add column if not exists default_template  uuid references templates(id) on delete set null;
alter table tools add column if not exists default_variants  integer not null default 3
  check (default_variants between 1 and 4);

comment on column tools.default_template is
  'Il template proposto all''apertura del modulo. Nullo: il primo in libreria.';
alter table tools add column if not exists published_version integer not null default 1;

comment on column tools.fields is
  'Le domande del modulo: [{key, label, type, required, example, options?}]. Ogni {{key}} dell''istruzione ha la sua.';
comment on column tools.cta_label is
  'L''etichetta del pulsante che avvia lo strumento, es. «Crea il poster».';
comment on column tools.published_version is
  'La versione che il team usa. Le bozze stanno in tool_versions con published_at nullo.';

create table if not exists tool_versions (
  id            uuid primary key default gen_random_uuid(),
  tool_id       uuid not null references tools(id) on delete cascade,
  version       integer not null,
  snapshot      jsonb not null,
  created_by    text,
  created_at    timestamptz not null default now(),
  published_at  timestamptz,
  unique (tool_id, version)
);

create index if not exists tool_versions_tool_idx on tool_versions (tool_id, version desc);

alter table tool_versions enable row level security;
