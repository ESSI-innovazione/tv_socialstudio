/**
 * Errori del video.
 *
 * Un freno non e' un guasto: si dice cosa e' successo e non si riprova
 * contro il muro. Un guasto del rendering invece finisce sulla riga del
 * lavoro, con il messaggio, e la console lo mostra.
 */

export class VideoError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "VideoError";
  }
}

export class VideoLimitError extends VideoError {
  constructor(kind: "concurrency" | "daily", limit: number) {
    super(
      kind === "concurrency"
        ? `Ci sono già ${limit} video in lavorazione. Aspetta che finiscano: ognuno occupa un minuto di rendering.`
        : `Raggiunto il tetto di ${limit} video nelle ultime 24 ore. È un freno, non un guasto.`,
    );
    this.name = "VideoLimitError";
  }
}

export class VideoRenderError extends VideoError {
  constructor(stage: "pagina" | "cattura" | "codifica" | "archiviazione", detail: string) {
    super(`Il video si è fermato durante la ${stage}: ${detail}`);
    this.name = "VideoRenderError";
  }
}
