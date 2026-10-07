import { redirect } from "next/navigation";
import { currentUser } from "@/auth";
import { PageFrame } from "@/components/studio/page-frame";
import { TemplateLibrary, type LibraryTemplate } from "@/components/studio/template-library";
import { countRunsByTemplate, getTemplates, getTools, listTemplateSyncs } from "@/lib/db";
import { figmaConfigured, figmaFileUrl } from "@/lib/integrations/figma";
import { can } from "@/lib/permissions";

export const dynamic = "force-dynamic";

/** Entro quanto un template appena arrivato si dice «nuovo». */
const NEW_FOR_MS = 7 * 86_400_000;

/**
 * I template: nascono in Figma e arrivano qui con una sincronizzazione in
 * due passi, senza un deploy. Tutti li vedono; designer e approvatori li
 * aggiornano.
 */
export default async function TemplatePage() {
  const user = await currentUser();
  if (!user) redirect("/");

  const [templates, tools, uses, history] = await Promise.all([getTemplates(), getTools(), countRunsByTemplate(), listTemplateSyncs()]);
  const now = Date.now();

  const items: LibraryTemplate[] = templates.map((t) => {
    const runs = uses[t.id] ?? 0;
    const usedBy = tools.filter((tool) => !tool.automatic && tool.default_template === t.id).map((tool) => tool.title);
    const fresh = t.synced_at ? now - new Date(t.synced_at).getTime() < NEW_FOR_MS : false;
    return {
      template: t,
      state: runs > 0 || usedBy.length > 0 ? "in-use" : fresh ? "new" : "available",
      runs,
      usedBy,
    };
  });

  return (
    <PageFrame
      title="Template"
      description="I template nascono in Figma, nelle pagine «TPL/…», e arrivano qui con una sincronizzazione: nessun deploy. Chi crea sceglie fra questi."
      width={1180}
    >
      <TemplateLibrary
        items={items}
        history={history}
        canSync={can(user, "syncTemplates")}
        configured={figmaConfigured()}
        figmaUrl={figmaFileUrl()}
      />
    </PageFrame>
  );
}
