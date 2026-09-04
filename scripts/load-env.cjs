/**
 * Legge .env.local per gli script di verifica.
 *
 * La CLI di Vercel riscrive il file con i valori fra virgolette. Un parser che
 * non le toglie manda la chiave con le virgolette dentro e ottiene un 401 che
 * sembra una chiave revocata: e' successo, ed e' costato un giro di debug.
 */
const fs = require("node:fs");
const path = require("node:path");

module.exports = function loadEnv() {
  const file = path.join(__dirname, "..", ".env.local");
  if (!fs.existsSync(file)) return;

  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (!match) continue;

    const value = match[2].trim().replace(/^["']/, "").replace(/["']$/, "");
    process.env[match[1]] = value;
  }
};
