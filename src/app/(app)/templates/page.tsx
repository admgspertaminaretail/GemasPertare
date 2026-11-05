import { requireUser } from "@/lib/auth";
import { listTemplates } from "@/lib/services/content";
import { TemplatesView } from "@/components/info/TemplatesView";
import { PageHeader } from "@/components/ui/kit";
import { FileDown } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function TemplatesPage() {
  const u = await requireUser();
  const rows = await listTemplates(u);
  return (
    <>
      <PageHeader icon={<FileDown className="h-6 w-6" />} title="Pusat Template" subtitle="Unduh template dokumen resmi: data tarikan i-BOS, Form FUPA, dan Daftar Arsip Usul Musnah." />
      <TemplatesView rows={rows} canManage={u.role === "ADMIN_PAM"} />
    </>
  );
}
