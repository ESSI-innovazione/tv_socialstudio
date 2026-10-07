import { redirect } from "next/navigation";
import { currentUser } from "@/auth";
import { ArchiveGrid, type ArchiveCard } from "@/components/studio/archive-grid";
import { ArchiveFilters } from "@/components/studio/archive-filters";
import { PageFrame } from "@/components/studio/page-frame";
import { FORMATS, type FormatId } from "@/lib/brand";
import { getCampaigns, listApprovedAssets } from "@/lib/db";

export const dynamic = "force-dynamic";

interface Query {
  campaign?: string;
  format?: string;
  author?: string;
  from?: string;
  to?: string;
  q?: string;
}

/**
 * L'archivio condiviso: tutto quello che il team ha approvato, filtrabile e
 * cercabile nel copy. Da ogni asset si scarica, si riparte, e si vede chi
 * ha approvato e quando.
 */
export default async function ArchivioPage({ searchParams }: { searchParams: Promise<Query> }) {
  const user = await currentUser();
  if (!user) redirect("/");

  const query = await searchParams;
  const [entries, campaigns] = await Promise.all([listApprovedAssets(), getCampaigns()]);
  const campaignName = (id: string | null) => campaigns.find((c) => c.id === id)?.name ?? null;

  const cards: ArchiveCard[] = entries.flatMap(({ asset, run }) => {
    const variant = run.variants.find((v) => v.index === asset.variant_index);
    if (!variant) return [];
    return [
      {
        asset,
        variant,
        runId: run.id,
        instruction: run.instruction,
        photo: run.brief?.photo ?? null,
        campaignId: run.campaign_id,
        campaign: campaignName(run.campaign_id) ?? run.brief?.campaign_name ?? "—",
        author: run.created_by ?? "—",
        captions: run.captions.map((c) => c.text),
      },
    ];
  });

  // I valori possibili dei filtri vengono dall'archivio stesso: non si
  // offre un autore o un formato che non ha niente dietro.
  const authors = [...new Set(cards.map((c) => c.author))].sort();
  const formats = [...new Set(cards.map((c) => c.asset.format))].filter((f): f is FormatId => f in FORMATS);
  const usedCampaigns = campaigns.filter((c) => cards.some((card) => card.campaignId === c.id));

  const needle = query.q?.trim().toLowerCase() ?? "";
  const from = query.from ? new Date(query.from) : null;
  const to = query.to ? new Date(`${query.to}T23:59:59`) : null;

  const filtered = cards.filter((c) => {
    if (query.campaign && c.campaignId !== query.campaign) return false;
    if (query.format && c.asset.format !== query.format) return false;
    if (query.author && c.author !== query.author) return false;
    const approved = c.asset.approved_at ? new Date(c.asset.approved_at) : null;
    if (from && approved && approved < from) return false;
    if (to && approved && approved > to) return false;
    if (needle) {
      const haystack = [c.variant.eyebrow, c.variant.headline, c.variant.subhead, c.variant.body, c.variant.badge ?? "", c.variant.cta_label, c.instruction, c.campaign, ...c.captions]
        .join("\n")
        .toLowerCase();
      if (!haystack.includes(needle)) return false;
    }
    return true;
  });

  return (
    <PageFrame
      user={user}
      title="Archivio"
      description={`${filtered.length} ${filtered.length === 1 ? "asset approvato" : "asset approvati"}${filtered.length !== cards.length ? ` su ${cards.length}` : ""} · di tutto il team`}
      width={1240}
    >
      <ArchiveFilters campaigns={usedCampaigns} formats={formats} authors={authors} query={query} />
      <ArchiveGrid cards={filtered} empty={cards.length === 0} />
    </PageFrame>
  );
}
