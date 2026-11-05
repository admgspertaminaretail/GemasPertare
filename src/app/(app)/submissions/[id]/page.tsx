import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getSubmissionDetail } from "@/lib/services/submissions";
import { SubmissionDetail } from "@/components/submissions/SubmissionDetail";

export const dynamic = "force-dynamic";

export default async function SubmissionPage({ params }: { params: { id: string } }) {
  const u = await requireUser();
  const d = await getSubmissionDetail(u, params.id);
  if (!d) notFound();
  return (
    <>
      <nav className="mb-2 flex items-center gap-1 text-xs text-slate-500" aria-label="Breadcrumb">
        <Link href="/submissions" className="hover:text-brand">Pengajuan</Link><ChevronRight className="h-3 w-3" /><span className="font-semibold text-navy">{d.submission.submission_id}</span>
      </nav>
      <SubmissionDetail data={JSON.parse(JSON.stringify(d))} role={u.role} />
    </>
  );
}
