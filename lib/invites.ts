import { ALLOWED_EMAIL_DOMAIN, env } from "./env";
import { sendMail } from "./mail";
import { ROLE_LABEL } from "./permissions";
import type { Profile } from "./types";

/**
 * L'email di invito a un collega. Il profilo esiste gia' quando parte:
 * la persona puo' entrare con Google anche senza averla ricevuta, quindi
 * un invio fallito non e' un errore, e' un avviso in meno.
 */
export async function sendInvite(profile: Profile, inviter: string): Promise<boolean> {
  const result = await sendMail({
    to: [profile.email],
    subject: "Sei nel team di TV Social Studio",
    text: [
      `${inviter} ti ha aggiunto a TV Social Studio, lo studio del marketing Time Vision, come ${ROLE_LABEL[profile.role].toLowerCase()}${profile.is_admin ? " e admin" : ""}.`,
      `\nEntra con il tuo account Google @${ALLOWED_EMAIL_DOMAIN}: ${env.siteUrl}`,
    ].join("\n"),
  });
  return result.sent;
}
