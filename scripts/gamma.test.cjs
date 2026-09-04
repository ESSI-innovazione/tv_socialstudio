/**
 * Verifica del modulo Gamma contro una risposta registrata.
 *
 * Ogni generazione vera consuma crediti del piano Pro, quindi il giro veloce
 * gira su un finto `fetch` che risponde come l'API documentata. Quello che si
 * verifica qui non e' che Gamma funzioni — quello lo sa Gamma — ma che il
 * nostro lavoro sia durevole, che il file venga davvero riospitato, e che i
 * freni di spesa scattino prima di chiamare.
 *
 * Esegui con: npm run test:gamma
 */

process.env.GAMMA_API_KEY = "sk-gamma-finta-per-i-test";

const base = "../.tmp-test";
const {
  buildBody,
  startDocument,
  advance,
  toGeneratedDocument,
  countPdfPages,
  assertNotAssetFormat,
} = require(`${base}/integrations/gamma.js`);
const {
  GammaLocalLimitError,
  GammaQuotaError,
  GammaRateLimitError,
} = require(`${base}/integrations/gamma-errors.js`);
const { THEMES, FORMAT_MAP, LIMITS } = require(`${base}/integrations/gamma-config.js`);
const { getJob, resetDocumentStore } = require(`${base}/db-documents.js`);
const { objectStore } = require(`${base}/storage.js`);

let pass = 0;
let fail = 0;

function check(name, cond, extra = "") {
  if (cond) pass++;
  else {
    fail++;
    console.log("FAIL:", name, extra);
  }
}

