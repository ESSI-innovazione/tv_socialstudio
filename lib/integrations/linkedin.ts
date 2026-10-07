import { env } from "../env";
import { ChannelNotConfiguredError, PublishError, httpFailure } from "./publish-errors";

/**
 * La pagina LinkedIn di Time Vision, via Posts API (Community Management).
 *
 * Tre chiamate: si registra un'immagine per conto dell'organizzazione, si
 * caricano i byte all'indirizzo che LinkedIn indica, si crea il post con il
 * testo e l'immagine. Serve un token con `w_organization_social` rilasciato
 * da un amministratore della pagina: l'approvazione dell'app e' un tempo di
 * attesa, non una casella da spuntare.
 */

const API = "https://api.linkedin.com/rest";

export interface LinkedInPost {
  caption: string;
  /** Un indirizzo pubblico dell'immagine: i byte li scarichiamo noi e li carichiamo a LinkedIn. */
  imageUrl: string;
  altText?: string;
}

export function linkedinConfigured(): boolean {
  return Boolean(env.linkedinToken && env.linkedinOrgId);
}

function credentials(): { token: string; owner: string } {
  const missing: string[] = [];
  if (!env.linkedinToken) missing.push("LINKEDIN_ACCESS_TOKEN");
  if (!env.linkedinOrgId) missing.push("LINKEDIN_ORGANIZATION_ID");
  if (missing.length > 0) throw new ChannelNotConfiguredError("linkedin", missing);
  return { token: env.linkedinToken!, owner: `urn:li:organization:${env.linkedinOrgId}` };
}

function headers(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    "X-Restli-Protocol-Version": "2.0.0",
    // La Posts API e' versionata per mese: una versione troppo vecchia viene
    // rifiutata, quindi si puo' aggiornare dall'ambiente senza un deploy.
    "LinkedIn-Version": env.linkedinApiVersion,
  };
}

async function fetchImage(url: string): Promise<{ bytes: ArrayBuffer; type: string }> {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new PublishError("linkedin", `non riesco a leggere l'immagine da pubblicare (${response.status}).`, true);
  return { bytes: await response.arrayBuffer(), type: response.headers.get("content-type") ?? "image/png" };
}

export async function publishToLinkedIn(post: LinkedInPost): Promise<{ externalId: string }> {
  const { token, owner } = credentials();

  // 1. Registrazione dell'immagine.
  const init = await fetch(`${API}/images?action=initializeUpload`, {
    method: "POST",
    headers: headers(token),
    body: JSON.stringify({ initializeUploadRequest: { owner } }),
  });
  if (!init.ok) throw httpFailure("linkedin", init.status, await init.text().catch(() => ""));
  const { value } = (await init.json()) as { value: { uploadUrl: string; image: string } };

  // 2. I byte, all'indirizzo indicato.
  const image = await fetchImage(post.imageUrl);
  const upload = await fetch(value.uploadUrl, {
    method: "PUT",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": image.type },
    body: image.bytes,
  });
  if (!upload.ok) throw httpFailure("linkedin", upload.status, await upload.text().catch(() => ""));

  // 3. Il post.
  const created = await fetch(`${API}/posts`, {
    method: "POST",
    headers: headers(token),
    body: JSON.stringify({
      author: owner,
      commentary: post.caption,
      visibility: "PUBLIC",
      distribution: { feedDistribution: "MAIN_FEED", targetEntities: [], thirdPartyDistributionChannels: [] },
      content: { media: { id: value.image, altText: post.altText ?? "" } },
      lifecycleState: "PUBLISHED",
      isReshareDisabledByAuthor: false,
    }),
  });
  if (!created.ok) throw httpFailure("linkedin", created.status, await created.text().catch(() => ""));

  const externalId = created.headers.get("x-restli-id") ?? created.headers.get("x-linkedin-id");
  if (!externalId) throw new PublishError("linkedin", "il post e' stato creato ma LinkedIn non ha restituito l'identificativo.");
  return { externalId };
}
