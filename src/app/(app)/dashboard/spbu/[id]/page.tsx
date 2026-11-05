import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight, Store, Plus } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getSpbuDetail } from "@/lib/services/monitoring";
import { SubmissionTable } from "@/components/submissions/SubmissionTable";
import { KpiCard, PageHeader } from "@/components/ui/kit";

export const dynamic = "force-dynamic";

export default async function SpbuDetail({ params }: { params: { id: string } }) {
  const u = await requireUser();
  let d;
  try { d = await getSpbuDetail(u, params.id); } catch { notFound(); }
  if (!d) notFound();
  const c = d.counts;
  return (
    <>
      {u.role !== "ADMIN_SPBU" && (
        <nav className="mb-2 flex flex-wrap items-center gap-1 text-xs text-slate-500" aria-label="Breadcrumb">
          <Link href="/dashboard" className="hover:text-brand">Dashboard</Link><ChevronRight className="h-3 w-3" />
          <Link href={`/dashboard/region/${d.spbu.region_id}`} className="hover:text-brand">{d.region?.region_name}</Link><ChevronRight className="h-3 w-3" />
          <span className="font-semibold text-navy">{d.spbu.name}</span>
        </nav>
      )}
      <PageHeader icon={<Store className="h-6 w-6" />} title={d.spbu.name}
        subtitle={`${d.spbu.spbu_code} · ${d.region?.region_name} · ${[d.spbu.city, d.spbu.province].filter(Boolean).join(", ")}${d.spbu.address ? " — " + d.spbu.address : ""}`}
        actions={u.role === "ADMIN_SPBU" ? <Link href="/submissions/new" className="btn-primary"><Plus className="h-4 w-4" />Buat Pengajuan</Link> : undefined} />
      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <KpiCard label="Total pengajuan" value={c.total} tone="blue" />
        <KpiCard label="Menunggu review" value={c.review} tone="amber" />
        <KpiCard label="Perlu revisi" value={c.revision} tone="red" />
        <KpiCard label="Disetujui" value={c.approved} tone="green" />
        <KpiCard label="Sudah pooling" value={c.pooled} tone="blue" />
        <KpiCard label="Sudah di-Memo" value={c.memoed} tone="navy" />
      </div>
      <h2 className="mb-2 text-sm font-bold text-navy">Seluruh transaksi pengajuan SPBU ini</h2>
      <SubmissionTable rows={d.subs} showSpbu={false} exportName={`pengajuan-${d.spbu.spbu_id}`} emptyText="SPBU ini belum pernah mengajukan usul musnah." />
    </>
  );
}
