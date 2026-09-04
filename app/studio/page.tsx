import { redirect } from "next/navigation";
import { currentUser } from "@/auth";
import { StudioShell } from "@/components/studio/studio-shell";
import { getCampaigns, getLatestRun, getTemplates, getTools, listRuns } from "@/lib/db";
import { env } from "@/lib/env";
import { timeAgo } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function StudioPage() {
  const user = await currentUser();
  if (!user) redirect("/");

  const [tools, campaigns, templates, recentRuns, latestRun] = await Promise.all([
    getTools(),
    getCampaigns(),
    getTemplates(),
    listRuns(2),
    getLatestRun(),
  ]);

  const synced = templates.find((t) => t.synced_at)?.synced_at ?? null;

  return (
    <StudioShell
      user={user}
      tools={tools}
      campaigns={campaigns}
      templates={templates}
      recentRuns={recentRuns}
      initialRun={latestRun}
      channelsLive={Boolean(env.linkedinToken && env.igToken)}
      figmaSyncedAt={synced ? timeAgo(synced) : "mai sincronizzato"}
    />
  );
}
