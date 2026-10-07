import { env } from "../env";
import { ChannelNotConfiguredError, PublishError, httpFailure } from "./publish-errors";

/**
 * L'account Instagram Business di Time Vision, via Graph API.
 *
 * Due passi: si crea un contenitore con l'indirizzo dell'immagine e la
 * caption, si aspetta che Instagram l'abbia scaricata, si pubblica. Le
 * story hanno lo stesso giro con `media_type=STORIES` e senza caption.
 * L'API non accetta upload: l'immagine deve stare a un indirizzo pubblico
 * e deve essere un JPEG.
 */

export interface InstagramPost {
  caption: string;
  imageUrl: string;
  surface: "feed" | "story";
}

export function instagramConfigured(): boolean {
  return Boolean(env.igToken && env.igUserId);
}

function credentials(): { token: string; userId: string; api: string } {
  const missing: string[] = [];
  if (!env.igToken) missing.push("IG_ACCESS_TOKEN");
  if (!env.igUserId) missing.push("IG_USER_ID");
  if (missing.length > 0) throw new ChannelNotConfiguredError("instagram", missing);
  return { token: env.igToken!, userId: env.igUserId!, api: `https://graph.facebook.com/${env.igGraphVersion}` };
}

async function graph<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, cache: "no-store" });
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    // Il messaggio di Graph e' dentro `error.message`: e' quello che aiuta.
    let detail = body;
    try {
      detail = (JSON.parse(body) as { error?: { message?: string } }).error?.message ?? body;
    } catch {
      // Il corpo non e' JSON: si tiene cosi' com'e'.
    }
    throw httpFailure("instagram", response.status, detail);
  }
  return (await response.json()) as T;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function publishToInstagram(post: InstagramPost): Promise<{ externalId: string }> {
  const { token, userId, api } = credentials();

  // 1. Il contenitore.
  const params = new URLSearchParams({ image_url: post.imageUrl, access_token: token });
  if (post.surface === "story") params.set("media_type", "STORIES");
  else params.set("caption", post.caption);

  const container = await graph<{ id: string }>(`${api}/${userId}/media`, { method: "POST", body: params });

  // 2. Instagram scarica l'immagine per conto suo: si aspetta che abbia finito.
  for (let attempt = 0; attempt < 8; attempt++) {
    const status = await graph<{ status_code?: string; status?: string }>(
      `${api}/${container.id}?fields=status_code,status&access_token=${encodeURIComponent(token)}`,
    );
    if (status.status_code === "FINISHED") break;
    if (status.status_code === "ERROR" || status.status_code === "EXPIRED") {
      throw new PublishError("instagram", `il contenuto non e' stato accettato (${status.status ?? status.status_code}). L'immagine deve essere un JPEG raggiungibile pubblicamente.`);
    }
    await sleep(1500);
  }

  // 3. La pubblicazione.
  const published = await graph<{ id: string }>(`${api}/${userId}/media_publish`, {
    method: "POST",
    body: new URLSearchParams({ creation_id: container.id, access_token: token }),
  });

  return { externalId: published.id };
}
