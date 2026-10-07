import { redirect } from "next/navigation";
import { currentUser } from "@/auth";
import { FigmaSync } from "@/components/studio/figma-sync";
import { PageFrame } from "@/components/studio/page-frame";
import { ProfilesAdmin } from "@/components/studio/profiles-admin";
import { ToolsAdmin } from "@/components/studio/tools-admin";
import { getTemplates, getTools, listProfiles } from "@/lib/db";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";

/**
 * L'amministrazione, riservata agli approvatori: chi fa parte del team e
 * con che ruolo, cosa dicono gli strumenti salvati, e la libreria Figma.
 */
export default async function AdminPage() {
  const user = await currentUser();
  if (!user) redirect("/");
  if (user.role !== "approver") redirect("/studio");

  const [profiles, tools, templates] = await Promise.all([listProfiles(), getTools(), getTemplates()]);
  const lastSyncedAt = templates.map((t) => t.synced_at).filter((s): s is string => Boolean(s)).sort().at(-1) ?? null;

  return (
    <PageFrame user={user} title="Amministrazione" description="Team, ruoli, strumenti salvati e template. Le modifiche valgono subito, senza un deploy." width={1000}>
      <ProfilesAdmin profiles={profiles} me={user.email} />
      <ToolsAdmin tools={tools} />
      <FigmaSync templates={templates} lastSyncedAt={lastSyncedAt} configured={Boolean(env.figmaToken && env.figmaFileKey)} />
    </PageFrame>
  );
}
