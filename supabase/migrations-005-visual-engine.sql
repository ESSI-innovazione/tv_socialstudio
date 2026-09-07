-- Il motore dei visual non e' piu' Gamma ma Pollinations: gratuito, quindi
-- senza crediti, ma con due cose che prima non c'erano e che servono a
-- rifare una variante riuscita — il modello e il seme.
--
-- `credits_used` resta: le righe generate con Gamma lo hanno valorizzato e
-- buttarlo via cancellerebbe quanto e' costato quel materiale.

alter table generated_images add column if not exists model text;
alter table generated_images add column if not exists seed  bigint;

comment on column generated_images.model is
  'Il modello che ha prodotto l''immagine. Null sulle righe generate con Gamma.';
comment on column generated_images.seed is
  'Il seme del generatore: con prompt e stile e'' quanto basta a rifare la stessa immagine.';
