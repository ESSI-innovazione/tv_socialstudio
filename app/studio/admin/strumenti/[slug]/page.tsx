import { notFound, redirect } from "next/navigation";
import { currentUser } from "@/auth";
import { ToolEditor } from "@/components/studio/tool-editor";
import { getTemplates, getTools, listToolVersions } from "@/lib/db";
import { can } from "@/lib/permissions";

export const dynamic = "force-dynamic";

/**
 * L'editor di uno strumento: l'istruzione con i suoi segnaposto, le domande
 * del modulo, i formati, e a destra come lo vede il team e le versioni.
 * Le modifiche sono una bozza finche' non si pubblica.
 */
export default async function ToolEditorPage({ params }: { params: Promise<{ slug: string }> }) {
  const user = await currentUser();
  if (!user) redirect("/");
  if (!can(user, "editTools")) redirect("/studio");

  const [{ slug }, tools, templates] = await Promise.all([params, getTools(), getTemplates()]);
  const tool = tools.find((t) => t.slug === slug);
  if (!tool || tool.automatic) notFound();

  const versions = await listToolVersions(tool.id);

  return (
    <main className="tv-scroll min-h-0 flex-1 overflow-y-auto">
      <ToolEditor key={tool.id} tools={tools} tool={tool} versions={versions} templates={templates} me={user.email} />
    </main>
  );
}
