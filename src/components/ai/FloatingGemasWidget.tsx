"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookMarked,
  Bot,
  ExternalLink,
  Info,
  Loader2,
  Maximize2,
  Minimize2,
  Send,
  Sparkles,
  X,
} from "lucide-react";
import { Mascot } from "../art/Mascot";
import { api } from "@/lib/client";

interface Src {
  title: string;
  page: string;
  version: string;
  kind: "official" | "app";
  snippet: string;
}

interface Msg {
  role: "user" | "bot";
  text: string;
  sources?: Src[];
  links?: { label: string; href: string }[];
  mode?: string;
  error?: boolean;
}

const POPULAR_QUESTIONS = [
  "Berapa lama masa retensi bukti kas/setoran BBM?",
  "Apa saja syarat berkas pengajuan usul musnah?",
  "Bagaimana cara download Data Arsip Tarikan i-BOS?",
  "Apa bedanya Formulir FUPA dan Daftar Arsip Usul Musnah?",
];

function RichText({ text }: { text: string }) {
  const inline = (s: string) =>
    s.split(/(\*\*[^*]+\*\*|_[^_]+_)/g).map((p, i) =>
      p.startsWith("**") ? (
        <b key={i} className="font-bold text-navy">
          {p.slice(2, -2)}
        </b>
      ) : p.startsWith("_") && p.endsWith("_") && p.length > 2 ? (
        <i key={i} className="text-slate-500">
          {p.slice(1, -1)}
        </i>
      ) : (
        <Fragment key={i}>{p}</Fragment>
      )
    );

  return (
    <div className="space-y-2 text-xs sm:text-sm leading-relaxed">
      {text.split(/\n\n+/).map((para, i) => (
        <p key={i} className="whitespace-pre-line">
          {inline(para)}
        </p>
      ))}
    </div>
  );
}

