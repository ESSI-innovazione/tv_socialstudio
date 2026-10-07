import { redirect } from "next/navigation";
import { currentUser } from "@/auth";
import { StudioShell } from "@/components/studio/studio-shell";
import { getCampaigns, getLatestRun, getRun, getTemplates, getTools, listRuns } from "@/lib/db";
import { env } from "@/lib/env";
import { timeAgo } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function StudioPage({ searchParams }: { searchParams: Promise<{ run?: string }> }) {
  const user = await currentUser();
  if (!user) redirect("/");

  const { run: requestedId } = await searchParams;

  const [tools, campaigns, templates, recentRuns, latestRun] = await Promise.all([
    getTools(),
    getCampaigns(),
    getTemplates(),
    listRuns(user.email, 2),
    // `?run=` riapre un lavoro preciso — dallo storico o dall'archivio —
    // altrimenti la console ripristina l'ultimo della persona.
    requestedId ? getRun(requestedId) : getLatestRun(user.email),
  ]);

  const synced = templates.find((t) => t.synced_at)?.synced_at ?? null;

  return (
    <StudioShell
      key={latestRun?.id ?? "fresh"}
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
