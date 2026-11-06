import fs from "fs";
import path from "path";
import { Row, SCHEMA, TABLES, TableName, PK, normalize } from "./schema";
import { getActiveSheetsId, getGoogleClients } from "./google";
export { normalize };

/** Abstraksi database. Dua adapter: file JSON lokal (demo/dev) dan Google Sheets (produksi awal). */
export interface Store {
  readonly driver: "local" | "sheets";
  list(t: TableName): Promise<Row[]>;
  insert(t: TableName, rows: Row[]): Promise<void>;
  update(t: TableName, id: string, patch: Partial<Row>): Promise<void>;
  replaceAll(t: TableName, rows: Row[]): Promise<void>;
  deleteWhere(t: TableName, pred: (r: Row) => boolean): Promise<void>;
}

/* ------------------------------ Local JSON ------------------------------ */
const DATA_DIR = process.env.VERCEL ? "/tmp/gemas" : path.join(process.cwd(), "data");
export const UPLOAD_DIR = path.join(DATA_DIR, "uploads");
const DB_FILE = path.join(DATA_DIR, "db.json");

export class LocalStore implements Store {
  readonly driver = "local" as const;
  private db: Record<TableName, Row[]>;
  constructor(db: Record<TableName, Row[]>) {
    this.db = db;
  }
  static exists() {
    return fs.existsSync(DB_FILE);
  }
  static load(): LocalStore {
    const raw = JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
    for (const t of TABLES) raw[t] = raw[t] || [];
    return new LocalStore(raw);
  }
  persist() {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    const tmp = DB_FILE + ".tmp";
    fs.writeFileSync(tmp, JSON.stringify(this.db));
    fs.renameSync(tmp, DB_FILE);
  }
  private table(t: TableName): Row[] {
    if (!Array.isArray(this.db[t])) this.db[t] = [];
    return this.db[t];
  }
  async list(t: TableName) {
    return this.table(t).map((r) => ({ ...r }));
  }
  async insert(t: TableName, rows: Row[]) {
    this.table(t).push(...(rows || []).map((r) => normalize(t, r)));
    this.persist();
  }
  async update(t: TableName, id: string, patch: Partial<Row>) {
    const row = this.table(t).find((r) => r[PK[t]] === id);
    if (!row) throw new Error(`${t}: ${id} tidak ditemukan`);
    Object.assign(row, normalize(t, { ...row, ...patch }));
    this.persist();
  }
  async replaceAll(t: TableName, rows: Row[]) {
    this.db[t] = (rows || []).map((r) => normalize(t, r));
    this.persist();
  }
  async deleteWhere(t: TableName, pred: (r: Row) => boolean) {
    this.db[t] = this.table(t).filter((r) => !pred(r));
    this.persist();
  }
}

