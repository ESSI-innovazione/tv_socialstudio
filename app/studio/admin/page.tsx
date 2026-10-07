import { redirect } from "next/navigation";
import { currentUser } from "@/auth";
import { can } from "@/lib/permissions";

export const dynamic = "force-dynamic";

/** L'amministrazione ha due pagine: gli strumenti e il team. Qui si smista. */
export default async function AdminPage() {
  const user = await currentUser();
  if (!user) redirect("/");
  if (can(user, "editTools")) redirect("/studio/admin/strumenti");
  if (can(user, "manageTeam")) redirect("/studio/admin/team");
  redirect("/studio");
}
