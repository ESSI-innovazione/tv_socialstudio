/**
 * Verifica del registro dei visual generati, sullo store in memoria.
 *
 * Una generazione si registra sempre — serve alla provenienza e al freno
 * giornaliero — ma finisce nell'archivio proposto agli altri solo quando
 * qualcuno la salva. Quello che si verifica qui e' esattamente quella
 * distinzione: registrato non vuol dire archiviato.
 *
 * Esegui con: npm run test:images
 */

const base = "../.tmp-test";
const {
  recordImage,
  markImageSaved,
  listRecentImages,
  countImagesLastDay,
  resetImageStore,
} = require(`${base}/db-images.js`);

let pass = 0;
let fail = 0;

function check(name, cond, extra = "") {
  if (cond) pass++;
  else {
    fail++;
    console.log("FAIL:", name, extra);
  }
}

const row = (id, saved) => ({
  id,
  stored_path: `visual/${id}.jpg`,
  prompt: "Un aula di formazione",
  full_prompt: "Un aula di formazione, fotografia",
  style: "photo",
  purpose: "ig-feed",
  width: 768,
  height: 768,
  credits_used: null,
  model: "sana",
  seed: 42,
  saved,
});

(async () => {
  resetImageStore();

  await recordImage(row("a", false));
  await recordImage(row("b", false));

  check("una generazione non salvata non compare in archivio", (await listRecentImages()).length === 0);
  check("ma conta lo stesso per il freno giornaliero", (await countImagesLastDay()) === 2);

  check("salvare restituisce vero sulla riga esistente", (await markImageSaved("a", true)) === true);
  check("salvare una riga inesistente restituisce falso", (await markImageSaved("zzz", true)) === false);

  const listed = await listRecentImages();
  check("dopo il salvataggio compare solo quella salvata", listed.length === 1 && listed[0].id === "a");
  check("la riga salvata porta il flag", listed[0].saved === true);

  await markImageSaved("a", false);
  check("togliere dall'archivio la fa sparire di nuovo", (await listRecentImages()).length === 0);
  check("il conteggio del giorno non cambia", (await countImagesLastDay()) === 2);

  console.log(`\n${pass} verifiche passate, ${fail} fallite`);
  process.exit(fail === 0 ? 0 : 1);
})();
