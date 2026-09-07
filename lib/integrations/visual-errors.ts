/**
 * Errori della generazione dei visual.
 *
 * Sono distinti da quelli di Gamma perche' ora sono due cose diverse: Gamma
 * impagina i documenti multipagina, il motore dei visual fa le immagini. Un
 * guasto dell'uno non deve raccontare la storia dell'altro.
 */

export class VisualError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "VisualError";
  }
}

/** Il freno locale: non e' un guasto del motore, e' una nostra scelta. */
export class VisualLimitError extends VisualError {
  readonly retryable = true;

  constructor(limit: number) {
    super(
      `Raggiunto il tetto di ${limit} visual nelle ultime 24 ore. ` +
        `È un freno nostro, non un rifiuto del motore: serve a non martellare un servizio gratuito.`,
    );
    this.name = "VisualLimitError";
  }
}

/** Il motore ha risposto male, o non ha risposto. Si riprova. */
export class VisualEngineError extends VisualError {
  readonly retryable = true;

  constructor(readonly status: number, detail: string) {
    super(
      `Il motore dei visual non ha prodotto l'immagine (${status}). ${detail} ` +
        `È un servizio gratuito e senza garanzie: riprova fra poco.`,
    );
    this.name = "VisualEngineError";
  }
}
