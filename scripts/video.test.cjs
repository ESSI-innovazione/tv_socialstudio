/**
 * Verifica del video breve senza aprire Chromium.
 *
 * Il rendering vero costa un minuto e un browser: qui si controlla tutto il
 * resto. Che il reveal entri in ordine di lettura e finisca dentro la durata,
 * che le misure siano pari per ogni formato, e che un lavoro sia durevole:
 * riparte se interrotto, si ferma alla seconda interruzione, e i freni
 * scattano prima di renderizzare.
 *
 * Esegui con: npm run test:video
 */

const base = "../.tmp-test";
const { videoSize, DURATION_MS, FPS, LIMITS, MAX_ATTEMPTS, STALE_RENDERING_MS, STALE_PENDING_MS } = require(`${base}/video/spec.js`);
const { buildTimeline, entranceEnd, frameTime, frameCount } = require(`${base}/video/timeline.js`);
const { startVideo, advance, isStale, videoPath, toVideoView, videosForRun } = require(`${base}/video/jobs.js`);
const { VideoLimitError } = require(`${base}/video/errors.js`);
const { getJob, updateJob, resetVideoStore, forceStoreBackend, videosAreDurable } = require(`${base}/db-videos.js`);
const { objectStore } = require(`${base}/storage.js`);
const { FORMAT_ORDER } = require(`${base}/brand.js`);
const { defaultLayout, ARCHETYPES } = require(`${base}/layout-model.js`);

let pass = 0;
let fail = 0;

function check(name, cond, extra = "") {
  if (cond) pass++;
  else {
    fail++;
    console.log("FAIL:", name, extra);
  }
}

/* ---------------- misure ---------------- */

for (const format of FORMAT_ORDER) {
  const size = videoSize(format);
  check(`${format}: larghezza pari`, size.width % 2 === 0, size.width);
  check(`${format}: altezza pari`, size.height % 2 === 0, size.height);
  check(`${format}: cattura alla misura del formato`, size.captureWidth > 0 && size.captureHeight > 0);
}
check("poster a scala doppia", videoSize("poster-a4").scale === 2 && videoSize("poster-a4").width === 1588 && videoSize("poster-a4").height === 2246);
check("linkedin perde il pixel dispari", videoSize("linkedin").width === 1200 && videoSize("linkedin").height === 626);
check("story nativa", videoSize("ig-story").width === 1080 && videoSize("ig-story").height === 1920);

/* ---------------- reveal ---------------- */

for (const format of FORMAT_ORDER) {
  for (const { id: archetype } of ARCHETYPES) {
    const layout = defaultLayout(format, archetype);
    const t = buildTimeline(layout);
    const label = `${format}/${archetype}`;

    check(`${label}: un movimento per blocco visibile`, t.motions.length === layout.blocks.filter((b) => b.visible).length);
    check(`${label}: l'entrata finisce dentro la durata`, entranceEnd(t) < t.durationMs, entranceEnd(t));
    check(`${label}: 240 fotogrammi`, t.frames === 240, t.frames);

    const image = t.motions.find((m) => m.kind === "image");
    if (image) check(`${label}: la foto scivola per tutta la durata`, image.effect === "drift" && image.delayMs === 0 && image.durationMs === t.durationMs);

    const logo = t.motions.find((m) => m.kind === "logo");
    if (logo) check(`${label}: il marchio appare subito`, logo.effect === "fade" && logo.delayMs === 0);

    const rises = t.motions.filter((m) => m.effect === "rise");
    const byId = Object.fromEntries(layout.blocks.map((b) => [b.id, b]));
    let ordered = true;
    for (let i = 1; i < rises.length; i++) {
      if (rises[i].delayMs <= rises[i - 1].delayMs) ordered = false;
      if (byId[rises[i].id].y < byId[rises[i - 1].id].y) ordered = false;
    }
    check(`${label}: i testi entrano dall'alto verso il basso, uno alla volta`, ordered);
  }
}

{
  const layout = defaultLayout("ig-story", ARCHETYPES[0].id);
  const hidden = { ...layout, blocks: layout.blocks.map((b, i) => (i === 0 ? { ...b, visible: false } : b)) };
  const t = buildTimeline(hidden);
  check("un blocco nascosto non anima", !t.motions.some((m) => m.id === layout.blocks[0].id));
  check("durata e fps personalizzabili", buildTimeline(layout, 6000, 25).frames === 150);
}

