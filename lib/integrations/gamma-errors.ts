/**
 * Errori di Gamma.
 *
 * La quota va distinta da un guasto: su un guasto si riprova, su una quota
 * esaurita riprovare significa solo sbattere contro il muro piu' in fretta.
 */

export class GammaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GammaError";
  }
}

export class GammaNotConfiguredError extends GammaError {
  constructor() {
    super(
      "Gamma non è configurato: GAMMA_API_KEY non è impostata. " +
        "La chiave si crea nelle impostazioni API del workspace Gamma ed è distinta " +
        "dal connettore: averne uno non implica avere l'altra.",
    );
    this.name = "GammaNotConfiguredError";
  }
}

/** Crediti finiti o piano che non copre la richiesta. Non si riprova. */
export class GammaQuotaError extends GammaError {
  readonly retryable = false;

  constructor(detail: string, readonly remaining?: number) {
    super(
      `Gamma ha rifiutato la generazione per crediti insufficienti. ${detail} ` +
        `Le generazioni consumano crediti del piano Pro: controlla il residuo nel workspace prima di riprovare.`,
    );
    this.name = "GammaQuotaError";
  }
}

/** Troppe richieste ravvicinate. Si riprova, ma piu' tardi. */
export class GammaRateLimitError extends GammaError {
  readonly retryable = true;

  constructor(readonly retryAfterSeconds: number | null) {
    super(
      `Gamma ha applicato un limite di frequenza.` +
        (retryAfterSeconds ? ` Riprova fra ${retryAfterSeconds} secondi.` : " Riprova fra qualche minuto."),
    );
    this.name = "GammaRateLimitError";
  }
}

/** Il freno locale, prima ancora di chiamare Gamma. */
export class GammaLocalLimitError extends GammaError {
  readonly retryable = true;

  constructor(kind: "concurrency" | "daily", limit: number) {
    super(
      kind === "concurrency"
        ? `Ci sono già ${limit} generazioni in corso. Aspetta che finiscano: ognuna consuma crediti.`
        : `Raggiunto il tetto di ${limit} generazioni nelle ultime 24 ore. È un freno di spesa, non un errore di Gamma.`,
    );
    this.name = "GammaLocalLimitError";
  }
}

export class GammaRequestError extends GammaError {
  readonly retryable: boolean;

  constructor(readonly status: number, endpoint: string, detail: string) {
    super(`Gamma ha risposto ${status} su ${endpoint}. ${detail}`);
    this.name = "GammaRequestError";
    this.retryable = status >= 500 || status === 408;
  }
}

/** La generazione è arrivata a `failed` da parte di Gamma. */
export class GammaGenerationFailedError extends GammaError {
  constructor(readonly generationId: string, detail: string) {
    super(`La generazione ${generationId} è fallita: ${detail}`);
    this.name = "GammaGenerationFailedError";
  }
}
