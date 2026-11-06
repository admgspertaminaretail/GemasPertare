export const APP_NAME = "GEMAS";
export const APP_FULL_NAME = "General Services Monitoring & Archive System";
export const TAGLINE = "Pengelolaan Arsip Lebih Mudah, Terstruktur, dan Terpantau.";

export type RoleId = "ADMIN_SPBU" | "ADMIN_REGION" | "ADMIN_PAM";
export const ROLE_LABEL: Record<RoleId, string> = {
  ADMIN_SPBU: "Admin SPBU",
  ADMIN_REGION: "PIC Region",
  ADMIN_PAM: "Admin PAM / Head Office",
};

export const STATUS = {
  UPLOADED: "PIC SPBU Sudah Upload",
  REVIEW: "PIC Region Perlu Review",
  REVISION: "Perlu Revisi",
  APPROVED: "Disetujui",
  POOLED: "Sudah Masuk Pooling",
  MEMOED: "Sudah Di-Memo",
} as const;
export type StatusValue = (typeof STATUS)[keyof typeof STATUS];
export const STATUS_LIST: StatusValue[] = Object.values(STATUS);

/** Kelas warna badge status, konsisten di seluruh aplikasi. */
export const STATUS_STYLE: Record<StatusValue, string> = {
  [STATUS.UPLOADED]: "bg-slate-100 text-slate-700 ring-slate-200",
  [STATUS.REVIEW]: "bg-amber-50 text-amber-800 ring-amber-200",
  [STATUS.REVISION]: "bg-red-50 text-prtred ring-red-200",
  [STATUS.APPROVED]: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  [STATUS.POOLED]: "bg-blue-50 text-brand ring-blue-200",
  [STATUS.MEMOED]: "bg-navy text-white ring-navy",
};

export const FORWARD = { NO: "Belum Diteruskan", YES: "Sudah Diteruskan" } as const;

export const DOC_TYPE = { EXCEL: "EXCEL", FUPA: "FUPA_PDF" } as const;

export const KNOWLEDGE_CATEGORIES = [
  "Pedoman",
  "TKI",
  "Jadwal Retensi (JRDP)",
  "Buku Saku",
  "Sprint (Surat Perintah)",
  "Manual Book",
  "Lainnya",
];
export const TEMPLATE_CATEGORIES = ["Data i-BOS", "Form FUPA", "Daftar Arsip", "Lainnya"];

export const DEMO_PASSWORD = "gemas123";
