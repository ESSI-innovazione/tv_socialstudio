/**
 * Il riempimento dell'istruzione di uno strumento e' una promessa: un
 * segnaposto senza campo o un campo obbligatorio vuoto fermano l'esecuzione,
 * non producono un prompt con un buco. Qui si verifica che valga, insieme
 * alla validazione che l'editor degli strumenti usa prima di pubblicare.
 *
 * Esegui con: npm run test:tools
 */

const {
  fillTemplate, placeholdersOf, missingRequired, validateTool, splitTemplate,
  draftCopy, exampleValues, labelFromKey, renderValue, ToolFieldError,
} = require("../.tmp-test/tool-fields.js");

let pass = 0, fail = 0;
const check = (name, cond, extra = "") => {
  if (cond) pass++;
  else { fail++; console.log("FAIL:", name, extra); }
};
const throws = (name, fn, key) => {
  try { fn(); fail++; console.log("FAIL:", name, "(non ha sollevato niente)"); }
  catch (e) {
    if (e instanceof ToolFieldError && (key === undefined || e.key === key)) pass++;
    else { fail++; console.log("FAIL:", name, `(${e.constructor.name}: ${e.message}, key=${e.key})`); }
  }
};

const poster = {
  prompt_template: "Costruisci un poster A4 per il bando {{bando}}. Scadenza {{scadenza}}, destinatario {{target}}. CTA: {{cta}}.",
  default_formats: ["poster-a4"],
  fields: [
    { key: "bando", label: "Il bando", type: "text", required: true, example: "Voucher Cloud MIMIT" },
    { key: "scadenza", label: "La scadenza", type: "datetime", required: true, example: "2026-11-10T12:00" },
    { key: "target", label: "A chi si rivolge", type: "text", required: false, example: "PMI" },
    { key: "cta", label: "Chiamata all'azione", type: "choice_link", required: true, example: "Scopri il voucher", options: ["Scopri il voucher", "Prenota una consulenza"] },
  ],
};

/* ---------------- segnaposto ---------------- */

check("i segnaposto escono in ordine e senza doppioni", JSON.stringify(placeholdersOf("{{a}} e {{b}} poi {{ a }} e {{B}}")) === JSON.stringify(["a", "b"]));
check("nessun segnaposto, lista vuota", placeholdersOf("niente qui").length === 0);

/* ---------------- riempimento ---------------- */

const full = fillTemplate(poster, { bando: "Voucher Cloud", scadenza: "2026-11-10T12:00", target: "PMI", cta: "Scopri il voucher" });
check("tutti i valori entrano nel prompt", full.includes("bando Voucher Cloud") && full.includes("destinatario PMI") && full.includes("CTA: Scopri il voucher."), full);
check("la data e ora diventa leggibile", /10 novembre 2026, ore 12:00/.test(full), full);
check("nessun segnaposto resta", !full.includes("{{"), full);

const partial = fillTemplate(poster, { bando: "Voucher Cloud", scadenza: "2026-11-10T12:00", cta: "Scopri il voucher" });
check("un facoltativo vuoto e' dichiarato, non inventato", partial.includes("destinatario (non indicato)"), partial);

throws("un obbligatorio vuoto e' un errore sul suo campo", () => fillTemplate(poster, { bando: "Voucher", scadenza: "", cta: "x" }), "scadenza");
throws("uno spazio non e' un valore", () => fillTemplate(poster, { bando: "   ", scadenza: "2026-11-10T12:00", cta: "x" }), "bando");
throws("un segnaposto senza campo e' un errore", () => fillTemplate({ prompt_template: "Ciao {{nome}}", fields: [] }, { nome: "x" }), "nome");

const missing = missingRequired(poster, { bando: "x" });
check("i mancanti sono nell'ordine del modulo", missing.map((f) => f.key).join(",") === "scadenza,cta", missing.map((f) => f.key).join(","));

const date = renderValue({ key: "d", label: "D", type: "date", required: true, example: "" }, "2026-11-10");
check("una data senza ora non mostra l'ora", date === "10 novembre 2026", date);
check("un valore non data passa com'e'", renderValue(poster.fields[0], "  testo ") === "testo");

/* ---------------- spezzatura per i chip ---------------- */

const parts = splitTemplate(poster, { bando: "Voucher Cloud" });
check("testo e campi si alternano", parts[0].kind === "text" && parts[1].kind === "field" && parts[1].key === "bando", JSON.stringify(parts.slice(0, 2)));
check("il campo compilato porta il valore", parts[1].value === "Voucher Cloud");
check("il campo vuoto non ha valore", parts.find((p) => p.kind === "field" && p.key === "target").value === null);
const orphan = splitTemplate({ prompt_template: "x {{ignoto}}", fields: [] });
check("un segnaposto senza campo resta riconoscibile", orphan[1].kind === "field" && orphan[1].field === null);

/* ---------------- validazione per la pubblicazione ---------------- */

check("uno strumento a posto non ha problemi", validateTool(poster).length === 0, JSON.stringify(validateTool(poster)));
check("un segnaposto senza domanda blocca", validateTool({ ...poster, prompt_template: poster.prompt_template + " {{extra}}" }).some((p) => p.includes("{{extra}}")));
check("una domanda non usata blocca", validateTool({ ...poster, fields: [...poster.fields, { key: "inutile", label: "X", type: "text", required: false, example: "" }] }).some((p) => p.includes("inutile")));
check("senza formati non si pubblica", validateTool({ ...poster, default_formats: [] }).some((p) => p.includes("formato")));
check("una chiave con la maiuscola non va", validateTool({ ...poster, fields: poster.fields.map((f) => (f.key === "cta" ? { ...f, key: "Cta" } : f)), prompt_template: poster.prompt_template.replace("{{cta}}", "{{Cta}}") }).some((p) => p.includes("Cta")));
check("una scelta senza opzioni non va", validateTool({ ...poster, fields: poster.fields.map((f) => (f.key === "cta" ? { ...f, options: [] } : f)) }).some((p) => p.includes("opzioni")));
check("una chiave doppia non va", validateTool({ ...poster, fields: [...poster.fields, poster.fields[0]] }).some((p) => p.includes("due volte")));

/* ---------------- esempi e anteprima ---------------- */

const examples = exampleValues(poster);
check("gli esempi riempiono il modulo", examples.bando === "Voucher Cloud MIMIT" && examples.cta === "Scopri il voucher");
check("con gli esempi il prompt si riempie", !fillTemplate(poster, examples).includes("{{"));
check("la chiave diventa un'etichetta", labelFromKey("data_scadenza") === "Data scadenza");

const draft = draftCopy(poster, { bando: "Voucher Cloud", scadenza: "2026-11-10T12:00", cta: "Scopri il voucher" }, "Voucher Cloud MIMIT");
check("il titolo dell'anteprima e' il bando", draft.headline === "Voucher Cloud", draft.headline);
check("la banda e' la scadenza leggibile", draft.badge === "Scadenza 10 novembre 2026, ore 12:00", draft.badge);
check("il pulsante e' la CTA", draft.cta_label === "Scopri il voucher");
const empty = draftCopy(poster, {}, "Voucher Cloud MIMIT");
check("senza valori l'anteprima usa la campagna", empty.headline === "Voucher Cloud MIMIT" && empty.badge === null);

console.log(`${pass} verifiche passate, ${fail} fallite`);
process.exit(fail > 0 ? 1 : 0);
