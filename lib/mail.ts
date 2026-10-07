import { env } from "./env";

/**
 * Le email di servizio: una richiesta di approvazione arrivata, una decisione
 * presa. Partono con Resend attraverso la sua API HTTP, senza dipendenze.
 *
 * Senza RESEND_API_KEY non si manda niente e si scrive nel log cosa si
 * sarebbe mandato: il flusso di approvazione funziona lo stesso, la posta
 * e' un avviso in piu', non un passaggio obbligato.
 */

export interface Mail {
  to: string[];
  subject: string;
  text: string;
}

export const mailConfigured = (): boolean => Boolean(env.resendApiKey);

export async function sendMail(mail: Mail): Promise<{ sent: boolean; id?: string; error?: string }> {
  const recipients = mail.to.filter(Boolean);
  if (recipients.length === 0) return { sent: false, error: "nessun destinatario" };

  if (!env.resendApiKey) {
    console.log(`[mail] (non inviata, RESEND_API_KEY assente) a ${recipients.join(", ")} · ${mail.subject}\n${mail.text}`);
    return { sent: false, error: "RESEND_API_KEY assente" };
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: env.mailFrom,
        to: recipients,
        subject: mail.subject,
        text: mail.text,
      }),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      console.error(`[mail] Resend ha risposto ${response.status}: ${detail.slice(0, 200)}`);
      return { sent: false, error: `Resend ${response.status}` };
    }

    const data = (await response.json()) as { id?: string };
    return { sent: true, id: data.id };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[mail] invio fallito", message);
    return { sent: false, error: message };
  }
}
