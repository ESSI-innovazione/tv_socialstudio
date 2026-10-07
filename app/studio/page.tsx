import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { currentUser } from "@/auth";
import { StudioShell } from "@/components/studio/studio-shell";
import { activeCampaignId, CAMPAIGN_COOKIE } from "@/lib/campaign-cookie";
import { getCampaigns, getLatestRun, getRun, getTemplates, getTools, listRuns } from "@/lib/db";
import { channelStatus } from "@/lib/publish";

export const dynamic = "force-dynamic";

export default async function StudioPage({ searchParams }: { searchParams: Promise<{ run?: string }> }) {
  const user = await currentUser();
  if (!user) redirect("/");

  const { run: requestedId } = await searchParams;

  const [tools, campaigns, templates, recentRuns, latestRun, jar] = await Promise.all([
    getTools(),
    getCampaigns(),
    getTemplates(),
    listRuns(user.email, 2),
    // `?run=` riapre un lavoro preciso — dallo storico o dall'archivio —
    // altrimenti la console ripristina l'ultimo della persona.
    requestedId ? getRun(requestedId) : getLatestRun(user.email),
    cookies(),
  ]);

  return (
    <StudioShell
      key={latestRun?.id ?? "fresh"}
      user={user}
      tools={tools}
      campaigns={campaigns}
      campaignId={activeCampaignId(campaigns, jar.get(CAMPAIGN_COOKIE)?.value)}
      templates={templates}
      recentRuns={recentRuns}
      initialRun={latestRun}
      channels={channelStatus()}
    />
  );
}
