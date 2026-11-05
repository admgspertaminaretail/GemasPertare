"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Pencil, Plus, Power } from "lucide-react";
import { DataTable } from "../ui/DataTable";
import { ConfirmModal, Modal } from "../ui/Modal";
import { DemoTag } from "../ui/kit";
import { useToast } from "../ui/Toast";
import { api } from "@/lib/client";
import { fmtDateTime } from "@/lib/format";
import { ROLE_LABEL, RoleId } from "@/lib/constants";

type R = Record<string, string>;
const blank = { username: "", full_name: "", email: "", role_id: "ADMIN_SPBU", region_id: "", spbu_id: "", password: "" };

export function UsersView({ users, regions, spbus, meId }: { users: R[]; regions: R[]; spbus: { id: string; name: string; region_id: string }[]; meId: string }) {
  const router = useRouter();
  const toast = useToast();
  const [edit, setEdit] = useState<{ id?: string; form: typeof blank } | null>(null);
  const [tog, setTog] = useState<R | null>(null);
  const [busy, setBusy] = useState(false);
  const [spq, setSpq] = useState("");
  const run = async (fn: () => Promise<any>, ok: string, done: () => void) => {
    setBusy(true);
    try { await fn(); toast("success", ok); done(); router.refresh(); } catch (e: any) { toast("error", e.message); } finally { setBusy(false); }
  };
  const f = edit?.form;
  return (
    <>
      <DataTable rows={users} rowKey={(r) => r.user_id} pageSize={15} exportName="pengguna" searchPlaceholder="Cari nama, username, SPBU…"
        filters={[{ label: "Role", get: (r) => ROLE_LABEL[r.role_id as RoleId] || r.role_id }, { label: "Region", get: (r) => r.region_name }, { label: "Status", get: (r) => (r.is_active === "1" ? "Aktif" : "Nonaktif"), options: ["Aktif", "Nonaktif"] }]}
        toolbar={<button className="btn-primary btn-sm" onClick={() => { setEdit({ form: { ...blank } }); setSpq(""); }}><Plus className="h-4 w-4" />Tambah Pengguna</button>}
        columns={[
          { key: "username", header: "Username", render: (r) => <span className="font-mono text-xs">{r.username}{r.is_demo === "1" && <> <DemoTag /></>}</span>, value: (r) => r.username },
          { key: "full_name", header: "Nama" },
          { key: "role_id", header: "Role", render: (r) => ROLE_LABEL[r.role_id as RoleId], value: (r) => ROLE_LABEL[r.role_id as RoleId] },
          { key: "unit", header: "Lingkup", render: (r) => r.spbu_name || r.region_name || "Seluruh Region", value: (r) => r.spbu_name || r.region_name || "Seluruh Region" },
          { key: "last_login", header: "Login terakhir", render: (r) => (r.last_login ? fmtDateTime(r.last_login) : "-"), value: (r) => r.last_login },
          { key: "is_active", header: "Status", render: (r) => <span className={`chip ${r.is_active === "1" ? "bg-emerald-50 text-emerald-700 ring-emerald-200" : "bg-slate-100 text-slate-500 ring-slate-200"}`}>{r.is_active === "1" ? "Aktif" : "Nonaktif"}</span>, value: (r) => (r.is_active === "1" ? "Aktif" : "Nonaktif") },
          { key: "act", header: "Aksi", render: (r) => <div className="flex gap-1"><button className="btn-ghost btn-sm" aria-label="Ubah" onClick={() => { setEdit({ id: r.user_id, form: { username: r.username, full_name: r.full_name, email: r.email, role_id: r.role_id, region_id: r.region_id, spbu_id: r.spbu_id, password: "" } }); setSpq(""); }}><Pencil className="h-4 w-4" /></button>{r.user_id !== meId && <button className="btn-ghost btn-sm" aria-label="Aktif/nonaktif" onClick={() => setTog(r)}><Power className="h-4 w-4" /></button>}</div>, value: () => "" },
        ]} />

      <Modal open={!!edit} onClose={() => setEdit(null)} wide title={edit?.id ? "Ubah Pengguna" : "Tambah Pengguna"} footer={<><button className="btn-ghost" onClick={() => setEdit(null)} disabled={busy}>Batal</button><button className="btn-primary" disabled={busy} onClick={() => run(() => api("/api/master/users", edit!.id ? { action: "update", id: edit!.id, data: edit!.form } : { action: "create", data: edit!.form }), "Pengguna disimpan.", () => setEdit(null))}>{busy && <Loader2 className="h-4 w-4 animate-spin" />}Simpan</button></>}>
        {edit && f && (
          <div className="grid gap-3 sm:grid-cols-2">
            <div><label className="label">Username *</label><input className="input" value={f.username} onChange={(e) => setEdit({ ...edit, form: { ...f, username: e.target.value } })} /></div>
            <div><label className="label">Nama lengkap *</label><input className="input" value={f.full_name} onChange={(e) => setEdit({ ...edit, form: { ...f, full_name: e.target.value } })} /></div>
            <div><label className="label">Email</label><input className="input" type="email" value={f.email} onChange={(e) => setEdit({ ...edit, form: { ...f, email: e.target.value } })} /></div>
            <div><label className="label">Role *</label><select className="input" value={f.role_id} onChange={(e) => setEdit({ ...edit, form: { ...f, role_id: e.target.value, region_id: "", spbu_id: "" } })}>{(Object.keys(ROLE_LABEL) as RoleId[]).map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}</select></div>
            {f.role_id === "ADMIN_REGION" && <div className="sm:col-span-2"><label className="label">Region *</label><select className="input" value={f.region_id} onChange={(e) => setEdit({ ...edit, form: { ...f, region_id: e.target.value } })}><option value="">— pilih —</option>{regions.map((r) => <option key={r.region_id} value={r.region_id}>{r.region_name}</option>)}</select></div>}
            {f.role_id === "ADMIN_SPBU" && (
              <div className="sm:col-span-2"><label className="label">SPBU *</label>
                <input className="input mb-2" placeholder="Cari SPBU…" value={spq} onChange={(e) => setSpq(e.target.value)} />
                <select className="input" size={5} value={f.spbu_id} onChange={(e) => setEdit({ ...edit, form: { ...f, spbu_id: e.target.value } })}>{spbus.filter((s) => s.name.toLowerCase().includes(spq.toLowerCase())).slice(0, 80).map((s) => <option key={s.id} value={s.id}>{s.name} ({regions.find((r) => r.region_id === s.region_id)?.region_name})</option>)}</select></div>
            )}
            <div className="sm:col-span-2"><label className="label">{edit.id ? "Kata sandi baru (kosongkan jika tidak diubah)" : "Kata sandi *"}</label><input className="input" type="password" autoComplete="new-password" value={f.password} onChange={(e) => setEdit({ ...edit, form: { ...f, password: e.target.value } })} /><p className="mt-1 text-xs text-slate-500">Minimal 8 karakter, huruf dan angka.</p></div>
          </div>
        )}
      </Modal>
      <ConfirmModal open={!!tog} onClose={() => setTog(null)} busy={busy} danger={tog?.is_active === "1"} title={tog?.is_active === "1" ? "Nonaktifkan pengguna?" : "Aktifkan pengguna?"} message={tog ? `${tog.full_name} ${tog.is_active === "1" ? "tidak akan dapat login lagi." : "dapat login kembali."}` : ""} onConfirm={() => run(() => api("/api/master/users", { action: "toggle", id: tog!.user_id, active: tog!.is_active !== "1" }), "Status pengguna diperbarui.", () => setTog(null))} />
    </>
  );
}
