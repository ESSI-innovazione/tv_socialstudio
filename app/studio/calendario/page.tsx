import { redirect } from "next/navigation";
import { currentUser } from "@/auth";
import { Calendar, type CalendarPost, type ReadyItem } from "@/components/studio/calendar";
import { PageFrame } from "@/components/studio/page-frame";
import { getAsset, getCampaigns, getRun, listApprovedAssets, listPostsBetween } from "@/lib/db";
import { can } from "@/lib/permissions";
import { channelStatus } from "@/lib/publish";
import type { Asset, Channel, Run, Surface } from "@/lib/types";

export const dynamic = "force-dynamic";

/** Il canale e la superficie che un formato social implica. */
function targetOf(format: Asset["format"]): { channel: Channel; surface: Surface } | null {
  if (format === "linkedin") return { channel: "linkedin", surface: "feed" };
  if (format === "ig-feed") return { channel: "instagram", surface: "feed" };
  if (format === "ig-story") return { channel: "instagram", surface: "story" };
  return null;
}

/**
 * Il calendario dei post: programmati e pubblicati, per settimana o per
 * mese, trascinabili per cambiare giorno. A destra, gli asset approvati che
 * non hanno ancora una data: si trascinano su un giorno. Lo stato dei
 * canali sta in testa, perche' un post su un canale non collegato aspetta.
 */
export default async function CalendarioPage() {
  const user = await currentUser();
  if (!user) redirect("/");

  // Tre mesi indietro e sei avanti: abbastanza per navigare senza ricaricare.
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth() - 3, 1);
  const to = new Date(now.getFullYear(), now.getMonth() + 7, 0, 23, 59, 59);

  const [posts, campaigns, approved] = await Promise.all([listPostsBetween(from, to), getCampaigns(), listApprovedAssets(200)]);
  const campaignName = (id: string | null) => campaigns.find((c) => c.id === id)?.name ?? null;

  const runs = new Map<string, Run | null>();
  const assets = new Map<string, Asset | null>();
  for (const post of posts) {
    if (!runs.has(post.run_id)) runs.set(post.run_id, await getRun(post.run_id));
    if (post.asset_id && !assets.has(post.asset_id)) assets.set(post.asset_id, await getAsset(post.asset_id));
  }

  const items: CalendarPost[] = posts.map((post) => {
    const run = runs.get(post.run_id) ?? null;
    const asset = post.asset_id ? (assets.get(post.asset_id) ?? null) : null;
    const variant = run?.variants.find((v) => v.index === (post.variant_index ?? asset?.variant_index)) ?? null;
    return {
      post,
      asset,
      variant,
      photo: run?.brief?.photo ?? null,
      runId: post.run_id,
      campaign: campaignName(run?.campaign_id ?? null) ?? run?.brief?.campaign_name ?? "—",
    };
  });

  // Pronti da programmare: approvati, social, e senza un post.
  const scheduledAssets = new Set(posts.map((p) => p.asset_id).filter(Boolean));
  const ready: ReadyItem[] = approved.flatMap(({ asset, run }) => {
    const target = targetOf(asset.format);
    if (!target || scheduledAssets.has(asset.id)) return [];
    const variant = run.variants.find((v) => v.index === asset.variant_index) ?? null;
    if (!variant) return [];
    const caption = run.captions.find((c) => c.channel === target.channel) ?? null;
    return [
      {
        assetId: asset.id,
        runId: run.id,
        channel: target.channel,
        surface: target.surface,
        format: asset.format,
        variant,
        layout: asset.layout ?? null,
        photo: run.brief?.photo ?? null,
        campaign: campaignName(run.campaign_id) ?? run.brief?.campaign_name ?? "—",
        caption: caption?.text ?? "",
        hashtags: caption?.hashtags ?? [],
      },
    ];
  });

  return (
    <PageFrame title="Calendario" description="I post programmati e pubblicati. Trascina un post su un altro giorno per spostarlo, o un asset pronto su un giorno per programmarlo." width={1380}>
      <Calendar items={items} ready={ready} channels={channelStatus()} canPublish={can(user, "publish")} />
    </PageFrame>
  );
}
