-- La coda di pubblicazione diventa un lavoro vero.
--
-- Tre cose mancavano alla tabella scheduled_posts per reggere un cron:
-- chi ha programmato il post, un modo per prenderlo in carico una volta
-- sola (due esecuzioni del cron non devono pubblicare due volte), e il
-- conto dei tentativi per non insistere contro un canale che risponde male.

alter table scheduled_posts add column if not exists created_by    text;
alter table scheduled_posts add column if not exists variant_index integer;
alter table scheduled_posts add column if not exists attempts      integer not null default 0;
alter table scheduled_posts add column if not exists claimed_at    timestamptz;

comment on column scheduled_posts.claimed_at is
  'Quando una funzione ha preso in carico la pubblicazione. Un claim piu'' vecchio di cinque minuti e'' scaduto e si puo'' riprendere.';
comment on column scheduled_posts.variant_index is
  'La variante dell''esecuzione pubblicata: serve a riaprire l''asset giusto dal calendario.';

create index if not exists scheduled_posts_calendar_idx
  on scheduled_posts (coalesce(scheduled_for, published_at, created_at));
