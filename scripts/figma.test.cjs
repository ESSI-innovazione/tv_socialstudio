/**
 * Verifica del lettore Figma senza toccare Figma.
 *
 * La chiamata di rete non e' la parte che sbaglia: sbaglia l'estrazione. Qui
 * si dà in pasto un documento con la forma esatta che restituisce
 * GET /v1/files/:key e si controlla che la TemplateSpec che esce sia giusta,
 * compresi i casi in cui il template e' mal formato e deve fallire.
 *
 * Esegui con: npm run test:figma
 */

const { pageToSpec, toHex, parseLayerName } = require("../.tmp-test/integrations/figma.js");
const {
  FigmaNotConfiguredError,
  TemplateIncompleteError,
  UnknownRoleError,
} = require("../.tmp-test/integrations/figma-errors.js");

let pass = 0;
let fail = 0;

function check(name, cond, extra = "") {
  if (cond) pass++;
  else {
    fail++;
    console.log("FAIL:", name, extra);
  }
}

function throws(name, fn, type) {
  try {
    fn();
    fail++;
    console.log("FAIL:", name, "(non ha sollevato niente)");
  } catch (error) {
    if (error instanceof type) pass++;
    else {
      fail++;
      console.log("FAIL:", name, `(${error.constructor.name}: ${error.message})`);
    }
  }
}

/* ---------------- fixture: la forma vera dei nodi Figma ---------------- */

const wine = { r: 0.4470588, g: 0, b: 0.14901961 };
const white = { r: 1, g: 1, b: 1 };
const coral = { r: 1, g: 0.49803922, b: 0.31764707 };
const onWine = { r: 0.9098039, g: 0.76862746, b: 0.79607844 };

function text(id, name, x, y, w, h, style, color) {
  return {
    id,
    name,
    type: "TEXT",
    absoluteBoundingBox: { x, y, width: w, height: h },
    style,
    fills: [{ type: "SOLID", visible: true, color }],
    characters: "segnaposto",
  };
}

function posterFrame() {
  return {
    id: "10:1",
    name: "poster-a4",
    type: "FRAME",
    absoluteBoundingBox: { x: 0, y: 0, width: 794, height: 1123 },
    fills: [{ type: "SOLID", visible: true, color: wine }],
    children: [
      {
        id: "10:2",
        name: "logo",
        type: "VECTOR",
        absoluteBoundingBox: { x: 64, y: 64, width: 33, height: 34 },
        fills: [{ type: "SOLID", visible: true, color: white }],
      },
      text(
        "10:3",
        "eyebrow@28",
        528,
        66,
        202,
        18,
        { fontSize: 13, fontWeight: 600, lineHeightPx: 15.6, letterSpacing: 1.69 },
        onWine,
      ),
      // 47.5px: il numero deve arrivare intatto, non arrotondato a 48.
      text(
        "10:4",
        "headline@48",
        64,
        176,
        620,
        160,
        { fontSize: 47.5, fontWeight: 800, lineHeightPx: 49.4, letterSpacing: -1.66 },
        white,
      ),
      text(
        "10:5",
        "subhead",
        64,
        356,
        600,
        44,
        { fontSize: 34, fontWeight: 600, lineHeightPx: 39.1, letterSpacing: -0.68 },
        coral,
      ),
      text(
        "10:6",
        "body@220",
        64,
        420,
        600,
        120,
        { fontSize: 21, fontWeight: 400, lineHeightPx: 32.5, letterSpacing: 0 },
        onWine,
      ),
      {
        id: "10:7",
        name: "gruppo scadenza",
        type: "GROUP",
        absoluteBoundingBox: { x: 64, y: 560, width: 420, height: 56 },
        children: [
          text(
            "10:8",
            "deadline@44",
            81,
            577,
            386,
            22,
            { fontSize: 22, fontWeight: 800, lineHeightPx: 26.4, letterSpacing: -0.22 },
            white,
          ),
        ],
      },
      {
        id: "10:9",
        name: "image",
        type: "RECTANGLE",
        absoluteBoundingBox: { x: 64, y: 650, width: 666, height: 300 },
      },
      text(
        "10:10",
        "cta@40",
        64,
        980,
        400,
        30,
        { fontSize: 30, fontWeight: 700, lineHeightPx: 36, letterSpacing: -0.6 },
        white,
      ),
      text(
        "10:11",
        "disclaimer",
        64,
        1030,
        666,
        30,
        { fontSize: 12, fontWeight: 400, lineHeightPx: 16.8, letterSpacing: 0 },
        onWine,
      ),
    ],
  };
}

function socialFrame(id, name, w, h) {
  return {
    id,
    name,
    type: "FRAME",
    absoluteBoundingBox: { x: 1000, y: 0, width: w, height: h },
    fills: [{ type: "SOLID", visible: true, color: wine }],
    children: [
      {
        id: `${id}:logo`,
        name: "logo",
        type: "VECTOR",
        absoluteBoundingBox: { x: 1054, y: 54, width: 28, height: 29 },
        fills: [{ type: "SOLID", visible: true, color: white }],
      },
      text(
        `${id}:h`,
        "headline@42",
        1054,
        200,
        610,
        130,
        { fontSize: 62, fontWeight: 800, lineHeightPx: 64.5, letterSpacing: -2.17 },
        white,
      ),
    ],
  };
}

function page(children) {
  return { id: "1:0", name: "TPL/Bando con countdown", type: "CANVAS", children };
}

/* ---------------- 1. estrazione corretta ---------------- */

const spec = pageToSpec(page([posterFrame(), socialFrame("20:1", "linkedin", 1200, 627)]), "2026-09-04T10:00:00Z");

