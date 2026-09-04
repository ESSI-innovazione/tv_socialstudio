/**
 * Verifica che un file archiviato si rilegga davvero.
 *
 * E' il controllo che mancava: con lo store in memoria la scrittura riusciva
 * sempre e la rilettura falliva solo in produzione, su un'altra istanza.
 *
 * Esegui con: node scripts/blob-check.cjs
 */

const fs = require("node:fs");
const path = require("node:path");

for (const line of fs.readFileSync(path.join(__dirname, "..", ".env.local"), "utf8").split("\n")) {
  const match = line.match(/^([A-Z0-9_]+)="?([^"]*)"?$/);
  if (match) process.env[match[1]] = match[2].trim();
}

const { objectStore, storageIsDurable } = require(path.join(__dirname, "..", ".tmp-test", "storage.js"));

(async () => {
  const store = objectStore();
  console.log("archivio in uso:", store.kind);
  console.log("durevole:", storageIsDurable());

  if (store.kind === "memory") {
    console.log("\nATTENZIONE: memoria. In produzione il file sparisce fra una richiesta e l'altra.");
    process.exit(1);
  }

  const payload = Buffer.from(`prova ${new Date().toISOString()}`, "utf8");
  const target = `verifica/blob-check-${Date.now()}.txt`;

  const written = await store.put(target, new Uint8Array(payload), "text/plain");
  console.log("\nscritto:", written.path, `(${written.bytes} byte)`);
  console.log("url servito:", written.url);

  const back = await store.get(written.path);
  if (!back) {
    console.log("RILETTURA FALLITA: il file non torna indietro.");
    process.exit(1);
  }

  const same = Buffer.from(back.data).equals(payload);
  console.log("riletto:", back.data.byteLength, "byte");
  console.log("contenuto identico:", same ? "si" : "NO");
  console.log("tipo:", back.contentType);

  process.exit(same ? 0 : 1);
})().catch((error) => {
  console.error("FALLITO:", error.constructor.name, "-", error.message);
  process.exit(1);
});