check("fotogramma 30 a un secondo", frameTime(30, FPS) === 1000);
check("frameCount arrotonda", frameCount(DURATION_MS, FPS) === 240);

/* ---------------- lavori ---------------- */

const request = {
  format: "ig-story",
  variant: 0,
  copy: {
    index: 0,
    layout: "testo in alto",
    eyebrow: "MIMIT",
    headline: "Titolo",
    subhead: "Sotto",
    body: "Corpo",
    badge: null,
    cta_label: "Scopri",
    cta_url: "timevision.it",
    disclaimer: null,
  },
  archetype: ARCHETYPES[0].id,
  layout: null,
  photo: "tv-digitale.jpg",
  durationMs: DURATION_MS,
};

const fakeVideo = () => ({
  bytes: new Uint8Array([0, 0, 0, 24, 102, 116, 121, 112]),
  width: 1080,
  height: 1920,
  durationMs: DURATION_MS,
  fps: FPS,
  music: false,
});

async function jobSuite(mode) {
  const tag = (name) => `[${mode}] ${name}`;
  await resetVideoStore();

  // Successo.
  {
    let calls = 0;
    const render = async () => {
      calls++;
      return fakeVideo();
    };
    const job = await startVideo(request, { runId: "run-1", createdBy: "test@timevision.it" });
    check(tag("nasce pending"), job.status === "pending" && job.attempts === 0);
    check(tag("il percorso ha il prefisso video"), videoPath(job).startsWith("video/") && videoPath(job).endsWith(`${job.id}.mp4`));
    check(tag("pending fresco: il poll non lo prende"), (await advance(job.id, render, "http://x", {})).status === "pending" && calls === 0);

    const done = await advance(job.id, render, "http://x", { force: true });
    check(tag("dopo il render e' ready"), done.status === "ready", done.status);
    check(tag("un solo render"), calls === 1);
    check(tag("misure registrate"), done.width === 1080 && done.height === 1920 && done.duration_ms === DURATION_MS);
    check(tag("il file e' nello store"), (await objectStore().get(done.stored_path))?.data.byteLength === 8);
    check(tag("attempts 1"), done.attempts === 1);
    check(tag("la richiesta torna intera"), done.request.copy.headline === "Titolo" && done.request.photo === "tv-digitale.jpg");

    const view = toVideoView(done);
    check(tag("la vista ha gli indirizzi nostri"), view.url === `/api/videos/${job.id}/file` && view.downloadUrl.endsWith("?download=1"));

    check(tag("ready e' terminale"), (await advance(job.id, render, "http://x", { force: true })).status === "ready" && calls === 1);

    const listed = await videosForRun("run-1");
    check(tag("l'elenco per esecuzione lo ritrova"), listed.length === 1 && listed[0].id === job.id && listed[0].status === "ready");
    check(tag("un'altra esecuzione non lo vede"), (await videosForRun("run-2")).length === 0);
  }

  // Errore del renderer.
  {
    const job = await startVideo(request, {});
    const failed = await advance(job.id, async () => { throw new Error("ffmpeg è esploso"); }, "http://x", { force: true });
    check(tag("un errore finisce sulla riga"), failed.status === "failed" && failed.error.includes("ffmpeg"), failed.error);
    check(tag("la vista senza file non ha url"), toVideoView(failed).url === null);
  }

  // Lavoro interrotto: riparte una volta.
  {
    await resetVideoStore();
    const job = await startVideo(request, {});
    const longAgo = new Date(Date.now() - STALE_RENDERING_MS - 1000).toISOString();
    await updateJob(job.id, { status: "rendering", attempts: 1, started_at: longAgo });
    check(tag("rendering vecchio e' stantio"), isStale(await getJob(job.id)));

    let calls = 0;
    const render = async () => { calls++; return fakeVideo(); };
    const resumed = await advance(job.id, render, "http://x", {});
    check(tag("un rendering interrotto riparte"), resumed.status === "ready" && calls === 1 && resumed.attempts === 2);
  }

  // Rendering in corso: nessuno lo tocca.
  {
    await resetVideoStore();
    const job = await startVideo(request, {});
    await updateJob(job.id, { status: "rendering", attempts: 1, started_at: new Date().toISOString() });
    let calls = 0;
    const same = await advance(job.id, async () => { calls++; return fakeVideo(); }, "http://x", { force: true });
    check(tag("un rendering in corso non si duplica"), same.status === "rendering" && calls === 0);
  }

  // Seconda interruzione: guasto.
  {
    await resetVideoStore();
    const job = await startVideo(request, {});
    const longAgo = new Date(Date.now() - STALE_RENDERING_MS - 1000).toISOString();
    await updateJob(job.id, { status: "rendering", attempts: MAX_ATTEMPTS, started_at: longAgo });
    let calls = 0;
    const dead = await advance(job.id, async () => { calls++; return fakeVideo(); }, "http://x", {});
    check(tag("alla seconda interruzione e' failed senza renderizzare"), dead.status === "failed" && calls === 0 && dead.error.includes(String(MAX_ATTEMPTS)));
  }

  // Pending stantio: il poll lo prende.
  {
    await resetVideoStore();
    const job = await startVideo(request, {});
    const stalePending = Date.now() + STALE_PENDING_MS + 1000;
    const taken = await advance(job.id, async () => fakeVideo(), "http://x", { now: stalePending });
    check(tag("un pending dimenticato riparte dal poll"), taken.status === "ready");
  }

  // Un lavoro stantio non occupa il freno.
  {
    await resetVideoStore();
    const longAgo = new Date(Date.now() - STALE_RENDERING_MS - 1000).toISOString();
    for (let i = 0; i < LIMITS.concurrency; i++) {
      const j = await startVideo(request, {});
      await updateJob(j.id, { status: "rendering", attempts: 1, started_at: longAgo });
    }
    let started = null;
    try {
      started = await startVideo(request, {});
    } catch (error) {
      check(tag("i lavori stantii non contano nel freno"), false, error.message);
    }
    check(tag("i lavori stantii non contano nel freno"), started !== null && started.status === "pending");
  }

  // Freni.
  {
    await resetVideoStore();
    for (let i = 0; i < LIMITS.concurrency; i++) await startVideo(request, {});
    try {
      await startVideo(request, {});
      check(tag("freno di concorrenza"), false, "non ha sollevato");
    } catch (error) {
      check(tag("freno di concorrenza"), error instanceof VideoLimitError && error.message.includes(String(LIMITS.concurrency)), error.message);
    }

    await resetVideoStore();
    for (let i = 0; i < LIMITS.perDay; i++) {
      const j = await startVideo(request, {});
      await updateJob(j.id, { status: "ready" });
    }
    try {
      await startVideo(request, {});
      check(tag("tetto giornaliero"), false, "non ha sollevato");
    } catch (error) {
      check(tag("tetto giornaliero"), error instanceof VideoLimitError && error.message.includes("24 ore"), error.message);
    }
  }
}

