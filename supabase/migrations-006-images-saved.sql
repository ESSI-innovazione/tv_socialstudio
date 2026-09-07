-- Generare non e' archiviare.
--
-- Fin qui ogni visual generato finiva subito fra quelli proposti a tutti,
-- anche i tentativi scartati dopo un'occhiata. Adesso la riga si scrive
-- sempre — la provenienza e il freno giornaliero ne hanno bisogno — ma
-- l'archivio mostra solo quello che qualcuno ha scelto di tenere.
--
-- Le righe esistenti erano gia' visibili: restano tali.

alter table generated_images add column if not exists saved boolean not null default false;

update generated_images set saved = true where saved = false;

comment on column generated_images.saved is
  'Vero quando qualcuno ha tenuto il visual: solo questi tornano nell''archivio. Le altre righe restano per la provenienza.';

create index if not exists generated_images_saved_idx
  on generated_images (saved, created_at desc);
