import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight, LayoutDashboard } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getDashboard } from "@/lib/services/monitoring";
import { DashboardView } from "@/components/dashboard/DashboardView";
import { PageHeader } from "@/components/ui/kit";

export const dynamic = "force-dynamic";

export default async function RegionDetail({ params, searchParams }: { params: { id: string }; searchParams: Record<string, string | undefined> }) {
  const u = await requireUser();
  if (u.role === "ADMIN_SPBU") notFound();
  if (u.role === "ADMIN_REGION" && u.regionId !== params.id) notFound(); // Region lain tidak boleh diakses
  const filters = { year: searchParams.year || "", region: params.id, spbu: searchParams.spbu || "", subId: searchParams.subId || "", status: searchParams.status || "", fupa: searchParams.fupa || "", memo: searchParams.memo || "" };
  const data = await getDashboard(u, filters);
  const region = data.regions.find((r) => r.region_id === params.id);
  if (!region) notFound();
  return (
    <>
      {u.role === "ADMIN_PAM" && (
        <nav className="mb-2 flex items-center gap-1 text-xs text-slate-500" aria-label="Breadcrumb">
          <Link href="/dashboard" className="hover:text-brand">Dashboard Head Office</Link><ChevronRight className="h-3 w-3" /><span className="font-semibold text-navy">{region.region_name}</span>
        </nav>
      )}
      <PageHeader icon={<LayoutDashboard className="h-6 w-6" />} title={`Dashboard ${region.region_name}`} subtitle="Seluruh SPBU dalam Region beserta progres pengajuannya." />
      <DashboardView data={data} role={u.role} filters={{ ...filters, region: "" }} basePath={`/dashboard/region/${params.id}`} fixedRegion={params.id} />
    </>
  );
}
