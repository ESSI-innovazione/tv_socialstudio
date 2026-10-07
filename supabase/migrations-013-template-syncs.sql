-- Lo storico delle sincronizzazioni da Figma.
--
-- La libreria si rilegge a mano, e da adesso in due passi: prima si guarda
-- cosa e' cambiato (modificato, nuovo, tolto), poi si decide cosa rendere
-- disponibile al team. Ogni passaggio che scrive resta qui: chi, quando,
-- che cosa. Le esecuzioni gia' fatte tengono il template com'era.

create table if not exists template_syncs (
  id        uuid primary key default gen_random_uuid(),
  at        timestamptz not null default now(),
  by        text,
  summary   text not null,
  changes   jsonb not null default '[]'
);

create index if not exists template_syncs_at_idx on template_syncs (at desc);

comment on column template_syncs.changes is
  'Le modifiche accettate: [{id, name, kind: new|modified|removed, description, formats}].';

alter table template_syncs enable row level security;
