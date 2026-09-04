import { redirect } from "next/navigation";
import { currentUser } from "@/auth";
import { getCampaigns, getTools } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function StudioPage() {
  const user = await currentUser();
  if (!user) redirect("/");

  const [tools, campaigns] = await Promise.all([getTools(), getCampaigns()]);

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center gap-6 p-10">
      <h1 className="text-2xl font-bold tracking-tight text-ink">Console creativa</h1>
      <p className="text-ink-soft">
        Accesso confermato per {user.name} · ruolo {user.role}. La console arriva al passo
        successivo.
      </p>
      <div className="tv-card p-5 text-sm text-ink-soft">
        {tools.length} strumenti e {campaigns.length} campagne caricati.
      </div>
    </main>
  );
}
