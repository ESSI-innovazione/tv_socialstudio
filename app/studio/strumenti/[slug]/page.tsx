import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { currentUser } from "@/auth";
import { StudioShell } from "@/components/studio/studio-shell";
import { activeCampaignId, CAMPAIGN_COOKIE } from "@/lib/campaign-cookie";
import { getCampaigns, getTemplates, getTools, listRuns } from "@/lib/db";
import { channelStatus } from "@/lib/publish";

export const dynamic = "force-dynamic";

/**
 * Il modulo di uno strumento. E' la stessa console di /studio con lo
 * strumento gia' scelto: compilato il modulo, l'esecuzione parte qui, sul
 * posto, e l'indirizzo diventa quello della console con il lavoro.
 *
 * I valori nell'indirizzo (?bando=…&scadenza=…) precompilano il modulo: e'
 * cosi' che «Crea poster» dalla scadenza di un bando arriva gia' pronto.
 */
export default async function ToolPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await currentUser();
  if (!user) redirect("/");

  const [{ slug }, query, tools, campaigns, templates, recentRuns, jar] = await Promise.all([
    params,
    searchParams,
    getTools(),
    getCampaigns(),
    getTemplates(),
    listRuns(user.email, 2),
    cookies(),
  ]);

  const tool = tools.find((t) => t.slug === slug);
  if (!tool || tool.automatic) notFound();

  const prefill: Record<string, string> = {};
  for (const field of tool.fields) {
    const raw = query[field.key];
    const value = Array.isArray(raw) ? raw[0] : raw;
    if (typeof value === "string" && value.trim()) prefill[field.key] = value;
  }

  return (
    <StudioShell
      key={tool.id}
      user={user}
      tools={tools}
      campaigns={campaigns}
      campaignId={activeCampaignId(campaigns, jar.get(CAMPAIGN_COOKIE)?.value)}
      templates={templates}
      recentRuns={recentRuns}
      initialRun={null}
      channels={channelStatus()}
      tool={tool}
      prefill={prefill}
    />
  );
}
