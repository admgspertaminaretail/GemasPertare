"use client";
import { useEffect, useState } from "react";
import { Download, ExternalLink, FileText, Loader2 } from "lucide-react";
import { Modal } from "./Modal";

export interface PreviewTarget {
  kind: "template" | "knowledge" | "doc" | "photo" | "ibos" | "slide";
  id: string;
  name: string;
  mime: string;
}

/** Pratinjau langsung di aplikasi (PDF, gambar, Excel, maupun Word .docx) tanpa harus mengunduh terlebih dahulu. */
export function FilePreview({ target, onClose }: { target: PreviewTarget | null; onClose: () => void }) {
  const [sheet, setSheet] = useState<{ sheet: string; rows: string[][]; totalRows: number } | null>(null);
  const [docxParas, setDocxParas] = useState<string[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const lowerName = (target?.name || "").toLowerCase();
  const isXlsx = !!target && (lowerName.endsWith(".xlsx") || target.mime.includes("spreadsheetml"));
  const isDocx = !!target && (lowerName.endsWith(".docx") || target.mime.includes("wordprocessingml"));
  const isPdf = !!target && !isXlsx && !isDocx && (target.mime === "application/pdf" || lowerName.endsWith(".pdf"));
  const isImg = !!target && target.mime.startsWith("image/");

  useEffect(() => {
    setSheet(null);
    setDocxParas(null);
    setErr("");
    if (!target || (!isXlsx && !isDocx)) return;
    setLoading(true);
    fetch(`/api/files/${target.kind}/${target.id}?preview=1`)
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.error);
        if (j.kind === "docx" || Array.isArray(j.paragraphs)) {
          setDocxParas(j.paragraphs || []);
        } else {
          setSheet(j);
        }
      })
      .catch((e) => setErr(e.message || "Gagal memuat pratinjau."))
      .finally(() => setLoading(false));
  }, [target, isXlsx, isDocx]);

  if (!target) return null;
  const url = `/api/files/${target.kind}/${target.id}`;
  return (
    <Modal
      open
      onClose={onClose}
      title={`Pratinjau Dokumen: ${target.name}`}
      wide
      footer={
        <>
          {isPdf && (
            <a className="btn-ghost" href={url} target="_blank" rel="noreferrer">
              <ExternalLink className="h-4 w-4" />
              Buka Layar Penuh
            </a>
          )}
          <a className="btn-ghost" href={`${url}?download=1`}>
            <Download className="h-4 w-4" />
            Unduh Berkas
          </a>
          <button className="btn-primary" onClick={onClose}>
            Tutup Pratinjau
          </button>
        </>
      }
    >
      {isPdf && (
        <iframe
          title={target.name}
          src={url}
          className="h-[70vh] w-full rounded-xl border border-slate-200 bg-slate-50"
        />
      )}
      {isImg && (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img src={url} alt={target.name} className="mx-auto max-h-[70vh] rounded-xl object-contain" />
      )}
      {(isXlsx || isDocx) &&
        (loading ? (
          <div className="flex items-center justify-center py-12 text-slate-500">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            Memuat pratinjau dokumen…
          </div>
        ) : err ? (
          <p className="text-sm text-prtred">{err}</p>
        ) : sheet ? (
          <div>
            <p className="mb-2 text-xs text-slate-500">
              Lembar “{sheet.sheet}” — menampilkan {Math.min(100, sheet.rows.length)} dari {sheet.totalRows} baris.
            </p>
            <div className="scroll-thin max-h-[65vh] overflow-auto rounded-xl border border-slate-200">
              <table className="w-full text-xs">
                <tbody>
                  {sheet.rows.slice(0, 100).map((r, i) => (
                    <tr
                      key={i}
                      className={i === 0 ? "sticky top-0 bg-softblue font-bold text-navy" : "border-t border-slate-100 hover:bg-slate-50/70"}
                    >
                      {r.map((c, j) => (
                        <td key={j} className="whitespace-nowrap px-3 py-1.5">
                          {c}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : docxParas ? (
          <div className="scroll-thin max-h-[68vh] space-y-3 overflow-y-auto rounded-2xl border border-slate-200 bg-slate-50/60 p-6">
            <div className="flex items-center gap-2 border-b border-slate-200 pb-3 text-xs font-semibold text-brand">
              <FileText className="h-4 w-4" />
              Pratinjau Isi Dokumen Word (.docx)
            </div>
            {docxParas.length === 0 ? (
              <p className="text-sm text-slate-500">Dokumen ini tidak memiliki teks yang dapat ditampilkan secara langsung.</p>
            ) : (
              docxParas.map((p, idx) => (
                <p key={idx} className="text-sm leading-relaxed text-navy">
                  {p}
                </p>
              ))
            )}
          </div>
        ) : null)}
      {!isXlsx && !isDocx && !isImg && !isPdf && (
        <p className="text-sm text-slate-500">Pratinjau tidak tersedia untuk jenis file ini. Silakan gunakan tombol Unduh Berkas.</p>
      )}
    </Modal>
  );
}
