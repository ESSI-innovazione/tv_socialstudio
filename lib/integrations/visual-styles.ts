import type { VisualStyle } from "./types";

/**
 * Gli stili dei visual, e la coda di prompt che li rende.
 *
 * Stanno in un file loro perche' il pannello di scelta e' un componente
 * client: importarli da `flux.ts` si tirerebbe dietro la lettura
 * dell'ambiente, che nel browser non ha niente da leggere. Qui non c'e' altro
 * che testo.
 *
 * Sono i quattro stili del prototipo FN4 piu' `scene`, che serviva gia' qui.
 *
 * Le code di prompt sono in inglese, e non e' una svista. Il modello e'
 * addestrato in inglese e la differenza e' vistosa: allo stesso prompt in
 * italiano — «aula di formazione con partecipanti visti di spalle» — risponde
 * con un'aula vuota, o con una baita nel bosco; in inglese risponde con l'aula
 * e le persone di spalle. Le etichette restano in italiano, perche' quelle le
 * legge chi sceglie, non il modello.
 */

export const STYLE_PROMPT: Record<VisualStyle, string> = {
  photo: "Professional photography, high quality, natural light, shallow depth of field",
  scene: "Candid documentary photograph, recognisable setting, natural light, a real moment",
  illustration: "Modern vector illustration, flat design, clean colours, crisp shapes",
  abstract: "Abstract art, geometric shapes, elegant gradients, spare composition",
  lineart: "Minimal line art, thin line drawing, plain light background",
};

/** L'ordine in cui si presentano, e come si chiamano nel pannello. */
export const STYLES: { id: VisualStyle; label: string }[] = [
  { id: "photo", label: "Foto" },
  { id: "scene", label: "Scena" },
  { id: "illustration", label: "Illustrazione" },
  { id: "abstract", label: "Astratto" },
  { id: "lineart", label: "Line art" },
];

/**
 * Lo stile di partenza e' `photo`, e non e' un dettaglio.
 *
 * Prima era `abstract`: chi apriva il pannello e premeva Genera senza toccare
 * niente otteneva un astratto 3D. Insieme al prompt pieno di proibizioni, che
 * il generatore leggeva come soggetto, e' da li' che venivano i visual «3D con
 * colori strani» e la «carta da parati».
 */
export const DEFAULT_STYLE: VisualStyle = "photo";

export function isStyle(value: unknown): value is VisualStyle {
  return typeof value === "string" && value in STYLE_PROMPT;
}
