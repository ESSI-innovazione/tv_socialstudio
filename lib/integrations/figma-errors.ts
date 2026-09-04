/**
 * Errori della sincronizzazione Figma.
 *
 * Ogni errore dice quale template ha il problema e quale problema ha. Una
 * mezza specifica prodotta in silenzio e' peggio di un errore: si scopre
 * quando l'asset e' gia' sbagliato, non quando si sincronizza.
 */

export class FigmaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FigmaError";
  }
}

/** Manca il token o la chiave del file. */
export class FigmaNotConfiguredError extends FigmaError {
  readonly missing: string[];

  constructor(missing: string[]) {
    super(
      `Figma non è configurato: ${missing.join(" e ")} ${
        missing.length === 1 ? "non è impostato" : "non sono impostati"
      }. ` +
        `Aggiungi le variabili d'ambiente e riprova la sincronizzazione. ` +
        `Il token è un personal access token di un account Figma Pro, in sola lettura.`,
    );
    this.name = "FigmaNotConfiguredError";
    this.missing = missing;
  }
}

/** Figma ha risposto male: credenziali, permessi, rate limit. */
export class FigmaRequestError extends FigmaError {
  readonly status: number;

  constructor(status: number, endpoint: string, detail: string) {
    const hint =
      status === 403
        ? " Il token non ha accesso a questo file: controlla che l'account sia nel team proprietario della libreria."
        : status === 404
          ? " File non trovato: controlla FIGMA_FILE_KEY."
          : status === 429
            ? " Limite di richieste raggiunto: la sincronizzazione è manuale proprio per questo, riprova fra qualche minuto."
            : "";

    super(`Figma ha risposto ${status} su ${endpoint}. ${detail}${hint}`);
    this.name = "FigmaRequestError";
    this.status = status;
  }
}

/** Un template esiste ma non è autorizzabile: manca un frame obbligatorio. */
export class TemplateIncompleteError extends FigmaError {
  readonly template: string;

  constructor(template: string, problem: string) {
    super(`Template «${template}»: ${problem}`);
    this.name = "TemplateIncompleteError";
    this.template = template;
  }
}

/** Un livello di testo ha un nome che non corrisponde a nessun ruolo noto. */
export class UnknownRoleError extends FigmaError {
  readonly template: string;
  readonly layer: string;

  constructor(template: string, format: string, layer: string, allowed: readonly string[]) {
    super(
      `Template «${template}», frame «${format}»: il livello di testo «${layer}» non corrisponde a nessun ruolo. ` +
        `Rinominalo con uno di: ${allowed.join(", ")}. ` +
        `Vedi TEMPLATES.md per la convenzione dei nomi.`,
    );
    this.name = "UnknownRoleError";
    this.template = template;
    this.layer = layer;
  }
}
