import { FileSpreadsheet } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { listIbosExtracts } from "@/lib/services/ibos";
import { MAX_FILE_BYTES } from "@/lib/storage";
import { PageHeader } from "@/components/ui/kit";
import { IbosDataView } from "@/components/info/IbosDataView";

export const dynamic = "force-dynamic";

export default async function TarikanIbosPage() {
  const u = await requireUser();
  const data = await listIbosExtracts(u);
  const canManage = u.role === "ADMIN_PAM";

  return (
    <>
      <PageHeader
        icon={<FileSpreadsheet className="h-6 w-6" />}
        title="Data Arsip Tarikan i-BOS"
        subtitle={
          canManage
            ? "Kelola dan bagikan data tarikan arsip bulanan dari sistem i-BOS untuk seluruh SPBU."
            : "Unduh data tarikan arsip bulanan dari sistem i-BOS yang dibagikan oleh Admin GS."
        }
      />
      <IbosDataView
        items={data.items}
        regions={data.regions}
        spbus={data.spbus}
        daftarArsipTemplate={data.daftarArsipTemplate}
        canManage={canManage}
        role={u.role}
        maxMb={Math.round(MAX_FILE_BYTES / 1048576)}
      />
    </>
  );
}
