"use client";
import { useRef, useState } from "react";
import { CheckCircle2, FileSpreadsheet, FileText, Image as ImageIcon, Upload, X } from "lucide-react";

/** Kolom unggah file dengan indikator terpenuhi / belum, pilih ganda opsional. */
export function FileField({
  label, accept, multiple, files, onChange, required = true, hint, kind,
}: { label: string; accept: string; multiple?: boolean; files: File[]; onChange: (f: File[]) => void; required?: boolean; hint?: string; kind: "excel" | "pdf" | "image" }) {
  const ref = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const Icon = kind === "excel" ? FileSpreadsheet : kind === "pdf" ? FileText : ImageIcon;
  const done = files.length > 0;
  const add = (list: FileList | null) => {
    if (!list) return;
    const arr = Array.from(list);
    onChange(multiple ? [...files, ...arr].slice(0, 10) : arr.slice(0, 1));
  };
  return (
    <div className={`rounded-2xl border-2 border-dashed p-4 transition ${drag ? "border-brand bg-softblue" : done ? "border-prtgreen/50 bg-green-50/40" : "border-slate-200 bg-white"}`}
      onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)} onDrop={(e) => { e.preventDefault(); setDrag(false); add(e.dataTransfer.files); }}>
      <div className="flex items-start gap-3">
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${done ? "bg-prtgreen text-white" : "bg-softblue text-brand"}`}>{done ? <CheckCircle2 className="h-5 w-5" /> : <Icon className="h-5 w-5" />}</div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-bold text-navy">{label} {required && <span className="text-prtred">*</span>}</div>
          {hint && <div className="text-xs text-slate-500">{hint}</div>}
          {files.length > 0 && (
            <ul className="mt-2 space-y-1">
              {files.map((f, i) => (
                <li key={i} className="flex items-center gap-2 rounded-lg bg-white px-2.5 py-1.5 text-xs ring-1 ring-slate-100">
                  <span className="min-w-0 flex-1 truncate font-medium">{f.name}</span>
                  <span className="text-slate-400">{Math.max(1, Math.round(f.size / 1024))} KB</span>
                  <button type="button" aria-label="Hapus file" onClick={() => onChange(files.filter((_, j) => j !== i))}><X className="h-3.5 w-3.5 text-slate-400 hover:text-prtred" /></button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <button type="button" className="btn-ghost btn-sm shrink-0" onClick={() => ref.current?.click()}><Upload className="h-4 w-4" />{done ? (multiple ? "Tambah" : "Ganti") : "Pilih"}</button>
        <input ref={ref} type="file" hidden accept={accept} multiple={multiple} onChange={(e) => { add(e.target.files); e.target.value = ""; }} />
      </div>
    </div>
  );
}
