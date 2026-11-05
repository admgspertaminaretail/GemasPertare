import { requireUser } from "@/lib/auth";
import { listSubmissions, listPoolings, listMemos, listPoolable, listMemoablePoolings } from "@/lib/services/submissions";
import { SubmissionsHub } from "@/components/submissions/SubmissionsHub";
import { PageHeader } from "@/components/ui/kit";
import { FilePlus2, Plus } from "lucide-react";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function SubmissionsPage({ searchParams }: { searchParams: { tab?: string } }) {
  const u = await requireUser();
  const isRegion = u.role === "ADMIN_REGION";
  const [subs, poolings, memos, poolable, memoable] = await Promise.all([
    listSubmissions(u), listPoolings(u), listMemos(u),
    isRegion ? listPoolable(u) : Promise.resolve([]), isRegion ? listMemoablePoolings(u) : Promise.resolve([]),
  ]);
  const tab = ["pengajuan", "pooling", "memo"].includes(searchParams.tab || "") && u.role !== "ADMIN_SPBU" ? searchParams.tab! : "pengajuan";
  return (
    <>
      <PageHeader icon={<FilePlus2 className="h-6 w-6" />} title="Pengajuan Usul Musnah Arsip"
        subtitle={u.role === "ADMIN_SPBU" ? "Buat pengajuan, pantau status, dan unggah revisi." : u.role === "ADMIN_REGION" ? "Review pengajuan SPBU, buat pooling FUPA Regional, dan catat MEMO." : "Monitoring pengajuan, pooling FUPA, dan MEMO seluruh Region (hanya lihat)."}
        actions={u.role === "ADMIN_SPBU" ? <Link href="/submissions/new" className="btn-primary"><Plus className="h-4 w-4" />Buat Pengajuan Usul Musnah</Link> : undefined} />
      <SubmissionsHub role={u.role} tab={tab} subs={subs} poolings={poolings} memos={memos} poolable={poolable} memoable={memoable} />
    </>
  );
}
