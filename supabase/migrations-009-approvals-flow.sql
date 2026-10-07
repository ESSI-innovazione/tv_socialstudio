-- Il flusso di approvazione: chi chiede, su quale variante, cosa risponde chi approva.
--
-- La tabella approvals aveva solo il nome dell'approvatore e lo stato: non
-- diceva chi aveva chiesto, per quale variante, ne' perche' una richiesta
-- era stata rimandata indietro. E l'archivio non aveva un modo rapido per
-- sapere quali asset erano stati approvati, da chi e quando.

alter table approvals add column if not exists requested_by  text;
alter table approvals add column if not exists variant_index integer not null default 0;
alter table approvals add column if not exists note          text;
alter table approvals add column if not exists comment       text;

comment on column approvals.requested_by is 'L''editor che ha chiesto l''approvazione.';
comment on column approvals.variant_index is 'La variante dell''esecuzione a cui si riferisce la richiesta.';
comment on column approvals.note is 'Il messaggio di chi chiede.';
comment on column approvals.comment is 'Il commento di chi decide: obbligatorio quando rimanda indietro.';

create index if not exists approvals_status_idx on approvals (status, created_at);

-- Sull'asset: approvato da chi, quando, con quale richiesta.
alter table assets add column if not exists approval_id uuid references approvals(id) on delete set null;
alter table assets add column if not exists approved_by text;
alter table assets add column if not exists approved_at timestamptz;

create index if not exists assets_approved_idx on assets (approved_at desc) where approved_at is not null;
