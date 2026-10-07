import { assetFileUrl } from "./asset-url";
import { overallStatus } from "./brand-guard";
import { claimPost, createPost, getAsset, getRun, markPost } from "./db";
import { env } from "./env";
import { instagramConfigured, publishToInstagram } from "./integrations/instagram";
import { linkedinConfigured, publishToLinkedIn } from "./integrations/linkedin";
import { ChannelNotConfiguredError, PublishError } from "./integrations/publish-errors";
import type { Asset, Channel, Run, ScheduledPost, Surface } from "./types";

/**
 * La pubblicazione, dal lato di chi la guida.
 *
 * Due regole che valgono per tutti i percorsi — subito, programmato, cron —
 * e che si controllano qui e non nel client: si pubblica solo un asset
 * approvato con il brand-guard positivo, e un post lo pubblica una funzione
 * sola per volta.
 */

export const MAX_ATTEMPTS = 3;

/** Un claim piu' vecchio di cosi' appartiene a una funzione che e' morta. */
export const CLAIM_TTL_MS = 5 * 60_000;

export interface ChannelStatus {
  linkedin: boolean;
  instagram: boolean;
}

export function channelStatus(): ChannelStatus {
  return { linkedin: linkedinConfigured(), instagram: instagramConfigured() };
}

export class PublishRefused extends Error {
  readonly status: number;
  constructor(message: string, status = 409) {
    super(message);
    this.name = "PublishRefused";
    this.status = status;
  }
}

/** Il formato che un canale e una superficie pretendono. */
export function formatFor(channel: Channel, surface: Surface): Asset["format"] {
  if (channel === "linkedin") return "linkedin";
  return surface === "story" ? "ig-story" : "ig-feed";
}

/** L'asset deve essere approvato, col brand-guard positivo, e del formato giusto. */
export function assertPublishable(asset: Asset, channel: Channel, surface: Surface): void {
  if (!asset.approved_at) throw new PublishRefused("L'asset non e' stato approvato: prima serve l'approvazione.");
  const guard = overallStatus([asset.guard_status]);
  if (guard !== "pass" && guard !== "warn") throw new PublishRefused("Il controllo del brand non e' positivo su questo asset.");
  const expected = formatFor(channel, surface);
  if (asset.format !== expected) {
    throw new PublishRefused(`Per ${channel === "linkedin" ? "LinkedIn" : surface === "story" ? "la story" : "il feed Instagram"} serve l'asset nel formato ${expected}, non ${asset.format}.`);
  }
}

export interface NewPostInput {
  asset: Asset;
  run: Run;
  channel: Channel;
  surface: Surface;
  caption: string;
  hashtags: string[];
  scheduledFor: Date | null;
  createdBy: string;
}

/**
 * Registra il post. Con una data futura resta `scheduled` e lo prende il
 * cron; senza, si pubblica adesso. Un canale non collegato non blocca la
 * programmazione: blocca solo la pubblicazione immediata.
 */
export async function schedulePost(input: NewPostInput): Promise<ScheduledPost> {
  assertPublishable(input.asset, input.channel, input.surface);

  const now = Date.now();
  const future = input.scheduledFor && input.scheduledFor.getTime() > now + 30_000;

  if (!future && !channelStatus()[input.channel]) {
    throw new PublishRefused(
      `${input.channel === "linkedin" ? "LinkedIn" : "Instagram"} non e' collegato: pubblicare adesso non e' possibile. Programma il post e si pubblichera' quando il canale sara' collegato.`,
    );
  }

  const post = await createPost({
    run_id: input.run.id,
    channel: input.channel,
    surface: input.surface,
    caption: input.caption,
    hashtags: input.hashtags,
    asset_id: input.asset.id,
    variant_index: input.asset.variant_index,
    status: "scheduled",
    scheduled_for: (input.scheduledFor ?? new Date()).toISOString(),
    created_by: input.createdBy,
  });

  if (future) return post;
  return (await publishNow(post)) ?? post;
}

/** L'immagine che il canale deve leggere: pubblica, raggiungibile, nel tipo giusto. */
function imageUrlFor(asset: Asset, channel: Channel): string {
  // Instagram non accetta PNG: l'asset esce come JPEG dalla stessa rotta.
  return assetFileUrl(asset, channel === "instagram" ? "jpg" : "png", env.siteUrl);
}

/**
 * Pubblica un post preso in carico. Idempotente sul claim: se un'altra
 * funzione lo ha gia' in mano, torna null e non fa niente.
 */
export async function publishNow(post: ScheduledPost, now = new Date()): Promise<ScheduledPost | null> {
  const claimed = await claimPost(post.id, now, CLAIM_TTL_MS);
  if (!claimed) return null;

  const fail = async (message: string, retryable: boolean) => {
    const attempts = claimed.attempts + 1;
    // Un errore da cui si puo' riprendere resta in coda finche' ci sono
    // tentativi; gli altri, o l'ultimo tentativo, chiudono il post.
    const status = retryable && attempts < MAX_ATTEMPTS ? "scheduled" : "failed";
    await markPost(post.id, { status, error: message, attempts, claimed_at: null });
    return { ...claimed, status, error: message, attempts, claimed_at: null } as ScheduledPost;
  };

  const asset = claimed.asset_id ? await getAsset(claimed.asset_id) : null;
  if (!asset) return fail("L'asset del post non esiste piu'.", false);

  try {
    assertPublishable(asset, claimed.channel, claimed.surface);
  } catch (error) {
    return fail(error instanceof Error ? error.message : String(error), false);
  }

  const caption = [claimed.caption.trim(), claimed.hashtags.map((h) => `#${h.replace(/^#/, "")}`).join(" ")].filter(Boolean).join("\n\n");
  const imageUrl = imageUrlFor(asset, claimed.channel);

  try {
    const result =
      claimed.channel === "linkedin"
        ? await publishToLinkedIn({ caption, imageUrl, altText: altTextFor(asset, await getRun(claimed.run_id)) })
        : await publishToInstagram({ caption, imageUrl, surface: claimed.surface });

    const patch = {
      status: "published" as const,
      published_at: now.toISOString(),
      external_id: result.externalId,
      error: null,
      attempts: claimed.attempts + 1,
      claimed_at: null,
    };
    await markPost(post.id, patch);
    return { ...claimed, ...patch };
  } catch (error) {
    if (error instanceof ChannelNotConfiguredError) return fail(error.message, true);
    if (error instanceof PublishError) return fail(error.message, error.retryable);
    return fail(error instanceof Error ? error.message : String(error), true);
  }
}

function altTextFor(asset: Asset, run: Run | null): string {
  const copy = run?.variants.find((v) => v.index === asset.variant_index);
  return copy ? `${copy.headline}. ${copy.subhead}`.slice(0, 300) : "Time Vision";
}
