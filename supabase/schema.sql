-- Time Vision Marketing Studio — schema
-- Esegui in Supabase: SQL Editor > New query > incolla > Run.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------
-- Profili e ruoli
-- ---------------------------------------------------------------
create table if not exists profiles (
  id          uuid primary key default gen_random_uuid(),
  email       text unique not null,
  name        text,
  role        text not null default 'editor' check (role in ('editor','designer','approver')),
  created_at  timestamptz not null default now()
);

comment on column profiles.role is
  'editor crea e chiede approvazione; designer in piu sincronizza i template; approver approva, pubblica e modifica gli strumenti.';

-- Amministrazione e accessi (migrazione 011).
alter table profiles add column if not exists is_admin     boolean not null default false;
alter table profiles add column if not exists invited_by   text;
alter table profiles add column if not exists invited_at   timestamptz;
alter table profiles add column if not exists last_seen_at timestamptz;
alter table profiles add column if not exists active       boolean not null default true;

create table if not exists profile_events (
  id          uuid primary key default gen_random_uuid(),
  profile_id  uuid not null references profiles(id) on delete cascade,
  email       text not null,
  changed_by  text not null,
  field       text not null check (field in ('role','is_admin','active','invited')),
  from_value  text,
  to_value    text,
  at          timestamptz not null default now()
);

create index if not exists profile_events_profile_idx on profile_events (profile_id, at desc);

-- Solo il dominio aziendale entra.
alter table profiles drop constraint if exists profiles_email_domain;
alter table profiles add constraint profiles_email_domain
  check (email like '%@timevision.it');

