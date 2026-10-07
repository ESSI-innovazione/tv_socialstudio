-- I ruoli crescono e l'amministrazione diventa una spunta.
--
-- Fin qui esistevano editor e approver, e chi amministrava era chiunque
-- approvasse. Entra il designer, che sincronizza i template da Figma senza
-- poter approvare, e l'admin diventa una spunta separata dal ruolo: chi
-- invita, cambia ruoli e toglie accessi. Ogni cambio di ruolo resta
-- scritto, con chi l'ha fatto e quando.

alter table profiles drop constraint if exists profiles_role_check;
alter table profiles add constraint profiles_role_check
  check (role in ('editor','designer','approver'));

alter table profiles add column if not exists is_admin     boolean not null default false;
alter table profiles add column if not exists invited_by   text;
alter table profiles add column if not exists invited_at   timestamptz;
alter table profiles add column if not exists last_seen_at timestamptz;
alter table profiles add column if not exists active       boolean not null default true;

comment on column profiles.role is
  'editor crea e chiede approvazione; designer in piu'' sincronizza i template; approver approva, pubblica e modifica gli strumenti.';
comment on column profiles.is_admin is
  'Chi gestisce il team: invita, cambia ruoli, toglie accessi. E'' una spunta, non un ruolo.';
comment on column profiles.active is
  'Falso quando l''accesso e'' stato tolto: il profilo resta, il lavoro resta, l''ingresso no.';

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

alter table profile_events enable row level security;
