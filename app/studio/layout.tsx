import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { currentUser } from "@/auth";
import { StudioFrame } from "@/components/studio/sidebar";
import { studioNav } from "@/components/studio/nav";
import { activeCampaignId, CAMPAIGN_COOKIE } from "@/lib/campaign-cookie";
import { getCampaigns, listApprovals } from "@/lib/db";
import { can } from "@/lib/permissions";

export const dynamic = "force-dynamic";

/**
 * La cornice di ogni pagina dello Studio: la barra laterale vino con la
 * navigazione, la campagna attiva e la persona. Le pagine ci mettono dentro
 * solo il loro contenuto.
 */
export default async function StudioLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser();
  if (!user) redirect("/");

  const [campaigns, pending, jar] = await Promise.all([
    getCampaigns(),
    can(user, "approve") ? listApprovals("pending") : Promise.resolve([]),
    cookies(),
  ]);

  return (
    <StudioFrame
      user={user}
      sections={studioNav(user.role, user.isAdmin)}
      campaigns={campaigns}
      campaignId={activeCampaignId(campaigns, jar.get(CAMPAIGN_COOKIE)?.value)}
      pendingCount={pending.length}
    >
      {children}
    </StudioFrame>
  );
}
