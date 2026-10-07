import { redirect } from "next/navigation";
import { currentUser } from "@/auth";
import { Calendar, type CalendarPost } from "@/components/studio/calendar";
import { PageFrame } from "@/components/studio/page-frame";
import { getAsset, getCampaigns, getRun, listPostsBetween } from "@/lib/db";
import { channelStatus } from "@/lib/publish";
import type { Asset, Run } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * Il calendario dei post: programmati e pubblicati, per mese o per
 * settimana, trascinabili per cambiare giorno. Lo stato dei canali sta in
 * testa, perche' un post programmato su un canale non collegato aspetta.
 */
export default async function CalendarioPage() {
  const user = await currentUser();
  if (!user) redirect("/");

  // Tre mesi indietro e sei avanti: abbastanza per navigare senza ricaricare.
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth() - 3, 1);
  const to = new Date(now.getFullYear(), now.getMonth() + 7, 0, 23, 59, 59);

  const [posts, campaigns] = await Promise.all([listPostsBetween(from, to), getCampaigns()]);

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
      campaign: campaigns.find((c) => c.id === run?.campaign_id)?.name ?? run?.brief?.campaign_name ?? "—",
    };
  });

  return (
    <PageFrame user={user} title="Calendario" description="I post programmati e pubblicati. Trascina un post su un altro giorno per spostarlo." width={1320}>
      <Calendar items={items} channels={channelStatus()} />
    </PageFrame>
  );
}
