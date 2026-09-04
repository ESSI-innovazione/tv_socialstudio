import { buildPrompt, type PromptInput } from "../prompt";
import { parseCopyResponse, type CopyResponse } from "../copy-schema";

/**
 * Generazione del copy dietro un'unica interfaccia.
 *
 * Oggi esiste un solo provider, `manual`, e non costa niente: l'app assembla
 * il prompt, il marketing lo incolla nell'abbonamento Claude che l'azienda ha
 * gia', e riporta indietro il JSON. L'app lo valida contro lo schema.
 *
 * Il giorno in cui si decidera' di pagare l'API, si aggiunge un secondo
 * provider con questa stessa firma e si cambia una riga in `copyProvider()`.
 * Lo schema di uscita e' gia' quello: nient'altro si muove.
 */

export type CopyProviderKind = "manual" | "api";

export interface CopyProvider {
  kind: CopyProviderKind;
  /** Vero quando il provider produce il copy da solo, senza passaggi a mano. */
  automatic: boolean;
  /** Il prompt da mostrare (manuale) o da inviare (API). */
  prompt(input: PromptInput): string;
  /** Produce il copy. Il provider manuale richiede il JSON incollato. */
  generate(input: PromptInput, pasted?: string): Promise<CopyResponse>;
}

export class CopyNeedsPasteError extends Error {
  constructor() {
    super("Incolla la risposta JSON dell'agente per continuare.");
    this.name = "CopyNeedsPasteError";
  }
}

export class CopyInvalidError extends Error {
  readonly errors: string[];
  constructor(errors: string[]) {
    super(errors.join(" "));
    this.name = "CopyInvalidError";
    this.errors = errors;
  }
}

export const manualProvider: CopyProvider = {
  kind: "manual",
  automatic: false,

  prompt(input) {
    return buildPrompt(input);
  },

  async generate(input, pasted) {
    if (!pasted) throw new CopyNeedsPasteError();

    const result = parseCopyResponse(pasted, input.variantCount);
    if (!result.ok) throw new CopyInvalidError(result.errors);

    return result.data;
  },
};

/** Il provider attivo. Oggi ce n'e' uno solo, e non chiama nessuna API. */
export function copyProvider(): CopyProvider {
  return manualProvider;
}
