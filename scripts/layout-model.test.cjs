/**
 * I vincoli del modello di impaginazione sono una promessa di brand, non un
 * dettaglio: un blocco non puo' uscire dal margine di sicurezza e un corpo non
 * puo' esistere fuori dalla scala tipografica. Qui si verifica che valga per
 * ogni formato e ogni archetipo, comprese le posizioni che un trascinamento
 * troppo lungo produrrebbe.
 *
 * Esegui con: npm run test:layout
 */

const { FORMATS } = require("../.tmp-test/brand.js");
const {
  defaultLayout, clampBlock, snap, safeInset, fontSizeOf,
  ladderFor, updateBlock, archetypeFromLabel, ARCHETYPES,
} = require("../.tmp-test/layout-model.js");

let pass = 0, fail = 0;
const check = (name, cond, extra = "") => {
  if (cond) { pass++; } else { fail++; console.log("FAIL:", name, extra); }
};

const formats = Object.keys(FORMATS);

for (const f of formats) {
  for (const a of ARCHETYPES) {
    const L = defaultLayout(f, a.id);

    // 1. Nessun blocco esce dal margine di sicurezza (l'immagine puo' andare a pieno formato).
    const inset = safeInset(f);
    for (const b of L.blocks) {
      if (b.kind === "image") continue;
      check(`${f}/${a.id}/${b.kind} dentro il margine sinistro`, b.x >= inset.x - 1e-9, `x=${b.x} inset=${inset.x}`);
      check(`${f}/${a.id}/${b.kind} dentro il margine destro`, b.x + b.w <= 1 - inset.x + 1e-9, `x+w=${b.x + b.w}`);
      check(`${f}/${a.id}/${b.kind} dentro il margine alto`, b.y >= inset.y - 1e-9, `y=${b.y}`);
    }

    // 2. Ogni blocco di testo ha un corpo che esiste nella scala del formato.
    const ladder = ladderFor(f);
    for (const b of L.blocks) {
      if (b.kind === "image") continue;
      const size = fontSizeOf(f, b);
      check(`${f}/${a.id}/${b.kind} corpo nella scala`, ladder.includes(size), `size=${size}`);
    }

    // 3. Trascinare fuori dalla pagina non porta fuori dalla pagina.
    const runaway = clampBlock(f, { ...L.blocks[1], x: 5, y: 5, w: 9 });
    check(`${f}/${a.id} clamp riporta dentro`,
      runaway.x >= inset.x - 1e-9 && runaway.x + runaway.w <= 1 - inset.x + 1e-9 && runaway.y <= 1,
      JSON.stringify(runaway));

    const negative = clampBlock(f, { ...L.blocks[1], x: -3, y: -3, w: 0.4 });
    check(`${f}/${a.id} clamp respinge i negativi`,
      negative.x >= inset.x - 1e-9 && negative.y >= inset.y - 1e-9,
      JSON.stringify(negative));

    // 4. L'aggancio alla griglia e' idempotente: due giri danno lo stesso punto.
    const once = snap(f, 0.37, 0.41);
    const twice = snap(f, once.x, once.y);
    check(`${f}/${a.id} snap idempotente`,
      Math.abs(once.x - twice.x) < 1e-9 && Math.abs(once.y - twice.y) < 1e-9,
      `${JSON.stringify(once)} vs ${JSON.stringify(twice)}`);

    // 5. Il marchio resta bloccato.
    const logo = L.blocks.find((b) => b.kind === "logo");
    check(`${f}/${a.id} marchio bloccato`, logo && logo.locked === true);

    // 6. updateBlock non puo' creare un blocco illegale.
    const moved = updateBlock(L, "headline", { x: 8, w: 8 });
    const h = moved.blocks.find((b) => b.id === "headline");
    check(`${f}/${a.id} updateBlock vincola`, h.x + h.w <= 1 - inset.x + 1e-9, JSON.stringify(h));
  }
}

// 7. I nomi liberi dell'agente si agganciano agli archetipi noti.
const mapping = [
  ["dato dominante", "dato-dominante"],
  ["countdown in evidenza", "countdown-in-evidenza"],
  ["foto a tutta pagina", "foto-a-tutta-pagina"],
  ["qualcosa di mai visto", "testo-in-alto"],
  [null, "testo-in-alto"],
  ["Foto A Tutta Pagina", "foto-a-tutta-pagina"],
];
for (const [input, expected] of mapping) {
  check(`archetipo da "${input}"`, archetypeFromLabel(input) === expected, archetypeFromLabel(input));
}

console.log(`\n${pass} verifiche passate, ${fail} fallite`);
process.exit(fail === 0 ? 0 : 1);
