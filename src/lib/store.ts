import fs from "fs";
import path from "path";
import { Row, SCHEMA, TABLES, TableName, PK } from "./schema";

/** Abstraksi database. Dua adapter: file JSON lokal (demo/dev) dan Google Sheets (produksi awal). */
export interface Store {
  readonly driver: "local" | "sheets";
  list(t: TableName): Promise<Row[]>;
  insert(t: TableName, rows: Row[]): Promise<void>;
  update(t: TableName, id: string, patch: Partial<Row>): Promise<void>;
  replaceAll(t: TableName, rows: Row[]): Promise<void>;
  deleteWhere(t: TableName, pred: (r: Row) => boolean): Promise<void>;
}

export function normalize(t: TableName, r: Partial<Row>): Row {
  const out: Row = {};
  for (const c of SCHEMA[t]) {
    const v = (r as Row)[c];
    out[c] = v === undefined || v === null ? "" : String(v);
  }
  return out;
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
  async list(t: TableName) {
    return this.db[t].map((r) => ({ ...r }));
  }
  async insert(t: TableName, rows: Row[]) {
    this.db[t].push(...rows.map((r) => normalize(t, r)));
    this.persist();
  }
  async update(t: TableName, id: string, patch: Partial<Row>) {
    const row = this.db[t].find((r) => r[PK[t]] === id);
    if (!row) throw new Error(`${t}: ${id} tidak ditemukan`);
    Object.assign(row, normalize(t, { ...row, ...patch }));
    this.persist();
  }
  async replaceAll(t: TableName, rows: Row[]) {
    this.db[t] = rows.map((r) => normalize(t, r));
    this.persist();
  }
  async deleteWhere(t: TableName, pred: (r: Row) => boolean) {
    this.db[t] = this.db[t].filter((r) => !pred(r));
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

export class SheetsStore implements Store {
  readonly driver = "sheets" as const;
  private cache = new Map<TableName, { at: number; rows: Row[] }>();
  private sheetsApi: any;
  private id: string;
  constructor() {
    const id = process.env.GOOGLE_SHEETS_ID;
    const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    const key = (process.env.GOOGLE_PRIVATE_KEY || "").replace(/\\n/g, "\n");
    if (!id || !email || !key) throw new Error("Konfigurasi Google Sheets belum lengkap (GOOGLE_SHEETS_ID / SERVICE_ACCOUNT).");
    this.id = id;
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { google } = require("googleapis");
    const auth = new google.auth.JWT(email, undefined, key, [
      "https://www.googleapis.com/auth/spreadsheets",
    ]);
    this.sheetsApi = google.sheets({ version: "v4", auth });
  }

  /** Membuat tab + header untuk seluruh tabel yang belum ada. */
  async ensureSchema() {
    const meta = await this.sheetsApi.spreadsheets.get({ spreadsheetId: this.id });
    const existing = new Set<string>(meta.data.sheets.map((s: any) => s.properties.title));
    const requests = TABLES.filter((t) => !existing.has(t)).map((t) => ({ addSheet: { properties: { title: t } } }));
    if (requests.length) await this.sheetsApi.spreadsheets.batchUpdate({ spreadsheetId: this.id, requestBody: { requests } });
    for (const t of TABLES) {
      if (existing.has(t)) continue;
      await this.sheetsApi.spreadsheets.values.update({
        spreadsheetId: this.id,
        range: `${t}!A1`,
        valueInputOption: "RAW",
        requestBody: { values: [[...SCHEMA[t]]] },
      });
    }
  }

  private async fetch(t: TableName): Promise<Row[]> {
    const c = this.cache.get(t);
    if (c && Date.now() - c.at < 2000) return c.rows;
    const res = await this.sheetsApi.spreadsheets.values.get({
      spreadsheetId: this.id,
      range: `${t}!A2:${colLetter(SCHEMA[t].length)}`,
      valueRenderOption: "UNFORMATTED_VALUE",
    });
    const rows: Row[] = (res.data.values || [])
      .filter((v: any[]) => v && v.length && String(v[0] ?? "") !== "")
      .map((v: any[]) => {
        const o: Row = {};
        SCHEMA[t].forEach((col, i) => (o[col] = v[i] === undefined || v[i] === null ? "" : String(v[i])));
        return o;
      });
    this.cache.set(t, { at: Date.now(), rows });
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
    this.cache.delete(t);
  }
  async update(t: TableName, id: string, patch: Partial<Row>) {
    this.cache.delete(t);
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
    this.cache.delete(t);
  }
  async replaceAll(t: TableName, rows: Row[]) {
    await this.sheetsApi.spreadsheets.values.clear({ spreadsheetId: this.id, range: `${t}!A2:${colLetter(SCHEMA[t].length)}` });
    this.cache.delete(t);
    // append dalam potongan agar tidak melebihi batas payload
    for (let i = 0; i < rows.length; i += 500) await this.insert(t, rows.slice(i, i + 500));
  }
  async deleteWhere(t: TableName, pred: (r: Row) => boolean) {
    const rows = (await this.fetch(t)).filter((r) => !pred(r));
    await this.replaceAll(t, rows);
  }
}
