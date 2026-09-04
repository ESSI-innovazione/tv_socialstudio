/**
 * Verifica dal vivo della generazione di un visual. UNA immagine, che costa
 * crediti. Percorre il codice di produzione e salva il file per guardarlo.
 *
 * Esegui con: node scripts/image-live.cjs <cartella>
 */

const fs = require("node:fs");
const path = require("node:path");

for (const line of fs.readFileSync(path.join(__dirname, "..", ".env.local"), "utf8").split("\n")) {
  const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (match) process.env[match[1]] = match[2].trim();
}

const base = path.join(__dirname, "..", ".tmp-test");
const { imageSource, imagePrompt } = require(`${base}/integrations/images.js`);
const { objectStore } = require(`${base}/storage.js`);
const { listRecentImages } = require(`${base}/db-images.js`);

const REQ = {
  prompt:
    "Chiave visiva astratta per un bando sulla digitalizzazione: forme geometriche tridimensionali che si incastrano, superfici opache, senso di struttura che si compone",
  purpose: "ig-feed",
  style: "abstract",
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
  console.log("punta a gamma:", image.url.includes("gamma") ? "SI (problema)" : "no");

  const rows = await listRecentImages(3);
  console.log("provenienza registrata:", rows.length > 0 ? "si" : "NO (problema)");
  if (rows[0]) {
    console.log("  prompt salvato:", rows[0].prompt.slice(0, 60) + "…");
    console.log("  crediti:", rows[0].credits_used);
  }

  const stored = await objectStore().get(rows[0].stored_path);
  const out = path.join(process.argv[2] || ".", "visual-live.png");
  fs.writeFileSync(out, Buffer.from(stored.data));
  console.log("\nfile scritto:", out, `(${stored.data.byteLength} byte)`);
})().catch((error) => {
  console.error("FALLITO:", error.constructor.name);
  console.error(error.message);
  process.exit(1);
});
