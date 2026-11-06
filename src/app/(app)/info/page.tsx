import { requireUser } from "@/lib/auth";
import { listKnowledge } from "@/lib/services/content";
import { InfoView } from "@/components/info/InfoView";
import { PageHeader } from "@/components/ui/kit";
import { BookOpen } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function InfoPage() {
  const u = await requireUser();
  const docs = await listKnowledge(u);
  return (
    <>
      <PageHeader icon={<BookOpen className="h-6 w-6" />} title="Pusat Informasi Arsip" subtitle="Infografis pemusnahan arsip & perpustakaan digital (Pedoman, TKI, JRDP, Buku Saku, Sprint (Surat Perintah), dan Manual i-BOS) — bisa langsung dibaca lewat Preview." />
      <InfoView docs={docs} canManage={u.role === "ADMIN_PAM"} />
    </>
  );
}
