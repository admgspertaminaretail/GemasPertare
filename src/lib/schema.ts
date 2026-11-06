/**
 * Skema 18 tabel GEMAS. Setiap tabel = satu sheet di Google Sheets (atau satu array di db.json).
 * Kolom pertama selalu primary key. Data master, transaksi, file, pooling, MEMO, dan histori dipisah.
 */
export const SCHEMA = {
  ROLES: ["role_id", "role_name", "description"],
  USERS: [
    "user_id", "username", "full_name", "email", "password_hash", "role_id",
    "region_id", "spbu_id", "is_active", "is_demo", "created_at", "last_login",
  ],
  REGIONS: ["region_id", "region_name", "is_active"],
  SPBUS: [
    "spbu_id", "spbu_code", "name", "region_id", "province", "city", "address",
    "pic_name", "is_active", "created_at",
  ],
  SUBMISSIONS: [
    "submission_id", "spbu_id", "region_id", "submission_date", "description", "status",
    "current_revision", "submitted_by", "created_at", "updated_at", "last_review_note", "is_demo",
  ],
  SUBMISSION_DOCUMENTS: [
    "doc_id", "submission_id", "revision_id", "doc_type", "file_name", "mime", "size",
    "storage_ref", "uploaded_by", "uploaded_at", "is_current", "meta",
  ],
  SUBMISSION_PHOTOS: [
    "photo_id", "submission_id", "revision_id", "file_name", "mime", "size",
    "storage_ref", "uploaded_by", "uploaded_at", "is_current",
  ],
  SUBMISSION_REVISION_HISTORY: [
    "revision_id", "submission_id", "revision_no", "requested_note", "requested_by",
    "requested_by_name", "requested_at", "resubmitted_at", "resubmitted_by", "resubmit_note",
  ],
  SUBMISSION_STATUS_HISTORY: [
    "history_id", "submission_id", "from_status", "to_status", "changed_by",
    "changed_by_name", "changed_by_role", "changed_at", "note",
  ],
  REGIONAL_POOLINGS: [
    "pooling_id", "fupa_number", "pooling_date", "region_id", "notes", "status",
    "created_by", "created_at", "cancelled_at", "cancel_reason",
  ],
  REGIONAL_POOLING_ITEMS: ["item_id", "pooling_id", "submission_id", "spbu_id", "status", "added_at"],
  REGIONAL_MEMOS: [
    "memo_id", "memo_number", "memo_date", "region_id", "notes", "created_by", "created_at",
  ],
  MEMO_POOLING_ITEMS: ["id", "memo_id", "pooling_id"],
  MEMO_FORWARDING: [
    "forwarding_id", "memo_id", "status", "forwarded_date", "notes", "updated_by", "updated_at",
  ],
  KNOWLEDGE_DOCUMENTS: [
    "doc_id", "title", "category", "description", "version", "status", "managed_by",
    "uploaded_at", "file_name", "mime", "size", "storage_ref", "use_for_ai", "ai_status", "is_demo",
  ],
  TEMPLATES: [
    "template_id", "name", "category", "version", "description", "usage_info", "status",
    "updated_at", "updated_by", "file_name", "mime", "size", "storage_ref", "is_demo",
  ],
  AI_KNOWLEDGE_BASE: ["chunk_id", "doc_id", "doc_title", "doc_version", "page", "chunk_index", "text", "created_at"],
  ACTIVITY_LOGS: [
    "log_id", "timestamp", "user_id", "user_name", "role_id", "action", "entity_type", "entity_id", "details",
  ],
  FILE_INDEX: [
    "file_id", "title", "category", "entity_id", "file_name", "mime_type",
    "size_bytes", "storage_ref", "file_url", "uploaded_by", "timestamp",
  ],
} as const;

export type TableName = keyof typeof SCHEMA;
export type Row = Record<string, string>;
export const TABLES = Object.keys(SCHEMA) as TableName[];
export const PK: Record<TableName, string> = Object.fromEntries(
  TABLES.map((t) => [t, SCHEMA[t][0]])
) as Record<TableName, string>;

export function normalize(t: TableName, r: Partial<Row>): Row {
  const out: Row = {};
  for (const c of SCHEMA[t]) {
    const v = (r as Row)[c];
    out[c] = v === undefined || v === null ? "" : String(v);
  }
  return out;
}
