import { requireUser } from "@/lib/auth";
import { getHomePageData } from "@/lib/services/home";
import { HomeClient } from "@/components/home/HomeClient";
import { GeneralHomeView } from "@/components/home/GeneralHomeView";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const u = await requireUser();
  const data = await getHomePageData(u);

  return (
    <HomeClient
      role={u.role}
      userDisplayName={u.name}
      greetingName={data.greetingName}
      userRegionName={data.userRegionName}
      isDemo={!!u.isDemo && process.env.DEMO_MODE !== "false"}
      slides={data.slides}
      kpi={data.kpi}
      scope={data.scope}
      regionStats={data.regionStats}
      nationalTotalSubmissions={data.nationalTotalSubmissions}
      topRegions={data.topRegions}
      topSpbus={data.topSpbus}
      mySpbuRank={data.mySpbuRank}
      myRegionRank={data.myRegionRank}
      regions={data.regions}
      regionKpis={data.regionKpis}
      regionalSpbus={data.regionalSpbus}
    />
  );
}
