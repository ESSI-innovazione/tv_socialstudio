-- Il brand-guard diventa un esito salvato sull'asset.
--
-- Fin qui il controllo del brand era una riga di log dell'esecuzione: non
-- diceva niente di un asset preciso, e il pulsante di pubblicazione non
-- aveva nulla su cui decidere. Adesso ogni asset porta l'impaginazione che
-- e' stata controllata e il verdetto: senza un verdetto positivo non si
-- chiede approvazione e non si pubblica.

alter table assets add column if not exists layout           jsonb;
alter table assets add column if not exists guard            jsonb;
alter table assets add column if not exists guard_status     text
  check (guard_status in ('pass','warn','fail'));
alter table assets add column if not exists guard_checked_at timestamptz;

comment on column assets.layout is
  'L''impaginazione cosi'' com''era quando e'' stata controllata. E'' quella che viene resa e pubblicata.';
comment on column assets.guard is
  'Le verifiche del brand-guard su questo asset: palette, font, marchio, dati con fonte, disclaimer, contrasto.';
comment on column assets.guard_status is
  'Il verdetto complessivo. Solo pass o warn permettono di chiedere approvazione e pubblicare.';

create index if not exists assets_guard_status_idx on assets (guard_status);
