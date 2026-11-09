export const fmtDate = (s?: string) => {
  if (!s) return "-";
  const d = new Date(s.length === 10 ? s + "T00:00:00" : s);
  if (isNaN(d.getTime())) return s;
  return d.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Jakarta" });
};
export const fmtDateTime = (s?: string) => {
  if (!s) return "-";
  const d = new Date(s);
  if (isNaN(d.getTime())) return s;
  return d.toLocaleString("id-ID", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" }) + " WIB";
};
export const fmtSize = (n: string | number) => {
  const b = Number(n) || 0;
  return b > 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`;
};
export const todayStr = () => new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Jakarta" });

const MONTHS_ID = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

export const fmtPeriod = (ym?: string) => {
  if (!ym) return "-";
  const m = /^(\d{4})-(\d{2})$/.exec(ym);
  if (!m) return ym;
  return `${MONTHS_ID[Number(m[2]) - 1] || m[2]} ${m[1]}`;
};