async function throwsAsync(name, fn, type) {
  try {
    await fn();
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

/* ---------------- un PDF finto ma contabile ---------------- */

function fakePdf(pages) {
  let body = "%PDF-1.4\n";
  for (let i = 0; i < pages; i++) {
    body += `${i + 2} 0 obj\n<< /Type /Page /Parent 1 0 R >>\nendobj\n`;
  }
  body += `1 0 obj\n<< /Type /Pages /Count ${pages} >>\nendobj\n%%EOF`;
  return Buffer.from(body, "latin1");
}

const PDF_PAGES = 12;
const EXPORT_URL = "https://exports.gamma.app/temporaneo/abc123?scade=fra-una-settimana";

/* ---------------- il finto Gamma ---------------- */

const calls = { post: 0, get: 0, download: 0, bodies: [] };
let pollsBeforeDone = 2;
let mode = "ok";

globalThis.fetch = async (url, init) => {
  const href = String(url);

  if (href.endsWith("/generations") && init?.method === "POST") {
    calls.post++;
    calls.bodies.push(JSON.parse(init.body));

    if (mode === "quota") {
      return new Response("Crediti esauriti", { status: 402 });
    }
    if (mode === "rate") {
      return new Response("Troppe richieste", { status: 429, headers: { "retry-after": "30" } });
    }
    return Response.json({ generationId: "gen_abc123" });
  }

  if (href.includes("/generations/gen_")) {
    calls.get++;
    if (calls.get < pollsBeforeDone) {
      return Response.json({ generationId: "gen_abc123", status: "pending" });
    }
    return Response.json({
      generationId: "gen_abc123",
      status: "completed",
      gammaId: "g_xyz789",
      gammaUrl: "https://gamma.app/docs/catalogo-servizi-xyz789",
      exportUrl: EXPORT_URL,
      credits: { deducted: 40, remaining: 1960 },
    });
  }

  if (href === EXPORT_URL) {
    calls.download++;
    return new Response(fakePdf(PDF_PAGES), {
      status: 200,
      headers: { "Content-Type": "application/pdf" },
    });
  }

  throw new Error(`fetch inatteso verso ${href}`);
};

/* ---------------- fixture ---------------- */

const CATALOGO = {
  format: "catalogo",
  title: "Catalogo servizi alle imprese 2026",
  inputText:
    "Time Vision accompagna PMI e lavoratori autonomi su bandi, formazione finanziata e digitalizzazione. " +
    "Servizi: analisi preliminare di ammissibilità, redazione della domanda, rendicontazione, formazione finanziata " +
    "tramite fondi interprofessionali, consulenza su voucher digitali e cybersecurity.",
  audience: "imprenditori e titolari di PMI",
  tone: "istituzionale e diretto",
  numCards: 12,
  imageKeys: ["tv-consulenza.jpg", "tv-aula.jpg"],
};

/* ---------------- 1. mappatura della richiesta ---------------- */

const body = buildBody(CATALOGO);

check("tema di brand su ogni generazione", body.themeId === THEMES.brand.id, body.themeId);
check("tema di brand è quello del workspace", THEMES.brand.id === "hjptfe5eku21fbl");
check("formato documento", body.format === "document", body.format);
check("dimensione A4", body.cardOptions.dimensions === "a4", body.cardOptions.dimensions);
check("export in PDF", body.exportAs === "pdf", body.exportAs);
check("lingua sempre italiana", body.textOptions.language === "it", body.textOptions.language);
check("numero di pagine passato", body.numCards === 12, String(body.numCards));
check("tono passato", body.textOptions.tone === "istituzionale e diretto");
check("destinatario passato", body.textOptions.audience === "imprenditori e titolari di PMI");

// Il testo non si riassume mai prima di mandarlo.
check("testo integro", body.inputText === CATALOGO.inputText);
check("testo non troncato", body.inputText.length === CATALOGO.inputText.length);

// Con l'archivio fotografico non si generano immagini.
check("archivio disponibile: niente immagini generate", body.imageOptions.source === "noImages",
  body.imageOptions.source);
check("istruzione di lasciare spazio alle foto", Boolean(body.additionalInstructions));

const senzaFoto = buildBody({ ...CATALOGO, imageKeys: [] });
check("senza archivio: immagini generate", senzaFoto.imageOptions.source === "aiGenerated",
  senzaFoto.imageOptions.source);
check("il campo è style, non stylePreset", "style" in senzaFoto.imageOptions,
  JSON.stringify(senzaFoto.imageOptions));
check("nessun campo stylePreset", !("stylePreset" in senzaFoto.imageOptions));

// textMode dipende dalla lunghezza della fonte.
const lungo = buildBody({ ...CATALOGO, inputText: "x".repeat(7000) });
check("fonte lunga: si condensa", lungo.textMode === "condense", lungo.textMode);
check("brief breve: si genera", body.textMode === "generate", body.textMode);

/* ---------------- 2. mappatura dei quattro formati ---------------- */

const deck = buildBody({ ...CATALOGO, format: "deck" });
check("deck: presentazione", deck.format === "presentation");
check("deck: 16x9", deck.cardOptions.dimensions === "16x9");
check("deck: export pptx", deck.exportAs === "pptx");

const onePager = buildBody({ ...CATALOGO, format: "one-pager" });
check("one-pager: documento A4 pdf",
  onePager.format === "document" && onePager.cardOptions.dimensions === "a4" && onePager.exportAs === "pdf");

const landing = buildBody({ ...CATALOGO, format: "landing" });
check("landing: pagina web", landing.format === "webpage");
check("landing: nessun export", landing.exportAs === undefined, String(landing.exportAs));
check("landing: nessun mime da archiviare", FORMAT_MAP.landing.mime === null);

const eventi = buildBody(CATALOGO, "eventi");
check("tema alternativo selezionabile", eventi.themeId === THEMES.eventi.id);

/* ---------------- 3. il giro completo ---------------- */

(async () => {
  resetDocumentStore();
  calls.post = 0;
  calls.get = 0;
  calls.download = 0;

  const started = await startDocument(CATALOGO, { createdBy: "demo@timevision.it" });

  check("una sola chiamata di invio", calls.post === 1, String(calls.post));
  check("identificativo registrato", started.generation_id === "gen_abc123", String(started.generation_id));
  check("stato in generazione", started.status === "generating", started.status);

  // Primo giro: Gamma sta ancora lavorando.
  const midway = await advance(started.id);
  check("ancora in corso", midway.status === "generating", midway.status);
  check("nessuna seconda generazione avviata", calls.post === 1, String(calls.post));

  /* --- il processo muore qui: si riprende dalla riga --- */
  const resumed = await getJob(started.id);
  check("la riga sopravvive", resumed !== null);
  check("l'identificativo è sulla riga, non in memoria", resumed.generation_id === "gen_abc123");

  const done = await advance(resumed.id);

  check("dopo la ripresa: pronto", done.status === "ready", done.status);
  check("nessuna seconda generazione dopo la ripresa", calls.post === 1, String(calls.post));
  check("il file è stato scaricato una volta sola", calls.download === 1, String(calls.download));
  check("crediti registrati", done.credits_used === 40, String(done.credits_used));
  check("pagine contate dal PDF", done.pages === PDF_PAGES, String(done.pages));
  check("indirizzo modificabile conservato", done.gamma_url.includes("gamma.app/docs/"));

  /* --- l'indirizzo di export non deve sopravvivere da nessuna parte --- */
  const serialised = JSON.stringify(done);
  check("l'URL di export non finisce sulla riga", !serialised.includes(EXPORT_URL), serialised.slice(0, 200));
  check("nessun dominio exports.gamma.app salvato", !serialised.includes("exports.gamma.app"));

  /* --- il file è davvero nostro, non un proxy --- */
  const doc = toGeneratedDocument(done);
  check("storedFileUrl è un indirizzo nostro", doc.storedFileUrl.startsWith("/api/documents/file/"),
    doc.storedFileUrl);
  check("storedFileUrl non punta a Gamma", !doc.storedFileUrl.includes("gamma.app"));
  check("gammaUrl resta esposto per la rifinitura", doc.gammaUrl.includes("gamma.app"));
  check("mime del catalogo", doc.mime === "application/pdf", doc.mime);
  check("pagine nel risultato", doc.pages === PDF_PAGES);

  const stored = await objectStore().get(done.stored_path);
  check("i byte sono nel nostro archivio", stored !== null);
  check("i byte sono quelli del PDF", stored && Buffer.from(stored.data).toString("latin1").startsWith("%PDF-"),
    stored ? Buffer.from(stored.data).subarray(0, 8).toString() : "assente");
  check("dimensione coerente", stored && stored.data.byteLength === fakePdf(PDF_PAGES).byteLength);

  // Gamma sparisce del tutto: il file continua a servirsi.
  const salvato = globalThis.fetch;
  globalThis.fetch = async () => {
    throw new Error("Gamma non è più raggiungibile");
  };
  const dopo = await objectStore().get(done.stored_path);
  check("il file si serve anche con Gamma irraggiungibile", dopo !== null);
  globalThis.fetch = salvato;

  /* ---------------- 4. i freni di spesa ---------------- */

  resetDocumentStore();
  calls.post = 0;
  pollsBeforeDone = 999; // restano tutte aperte

  for (let i = 0; i < LIMITS.concurrency; i++) {
    await startDocument({ ...CATALOGO, title: `Catalogo ${i}` });
  }
  const before = calls.post;

  await throwsAsync(
    "il limite di concorrenza scatta",
    () => startDocument({ ...CATALOGO, title: "Uno di troppo" }),
    GammaLocalLimitError,
  );
  check("il freno scatta prima di chiamare Gamma", calls.post === before, String(calls.post));

  /* ---------------- 5. quota e frequenza ---------------- */

  resetDocumentStore();
  pollsBeforeDone = 2;
  mode = "quota";
  await throwsAsync(
    "crediti esauriti: errore di quota",
    () => startDocument({ ...CATALOGO, title: "Senza crediti" }),
    GammaQuotaError,
  );

  resetDocumentStore();
  mode = "rate";
  await throwsAsync(
    "limite di frequenza: errore distinto",
    () => startDocument({ ...CATALOGO, title: "Troppo in fretta" }),
    GammaRateLimitError,
  );
  mode = "ok";

  // Una quota esaurita non si riprova; un limite di frequenza si.
  const quota = new GammaQuotaError("");
  const rate = new GammaRateLimitError(30);
  check("la quota non è ritentabile", quota.retryable === false);
  check("la frequenza è ritentabile", rate.retryable === true);

  /* ---------------- 6. conteggio pagine ---------------- */

  check("conta 12 pagine", countPdfPages(fakePdf(12)) === 12, String(countPdfPages(fakePdf(12))));
  check("conta 1 pagina", countPdfPages(fakePdf(1)) === 1, String(countPdfPages(fakePdf(1))));
  check("non inventa pagine su un file non-PDF",
    countPdfPages(Buffer.from("non sono un pdf")) === null,
    String(countPdfPages(Buffer.from("non sono un pdf"))));

  /* ---------------- 7. cosa non passa di qui ---------------- */

  for (const format of ["poster-a4", "linkedin", "ig-feed", "ig-story"]) {
    let refused = false;
    try {
      assertNotAssetFormat(format);
    } catch (error) {
      refused = error.message.includes("non passa da Gamma");
    }
    check(`${format} viene rifiutato`, refused);
  }

  let allowed = true;
  try {
    assertNotAssetFormat("catalogo");
  } catch {
    allowed = false;
  }
  check("catalogo resta ammesso", allowed);

  console.log(`\n${pass} verifiche passate, ${fail} fallite`);
  process.exit(fail === 0 ? 0 : 1);
})();
