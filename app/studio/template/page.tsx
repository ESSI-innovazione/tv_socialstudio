import { redirect } from "next/navigation";
import { currentUser } from "@/auth";
import { FigmaSync } from "@/components/studio/figma-sync";
import { PageFrame } from "@/components/studio/page-frame";
import { getTemplates } from "@/lib/db";
import { env } from "@/lib/env";
import { can } from "@/lib/permissions";

export const dynamic = "force-dynamic";

/**
 * I template: nascono in Figma e arrivano qui con una sincronizzazione,
 * senza un deploy. Tutti li vedono; designer e approvatori li aggiornano.
 */
export default async function TemplatePage() {
  const user = await currentUser();
  if (!user) redirect("/");

  const templates = await getTemplates();
  const lastSyncedAt = templates.map((t) => t.synced_at).filter((s): s is string => Boolean(s)).sort().at(-1) ?? null;

  return (
    <PageFrame title="Template" description="I template nascono in Figma, nelle pagine «TPL/…», e arrivano qui senza un deploy." width={1100}>
      {can(user, "syncTemplates") ? (
        <FigmaSync templates={templates} lastSyncedAt={lastSyncedAt} configured={Boolean(env.figmaToken && env.figmaFileKey)} />
      ) : (
        <p className="tv-card px-5 py-4 text-[13.5px]" style={{ color: "var(--color-ink-soft)" }}>
          {templates.length} template in libreria. La sincronizzazione da Figma la fanno designer e approvatori.
        </p>
      )}
    </PageFrame>
  );
}
