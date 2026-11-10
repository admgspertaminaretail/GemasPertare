import { redirect } from "next/navigation";
import Link from "next/link";
import { ChevronRight, FilePlus2 } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getStore } from "@/lib/db";
import { listIbosExtracts } from "@/lib/services/ibos";
import { NewSubmissionForm } from "@/components/submissions/NewSubmissionForm";
import { PageHeader } from "@/components/ui/kit";
import { MAX_FILE_BYTES } from "@/lib/storage";

export const dynamic = "force-dynamic";

export default async function NewSubmission() {
  const u = await requireUser();
  if (u.role !== "ADMIN_SPBU") redirect("/submissions");
  const store = await getStore();
  const [spbus, regions, tpls, ibosData] = await Promise.all([
    store.list("SPBUS"),
    store.list("REGIONS"),
    store.list("TEMPLATES"),
    listIbosExtracts(u),
  ]);
  const spbu = spbus.find((s) => s.spbu_id === u.spbuId);
  const region = regions.find((r) => r.region_id === u.regionId);
  const activeTpls = tpls.filter((t) => t.status === "Aktif");
  const daftarArsipTpl =
    activeTpls.find((t) => t.category === "Daftar Arsip") ||
    activeTpls.find((t) => /daftar arsip/i.test(t.name)) ||
    null;
  const fupaTpl =
    activeTpls.find((t) => t.category === "Form FUPA") ||
    activeTpls.find((t) => /fupa|fup/i.test(t.name)) ||
    null;

  return (
    <>
      <nav className="mb-2 flex items-center gap-1 text-xs text-slate-500">
        <Link href="/submissions" className="hover:text-brand">Pengajuan</Link>
        <ChevronRight className="h-3 w-3" />
        <span className="font-semibold text-navy">Buat Pengajuan</span>
      </nav>
      <PageHeader
        icon={<FilePlus2 className="h-6 w-6" />}
        title="Buat Pengajuan Usul Musnah"
        subtitle="Lengkapi keterangan pengajuan dan unggah dokumen arsip usul musnah beserta foto fisik arsip."
      />
      <NewSubmissionForm
        spbuName={spbu?.name || ""}
        spbuCode={spbu?.spbu_code || ""}
        regionName={region?.region_name || ""}
        maxMb={Math.round(MAX_FILE_BYTES / 1048576)}
        ibosItems={ibosData.items}
        daftarArsipTemplate={
          daftarArsipTpl
            ? { id: daftarArsipTpl.template_id, name: daftarArsipTpl.name }
            : null
        }
        fupaTemplate={
          fupaTpl
            ? { id: fupaTpl.template_id, name: fupaTpl.name }
            : null
        }
      />
    </>
  );
}
