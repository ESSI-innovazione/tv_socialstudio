import { redirect } from "next/navigation";
import { currentUser } from "@/auth";
import { getTools } from "@/lib/db";
import { can } from "@/lib/permissions";

export const dynamic = "force-dynamic";

/** L'editor apre sempre uno strumento: senza slug, il primo del team. */
export default async function ToolsAdminIndex() {
  const user = await currentUser();
  if (!user) redirect("/");
  if (!can(user, "editTools")) redirect("/studio");

  const first = (await getTools()).find((t) => !t.automatic);
  redirect(first ? `/studio/admin/strumenti/${first.slug}` : "/studio");
}