/* ----------------------------- Google Sheets ---------------------------- */
function colLetter(n: number) {
  let s = "";
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

const SHEETS_CACHE_TTL_MS = 5000;

export class SheetsStore implements Store {
  readonly driver = "sheets" as const;
  private cache = new Map<TableName, { at: number; rows: Row[] }>();
  private invalidatedAt = new Map<TableName, number>();
  private batchInflight: Promise<void> | null = null;
  private sheetsApi: any;
  private id: string;
  constructor(spreadsheetId?: string) {
    const id = spreadsheetId || getActiveSheetsId();
    if (!id) throw new Error("GOOGLE_SHEETS_ID belum diatur. Jalankan Inisialisasi Otomatis di menu Database & Cloud terlebih dahulu.");
    this.id = id;
    this.sheetsApi = getGoogleClients().sheets;
  }

  /** Membuat tab + menyinkronkan baris header seluruh tabel di Google Sheets. */
  async ensureSchema() {
    const meta = await this.sheetsApi.spreadsheets.get({ spreadsheetId: this.id });
    const existing = new Set<string>(meta.data.sheets.map((s: any) => s.properties.title));
    const requests = TABLES.filter((t) => !existing.has(t)).map((t) => ({ addSheet: { properties: { title: t } } }));
    if (requests.length) await this.sheetsApi.spreadsheets.batchUpdate({ spreadsheetId: this.id, requestBody: { requests } });
    await this.sheetsApi.spreadsheets.values.batchUpdate({
      spreadsheetId: this.id,
      requestBody: {
        valueInputOption: "RAW",
        data: TABLES.map((t) => ({
          range: `${t}!A1`,
          values: [[...SCHEMA[t]]],
        })),
      },
    });
  }

  private parseSheetValues(t: TableName, values: any[][] | undefined): Row[] {
    return (values || [])
      .filter((v: any[]) => v && v.length && String(v[0] ?? "") !== "")
      .map((v: any[]) => {
        const o: Row = {};
        SCHEMA[t].forEach((col, i) => (o[col] = v[i] === undefined || v[i] === null ? "" : String(v[i])));
        return o;
      });
  }

  private invalidate(t: TableName) {
    this.invalidatedAt.set(t, Date.now());
    this.cache.delete(t);
  }

  private isFresh(t: TableName): boolean {
    const c = this.cache.get(t);
    return !!c && Date.now() - c.at < SHEETS_CACHE_TTL_MS;
  }

  private async fetch(t: TableName): Promise<Row[]> {
    if (this.isFresh(t)) return this.cache.get(t)!.rows;

    const staleTables = TABLES.filter((tb) => !this.isFresh(tb));
    if (staleTables.length > 1) {
      if (!this.batchInflight) {
        const targets = [...staleTables];
        const startedAt = Date.now();
        this.batchInflight = (async () => {
          try {
            const res = await this.sheetsApi.spreadsheets.values.batchGet({
              spreadsheetId: this.id,
              ranges: targets.map((tb) => `${tb}!A2:${colLetter(SCHEMA[tb].length)}`),
              valueRenderOption: "UNFORMATTED_VALUE",
            });
            const ranges = res.data.valueRanges || [];
            const now = Date.now();
            targets.forEach((tb, idx) => {
              if ((this.invalidatedAt.get(tb) || 0) <= startedAt) {
                this.cache.set(tb, { at: now, rows: this.parseSheetValues(tb, ranges[idx]?.values) });
              }
            });
          } finally {
            this.batchInflight = null;
          }
        })();
      }
      await this.batchInflight;
      if (this.cache.has(t)) return this.cache.get(t)!.rows;
    }

    const startedAt = Date.now();
    const res = await this.sheetsApi.spreadsheets.values.get({
      spreadsheetId: this.id,
      range: `${t}!A2:${colLetter(SCHEMA[t].length)}`,
      valueRenderOption: "UNFORMATTED_VALUE",
    });
    const rows = this.parseSheetValues(t, res.data.values);
    if ((this.invalidatedAt.get(t) || 0) <= startedAt) {
      this.cache.set(t, { at: Date.now(), rows });
    }
    return rows;
  }
  async list(t: TableName) {
    return (await this.fetch(t)).map((r) => ({ ...r }));
  }
  async insert(t: TableName, rows: Row[]) {
    if (!rows.length) return;
    const values = rows.map((r) => SCHEMA[t].map((c) => normalize(t, r)[c]));
    await this.sheetsApi.spreadsheets.values.append({
      spreadsheetId: this.id,
      range: `${t}!A1`,
      valueInputOption: "RAW",
      insertDataOption: "INSERT_ROWS",
      requestBody: { values },
    });
    this.invalidate(t);
  }
  async update(t: TableName, id: string, patch: Partial<Row>) {
    this.invalidate(t);
    const rows = await this.fetch(t);
    const idx = rows.findIndex((r) => r[PK[t]] === id);
    if (idx < 0) throw new Error(`${t}: ${id} tidak ditemukan`);
    const merged = normalize(t, { ...rows[idx], ...patch });
    await this.sheetsApi.spreadsheets.values.update({
      spreadsheetId: this.id,
      range: `${t}!A${idx + 2}:${colLetter(SCHEMA[t].length)}${idx + 2}`,
      valueInputOption: "RAW",
      requestBody: { values: [SCHEMA[t].map((c) => merged[c])] },
    });
    this.invalidate(t);
  }
  async replaceAll(t: TableName, rows: Row[]) {
    await this.sheetsApi.spreadsheets.values.clear({ spreadsheetId: this.id, range: `${t}!A2:${colLetter(SCHEMA[t].length)}` });
    this.invalidate(t);
    // append dalam potongan agar tidak melebihi batas payload
    for (let i = 0; i < rows.length; i += 500) await this.insert(t, rows.slice(i, i + 500));
  }
  async deleteWhere(t: TableName, pred: (r: Row) => boolean) {
    const rows = (await this.fetch(t)).filter((r) => !pred(r));
    await this.replaceAll(t, rows);
  }
}