(async () => {
  // Senza credenziali: memoria.
  check("senza credenziali i lavori stanno in memoria", videosAreDurable() === false);
  await jobSuite("memoria");

  // Con lo store dei file ma senza database: e' il caso della produzione.
  forceStoreBackend(true);
  check("con lo store i lavori sono durevoli", videosAreDurable() === true);
  await jobSuite("store");
  {
    // Lo store e' la sola verita': una riga scritta qui si legge da un'altra "istanza".
    await resetVideoStore();
    const job = await startVideo(request, { runId: "run-9" });
    const v1 = await objectStore().list(`video/jobs/${job.id}/`);
    check("[store] il lavoro e' un file JSON con lo stato nel nome", v1.length === 1 && v1[0].includes("~pending~"));
    await updateJob(job.id, { status: "rendering", attempts: 1, started_at: new Date().toISOString() });
    const v2 = await objectStore().list(`video/jobs/${job.id}/`);
    check("[store] un cambio di stato e' un file nuovo, mai una sovrascrittura", v2.length === 2 && v2.some((p) => p.includes("~rendering~")) && v2.every((p) => p !== v1[0] || p === v1[0]));
    check("[store] il primo file resta com'era", v2.includes(v1[0]));
    check("[store] la lettura prende l'ultima versione", (await getJob(job.id)).status === "rendering");
    check("[store] l'elenco per esecuzione lo trova senza indice", (await videosForRun("run-9")).some((j) => j.id === job.id));
  }
  forceStoreBackend(false);

  console.log(`video: ${pass} ok, ${fail} falliti`);
  process.exit(fail ? 1 : 0);
})();
