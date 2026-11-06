import { redirect } from "next/navigation";
import Link from "next/link";
import { ChevronRight, FilePlus2 } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getStore } from "@/lib/db";
import { NewSubmissionForm } from "@/components/submissions/NewSubmissionForm";
import { PageHeader } from "@/components/ui/kit";
import { MAX_FILE_BYTES } from "@/lib/storage";

export const dynamic = "force-dynamic";

export default async function NewSubmission() {
  const u = await requireUser();
  if (u.role !== "ADMIN_SPBU") redirect("/submissions");
  const store = await getStore();
  const spbu = (await store.list("SPBUS")).find((s) => s.spbu_id === u.spbuId);
  const region = (await store.list("REGIONS")).find((r) => r.region_id === u.regionId);
  const tpls = (await store.list("TEMPLATES")).filter((t) => t.status === "Aktif");
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
        subtitle="Lengkapi data dan unggah ketiga dokumen wajib. ID pengajuan dibuat otomatis (SUB-001, SUB-002, …)."
      />
      <NewSubmissionForm
        spbuName={spbu?.name || ""}
        spbuCode={spbu?.spbu_code || ""}
        regionName={region?.region_name || ""}
        maxMb={Math.round(MAX_FILE_BYTES / 1048576)}
        templates={tpls
          .filter((t) => ["Daftar Arsip", "Form FUPA"].includes(t.category))
          .map((t) => ({ id: t.template_id, name: t.name, category: t.category }))}
      />
    </>
  );
}
