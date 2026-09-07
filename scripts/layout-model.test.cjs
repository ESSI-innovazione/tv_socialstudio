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

/* ---------------- colori e stile ---------------- */

const { normalizeHex, isDark, rgba, updateStyle, hasStyle, encodeLayout, decodeLayout, templateLayout } = require("../.tmp-test/layout-model.js");
// Un layout vero e' quello incolonnato dal template, non quello grezzo: e' quello che l'editor tiene in mano.
const SAMPLE_TEXT = { eyebrow: "Voucher", headline: "20.000 €", subhead: "a fondo perduto", body: "Il MIMIT copre il 50% delle spese.", badge: "Click-day", disclaimer: "Misura del Ministero." };

check("esadecimale con cancelletto", normalizeHex("#1F4E9C") === "#1f4e9c");
check("esadecimale senza cancelletto", normalizeHex("1f4e9c") === "#1f4e9c");
check("esadecimale corto", normalizeHex("#abc") === "#aabbcc");
check("un nome non e' un colore", normalizeHex("blue") === null);
check("rgb() non e' un colore", normalizeHex("rgb(1,2,3)") === null);
check("il vino e' scuro", isDark("#720026") === true);
check("il bianco e' chiaro", isDark("#ffffff") === false);
check("un blu pieno e' scuro", isDark("#1f4e9c") === true);
check("rgba dal vino", rgba("#720026", 0.5) === "rgba(114,0,38,0.5)");

const plain = templateLayout("linkedin", "dato-dominante", SAMPLE_TEXT);
check("senza scelte non c'e' stile", hasStyle(plain) === false);
const styled = updateStyle(plain, { background: "#1f4e9c", font: "playfair" });
check("lo stile si applica", styled.style.background === "#1f4e9c" && styled.style.font === "playfair");
const reverted = updateStyle(styled, { background: undefined, font: undefined });
check("tornare al brand kit toglie lo stile del tutto", !("style" in reverted));

const coloured = updateBlock(styled, "headline", { color: "#ffcc00" });
const roundTrip = decodeLayout(decodeURIComponent(encodeLayout(coloured)), "linkedin");
// L'ordine delle chiavi non conta: conta che ogni valore torni uguale.
// E nemmeno un errore di virgola mobile alla diciassettesima cifra, che il clamp produce da solo.
const canon = (v) => Array.isArray(v) ? v.map(canon) : v && typeof v === "object" ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, canon(v[k])])) : typeof v === "number" ? Math.round(v * 1e9) / 1e9 : v;
check("il layout sopravvive al viaggio nell'URL", roundTrip !== null && JSON.stringify(canon(roundTrip)) === JSON.stringify(canon(coloured)), JSON.stringify(roundTrip));
const image = roundTrip && roundTrip.blocks.find((b) => b.kind === "image");
check("l'immagine a pieno formato non viene spinta dentro il margine", image && image.x === 0.5 && image.w === 0.5);
check("un formato diverso da quello della rotta si scarta", decodeLayout(decodeURIComponent(encodeLayout(coloured)), "ig-feed") === null);
check("JSON rotto si scarta", decodeLayout("{not json", "linkedin") === null);
check("niente parametro, niente layout", decodeLayout(null, "linkedin") === null);
check("blocchi che non sono un elenco si scartano", decodeLayout(JSON.stringify({ format: "linkedin", blocks: "x" }), "linkedin") === null);

const hostile = JSON.stringify({
  format: "linkedin",
  blocks: [{ id: "headline", kind: "headline", x: -5, y: 9, w: 40, step: 99, color: "javascript:alert(1)", visible: true }],
  style: { font: "comic-sans", background: "url(x)" },
});
const tamed = decodeLayout(hostile, "linkedin");
const insetL = safeInset("linkedin");
check("un blocco fuori margine viene riportato dentro", tamed && tamed.blocks[0].x >= insetL.x - 1e-9 && tamed.blocks[0].x + tamed.blocks[0].w <= 1 - insetL.x + 1e-9);
check("un passo fuori scala viene riportato in scala", tamed && tamed.blocks[0].step === ladderFor("linkedin").length - 1);
check("un colore che non e' un colore sparisce", tamed && !("color" in tamed.blocks[0]));
check("un font sconosciuto e un fondo non valido spariscono", tamed && !("style" in tamed));

const veiled = updateBlock(coloured, "image", { veil: 0.35 });
const veiledBack = decodeLayout(decodeURIComponent(encodeLayout(veiled)), "linkedin");
check("il velo dell'immagine sopravvive al viaggio nell'URL", veiledBack && veiledBack.blocks.find((b) => b.kind === "image").veil === 0.35);
const overVeil = decodeLayout(JSON.stringify({ format: "linkedin", blocks: [{ id: "image", kind: "image", x: 0, y: 0, w: 1, h: 1, veil: 7 }, { id: "headline", kind: "headline", x: 0.1, y: 0.1, w: 0.5, veil: 0.5 }] }), "linkedin");
check("un velo oltre 1 viene riportato a 1", overVeil && overVeil.blocks[0].veil === 1);
check("il velo non esiste sui blocchi di testo", overVeil && !("veil" in overVeil.blocks[1]));

// Un ritocco a una foto a pieno formato non deve stringerla dentro i margini.
const full = defaultLayout("ig-story", "foto-a-tutta-pagina");
const touched = updateBlock(full, "image", { veil: 0.5 }).blocks.find((b) => b.kind === "image");
check("la foto a pieno formato resta a pieno formato dopo un ritocco", touched.x === 0 && touched.y === 0 && touched.w === 1 && touched.h === 1, JSON.stringify(touched));
const pushed = clampBlock("ig-story", { ...touched, x: 0.4, y: -0.3, w: 1.5, h: 2 });
check("ma non esce dall'artboard", pushed.x === 0 && pushed.y === 0 && pushed.w === 1 && pushed.h === 1, JSON.stringify(pushed));

console.log(`\n${pass} verifiche passate, ${fail} fallite`);
process.exit(fail === 0 ? 0 : 1);
