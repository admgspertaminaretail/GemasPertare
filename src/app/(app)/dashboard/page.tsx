import { requireUser } from "@/lib/auth";
import { getDashboard } from "@/lib/services/monitoring";
import { DashboardView } from "@/components/dashboard/DashboardView";
import { PageHeader, DemoTag } from "@/components/ui/kit";
import { LayoutDashboard } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function DashboardPage({ searchParams }: { searchParams: Record<string, string | undefined> }) {
  const u = await requireUser();
  const filters = {
    year: searchParams.year || "", region: searchParams.region || "", spbu: searchParams.spbu || "",
    subId: searchParams.subId || "", status: searchParams.status || "", fupa: searchParams.fupa || "", memo: searchParams.memo || "",
  };
  const data = await getDashboard(u, filters);
  const title = data.scope === "HO" ? "Dashboard Head Office" : data.scope === "REGION" ? "Dashboard Region" : "Dashboard SPBU";
  return (
    <>
      <PageHeader icon={<LayoutDashboard className="h-6 w-6" />} title={title}
        subtitle={data.scope === "HO" ? "Ringkasan seluruh Region." : data.scope === "REGION" ? "Pusat monitoring operasional PIC Region." : "Ringkasan pengajuan usul musnah SPBU Anda."}
        actions={u.isDemo && process.env.DEMO_MODE !== "false" ? <DemoTag /> : undefined} />
      <DashboardView data={data} role={u.role} filters={filters} basePath="/dashboard" />
    </>
  );
}
