-- Provenienza dei visual generati.
-- Un asset registra da cosa nasce; un'immagine generata non fa eccezione.

create table if not exists generated_images (
  id            text primary key,
  stored_path   text not null,
  prompt        text not null,
  full_prompt   text not null,
  style         text not null,
  purpose       text not null,
  width         integer not null,
  height        integer not null,
  credits_used  integer,
  created_at    timestamptz not null default now()
);

comment on column generated_images.full_prompt is
  'Il prompt davvero inviato, vincoli di brand compresi: e'' quello che ha prodotto l''immagine.';

create index if not exists generated_images_recent_idx
  on generated_images (created_at desc);

alter table generated_images enable row level security;
