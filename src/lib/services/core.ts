import { getStore } from "../db";
import { SessionUser, HttpError } from "../auth";
import { Row } from "../schema";

export const nowIso = () => new Date().toISOString();
export const today = () => new Date().toISOString().slice(0, 10);

export function nextId(prefix: string, rows: Row[], key: string, width = 3) {
  let max = 0;
  const re = new RegExp(`^${prefix}-(\\d+)$`);
  for (const r of rows) {
    const m = re.exec(r[key]);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return `${prefix}-${String(max + 1).padStart(width, "0")}`;
}

export async function logActivity(
  u: Pick<SessionUser, "userId" | "name" | "role"> | null,
  action: string,
  entityType: string,
  entityId: string,
  details = ""
) {
  const store = await getStore();
  await store.insert("ACTIVITY_LOGS", [
    {
      log_id: `LOG-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`.toUpperCase(), timestamp: nowIso(),
      user_id: u?.userId || "SYSTEM", user_name: u?.name || "Sistem", role_id: u?.role || "SYSTEM",
      action, entity_type: entityType, entity_id: entityId, details,
    },
  ]);
}

/** Hak akses terhadap data pengajuan berdasarkan role dan lingkup organisasi (selalu dicek di server). */
export function canAccessScope(u: SessionUser, regionId: string, spbuId?: string) {
  if (u.role === "ADMIN_PAM") return true;
  if (u.role === "ADMIN_REGION") return u.regionId === regionId;
  return u.spbuId === spbuId;
}
export function assertScope(u: SessionUser, regionId: string, spbuId?: string) {
  if (!canAccessScope(u, regionId, spbuId)) throw new HttpError(403, "Data berada di luar lingkup akses Anda.");
}
export const isOn = (v: string) => v === "1" || v === "true";
