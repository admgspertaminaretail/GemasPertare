# GEMAS — General Services Monitoring & Archive System
PT Pertamina Retail · *Pengelolaan Arsip Lebih Mudah, Terstruktur, dan Terpantau.*

Aplikasi web internal untuk pengelolaan arsip: pusat informasi, template, pengajuan usul musnah (SPBU → Region), pooling FUPA Regional, pencatatan MEMO, dashboard monitoring, dan asisten AI **Tanya si GEMAS** (RAG).

## Menjalankan (lokal / demo)
```bash
npm install
cp .env.example .env.local     # ubah AUTH_SECRET
npm run dev                    # http://localhost:3000
```
Pada start pertama GEMAS membuat `data/db.json` dari **data SPBU asli** (`data/spbu_master.json`, hasil impor `DATABASE_SPBU.xlsx`: 174 SPBU unik di 7 Region) ditambah **data demo** pengajuan/pooling/MEMO (diberi label *Data Demo*). Hapus `data/db.json` untuk mereset.

Akun demo (kata sandi `gemas123`, tampil di halaman login selama `DEMO_MODE=true`):
`pam.demo` (Admin PAM), `region1.demo` … `region7.demo` (PIC Region), `spbu<StationID>` (Admin SPBU, mis. `spbu11201101`).

> **Produksi:** set `DEMO_MODE=false`, ganti `AUTH_SECRET`, dan nonaktifkan/hapus seluruh akun demo dari menu Pengguna.

## Logo resmi
Letakkan logo resmi Pertamina Retail (tanpa diubah) di `public/brand/logo-pertamina-retail.png`. Logo muncul otomatis di header. Aplikasi tidak membuat ulang logo.

## Arsitektur
| Lapisan | Implementasi |
|---|---|
| UI | Next.js 14 (App Router) + TypeScript + Tailwind, Recharts, ilustrasi SVG semi-isometrik buatan sendiri |
| Auth | Cookie sesi JWT (httpOnly, 8 jam) + bcrypt; user diverifikasi ulang ke DB di setiap request; throttle login |
| RBAC | `Admin SPBU` / `PIC Region` / `Admin PAM`; **semua pemeriksaan lingkup di server** (`src/lib/services/*`), middleware menutup seluruh rute selain `/login` |
| Database | `src/lib/store.ts`: adapter **Local JSON** (`DB_DRIVER=local`) atau **Google Sheets** (`DB_DRIVER=sheets`), 18 tabel pada `src/lib/schema.ts` |
| File | `src/lib/storage.ts`: lokal atau **Google Drive** (`FILE_DRIVER=drive`); validasi ekstensi, ukuran, dan *magic bytes*; file selalu dilayani lewat `/api/files/...` setelah cek akses (tidak ada tautan publik Drive) |
| AI | `src/lib/services/rag.ts`: ekstraksi PDF per halaman → chunk → `AI_KNOWLEDGE_BASE` → BM25 → LLM Gemini (opsional) dengan sitasi `[n]`, nama dokumen & halaman |

### Model data (18 tabel)
`USERS, ROLES, REGIONS, SPBUS, SUBMISSIONS, SUBMISSION_DOCUMENTS, SUBMISSION_PHOTOS, SUBMISSION_REVISION_HISTORY, SUBMISSION_STATUS_HISTORY, REGIONAL_POOLINGS, REGIONAL_POOLING_ITEMS, REGIONAL_MEMOS, MEMO_POOLING_ITEMS, MEMO_FORWARDING, KNOWLEDGE_DOCUMENTS, TEMPLATES, AI_KNOWLEDGE_BASE, ACTIVITY_LOGS`.

Aturan penting yang ditegakkan di kode:
- KPI SPBU memakai **SPBU unik**, bukan jumlah transaksi. Satu SPBU boleh punya banyak pengajuan (`SUB-001`, `SUB-002`, …).
- Revisi memakai ID `SUB-001-R1`, `-R2`; dokumen lama **tidak dihapus** (`is_current=0`).
- Setiap perubahan status → baris di `SUBMISSION_STATUS_HISTORY` (sebelum, sesudah, pengguna, waktu, catatan).
- Satu pengajuan hanya boleh ada di **satu pooling aktif**; pembatalan pooling wajib beralasan dan tercatat. Pooling yang sudah di-MEMO tidak dapat dibatalkan.
- MEMO ↔ banyak pooling (`MEMO_POOLING_ITEMS`); penerusan ke PAM disimpan terpisah (`MEMO_FORWARDING`).
- Seluruh aktivitas penting → `ACTIVITY_LOGS`.

## Integrasi Google (Tahap 4)
1. Buat **Service Account** di Google Cloud; aktifkan *Sheets API* dan *Drive API*.
2. Buat Spreadsheet kosong dan folder Drive; **bagikan keduanya ke email service account (Editor)**. Jangan bagikan publik.
3. Isi `.env` / Environment Variables Vercel: `DB_DRIVER=sheets`, `GOOGLE_SHEETS_ID`, `GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_PRIVATE_KEY`, `FILE_DRIVER=drive`, `GOOGLE_DRIVE_FOLDER_ID`, `SETUP_KEY`, `AUTH_SECRET`, `DEMO_MODE=false`.
4. Bootstrap sekali: `POST /api/setup` dengan JSON `{ "key": "<SETUP_KEY>", "username": "...", "name": "...", "password": "..." }` → membuat 18 tab + header, mengisi ROLES/REGIONS/SPBUS dan Admin PAM pertama. Endpoint menolak jika sudah ada pengguna.
5. Kredensial hanya dipakai di server; tidak ada variabel `NEXT_PUBLIC_*` untuk rahasia.

> Catatan Vercel: body request fungsi serverless dibatasi ±4,5 MB total. Pengajuan (Excel + PDF + foto) harus muat dalam batas itu, atau gunakan unggah langsung ke storage dengan *signed URL* pada pengembangan lanjutan. Google Sheets cocok untuk volume awal; untuk beban tinggi pindahkan ke database relasional dengan mengganti adapter `Store`.

## AI — Tanya si GEMAS
- Unggah dokumen resmi (PDF berteks) di **Pusat Informasi Arsip** (Admin PAM) → otomatis diindeks (tombol indeks-ulang tersedia). PDF hasil pindai tanpa teks perlu OCR terlebih dahulu.
- Isi `GEMINI_API_KEY` untuk jawaban LLM. Tanpa key, GEMAS menampilkan **kutipan langsung** dokumen resmi + sumber.
- Jika tidak ada sumber relevan: *"perlu dikonfirmasi kepada Document Controller"*. Panduan penggunaan aplikasi bawaan diberi label terpisah dari dokumen resmi.

## Yang perlu diisi perusahaan
- Template resmi (saat ini **placeholder** berlabel Data Demo): i-BOS, Form FUPA, Daftar Arsip.
- 6 dokumen pedoman (metadata sudah terdaftar, file belum diunggah).
- Akun pengguna nyata (PIC SPBU/Region) dan nama PIC SPBU pada master data.

## Struktur
```
src/app            halaman & route API (App Router)
src/components     UI, dashboard, pengajuan, admin, ilustrasi
src/lib            schema, store (Local/Sheets), storage (Local/Drive), auth, seed
src/lib/services   logika bisnis + RBAC (submissions, monitoring, master, content, rag)
data/              spbu_master.json (impor Excel) · db.json (dibuat otomatis)
```
