import { ClipboardList } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getDashboard } from "@/lib/services/monitoring";
import { MonitoringDetailView } from "@/components/dashboard/MonitoringDetailView";
import { DemoTag, PageHeader } from "@/components/ui/kit";

export const dynamic = "force-dynamic";

export default async function DetailMonitoringPage({ searchParams }: { searchParams: Record<string, string | undefined> }) {
  const u = await requireUser();
  const filters = {
    year: searchParams.year || "",
    region: searchParams.region || "",
    spbu: searchParams.spbu || "",
    subId: searchParams.subId || "",
    status: searchParams.status || "",
    fupa: searchParams.fupa || "",
    memo: searchParams.memo || "",
  };
  const data = await getDashboard(u, filters);
  return (
    <>
      <PageHeader
        icon={<ClipboardList className="h-6 w-6" />}
        title="Rincian Data Monitoring"
        subtitle="Tampilan tabel penuh untuk seluruh poin KPI dan segmen grafik Dashboard Monitoring — terintegrasi dengan data SPBU, Daftar Arsip (Excel), FUPA, dan MEMO."
        actions={u.isDemo && process.env.DEMO_MODE !== "false" ? <DemoTag /> : undefined}
      />
      <MonitoringDetailView
        data={data}
        role={u.role}
        filters={filters}
        initialView={searchParams.view || ""}
        initialFocusRegion={searchParams.focusRegion || ""}
      />
    </>
  );
}
