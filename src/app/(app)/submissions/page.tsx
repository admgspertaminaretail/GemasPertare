import { requireUser } from "@/lib/auth";
import { getStore } from "@/lib/db";
import { listSubmissions, listPoolings, listMemos, listPoolable, listMemoablePoolings } from "@/lib/services/submissions";
import { listIbosExtracts } from "@/lib/services/ibos";
import { SubmissionsHub } from "@/components/submissions/SubmissionsHub";
import { PageHeader } from "@/components/ui/kit";
import { Download, FilePlus2, Plus } from "lucide-react";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function SubmissionsPage({ searchParams }: { searchParams: { tab?: string } }) {
  const u = await requireUser();
  const isRegion = u.role === "ADMIN_REGION";
  const store = await getStore();
  const [subs, poolings, memos, poolable, memoable, templates, ibosData] = await Promise.all([
    listSubmissions(u),
    listPoolings(u),
    listMemos(u),
    isRegion ? listPoolable(u) : Promise.resolve([]),
    isRegion ? listMemoablePoolings(u) : Promise.resolve([]),
    store.list("TEMPLATES"),
    listIbosExtracts(u),
  ]);

  const activeTpls = templates.filter((t) => t.status === "Aktif");
  const daftarArsipTpl =
    activeTpls.find((t) => t.category === "Daftar Arsip") ||
    activeTpls.find((t) => /daftar arsip/i.test(t.name)) ||
    null;

  const allowedTabs = u.role === "ADMIN_SPBU" ? ["pengajuan"] : ["pengajuan", "pooling", "memo"];
  const tab = allowedTabs.includes(searchParams.tab || "") ? searchParams.tab! : "pengajuan";

  return (
    <>
      <PageHeader
        icon={<FilePlus2 className="h-6 w-6" />}
        title="Pengajuan Usul Musnah Arsip"
        subtitle={
          u.role === "ADMIN_SPBU"
            ? "Buat pengajuan usul musnah arsip dan pantau status pengajuan SPBU Anda."
            : u.role === "ADMIN_REGION"
              ? "Review pengajuan SPBU, buat pooling FUPA Regional, dan catat MEMO."
              : "Monitoring pengajuan, pooling FUPA, dan MEMO seluruh Region."
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {daftarArsipTpl && (
              <a
                href={`/api/files/template/${daftarArsipTpl.template_id}?download=1`}
                className="btn-ghost bg-white ring-1 ring-slate-200 hover:bg-emerald-50 hover:text-emerald-800 hover:ring-emerald-200"
              >
                <Download className="h-4 w-4 text-prtgreen" />
                Template Daftar Arsip
              </a>
            )}
            {u.role === "ADMIN_SPBU" && (
              <Link href="/submissions/new" className="btn-primary">
                <Plus className="h-4 w-4" />
                Buat Pengajuan Usul Musnah
              </Link>
            )}
          </div>
        }
      />
      <SubmissionsHub
        role={u.role}
        tab={tab}
        subs={subs}
        poolings={poolings}
        memos={memos}
        poolable={poolable}
        memoable={memoable}
        ibosItems={ibosData.items}
        daftarArsipTemplate={
          daftarArsipTpl
            ? { id: daftarArsipTpl.template_id, name: daftarArsipTpl.name, version: daftarArsipTpl.version }
            : null
        }
      />
    </>
  );
}
