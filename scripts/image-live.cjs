/**
 * Verifica dal vivo della generazione di un visual: percorre il codice di
 * produzione e salva il file, perche' su un'immagine l'unico collaudo che
 * conta e' guardarla.
 *
 * Il motore e' gratuito, quindi si puo' rieseguire senza contare i soldi.
 *
 * Esegui con: node scripts/image-live.cjs <cartella>
 */

const fs = require("node:fs");
const path = require("node:path");

require("./load-env.cjs")();

const base = path.join(__dirname, "..", ".tmp-test");
const { imageSource, imagePrompt } = require(`${base}/integrations/images.js`);
const { objectStore } = require(`${base}/storage.js`);
const { listRecentImages } = require(`${base}/db-images.js`);

const REQ = {
  prompt:
    "Una scrivania in un ufficio, con documenti di una domanda di finanziamento, un portatile aperto e una tazza di caffe'. Luce naturale di mattina, ordine, lavoro in corso",
  purpose: "poster-a4",
  style: "scene",
};

(async () => {
  console.log("prompt completo inviato:\n" + imagePrompt(REQ) + "\n");
  console.log("Genero UNA immagine. Consuma crediti.\n");

  const started = Date.now();
  const image = await imageSource.generate(REQ);
  const seconds = Math.round((Date.now() - started) / 1000);

  console.log("--- esito ---");
  console.log("secondi:", seconds);
  console.log("origine:", image.origin);
  console.log("dimensioni:", image.width, "x", image.height);
  console.log("url nostro:", image.url);
  console.log("modello:", image.model, "· seme:", image.seed);
  console.log(
    "punta a un terzo:",
    /gamma|pollinations/.test(image.url) ? "SI (problema)" : "no",
  );

  const rows = await listRecentImages(3);
  console.log("provenienza registrata:", rows.length > 0 ? "si" : "NO (problema)");
  if (rows[0]) {
    console.log("  prompt salvato:", rows[0].prompt.slice(0, 60) + "…");
    console.log("  modello salvato:", rows[0].model, "· seme:", rows[0].seed);
  }

  const stored = await objectStore().get(rows[0].stored_path);
  const out = path.join(process.argv[2] || ".", "visual-live.jpg");
  fs.writeFileSync(out, Buffer.from(stored.data));
  console.log("\nfile scritto:", out, `(${stored.data.byteLength} byte)`);
})().catch((error) => {
  console.error("FALLITO:", error.constructor.name);
  console.error(error.message);
  process.exit(1);
});
