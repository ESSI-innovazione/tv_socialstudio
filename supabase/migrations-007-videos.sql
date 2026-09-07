-- I video come lavori durevoli.
-- Un rendering dura un minuto e non puo' vivere nella richiesta che l'ha
-- avviato: la riga nasce prima di aprire Chromium e porta con se' tutto cio'
-- che serve a rifare il video, perche' l'impaginazione non sta da nessun'altra
-- parte nel database.

create table if not exists videos (
  id             uuid primary key default gen_random_uuid(),
  run_id         uuid references runs(id) on delete set null,
  variant_index  integer not null,
  format         text not null check (format in ('poster-a4','linkedin','ig-feed','ig-story')),
  request        jsonb not null,
  status         text not null default 'pending'
                 check (status in ('pending','rendering','ready','failed')),
  stored_path    text,
  mime           text,
  width          integer,
  height         integer,
  bytes          integer,
  duration_ms    integer,
  fps            integer,
  music          boolean,
  error          text,
  attempts       integer not null default 0,
  started_at     timestamptz,
  created_by     text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

comment on column videos.request is
  'Copy, impaginazione, foto e impianto cosi'' com''erano nell''editor. Basta questa colonna per rifare il video.';

comment on column videos.started_at is
  'Quando l''ultimo tentativo ha aperto Chromium. Un rendering piu'' vecchio di sei minuti e'' stato interrotto e si riprende.';

create index if not exists videos_open_idx
  on videos (created_at) where status in ('pending','rendering');

create index if not exists videos_run_idx on videos (run_id, created_at desc);

alter table videos enable row level security;
