import Link from "next/link";
import { redirect } from "next/navigation";
import { Users } from "lucide-react";
import { currentUser } from "@/auth";
import { FigmaSync } from "@/components/studio/figma-sync";
import { PageFrame } from "@/components/studio/page-frame";
import { ToolsAdmin } from "@/components/studio/tools-admin";
import { getTemplates, getTools } from "@/lib/db";
import { env } from "@/lib/env";
import { can } from "@/lib/permissions";

export const dynamic = "force-dynamic";

/**
 * L'amministrazione degli strumenti e della libreria Figma. Il team e i
 * ruoli hanno la loro pagina, riservata agli admin.
 */
export default async function AdminPage() {
  const user = await currentUser();
  if (!user) redirect("/");
  if (!can(user, "editTools") && !can(user, "syncTemplates")) {
    redirect(can(user, "manageTeam") ? "/studio/admin/team" : "/studio");
  }

  const [tools, templates] = await Promise.all([getTools(), getTemplates()]);
  const lastSyncedAt = templates.map((t) => t.synced_at).filter((s): s is string => Boolean(s)).sort().at(-1) ?? null;

  return (
    <PageFrame
      title="Amministrazione"
      breadcrumb={[{ label: "Amministrazione" }]}
      description="Strumenti salvati e template. Le modifiche valgono subito, senza un deploy."
      width={1000}
      action={
        can(user, "manageTeam") ? (
          <Link href="/studio/admin/team" className="tv-pill h-[44px] gap-2 px-4 text-[13px] hover:bg-line-soft" style={{ border: "1px solid var(--color-line)", color: "var(--color-ink)" }}>
            <Users size={15} strokeWidth={1.9} />
            Team e ruoli
          </Link>
        ) : null
      }
    >
      {can(user, "editTools") ? <ToolsAdmin tools={tools} /> : null}
      {can(user, "syncTemplates") ? <FigmaSync templates={templates} lastSyncedAt={lastSyncedAt} configured={Boolean(env.figmaToken && env.figmaFileKey)} /> : null}
    </PageFrame>
  );
}
