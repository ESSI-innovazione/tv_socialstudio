-- Generazioni multipagina come lavori durevoli.
-- Una generazione Gamma dura minuti: se vivesse nella richiesta che l'ha
-- avviata, chiudere la scheda la perderebbe, e i crediti spesi con lei.

create table if not exists documents (
  id             uuid primary key default gen_random_uuid(),
  run_id         uuid references runs(id) on delete set null,
  format         text not null check (format in ('catalogo','deck','one-pager','landing')),
  title          text not null,
  request        jsonb not null,
  theme_id       text not null,
  status         text not null default 'pending'
                 check (status in ('pending','generating','exporting','ready','failed')),
  generation_id  text,
  gamma_id       text,
  gamma_url      text,
  stored_path    text,
  mime           text,
  pages          integer,
  credits_used   integer,
  error          text,
  attempts       integer not null default 0,
  created_by     text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

comment on column documents.generation_id is
  'L''identificativo restituito da Gamma. E'' la chiave che permette di riprendere invece di rigenerare.';

comment on column documents.stored_path is
  'La nostra copia. L''URL di export di Gamma scade in circa una settimana e non e'' legato alla chiave: non va mai salvato qui.';

create index if not exists documents_open_idx
  on documents (created_at) where status in ('pending','generating','exporting');

create index if not exists documents_run_idx on documents (run_id);

alter table documents enable row level security;

-- Il bucket dei file archiviati. Privato: si serve attraverso l'app.
insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do nothing;
