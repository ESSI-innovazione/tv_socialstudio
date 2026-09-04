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
  role        text not null default 'editor' check (role in ('editor','approver')),
  created_at  timestamptz not null default now()
);

comment on column profiles.role is
  'editor esegue e salva bozze; approver puo pubblicare.';

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