export function FloatingGemasWidget({ role }: { role: string }) {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [hasUnread, setHasUnread] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Jangan tampilkan floating widget di halaman /ask karena sudah berupa tampilan penuh chat
  const isAskPage = pathname === "/ask";

  // Auto-scroll ke bawah saat ada pesan baru
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [msgs, busy, isOpen]);

  // Fokus ke input saat pop-up dibuka
  useEffect(() => {
    if (isOpen) {
      setHasUnread(false);
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [isOpen]);

  // Dengarkan custom event dari Beranda atau halaman lain ("gemas:ask")
  useEffect(() => {
    const handleAskEvent = (e: any) => {
      const q = e?.detail?.question;
      setIsOpen(true);
      if (q && typeof q === "string" && q.trim().length >= 3) {
        ask(q.trim());
      }
    };

    window.addEventListener("gemas:ask", handleAskEvent);
    return () => window.removeEventListener("gemas:ask", handleAskEvent);
  }, [msgs, busy]);

  const ask = async (text = query) => {
    const question = text.trim();
    if (question.length < 3 || busy) return;

    const history = msgs
      .filter((m) => !m.error)
      .map((m) => ({ role: m.role === "user" ? "user" : "model", text: m.text }));

    setMsgs((m) => [...m, { role: "user", text: question }]);
    setQuery("");
    setBusy(true);

    try {
      const res = await api("/api/ai/chat", { question, history });
      setMsgs((m) => [
        ...m,
        {
          role: "bot",
          text: res.answer,
          sources: res.sources,
          links: res.links,
          mode: res.mode,
        },
      ]);
    } catch (err: any) {
      setMsgs((m) => [
        ...m,
        {
          role: "bot",
          text: err.message || "Maaf, terjadi kendala saat memproses pertanyaan. Silakan coba kembali.",
          error: true,
        },
      ]);
    } finally {
      setBusy(false);
    }
  };

  if (isAskPage) return null;

  return (
    <div className="fixed bottom-5 right-5 sm:bottom-6 sm:right-6 z-50">
      {/* 1. KOTAK POP-UP CHAT TANYA SI GEMAS */}
      {isOpen && (
        <div className="animate-slidein mb-3 flex h-[520px] max-h-[82vh] w-[92vw] sm:w-[410px] flex-col overflow-hidden rounded-3xl border border-slate-200/90 bg-white shadow-2xl">
          {/* Header Pop-up */}
          <div className="flex items-center justify-between bg-gradient-to-r from-navy via-[#10375E] to-brand px-4 py-3 text-white shadow-sm">
            <div className="flex items-center gap-2.5">
              <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white/15 backdrop-blur">
                <Mascot size={34} mood={busy ? "think" : "happy"} />
                <span className="absolute -bottom-0.5 -right-0.5 flex h-3 w-3 items-center justify-center">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
                </span>
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <h3 className="text-sm font-extrabold tracking-tight">Tanya si GEMAS</h3>
                  <span className="rounded-full bg-white/20 px-2 py-0.2 text-[10px] font-bold">
                    Official AI
                  </span>
                </div>
                <p className="text-[11px] text-white/80">Asisten Kearsipan PT Pertamina Retail</p>
              </div>
            </div>

            <div className="flex items-center gap-1 text-white/80">
              <Link
                href="/ask"
                title="Buka tampilan penuh"
                className="flex h-8 w-8 items-center justify-center rounded-xl transition hover:bg-white/20 hover:text-white"
              >
                <Maximize2 className="h-4 w-4" />
              </Link>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                title="Tutup pop-up"
                className="flex h-8 w-8 items-center justify-center rounded-xl transition hover:bg-white/20 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Area Pesan Chat */}
          <div className="scroll-thin flex-1 space-y-3.5 overflow-y-auto bg-slate-50/70 p-4">
            {/* Pesan Sapaan Awal */}
            {msgs.length === 0 && (
              <div className="space-y-4 pt-1">
                <div className="flex gap-2.5">
                  <Mascot size={38} className="shrink-0" mood="happy" />
                  <div className="rounded-2xl rounded-tl-sm border border-slate-200/80 bg-white p-3.5 text-xs text-navy shadow-sm">
                    <p className="font-extrabold text-brand">Halo, Sahabat Arsip SPBU! 👋</p>
                    <p className="mt-1 leading-relaxed text-slate-600">
                      Saya <b>GEMAS</b>, asisten resmi kearsipan PT Pertamina Retail. Ada yang bisa saya bantu terkait jadwal retensi berkas (JRDP), alur usul musnah, atau data tarikan i-BOS?
                    </p>
                  </div>
                </div>

                <div className="space-y-2 rounded-2xl border border-blue-100 bg-softblue/50 p-3">
                  <div className="flex items-center gap-1 text-[11px] font-extrabold uppercase tracking-wider text-brand">
                    <Sparkles className="h-3 w-3" />
                    Pilihan Pertanyaan Cepat:
                  </div>
                  <div className="flex flex-col gap-1.5">
                    {POPULAR_QUESTIONS.map((qText) => (
                      <button
                        key={qText}
                        type="button"
                        onClick={() => ask(qText)}
                        className="rounded-xl border border-blue-200/60 bg-white px-3 py-1.5 text-left text-xs font-semibold text-brand transition hover:border-brand hover:bg-softblue"
                      >
                        💬 {qText}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Daftar Pesan Percakapan */}
            {msgs.map((m, idx) => (
              <div
                key={idx}
                className={`flex gap-2.5 ${m.role === "user" ? "justify-end" : "justify-start"}`}
              >
                {m.role === "bot" && (
                  <Mascot
                    size={34}
                    className="shrink-0"
                    mood={m.error ? "think" : "happy"}
                  />
                )}
                <div
                  className={`max-w-[85%] rounded-2xl p-3 shadow-sm ${
                    m.role === "user"
                      ? "rounded-tr-sm bg-brand text-white text-xs sm:text-sm font-medium"
                      : m.error
                        ? "rounded-tl-sm border border-red-200 bg-red-50 text-prtred text-xs"
                        : "rounded-tl-sm border border-slate-200/80 bg-white text-navy text-xs sm:text-sm"
                  }`}
                >
                  {m.role === "user" ? (
                    <p>{m.text}</p>
                  ) : (
                    <>
                      <RichText text={m.text} />
                      {m.mode === "extractive" && (
                        <p className="mt-2 flex items-center gap-1 text-[10px] text-slate-400">
                          <Info className="h-3 w-3" /> Kutipan langsung dari dokumen resmi.
                        </p>
                      )}
                      {m.links && m.links.length > 0 && (
                        <div className="mt-2.5 flex flex-wrap gap-1.5">
                          {m.links.map((l) => (
                            <Link
                              key={l.href + l.label}
                              href={l.href}
                              className="inline-flex items-center gap-1 rounded-lg bg-softblue px-2 py-1 text-[11px] font-bold text-brand hover:bg-blue-100"
                            >
                              <ExternalLink className="h-3 w-3" />
                              {l.label}
                            </Link>
                          ))}
                        </div>
                      )}
                      {m.sources && m.sources.length > 0 && (
                        <details className="mt-2.5 rounded-xl border border-slate-100 bg-cloud p-2 text-[11px]">
                          <summary className="flex cursor-pointer items-center gap-1 font-bold text-navy">
                            <BookMarked className="h-3 w-3 text-brand" />
                            Sumber Resmi ({m.sources.length})
                          </summary>
                          <ul className="mt-1.5 space-y-1.5">
                            {m.sources.map((s, j) => (
                              <li key={j} className="rounded-lg bg-white p-1.5 border border-slate-100">
                                <span className="font-bold text-navy">[{j + 1}] {s.title}</span>{" "}
                                <span className="text-slate-500">· hal. {s.page}</span>
                                <p className="mt-0.5 text-slate-500 line-clamp-2">{s.snippet}</p>
                              </li>
                            ))}
                          </ul>
                        </details>
                      )}
                    </>
                  )}
                </div>
              </div>
            ))}

            {/* Indikator Berpikir saat Loading */}
            {busy && (
              <div className="flex items-center gap-2.5 text-xs text-slate-500">
                <Mascot size={32} mood="think" className="animate-floaty shrink-0" />
                <div className="rounded-2xl rounded-tl-sm border border-slate-200/70 bg-white px-3.5 py-2.5 shadow-sm">
                  <Loader2 className="mr-1.5 inline h-3.5 w-3.5 animate-spin text-brand" />
                  GEMAS sedang mencari jawaban di dokumen resmi…
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Form Input Pertanyaan */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              ask();
            }}
            className="flex items-center gap-2 border-t border-slate-100 bg-white p-3"
          >
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Tulis pertanyaan seputar arsip SPBU…"
              maxLength={400}
              disabled={busy}
              className="flex-1 rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs text-navy placeholder:text-slate-400 focus:border-brand focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand/20 disabled:opacity-60"
            />
            <button
              type="submit"
              disabled={busy || query.trim().length < 3}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand text-white shadow-sm transition hover:bg-brand-600 disabled:opacity-40"
              title="Kirim pertanyaan"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
          <div className="border-t border-slate-100 bg-slate-50/60 px-3 py-1.5 text-center text-[10px] text-slate-400">
            Jawaban bersumber dari JRDP &amp; Pedoman Kearsipan PT Pertamina Retail
          </div>
        </div>
      )}

      {/* 2. TOMBOL LAUNCHER MASKOT MENGAPUNG (FLOATING BUBBLE) */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Tanya si GEMAS"
        className={`group relative flex items-center gap-2.5 rounded-full p-2 transition-all duration-300 ${
          isOpen
            ? "bg-navy text-white shadow-pop scale-95"
            : "bg-white text-navy shadow-pop hover:shadow-2xl hover:scale-105 ring-2 ring-blue-100"
        }`}
      >
        {/* Maskot Avatar */}
        <div className="relative flex h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-softblue/60 p-1">
          <Mascot size={46} mood={isOpen ? "happy" : "happy"} />
          <span className="absolute top-0.5 right-0.5 flex h-3.5 w-3.5 items-center justify-center">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-white" />
          </span>
        </div>

        {/* Label Teks Samping */}
        <div className="hidden pr-3 text-left sm:block">
          <div className="flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-brand">
            <Sparkles className="h-3 w-3" />
            Tanya AI
          </div>
          <div className="text-xs font-black tracking-tight text-navy">
            {isOpen ? "Tutup GEMAS" : "Tanya si GEMAS"}
          </div>
        </div>
      </button>
    </div>
  );
}
