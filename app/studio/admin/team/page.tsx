import { redirect } from "next/navigation";
import { currentUser } from "@/auth";
import { PageFrame } from "@/components/studio/page-frame";
import { TeamAdmin } from "@/components/studio/team-admin";
import { listProfileEvents, listProfiles } from "@/lib/db";
import { mailConfigured } from "@/lib/mail";
import { can } from "@/lib/permissions";

export const dynamic = "force-dynamic";

/**
 * Il team: chi c'e', con che ruolo, quando e' entrato l'ultima volta. Da
 * qui si invita un collega e si cambia un ruolo senza aprire il database.
 * Riservata agli admin, sul server.
 */
export default async function TeamPage() {
  const user = await currentUser();
  if (!user) redirect("/");
  if (!can(user, "manageTeam")) redirect("/studio");

  const [profiles, events] = await Promise.all([listProfiles(), listProfileEvents(12)]);

  return (
    <PageFrame
      title="Team e ruoli"
      breadcrumb={[{ label: "Amministrazione" }, { label: "Team e ruoli" }]}
      description={`${profiles.filter((p) => p.active !== false).length} persone nel team. Chi ha un profilo entra con Google da subito.`}
      width={1100}
    >
      <TeamAdmin profiles={profiles} events={events} me={user.email} mailConfigured={mailConfigured()} />
    </PageFrame>
  );
}
