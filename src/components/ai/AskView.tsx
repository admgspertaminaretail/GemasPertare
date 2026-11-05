"use client";
import { Fragment, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { BookMarked, Info, Loader2, Send, Sparkles, ExternalLink } from "lucide-react";
import { Mascot } from "../art/Mascot";
import { api } from "@/lib/client";

interface Src { title: string; page: string; version: string; kind: "official" | "app"; snippet: string }
interface Msg { role: "user" | "bot"; text: string; sources?: Src[]; links?: { label: string; href: string }[]; mode?: string; error?: boolean }

const SUGGEST = [
  "Bagaimana alur pengajuan usul musnah arsip?",
  "Apa arti status “Perlu Revisi” dan apa yang harus saya lakukan?",
  "Di mana saya bisa mengunduh template Form FUPA?",
  "Bagaimana cara membaca JRDP untuk menentukan masa retensi?",
  "Bagaimana cara melakukan pooling FUPA Regional?",
];

function Rich({ text }: { text: string }) {
  const inline = (s: string) =>
    s.split(/(\*\*[^*]+\*\*|_[^_]+_)/g).map((p, i) => p.startsWith("**") ? <b key={i}>{p.slice(2, -2)}</b> : p.startsWith("_") && p.endsWith("_") && p.length > 2 ? <i key={i} className="text-slate-500">{p.slice(1, -1)}</i> : <Fragment key={i}>{p}</Fragment>);
  return <div className="space-y-2 text-sm leading-relaxed">{text.split(/\n\n+/).map((para, i) => <p key={i} className="whitespace-pre-line">{inline(para)}</p>)}</div>;
}

export function AskView({ indexed, totalDocs, llm }: { indexed: string[]; totalDocs: number; llm: boolean }) {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => { end.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [msgs, busy]);

  const ask = async (text = q) => {
    const question = text.trim();
    if (question.length < 3 || busy) return;
    const history = msgs.filter((m) => !m.error).map((m) => ({ role: m.role === "user" ? "user" : "model", text: m.text }));
    setMsgs((m) => [...m, { role: "user", text: question }]); setQ(""); setBusy(true);
    try {
      const r = await api("/api/ai/chat", { question, history });
      setMsgs((m) => [...m, { role: "bot", text: r.answer, sources: r.sources, links: r.links, mode: r.mode }]);
    } catch (e: any) { setMsgs((m) => [...m, { role: "bot", text: e.message || "Maaf, terjadi kendala. Coba lagi.", error: true }]); }
    finally { setBusy(false); }
  };

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_300px]">
      <section className="card flex h-[calc(100vh-150px)] min-h-[520px] flex-col overflow-hidden">
        <div className="flex items-center gap-4 bg-gradient-to-r from-brand to-navy p-4 text-white">
          <div className="rounded-2xl bg-white/15 p-1"><Mascot size={64} className="animate-floaty" /></div>
          <div><h1 className="text-lg font-extrabold">Tanya si GEMAS</h1><p className="text-xs text-white/80">Asisten pengelolaan arsip. Menjawab berdasarkan dokumen resmi perusahaan, lengkap dengan sumber.</p></div>
        </div>
        <div className="scroll-thin flex-1 space-y-4 overflow-y-auto bg-cloud/60 p-4">
          {msgs.length === 0 && (
            <div className="mx-auto max-w-xl pt-4 text-center">
              <Mascot size={110} className="mx-auto" />
              <h2 className="mt-2 text-lg font-bold text-navy">Halo! Ada yang bisa GEMAS bantu?</h2>
              <p className="mt-1 text-sm text-slate-500">Tanyakan prosedur pengajuan usul musnah, pengisian FUPA, JRDP, retensi arsip, template, atau arahan menu.</p>
              <div className="mt-5 flex flex-wrap justify-center gap-2">{SUGGEST.map((s) => <button key={s} onClick={() => ask(s)} className="rounded-full bg-white px-3.5 py-2 text-left text-xs font-semibold text-brand ring-1 ring-blue-100 transition hover:bg-softblue">{s}</button>)}</div>
            </div>
          )}
          {msgs.map((m, i) => (
            <div key={i} className={`flex gap-3 ${m.role === "user" ? "justify-end" : ""}`}>
              {m.role === "bot" && <Mascot size={40} className="shrink-0" mood={m.error ? "think" : "happy"} />}
              <div className={`max-w-[88%] rounded-2xl p-4 shadow-card ${m.role === "user" ? "bg-brand text-white" : m.error ? "bg-red-50 text-prtred ring-1 ring-red-100" : "bg-white text-navy ring-1 ring-slate-100"}`}>
                {m.role === "user" ? <p className="text-sm">{m.text}</p> : <Rich text={m.text} />}
                {m.mode === "extractive" && <p className="mt-2 flex items-center gap-1 text-[11px] text-slate-400"><Info className="h-3 w-3" />Menampilkan kutipan langsung (LLM belum diaktifkan).</p>}
                {m.links && m.links.length > 0 && <div className="mt-3 flex flex-wrap gap-2">{m.links.map((l) => l.href.startsWith("/api") ? <a key={l.href + l.label} href={`${l.href}?download=1`} className="btn-ghost btn-sm"><ExternalLink className="h-3.5 w-3.5" />{l.label}</a> : <Link key={l.href + l.label} href={l.href} className="btn-ghost btn-sm"><ExternalLink className="h-3.5 w-3.5" />{l.label}</Link>)}</div>}
                {m.sources && m.sources.length > 0 && (
                  <details className="mt-3 rounded-xl bg-cloud p-3 text-xs" open>
                    <summary className="flex cursor-pointer items-center gap-1.5 font-bold text-navy"><BookMarked className="h-3.5 w-3.5" />Sumber ({m.sources.length})</summary>
                    <ul className="mt-2 space-y-2">
                      {m.sources.map((s, j) => (
                        <li key={j} className="rounded-lg bg-white p-2 ring-1 ring-slate-100">
                          <div className="flex flex-wrap items-center gap-1.5"><span className="font-bold text-navy">[{j + 1}] {s.title}</span>{s.version && <span className="text-slate-400">v{s.version}</span>}<span className="text-slate-500">· {s.kind === "official" ? `hal. ${s.page}` : s.page}</span>
                            <span className={`chip ${s.kind === "official" ? "bg-emerald-50 text-emerald-700 ring-emerald-200" : "bg-amber-50 text-amber-800 ring-amber-200"}`}>{s.kind === "official" ? "Dokumen resmi" : "Panduan aplikasi"}</span></div>
                          <p className="mt-1 text-slate-500">{s.snippet}</p>
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
              </div>
            </div>
          ))}
          {busy && <div className="flex items-center gap-3"><Mascot size={40} mood="think" className="animate-floaty" /><div className="rounded-2xl bg-white px-4 py-3 text-sm text-slate-500 shadow-card"><Loader2 className="mr-2 inline h-4 w-4 animate-spin" />GEMAS sedang mencari di dokumen…</div></div>}
          <div ref={end} />
        </div>
        <form className="flex gap-2 border-t border-slate-100 bg-white p-3" onSubmit={(e) => { e.preventDefault(); ask(); }}>
          <input className="input" placeholder="Tulis pertanyaan Anda…" value={q} maxLength={600} onChange={(e) => setQ(e.target.value)} aria-label="Pertanyaan" disabled={busy} />
          <button className="btn-primary" disabled={busy || q.trim().length < 3}><Send className="h-4 w-4" /><span className="hidden sm:inline">Kirim</span></button>
        </form>
      </section>

      <aside className="space-y-4">
        <div className="card p-5">
          <h3 className="flex items-center gap-2 font-bold text-navy"><Sparkles className="h-4 w-4 text-brand" />Basis pengetahuan</h3>
          {indexed.length ? <ul className="mt-3 space-y-1.5 text-sm">{indexed.map((t) => <li key={t} className="flex items-start gap-2"><span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-prtgreen" />{t}</li>)}</ul>
            : <p className="mt-2 text-sm text-slate-500">Belum ada dokumen resmi yang terindeks ({totalDocs} dokumen terdaftar). Admin PAM perlu mengunggah PDF di <Link href="/info" className="font-semibold text-brand">Pusat Informasi Arsip</Link>. Sampai saat itu, GEMAS hanya dapat menjelaskan penggunaan aplikasi.</p>}
        </div>
        <div className="card space-y-2 p-5 text-xs text-slate-600">
          <h3 className="text-sm font-bold text-navy">Cara GEMAS menjawab</h3>
          <p>• Jawaban bersumber dari dokumen resmi; nama dokumen dan halaman dicantumkan.</p>
          <p>• Penjelasan penggunaan aplikasi diberi label <b>Panduan aplikasi</b>, terpisah dari kebijakan.</p>
          <p>• Jika tidak ditemukan, GEMAS menyarankan konfirmasi ke <b>Document Controller</b> dan tidak mengarang prosedur.</p>
          <p className="text-slate-400">Mode: {llm ? "LLM + RAG" : "RAG (kutipan dokumen)"}</p>
        </div>
      </aside>
    </div>
  );
}
