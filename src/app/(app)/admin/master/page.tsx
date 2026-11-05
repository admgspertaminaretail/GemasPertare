import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getStore } from "@/lib/db";
import { listSpbus } from "@/lib/services/master";
import { MasterView } from "@/components/admin/MasterView";
import { PageHeader } from "@/components/ui/kit";
import { Database } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function MasterPage() {
  const u = await getSession();
  if (!u || u.role !== "ADMIN_PAM") redirect("/dashboard");
  const [spbus, regions] = await Promise.all([listSpbus(u), (await getStore()).list("REGIONS")]);
  return (
    <>
      <PageHeader icon={<Database className="h-6 w-6" />} title="Master Data" subtitle="Kelola Region dan SPBU: impor Excel, tambah, ubah, nonaktifkan, dan validasi duplikat." />
      <MasterView spbus={spbus} regions={regions} />
    </>
  );
}
