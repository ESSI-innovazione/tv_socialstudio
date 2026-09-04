/**
 * Verifica dal vivo del modulo Gamma. UNA generazione, che costa crediti.
 *
 * Percorre esattamente il codice di produzione: startDocument, poi advance()
 * a intervalli, fino a quando il file e' scaricato e archiviato. Alla fine
 * scrive il PDF su disco per poterlo guardare.
 *
 * Esegui con: node scripts/gamma-live.cjs
 */

const fs = require("node:fs");
const path = require("node:path");

// Le chiavi stanno in .env.local, che git non vede.
require("./load-env.cjs")();

const base = path.join(__dirname, "..", ".tmp-test");
const { startDocument, advance, toGeneratedDocument } = require(`${base}/integrations/gamma.js`);
const { objectStore } = require(`${base}/storage.js`);
const { getJob } = require(`${base}/db-documents.js`);

const CATALOGO = {
  format: "catalogo",
  title: "Catalogo servizi alle imprese — Time Vision 2026",
  inputText: `Time Vision è una società italiana di consulenza e formazione professionale che
accompagna PMI e lavoratori autonomi nell'accesso ai finanziamenti pubblici e nella
crescita delle competenze interne.

I servizi da inserire nel catalogo, uno per pagina:

1. Analisi preliminare di ammissibilità. Verifichiamo se l'impresa rientra nei requisiti
di un bando prima che spenda tempo sulla domanda. Restituiamo un parere scritto con i
punti critici.

2. Redazione e presentazione della domanda. Prepariamo la documentazione, curiamo i
tempi dello sportello e presentiamo la candidatura. Sui bandi a sportello il momento
della presentazione conta quanto il contenuto.

3. Rendicontazione. Seguiamo la fase in cui la maggior parte dei contributi si perde:
documentare le spese nei modi e nei tempi che l'ente richiede.

4. Formazione finanziata tramite fondi interprofessionali. Progettiamo piani formativi
finanziati dai fondi a cui l'azienda già versa, senza costi aggiuntivi per l'impresa.

5. Voucher per digitalizzazione, cloud e cybersecurity. Assistenza sulle misure
ministeriali dedicate alla trasformazione digitale delle piccole imprese.

6. Academy e percorsi di specializzazione. Master e corsi lunghi per figure tecniche e
manageriali, in aula e a distanza.

7. Consulenza organizzativa. Analisi dei processi e delle competenze, con un piano di
intervento a dodici mesi.

Tono istituzionale e diretto. Nessun superlativo. Chi legge è un imprenditore che ha
poco tempo. Ogni pagina dice prima la cosa concreta e poi perché conta.

Chiudere con una pagina di contatto: timevision.it`,
  audience: "imprenditori e titolari di piccole e medie imprese",
  tone: "istituzionale e diretto, senza superlativi",
  numCards: 10,
  // Nessuna chiave immagine: si vuole vedere cosa produce Gamma da solo.
  imageKeys: [],
};

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

(async () => {
  console.log("Avvio UNA generazione. Consuma crediti del piano Pro.\n");

  const job = await startDocument(CATALOGO, { createdBy: "verifica@timevision.it" });
  console.log("inviata   id lavoro:", job.id);
  console.log("          id generazione:", job.generation_id);
  console.log("          stato:", job.status, "\n");

  let current = job;
  const started = Date.now();

  // Mai un ciclo stretto: qualche secondo fra un controllo e l'altro.
  for (let attempt = 1; attempt <= 60; attempt++) {
    await wait(5000);

    try {
      current = (await advance(job.id)) ?? current;
    } catch (error) {
      console.log("errore    ", error.message);
      break;
    }

    const seconds = Math.round((Date.now() - started) / 1000);
    console.log(`controllo ${attempt} · ${seconds}s · stato: ${current.status}`);

    if (current.status === "ready" || current.status === "failed") break;
  }

  const finale = await getJob(job.id);
  console.log("\n--- esito ---");
  console.log("stato:", finale.status);
  console.log("crediti consumati:", finale.credits_used);
  console.log("pagine:", finale.pages);
  console.log("documento modificabile:", finale.gamma_url);
  console.log("percorso archiviato:", finale.stored_path);
  console.log("errore:", finale.error ?? "nessuno");

  if (finale.status !== "ready") process.exit(1);

  const doc = toGeneratedDocument(finale);
  console.log("\nstoredFileUrl:", doc.storedFileUrl);
  console.log("mime:", doc.mime);

  // L'URL di export non deve comparire da nessuna parte sulla riga.
  const serialised = JSON.stringify(finale);
  console.log(
    "URL di export salvato sulla riga:",
    serialised.includes("exports.gamma") || serialised.includes("export") ? "DA CONTROLLARE" : "no",
  );

  const stored = await objectStore().get(finale.stored_path);
  const out = path.join(process.argv[2] || ".", "catalogo-live.pdf");
  fs.writeFileSync(out, Buffer.from(stored.data));
  console.log("\nfile scritto:", out, `(${stored.data.byteLength} byte)`);
})();
