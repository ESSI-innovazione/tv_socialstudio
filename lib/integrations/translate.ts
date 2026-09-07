import { env } from "../env";

/**
 * Traduzione del prompt in inglese, prima di mandarlo al motore dei visual.
 *
 * Non e' una raffinatezza, e' la differenza fra un'immagine giusta e una
 * sbagliata. Il modello che genera e' addestrato in inglese e in italiano
 * perde il soggetto: allo stesso prompt — «un'aula di formazione con
 * partecipanti visti di spalle davanti a uno schermo» — ha risposto una volta
 * con un'aula vuota e una volta con una baita nel bosco. Tradotto, ha
 * risposto con l'aula e le persone di spalle.
 *
 * Chi scrive i prompt in Time Vision scrive in italiano, e deve continuare a
 * poterlo fare: la traduzione sta qui, non nella testa di chi compila il campo.
 *
 * Senza `ANTHROPIC_API_KEY` il prompt parte com'e'. Funziona lo stesso, ma
 * peggio, e il pannello lo dice invece di lasciarlo scoprire.
 */

const MODEL = "claude-opus-5";

/** Una traduzione di poche righe. Il tetto lascia spazio al ragionamento. */
const MAX_TOKENS = 4000;

const SYSTEM = [
  "You translate short image-generation prompts from Italian to English.",
  "Reply with the translation and nothing else: no quotes, no preamble, no explanation.",
  "Keep every concrete detail — subject, setting, framing, light, mood — and add nothing.",
  "If the text is already English, return it unchanged.",
].join(" ");

export interface Translated {
  text: string;
  /** Falso quando il prompt e' partito in italiano, perche' non c'era la chiave. */
  translated: boolean;
}

/** Vero quando la traduzione e' disponibile su questo ambiente. */
export function translationConfigured(): boolean {
  return Boolean(env.anthropicKey);
}

export async function toEnglish(italian: string): Promise<Translated> {
  const source = italian.trim();
  if (!source || !env.anthropicKey) return { text: source, translated: false };

  try {
    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    const client = new Anthropic({ apiKey: env.anthropicKey });

    const response = await client.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      // Una traduzione non ha bisogno di pensarci su: lo sforzo basso costa
      // meno e non toglie niente al risultato.
      output_config: { effort: "low" },
      system: SYSTEM,
      messages: [{ role: "user", content: source }],
    });

    if (response.stop_reason === "refusal") return { text: source, translated: false };

    const text = response.content
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join(" ")
      .trim();

    return text ? { text, translated: true } : { text: source, translated: false };
  } catch (cause) {
    // Una traduzione mancata non deve impedire la generazione: si va avanti
    // con l'italiano, che e' peggio ma non e' niente.
    console.error("[translate] prompt non tradotto:", cause instanceof Error ? cause.message : cause);
    return { text: source, translated: false };
  }
}
