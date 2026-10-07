import { redirect } from "next/navigation";
import { currentUser } from "@/auth";
import { PageFrame } from "@/components/studio/page-frame";
import { ProfilesAdmin } from "@/components/studio/profiles-admin";
import { ToolsAdmin } from "@/components/studio/tools-admin";
import { getTools, listProfiles } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * L'amministrazione, riservata agli approvatori: chi fa parte del team e
 * con che ruolo, e cosa dicono gli strumenti salvati.
 */
export default async function AdminPage() {
  const user = await currentUser();
  if (!user) redirect("/");
  if (user.role !== "approver") redirect("/studio");

  const [profiles, tools] = await Promise.all([listProfiles(), getTools()]);

  return (
    <PageFrame user={user} title="Amministrazione" description="Team, ruoli e strumenti salvati. Le modifiche valgono subito, senza un deploy." width={1000}>
      <ProfilesAdmin profiles={profiles} me={user.email} />
      <ToolsAdmin tools={tools} />
    </PageFrame>
  );
}
