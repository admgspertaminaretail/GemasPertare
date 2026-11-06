import { redirect } from "next/navigation";
import { Cloud } from "lucide-react";
import { getSession } from "@/lib/auth";
import { getDatabaseStatus } from "@/lib/services/database";
import { DatabaseView } from "@/components/admin/DatabaseView";
import { PageHeader } from "@/components/ui/kit";

export const dynamic = "force-dynamic";

export default async function AdminDatabasePage() {
  const u = await getSession();
  if (!u || u.role !== "ADMIN_PAM") redirect("/dashboard");
  const status = await getDatabaseStatus();
  return (
    <>
      <PageHeader
        icon={<Cloud className="h-6 w-6" />}
        title="Database & Integrasi Google Cloud"
        subtitle="Kelola koneksi Google Service Account, inisialisasi otomatis Folder Google Drive & Spreadsheet 19 tabel GEMAS, serta sinkronisasi data."
      />
      <DatabaseView initial={status} />
    </>
  );
}
