"use client";
import { useEffect, useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { Modal } from "./Modal";

export interface PreviewTarget { kind: "template" | "knowledge" | "doc" | "photo"; id: string; name: string; mime: string }

/** Pratinjau PDF (iframe), gambar, atau 20 baris pertama Excel. File selalu dilayani server dengan pengecekan akses. */
export function FilePreview({ target, onClose }: { target: PreviewTarget | null; onClose: () => void }) {
  const [sheet, setSheet] = useState<{ sheet: string; rows: string[][]; totalRows: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const isXlsx = !!target && target.name.toLowerCase().endsWith(".xlsx");

  useEffect(() => {
    setSheet(null); setErr("");
    if (!target || !isXlsx) return;
    setLoading(true);
    fetch(`/api/files/${target.kind}/${target.id}?preview=1`).then(async (r) => { const j = await r.json(); if (!r.ok) throw new Error(j.error); setSheet(j); })
      .catch((e) => setErr(e.message || "Gagal memuat pratinjau.")).finally(() => setLoading(false));
  }, [target, isXlsx]);

  if (!target) return null;
  const url = `/api/files/${target.kind}/${target.id}`;
  return (
    <Modal open onClose={onClose} title={`Pratinjau: ${target.name}`} wide footer={<><button className="btn-ghost" onClick={onClose}>Tutup</button><a className="btn-primary" href={`${url}?download=1`}><Download className="h-4 w-4" />Unduh</a></>}>
      {target.mime === "application/pdf" && <iframe title={target.name} src={url} className="h-[65vh] w-full rounded-xl border border-slate-200" />}
      {target.mime.startsWith("image/") && /* eslint-disable-next-line @next/next/no-img-element */ <img src={url} alt={target.name} className="mx-auto max-h-[65vh] rounded-xl" />}
      {isXlsx && (
        loading ? <div className="flex items-center justify-center py-12 text-slate-500"><Loader2 className="mr-2 h-5 w-5 animate-spin" />Memuat…</div>
        : err ? <p className="text-sm text-prtred">{err}</p>
        : sheet && (
          <div>
            <p className="mb-2 text-xs text-slate-500">Lembar “{sheet.sheet}” — menampilkan {Math.min(20, sheet.rows.length)} dari {sheet.totalRows} baris pertama.</p>
            <div className="scroll-thin overflow-auto rounded-xl border border-slate-200">
              <table className="w-full text-xs"><tbody>{sheet.rows.map((r, i) => <tr key={i} className={i === 0 ? "bg-softblue font-bold" : "border-t border-slate-100"}>{r.map((c, j) => <td key={j} className="whitespace-nowrap px-3 py-1.5">{c}</td>)}</tr>)}</tbody></table>
            </div>
          </div>
        )
      )}
      {!isXlsx && !target.mime.startsWith("image/") && target.mime !== "application/pdf" && <p className="text-sm text-slate-500">Pratinjau tidak tersedia untuk jenis file ini. Silakan unduh.</p>}
    </Modal>
  );
}