-- ---------------------------------------------------------------
-- Campagne
-- ---------------------------------------------------------------
create table if not exists campaigns (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text unique not null,
  active      boolean not null default false,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------
-- Strumenti — istruzioni salvate, editabili senza deploy
-- ---------------------------------------------------------------
create table if not exists tools (
  id               uuid primary key default gen_random_uuid(),
  slug             text unique not null,
  title            text not null,
  description      text not null,
  prompt_template  text not null,
  default_formats  text[] not null default '{}',
  run_count        integer not null default 0,
  note             text,
  automatic        boolean not null default false,
  position         integer not null default 0,
  updated_at       timestamptz not null default now()
);

comment on table tools is
  'Il marketing aggiunge o modifica strumenti qui, senza un deploy.';

-- Il modulo guidato e le versioni (migrazione 012).
alter table tools add column if not exists fields            jsonb not null default '[]';
alter table tools add column if not exists cta_label         text;
alter table tools add column if not exists cover_image       text;
alter table tools add column if not exists category          text
  check (category is null or category in ('social','stampa'));
alter table tools add column if not exists estimated_minutes integer;
alter table tools add column if not exists default_variants  integer not null default 3
  check (default_variants between 1 and 4);
alter table tools add column if not exists published_version integer not null default 1;

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

-- ---------------------------------------------------------------
-- Template base, cachati da Figma
-- ---------------------------------------------------------------
create table if not exists templates (
  id             uuid primary key default gen_random_uuid(),
  figma_node_id  text,
  name           text not null,
  description    text,
  frame_count    integer not null default 0,
  thumbnail_url  text,
  formats        text[] not null default '{}',
  synced_at      timestamptz
);

create unique index if not exists templates_figma_node_id_key
  on templates (figma_node_id) where figma_node_id is not null;

-- Il template proposto da uno strumento (migrazione 012): dopo templates, che referenzia.
alter table tools add column if not exists default_template uuid references templates(id) on delete set null;

-- ---------------------------------------------------------------
-- Esecuzioni — una riga per run, stato completo per il refresh
-- ---------------------------------------------------------------
create table if not exists runs (
  id             uuid primary key default gen_random_uuid(),
  campaign_id    uuid references campaigns(id) on delete set null,
  tool_slug      text not null,
  instruction    text not null,
  attachments    jsonb not null default '[]',
  formats        text[] not null default '{}',
  variant_count  integer not null default 4,
  template_id    uuid references templates(id) on delete set null,
  state          text not null default 'running'
                 check (state in ('composing','running','results','failed')),
  steps          jsonb not null default '[]',
  logs           jsonb not null default '[]',
  brief          jsonb,
  variants       jsonb not null default '[]',
  captions       jsonb not null default '[]',
  guard          jsonb not null default '[]',
  error          text,
  created_by     text,
  created_at     timestamptz not null default now(),
  finished_at    timestamptz,
  duration_ms    integer
);

create index if not exists runs_created_at_idx on runs (created_at desc);
create index if not exists runs_state_idx on runs (state);

-- ---------------------------------------------------------------
-- Asset — provenienza sempre registrata
-- ---------------------------------------------------------------
create table if not exists assets (
  id                uuid primary key default gen_random_uuid(),
  run_id            uuid not null references runs(id) on delete cascade,
  variant_index     integer not null,
  format            text not null,
  render_url        text not null,
  width             integer not null,
  height            integer not null,
  template_id       uuid references templates(id) on delete set null,
  source_documents  text[] not null default '{}',
  created_at        timestamptz not null default now()
);

create index if not exists assets_run_id_idx on assets (run_id);

comment on column assets.source_documents is
  'Quali documenti sorgente hanno prodotto questo asset. Requisito di tracciabilita.';

-- Brand-guard: l'impaginazione controllata e il verdetto (migrazione 008).
alter table assets add column if not exists layout           jsonb;
alter table assets add column if not exists guard            jsonb;
alter table assets add column if not exists guard_status     text
  check (guard_status in ('pass','warn','fail'));
alter table assets add column if not exists guard_checked_at timestamptz;

create index if not exists assets_guard_status_idx on assets (guard_status);

-- ---------------------------------------------------------------
-- Approvazioni — la pubblicazione richiede un approver
-- ---------------------------------------------------------------
create table if not exists approvals (
  id              uuid primary key default gen_random_uuid(),
  run_id          uuid not null references runs(id) on delete cascade,
  approver_name   text not null,
  approver_email  text,
  status          text not null default 'pending'
                  check (status in ('pending','approved','rejected')),
  decided_at      timestamptz,
  created_at      timestamptz not null default now()
);

create index if not exists approvals_run_id_idx on approvals (run_id);

-- Flusso di approvazione: chi chiede, quale variante, il commento (migrazione 009).
alter table approvals add column if not exists requested_by  text;
alter table approvals add column if not exists variant_index integer not null default 0;
alter table approvals add column if not exists note          text;
alter table approvals add column if not exists comment       text;

create index if not exists approvals_status_idx on approvals (status, created_at);

alter table assets add column if not exists approval_id uuid references approvals(id) on delete set null;
alter table assets add column if not exists approved_by text;
alter table assets add column if not exists approved_at timestamptz;

create index if not exists assets_approved_idx on assets (approved_at desc) where approved_at is not null;

-- ---------------------------------------------------------------
-- Coda di pubblicazione, drenata dal cron
-- ---------------------------------------------------------------
create table if not exists scheduled_posts (
  id             uuid primary key default gen_random_uuid(),
  run_id         uuid not null references runs(id) on delete cascade,
  channel        text not null check (channel in ('linkedin','instagram')),
  surface        text not null default 'feed',
  caption        text not null,
  hashtags       text[] not null default '{}',
  asset_id       uuid references assets(id) on delete set null,
  status         text not null default 'draft'
                 check (status in ('draft','pending_approval','approved','scheduled','published','failed')),
  scheduled_for  timestamptz,
  published_at   timestamptz,
  external_id    text,
  error          text,
  created_at     timestamptz not null default now()
);

create index if not exists scheduled_posts_due_idx
  on scheduled_posts (scheduled_for) where status = 'scheduled';

-- Pubblicazione come lavoro: autore, variante, tentativi, presa in carico (migrazione 010).
alter table scheduled_posts add column if not exists created_by    text;
alter table scheduled_posts add column if not exists variant_index integer;
alter table scheduled_posts add column if not exists attempts      integer not null default 0;
alter table scheduled_posts add column if not exists claimed_at    timestamptz;

create index if not exists scheduled_posts_calendar_idx
  on scheduled_posts (coalesce(scheduled_for, published_at, created_at));

-- ---------------------------------------------------------------
-- RLS: l'app parla al database con la service role key dal server.
-- Le policy restano attive per bloccare qualunque accesso anon.
-- ---------------------------------------------------------------
alter table profiles        enable row level security;
alter table campaigns       enable row level security;
alter table tools           enable row level security;
alter table templates       enable row level security;
alter table runs            enable row level security;
alter table assets          enable row level security;
alter table approvals       enable row level security;
alter table scheduled_posts enable row level security;
alter table profile_events  enable row level security;
alter table tool_versions   enable row level security;
