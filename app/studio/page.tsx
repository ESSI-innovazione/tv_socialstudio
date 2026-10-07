import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { currentUser } from "@/auth";
import { StudioShell } from "@/components/studio/studio-shell";
import { activeCampaignId, CAMPAIGN_COOKIE } from "@/lib/campaign-cookie";
import { getCampaigns, getRun, getTemplates, getTools, listRuns } from "@/lib/db";
import { loadHomeData } from "@/lib/home-data";
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
    // `?run=` riapre un lavoro preciso — dallo storico o dall'archivio.
    // Senza, la console e' la home degli strumenti: l'ultimo lavoro si
    // riprende dalle card «Riprendi da dove eri», non si riapre da solo.
    requestedId ? getRun(requestedId) : Promise.resolve(null),
    cookies(),
  ]);

  const campaignId = activeCampaignId(campaigns, jar.get(CAMPAIGN_COOKIE)?.value);
  const home = requestedId ? null : await loadHomeData(user, campaigns, campaignId);

  return (
    <StudioShell
      key={latestRun?.id ?? "fresh"}
      user={user}
      tools={tools}
      campaigns={campaigns}
      campaignId={campaignId}
      templates={templates}
      recentRuns={recentRuns}
      initialRun={latestRun}
      channels={channelStatus()}
      home={home}
    />
  );
}
