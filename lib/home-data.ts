import type { StudioUser } from "@/auth";
import type { FormatId } from "./brand";
import { getRun, listApprovals, listCampaignRuns, listPostsBetween, listRuns } from "./db";
import { daysUntil } from "./format";
import { can } from "./permissions";
import type { Campaign, Channel, PostStatus, Run, Surface, VariantCopy } from "./types";

/**
 * Quello che la home mostra intorno agli strumenti: cosa aspetta
 * un'approvazione, cosa esce questa settimana, quali bandi scadono, da
 * dove si era rimasti. Tutto letto dal server in una volta, e niente
 * inventato: una scadenza compare solo se un'esecuzione l'ha letta da una
 * fonte.
 */

export interface HomeApproval {
  id: string;
  runId: string;
  variantIndex: number;
  title: string;
  campaign: string;
  requester: string;
  formats: FormatId[];
  createdAt: string;
  variant: VariantCopy | null;
  photo: string | null;
}

export interface HomePost {
  id: string;
  channel: Channel;
  surface: Surface;
  scheduledFor: string;
  title: string;
  status: PostStatus;
}

export interface HomeDeadline {
  campaign: string;
  bando: string;
  deadline: string;
  daysLeft: number;
  runId: string;
}

export interface HomeData {
  campaignName: string;
  approvals: HomeApproval[];
  posts: HomePost[];
  deadlines: HomeDeadline[];
  recent: Run[];
}

export async function loadHomeData(user: StudioUser, campaigns: Campaign[], campaignId: string | null): Promise<HomeData> {
  const campaignName = (id: string | null) => campaigns.find((c) => c.id === id)?.name ?? null;
  const activeIds = campaigns.filter((c) => c.active || c.id === campaignId).map((c) => c.id);

  const now = new Date();
  const weekEnd = new Date(now.getTime() + 7 * 86_400_000);

  const [pending, posts, campaignRuns, recent] = await Promise.all([
    can(user, "approve") ? listApprovals("pending", 3) : Promise.resolve([]),
    listPostsBetween(now, weekEnd),
    listCampaignRuns(activeIds, 60),
    listRuns(user.email, 4),
  ]);

  const runCache = new Map<string, Run | null>();
  const runOf = async (id: string) => {
    if (!runCache.has(id)) runCache.set(id, await getRun(id));
    return runCache.get(id) ?? null;
  };

  const approvals: HomeApproval[] = [];
  for (const a of pending) {
    const run = await runOf(a.run_id);
    if (!run) continue;
    const variant = run.variants.find((v) => v.index === a.variant_index) ?? null;
    approvals.push({
      id: a.id,
      runId: run.id,
      variantIndex: a.variant_index,
      title: variant?.headline ?? run.instruction.slice(0, 60),
      campaign: campaignName(run.campaign_id) ?? run.brief?.campaign_name ?? "—",
      requester: a.requested_by ?? "—",
      formats: run.formats,
      createdAt: a.created_at,
      variant,
      photo: run.brief?.photo ?? null,
    });
  }

  const scheduled = posts
    .filter((p) => p.status === "scheduled" && p.scheduled_for)
    .sort((a, b) => (a.scheduled_for ?? "").localeCompare(b.scheduled_for ?? ""))
    .slice(0, 3);
  const weekPosts: HomePost[] = [];
  for (const p of scheduled) {
    const run = await runOf(p.run_id);
    const variant = run?.variants.find((v) => v.index === p.variant_index) ?? run?.variants[0] ?? null;
    weekPosts.push({
      id: p.id,
      channel: p.channel,
      surface: p.surface,
      scheduledFor: p.scheduled_for!,
      title: variant?.headline ?? run?.instruction.slice(0, 60) ?? "Post",
      status: p.status,
    });
  }

  // Una scadenza per bando, la piu' recente letta: solo quelle ancora davanti.
  const seen = new Set<string>();
  const deadlines: HomeDeadline[] = [];
  for (const run of campaignRuns) {
    const iso = run.brief?.deadline;
    if (!iso) continue;
    const days = daysUntil(iso, now.getTime());
    if (days === null || days < 0) continue;
    const bando = run.brief?.campaign_name ?? campaignName(run.campaign_id) ?? run.instruction.slice(0, 50);
    const key = `${run.campaign_id}:${bando}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deadlines.push({ campaign: campaignName(run.campaign_id) ?? bando, bando, deadline: iso, daysLeft: days, runId: run.id });
  }
  deadlines.sort((a, b) => a.daysLeft - b.daysLeft);

  return {
    campaignName: campaignName(campaignId) ?? "Nessuna campagna",
    approvals,
    posts: weekPosts,
    deadlines: deadlines.slice(0, 3),
    recent,
  };
}
