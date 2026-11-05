"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { FileUp, Loader2, Pencil, Plus, Power } from "lucide-react";
import { DataTable } from "../ui/DataTable";
import { ConfirmModal, Modal } from "../ui/Modal";
import { useToast } from "../ui/Toast";
import { api } from "@/lib/client";

type R = Record<string, string>;
const blank = { spbu_id: "", spbu_code: "", name: "", region_id: "", province: "", city: "", address: "", pic_name: "" };

export function MasterView({ spbus, regions }: { spbus: R[]; regions: R[] }) {
  const router = useRouter();
  const toast = useToast();
  const [tab, setTab] = useState<"spbu" | "region">("spbu");
  const [edit, setEdit] = useState<{ id?: string; form: typeof blank } | null>(null);
  const [tog, setTog] = useState<R | null>(null);
  const [imp, setImp] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [report, setReport] = useState<any>(null);
  const [reg, setReg] = useState<{ id?: string; name: string; active: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const run = async (fn: () => Promise<any>, ok: string, done: () => void) => {
    setBusy(true);
    try { await fn(); toast("success", ok); done(); router.refresh(); } catch (e: any) { toast("error", e.message); } finally { setBusy(false); }
  };
  const regionName = (id: string) => regions.find((r) => r.region_id === id)?.region_name || id;

  return (
    <div className="space-y-4">
      <div className="flex gap-1 rounded-2xl bg-white p-1.5 shadow-card ring-1 ring-slate-100">
        {([["spbu", `SPBU (${spbus.length})`], ["region", `Region (${regions.length})`]] as const).map(([id, l]) => (
          <button key={id} onClick={() => setTab(id)} className={`flex-1 rounded-xl px-4 py-2.5 text-sm font-semibold ${tab === id ? "bg-brand text-white" : "text-navy hover:bg-softblue"}`}>{l}</button>
        ))}
      </div>

      {tab === "spbu" ? (
        <DataTable rows={spbus} rowKey={(r) => r.spbu_id} exportName="master-spbu" pageSize={15} searchPlaceholder="Cari nama, kode, kota, ID…"
          filters={[{ label: "Region", get: (r) => r.region_name }, { label: "Status", get: (r) => (r.is_active === "1" ? "Aktif" : "Nonaktif"), options: ["Aktif", "Nonaktif"] }]}
          toolbar={<><button className="btn-ghost btn-sm" onClick={() => { setImp(true); setFile(null); setReport(null); }}><FileUp className="h-4 w-4" />Import Excel</button><button className="btn-primary btn-sm" onClick={() => setEdit({ form: { ...blank, region_id: regions[0]?.region_id || "" } })}><Plus className="h-4 w-4" />Tambah SPBU</button></>}
          columns={[
            { key: "spbu_code", header: "Kode SPBU" },
            { key: "spbu_id", header: "ID" },
            { key: "name", header: "Nama SPBU" },
            { key: "region_name", header: "Region" },
            { key: "city", header: "Kota/Kab." },
            { key: "pic_name", header: "PIC SPBU" },
            { key: "is_active", header: "Status", render: (r) => <span className={`chip ${r.is_active === "1" ? "bg-emerald-50 text-emerald-700 ring-emerald-200" : "bg-slate-100 text-slate-500 ring-slate-200"}`}>{r.is_active === "1" ? "Aktif" : "Nonaktif"}</span>, value: (r) => (r.is_active === "1" ? "Aktif" : "Nonaktif") },
            { key: "act", header: "Aksi", render: (r) => <div className="flex gap-1"><button className="btn-ghost btn-sm" aria-label="Ubah" onClick={() => setEdit({ id: r.spbu_id, form: { spbu_id: r.spbu_id, spbu_code: r.spbu_code, name: r.name, region_id: r.region_id, province: r.province, city: r.city, address: r.address, pic_name: r.pic_name } })}><Pencil className="h-4 w-4" /></button><button className="btn-ghost btn-sm" aria-label="Aktif/nonaktif" onClick={() => setTog(r)}><Power className="h-4 w-4" /></button></div>, value: () => "" },
          ]} />
      ) : (
        <DataTable rows={regions} rowKey={(r) => r.region_id} pageSize={10}
          toolbar={<button className="btn-primary btn-sm" onClick={() => setReg({ name: "", active: "1" })}><Plus className="h-4 w-4" />Tambah Region</button>}
          columns={[
            { key: "region_id", header: "ID" }, { key: "region_name", header: "Nama Region" },
            { key: "n", header: "Jumlah SPBU", align: "right", value: (r) => spbus.filter((s) => s.region_id === r.region_id && s.is_active === "1").length },
            { key: "is_active", header: "Status", render: (r) => (r.is_active === "1" ? "Aktif" : "Nonaktif"), value: (r) => (r.is_active === "1" ? "Aktif" : "Nonaktif") },
            { key: "act", header: "Aksi", render: (r) => <button className="btn-ghost btn-sm" onClick={() => setReg({ id: r.region_id, name: r.region_name, active: r.is_active })}><Pencil className="h-4 w-4" /></button>, value: () => "" },
          ]} />
      )}

      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? "Ubah SPBU" : "Tambah SPBU"} wide footer={<><button className="btn-ghost" onClick={() => setEdit(null)} disabled={busy}>Batal</button><button className="btn-primary" disabled={busy} onClick={() => run(() => api("/api/master/spbus", edit!.id ? { action: "update", id: edit!.id, data: edit!.form } : { action: "create", data: edit!.form }), "Data SPBU disimpan.", () => setEdit(null))}>{busy && <Loader2 className="h-4 w-4 animate-spin" />}Simpan</button></>}>
        {edit && (
          <div className="grid gap-3 sm:grid-cols-2">
            {([["spbu_id", "ID SPBU (Station ID) *", !!edit.id], ["spbu_code", "Kode SPBU (Station No) *"], ["name", "Nama SPBU *"], ["pic_name", "PIC SPBU"], ["province", "Provinsi"], ["city", "Kota/Kabupaten"]] as [keyof typeof blank, string, boolean?][]).map(([k, l, dis]) => (
              <div key={k}><label className="label">{l}</label><input className="input" disabled={dis} value={edit.form[k]} onChange={(e) => setEdit({ ...edit, form: { ...edit.form, [k]: e.target.value } })} /></div>
            ))}
            <div><label className="label">Region *</label><select className="input" value={edit.form.region_id} onChange={(e) => setEdit({ ...edit, form: { ...edit.form, region_id: e.target.value } })}>{regions.map((r) => <option key={r.region_id} value={r.region_id}>{r.region_name}</option>)}</select></div>
            <div className="sm:col-span-2"><label className="label">Alamat</label><textarea className="input min-h-[60px]" value={edit.form.address} onChange={(e) => setEdit({ ...edit, form: { ...edit.form, address: e.target.value } })} /></div>
          </div>
        )}
      </Modal>

      <ConfirmModal open={!!tog} onClose={() => setTog(null)} busy={busy} danger={tog?.is_active === "1"} title={tog?.is_active === "1" ? "Nonaktifkan SPBU?" : "Aktifkan SPBU?"} message={tog ? `${tog.name} ${tog.is_active === "1" ? "tidak akan dihitung pada total SPBU dan dashboard. Riwayat pengajuan tetap tersimpan." : "akan kembali dihitung pada dashboard."}` : ""} onConfirm={() => run(() => api("/api/master/spbus", { action: "toggle", id: tog!.spbu_id, active: tog!.is_active !== "1" }), "Status SPBU diperbarui.", () => setTog(null))} />

      <Modal open={imp} onClose={() => setImp(false)} title="Import Excel SPBU" footer={<><button className="btn-ghost" onClick={() => setImp(false)}>Tutup</button><button className="btn-primary" disabled={!file || busy} onClick={async () => { const fd = new FormData(); fd.set("file", file!); setBusy(true); try { const r = await api("/api/master/spbus/import", fd); setReport(r.report); toast("success", `${r.report.added} SPBU ditambahkan.`); router.refresh(); } catch (e: any) { toast("error", e.message); } finally { setBusy(false); } }}>{busy && <Loader2 className="h-4 w-4 animate-spin" />}Import</button></>}>
        <p className="mb-3 text-sm text-slate-600">Kolom yang dibaca: <b>Station No, Station ID, Region, Station Name, Provinsi, Kota/Kabupaten, Address</b>. Data dengan Station ID atau Kode yang sudah ada dilewati (tidak ditimpa).</p>
        <input type="file" accept=".xlsx" className="input" onChange={(e) => setFile(e.target.files?.[0] || null)} />
        {report && (
          <div className="mt-4 space-y-2 rounded-xl bg-cloud p-3 text-sm">
            <p><b className="text-prtgreen">{report.added}</b> SPBU baru ditambahkan.</p>
            {report.newRegions.length > 0 && <p>Region baru: {report.newRegions.join(", ")}</p>}
            {report.duplicates.length > 0 && <details><summary className="cursor-pointer font-semibold text-amber-700">{report.duplicates.length} duplikat dilewati</summary><ul className="mt-1 max-h-40 list-disc overflow-auto pl-5 text-xs">{report.duplicates.map((d: string) => <li key={d}>{d}</li>)}</ul></details>}
            {report.errors.length > 0 && <details open><summary className="cursor-pointer font-semibold text-prtred">{report.errors.length} baris bermasalah</summary><ul className="mt-1 max-h-40 list-disc overflow-auto pl-5 text-xs">{report.errors.map((d: string) => <li key={d}>{d}</li>)}</ul></details>}
          </div>
        )}
      </Modal>

      <Modal open={!!reg} onClose={() => setReg(null)} title={reg?.id ? "Ubah Region" : "Tambah Region"} footer={<><button className="btn-ghost" onClick={() => setReg(null)}>Batal</button><button className="btn-primary" disabled={busy || !reg?.name} onClick={() => run(() => api("/api/master/spbus", reg!.id ? { action: "region_update", id: reg!.id, data: { region_name: reg!.name, is_active: reg!.active } } : { action: "region_create", data: { region_name: reg!.name } }), "Region disimpan.", () => setReg(null))}>Simpan</button></>}>
        {reg && <div className="space-y-3"><div><label className="label">Nama Region *</label><input className="input" value={reg.name} onChange={(e) => setReg({ ...reg, name: e.target.value })} placeholder="mis. Region VIII" /></div>
          {reg.id && <div><label className="label">Status</label><select className="input" value={reg.active} onChange={(e) => setReg({ ...reg, active: e.target.value })}><option value="1">Aktif</option><option value="0">Nonaktif</option></select></div>}</div>}
      </Modal>
      <span hidden>{regionName("")}</span>
    </div>
  );
}
