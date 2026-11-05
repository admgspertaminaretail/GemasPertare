"use client";
import { DataTable } from "../ui/DataTable";
import { fmtDateTime } from "@/lib/format";
import { ROLE_LABEL, RoleId } from "@/lib/constants";

type R = Record<string, string>;
export function ActivityView({ logs }: { logs: R[] }) {
  return (
    <DataTable rows={logs} rowKey={(r) => r.log_id} pageSize={20} exportName="audit-trail" searchPlaceholder="Cari pengguna, aktivitas, data terpengaruh…"
      filters={[
        { label: "Aktivitas", get: (r) => r.action },
        { label: "Role", get: (r) => ROLE_LABEL[r.role_id as RoleId] || r.role_id },
        { label: "Jenis data", get: (r) => r.entity_type },
      ]}
      columns={[
        { key: "timestamp", header: "Waktu", render: (r) => fmtDateTime(r.timestamp), value: (r) => r.timestamp },
        { key: "user_name", header: "Pengguna" },
        { key: "role_id", header: "Role", render: (r) => ROLE_LABEL[r.role_id as RoleId] || r.role_id, value: (r) => ROLE_LABEL[r.role_id as RoleId] || r.role_id },
        { key: "action", header: "Aktivitas", render: (r) => <span className="chip bg-softblue text-brand ring-blue-100">{r.action}</span>, value: (r) => r.action },
        { key: "entity", header: "Data Terpengaruh", render: (r) => <span><b>{r.entity_type}</b> {r.entity_id}</span>, value: (r) => `${r.entity_type} ${r.entity_id}` },
        { key: "details", header: "Keterangan", className: "max-w-[360px] truncate" },
      ]} />
  );
}
