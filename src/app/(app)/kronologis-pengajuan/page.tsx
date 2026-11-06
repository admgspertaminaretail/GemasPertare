import { ListOrdered } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getDashboard } from "@/lib/services/monitoring";
import { ChronologicalIdView } from "@/components/dashboard/ChronologicalIdView";
import { DemoTag, PageHeader } from "@/components/ui/kit";

export const dynamic = "force-dynamic";

export default async function KronologisPengajuanPage({ searchParams }: { searchParams: Record<string, string | undefined> }) {
  const u = await requireUser();
  const data = await getDashboard(u);
  return (
    <>
      <PageHeader
        icon={<ListOrdered className="h-6 w-6" />}
        title="Kronologis ID Pengajuan"
        subtitle="Daftar urutan kronologis seluruh ID Pengajuan (SUB-0001 dan seterusnya) untuk memudahkan penelusuran histori pengajuan, tanggal FUPA, dan tanggal MEMO."
        actions={u.isDemo && process.env.DEMO_MODE !== "false" ? <DemoTag /> : undefined}
      />
      <ChronologicalIdView data={data} initialId={searchParams.id || ""} />
    </>
  );
}
