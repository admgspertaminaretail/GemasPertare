"use client";
import { DataTable } from "../ui/DataTable";
import { StatusBadge } from "../ui/kit";
import { fmtDate } from "@/lib/format";
import { STATUS_LIST } from "@/lib/constants";

export function SubmissionTable({ rows, showSpbu = true, showRegion = false, exportName = "pengajuan", emptyText }: { rows: any[]; showSpbu?: boolean; showRegion?: boolean; exportName?: string; emptyText?: string }) {
  return (
    <DataTable
      rows={rows} rowKey={(r) => r.submission_id} rowHref={(r) => `/submissions/${r.submission_id}`} exportName={exportName}
      searchPlaceholder="Cari ID, SPBU, nomor FUPA/MEMO…" emptyTitle="Belum ada pengajuan" emptyText={emptyText}
      filters={[{ label: "Status", get: (r) => r.status, options: STATUS_LIST }, ...(showRegion ? [{ label: "Region", get: (r: any) => r.region_name }] : [])]}
      columns={[
        { key: "submission_id", header: "ID Pengajuan" },
        ...(showSpbu ? [{ key: "spbu_name", header: "SPBU", render: (r: any) => <span>{r.spbu_name}<span className="block text-[11px] text-slate-400">{r.spbu_code}</span></span>, value: (r: any) => r.spbu_name }] : []),
        ...(showRegion ? [{ key: "region_name", header: "Region" }] : []),
        { key: "submission_date", header: "Tanggal", render: (r: any) => fmtDate(r.submission_date) },
        { key: "status", header: "Status", render: (r: any) => <StatusBadge status={r.status} /> },
        { key: "current_revision", header: "Revisi", align: "center", render: (r: any) => (Number(r.current_revision) ? `R${r.current_revision}` : "-"), value: (r: any) => Number(r.current_revision) },
        { key: "fupa_number", header: "Nomor FUPA" },
        { key: "memo_number", header: "Nomor MEMO" },
      ]}
    />
  );
}