check("il nome perde il prefisso TPL/", spec.name === "Bando con countdown", spec.name);
check("id della pagina", spec.id === "1:0");
check("due formati riconosciuti", spec.formats.length === 2, JSON.stringify(spec.formats));
check("poster-a4 presente", spec.formats.includes("poster-a4"));
check("updatedAt dal file", spec.updatedAt === "2026-09-04T10:00:00Z");

const poster = spec.frames["poster-a4"];
check("fondo del frame convertito in hex", poster.background === "#720026", poster.background);
check("sette ruoli di testo estratti", poster.slots.length === 7, `${poster.slots.length}`);

const headline = poster.slots.find((s) => s.role === "headline");
check("headline: corpo non arrotondato", headline.fontSize === 47.5, `${headline.fontSize}`);
check("headline: peso", headline.fontWeight === 800, `${headline.fontWeight}`);
check("headline: interlinea in px", headline.lineHeight === 49.4, `${headline.lineHeight}`);
check("headline: spaziatura negativa", headline.letterSpacing === -1.66, `${headline.letterSpacing}`);
check("headline: colore bianco", headline.color === "#ffffff", headline.color);
check("headline: maxChars dal suffisso", headline.maxChars === 48, `${headline.maxChars}`);

const subhead = poster.slots.find((s) => s.role === "subhead");
check("subhead: maxChars stimato quando manca il suffisso", subhead.maxChars > 0, `${subhead.maxChars}`);
check("subhead: colore corallo", subhead.color === "#ff7f51", subhead.color);

const deadline = poster.slots.find((s) => s.role === "deadline");
check("ruolo trovato dentro un gruppo annidato", deadline !== undefined);
check("deadline: maxChars", deadline && deadline.maxChars === 44);

check("riquadro immagine relativo al frame", poster.imageSlot.x === 64 && poster.imageSlot.y === 650,
  JSON.stringify(poster.imageSlot));
check("riquadro immagine: dimensione", poster.imageSlot.w === 666 && poster.imageSlot.h === 300);
check("marchio relativo al frame", poster.logo.x === 64 && poster.logo.y === 64, JSON.stringify(poster.logo));
check("marchio: colore", poster.logo.color === "#ffffff", poster.logo.color);

// Le coordinate del frame LinkedIn partono da x=1000 sul canvas: devono
// arrivare relative al frame, non assolute.
const li = spec.frames["linkedin"];
check("frame lontano sul canvas: marchio relativo", li.logo.x === 54 && li.logo.y === 54,
  JSON.stringify(li.logo));

/* ---------------- 2. conversioni ---------------- */

check("hex: wine", toHex(wine) === "#720026", toHex(wine));
check("hex: corallo", toHex(coral) === "#ff7f51", toHex(coral));
check("hex: valori fuori scala vengono limitati", toHex({ r: 2, g: -1, b: 0.5 }) === "#ff0080",
  toHex({ r: 2, g: -1, b: 0.5 }));

check("nome livello semplice", parseLayerName("headline").maxChars === null);
check("nome livello con soglia", parseLayerName("headline@48").maxChars === 48);
check("nome livello con spazi", parseLayerName("  body@220  ").role === "body");
check("soglia non numerica ignorata", parseLayerName("body@abc").maxChars === null);
check("soglia zero ignorata", parseLayerName("body@0").maxChars === null);

/* ---------------- 3. template mal formati falliscono per nome ---------------- */

throws(
  "livello con ruolo sconosciuto",
  () => {
    const frame = posterFrame();
    frame.children.push(
      text("10:99", "titolone", 64, 200, 100, 20, { fontSize: 20 }, white),
    );
    pageToSpec(page([frame]), "2026-09-04T10:00:00Z");
  },
  UnknownRoleError,
);

throws(
  "manca il frame poster-a4",
  () => pageToSpec(page([socialFrame("20:1", "linkedin", 1200, 627)]), "2026-09-04T10:00:00Z"),
  TemplateIncompleteError,
);

throws(
  "nessun frame riconosciuto",
  () => pageToSpec(page([{ id: "9:9", name: "appunti", type: "FRAME", children: [] }]), "x"),
  TemplateIncompleteError,
);

throws(
  "frame senza marchio",
  () => {
    const frame = posterFrame();
    frame.children = frame.children.filter((c) => c.name !== "logo");
    pageToSpec(page([frame]), "x");
  },
  TemplateIncompleteError,
);

throws(
  "frame senza testi",
  () => {
    const frame = posterFrame();
    frame.children = frame.children.filter((c) => c.type !== "TEXT" && c.type !== "GROUP");
    pageToSpec(page([frame]), "x");
  },
  TemplateIncompleteError,
);

// L'errore deve nominare il template, se no non si sa dove guardare.
try {
  pageToSpec(page([socialFrame("20:1", "linkedin", 1200, 627)]), "x");
} catch (error) {
  check("l'errore nomina il template", error.message.includes("Bando con countdown"), error.message);
  check("l'errore nomina il problema", error.message.includes("poster-a4"), error.message);
}

/* ---------------- 4. senza credenziali: errore chiaro, non crash ---------------- */

const missing = new FigmaNotConfiguredError(["FIGMA_TOKEN"]);
check("errore di configurazione: nomina la variabile", missing.message.includes("FIGMA_TOKEN"));
check("errore di configurazione: è un Error", missing instanceof Error);
check("errore di configurazione: elenca cosa manca", missing.missing.length === 1);

console.log(`\n${pass} verifiche passate, ${fail} fallite`);
process.exit(fail === 0 ? 0 : 1);
