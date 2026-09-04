-- La specifica completa del template, come sincronizzata da Figma.
-- list() e get() leggono da qui e non toccano mai la rete.

alter table templates add column if not exists spec jsonb;

comment on column templates.spec is
  'TemplateSpec completa: frame per formato, tipografia per ruolo, riquadro immagine, marchio.';

create index if not exists templates_spec_present_idx
  on templates ((spec is not null));
