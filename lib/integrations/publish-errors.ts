/**
 * Gli errori della pubblicazione, in italiano e con il canale davanti: chi
 * legge il calendario deve capire cosa e' andato storto senza aprire i log.
 */
export class PublishError extends Error {
  readonly channel: "linkedin" | "instagram";
  /** Vero quando riprovare piu' tardi ha senso (rete, limite di richieste). */
  readonly retryable: boolean;

  constructor(channel: "linkedin" | "instagram", message: string, retryable = false) {
    super(`${channel === "linkedin" ? "LinkedIn" : "Instagram"}: ${message}`);
    this.name = "PublishError";
    this.channel = channel;
    this.retryable = retryable;
  }
}

/** Il canale non ha le chiavi: non e' un guasto, e' un'integrazione da collegare. */
export class ChannelNotConfiguredError extends PublishError {
  constructor(channel: "linkedin" | "instagram", missing: string[]) {
    super(channel, `canale non collegato (${missing.join(", ")} da impostare). Puoi comunque programmare il post.`);
    this.name = "ChannelNotConfiguredError";
  }
}

/** Una risposta HTTP sbagliata, con il pezzo di corpo che spiega perche'. */
export function httpFailure(channel: "linkedin" | "instagram", status: number, body: string): PublishError {
  const retryable = status === 429 || status >= 500;
  const hint =
    status === 401
      ? "autorizzazione scaduta o revocata: rigenera il token."
      : status === 403
        ? "il token non ha i permessi per pubblicare su questo account."
        : status === 429
          ? "limite di richieste raggiunto: si riprova piu' tardi."
          : `risposta ${status}.`;
  return new PublishError(channel, `${hint} ${body.slice(0, 180)}`.trim(), retryable);
}
