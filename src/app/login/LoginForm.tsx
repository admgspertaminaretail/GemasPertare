"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Eye, EyeOff, Loader2, LogIn, HelpCircle, Lock, AlertTriangle,
  AlertCircle, ChevronDown, FlaskConical, Copy, Check, ShieldAlert,
} from "lucide-react";
import { SpbuScene } from "@/components/art/SpbuScene";
import { DemoTag } from "@/components/ui/kit";
import { Modal } from "@/components/ui/Modal";

const SUPPORT_EMAIL = "adm.gs.pertaminaretail@gmail.com";
const MAX_TRIES = 10;

interface Suggestion {
  username: string;
  label: string;
}

function fmtCountdown(sec: number) {
  const s = Math.max(0, sec);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
}

export function LoginForm({
  next,
  accounts = [],
  demoPassword = "",
}: {
  next?: string;
  accounts?: { label: string; username: string; hint: string }[];
  demoPassword?: string;
}) {
  const router = useRouter();
  const pwdRef = useRef<HTMLInputElement>(null);

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [showForgot, setShowForgot] = useState(false);
  const [showDemoPanel, setShowDemoPanel] = useState(false);
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  // State untuk koreksi username & proteksi penangguhan 10x salah sandi
  const [notFoundUser, setNotFoundUser] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [attemptsInfo, setAttemptsInfo] = useState<{ username: string; attempts: number; maxAttempts: number } | null>(null);
  const [suspended, setSuspended] = useState<{ username: string; untilMs: number } | null>(null);
  const [remainingSec, setRemainingSec] = useState(0);

  useEffect(() => {
    try {
      const savedRemember = localStorage.getItem("gemas_remember_me");
      if (savedRemember === "1") {
        const savedUser = localStorage.getItem("gemas_remember_user") || "";
        const savedPass = localStorage.getItem("gemas_remember_pass") || "";
        if (savedUser) setUsername(savedUser);
        if (savedPass) setPassword(savedPass);
        setRememberMe(true);
      }
    } catch {
      /* abaikan bila localStorage tidak tersedia */
    }
  }, []);

  // Hitung mundur penangguhan login (10x salah kata sandi)
  useEffect(() => {
    if (!suspended) {
      setRemainingSec(0);
      return;
    }
    const tick = () => {
      const left = Math.max(0, Math.ceil((suspended.untilMs - Date.now()) / 1000));
      setRemainingSec(left);
      if (left <= 0) {
        setSuspended(null);
        setAttemptsInfo(null);
        setError("");
      }
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [suspended]);

  const normUser = username.trim().toLowerCase();
  const isCurrentUserSuspended = !!(suspended && remainingSec > 0 && suspended.username === normUser);
  const activeAttempts = attemptsInfo && attemptsInfo.username === normUser ? attemptsInfo : null;
  const remainingTries = activeAttempts ? Math.max(0, activeAttempts.maxAttempts - activeAttempts.attempts) : MAX_TRIES;

  // Cek otomatis username saat berpindah kolom agar langsung memberi koreksi bila salah ketik
  const checkUsernameOnBlur = async (targetUser = username) => {
    const u = targetUser.trim().toLowerCase();
    if (!u) {
      setNotFoundUser("");
      setSuggestions([]);
      return;
    }
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "check_username", username: u }),
      });
      const data = await res.json();
      if (!data?.ok) return;
      if (data.exists) {
        setNotFoundUser("");
        setSuggestions([]);
        if (data.suspended && data.waitSeconds > 0) {
          setSuspended({ username: data.username, untilMs: Date.now() + data.waitSeconds * 1000 });
        } else if (data.attempts > 0) {
          setAttemptsInfo({ username: data.username, attempts: data.attempts, maxAttempts: data.maxAttempts || MAX_TRIES });
        }
      } else if (!data.inactive) {
        setNotFoundUser(u);
        setSuggestions(data.suggestions || []);
      }
    } catch {
      /* abaikan bila jaringan terputus sementara */
    }
  };

  const applySuggestion = (s: Suggestion) => {
    setUsername(s.username);
    setNotFoundUser("");
    setSuggestions([]);
    setError("");
    setTimeout(() => pwdRef.current?.focus(), 40);
  };

  const submit = async (e?: React.FormEvent, u = username, p = password) => {
    e?.preventDefault();
    const cleanU = u.trim().toLowerCase();
    if (!cleanU || !p) return;

    setBusy(true);
    setError("");

    if (rememberMe) {
      try {
        localStorage.setItem("gemas_remember_me", "1");
        localStorage.setItem("gemas_remember_user", cleanU);
        localStorage.setItem("gemas_remember_pass", p);
      } catch {}
    } else {
      try {
        localStorage.removeItem("gemas_remember_me");
        localStorage.removeItem("gemas_remember_user");
        localStorage.removeItem("gemas_remember_pass");
      } catch {}
    }

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: cleanU, password: p }),
      });
      let data: any = {};
      try { data = await res.json(); } catch {}

      if (res.ok && data?.ok) {
        router.replace(next && next.startsWith("/") && !next.startsWith("//") ? next : "/home");
        router.refresh();
        return;
      }

      if (data?.code === "USER_NOT_FOUND") {
        setNotFoundUser(data.enteredUsername || cleanU);
        setSuggestions(data.suggestions || []);
        setError(data.error || `Username "${cleanU}" tidak terdaftar dalam data kami.`);
      } else if (data?.code === "SUSPENDED") {
        const wait = Number(data.waitSeconds) || 900;
        const lockedUser = (data.username || cleanU).toLowerCase();
        setNotFoundUser("");
        setSuggestions([]);
        setAttemptsInfo({ username: lockedUser, attempts: MAX_TRIES, maxAttempts: MAX_TRIES });
        setSuspended({ username: lockedUser, untilMs: Date.now() + wait * 1000 });
        setError(data.error || `Login ditangguhkan sementara setelah ${MAX_TRIES} kali salah kata sandi.`);
      } else if (data?.code === "WRONG_PASSWORD") {
        const targetU = (data.username || cleanU).toLowerCase();
        setNotFoundUser("");
        setSuggestions([]);
        setAttemptsInfo({
          username: targetU,
          attempts: Number(data.attempts) || 1,
          maxAttempts: Number(data.maxAttempts) || MAX_TRIES,
        });
        setError(data.error || "Username / kata sandi salah. Silakan periksa kembali.");
      } else {
        setError(data?.error || "Username / kata sandi salah. Silakan periksa kembali.");
      }
      setBusy(false);
    } catch {
      setError("Tidak dapat terhubung ke server. Silakan periksa koneksi Anda.");
      setBusy(false);
    }
  };

  const copySupportEmail = async () => {
    try {
      await navigator.clipboard.writeText(SUPPORT_EMAIL);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  return (
    <div className="relative grid min-h-screen lg:grid-cols-2">
      {/* Kolom Kiri: Ilustrasi & Identitas Brand */}
      <div className="relative hidden flex-col justify-between overflow-hidden bg-gradient-to-br from-brand via-brand-600 to-navy p-10 text-white lg:flex">
        <div className="flex items-center">
          <img
            src="/brand/logo-pertamina-retail.png"
            alt="Pertamina Retail"
            className="h-12 w-auto object-contain"
          />
        </div>
        <div>
          <SpbuScene className="mx-auto w-full max-w-[560px] drop-shadow-2xl" />
          <h2 className="mt-4 text-3xl font-extrabold leading-tight">
            Pengelolaan Arsip Lebih Mudah,<br />Terstruktur, dan Terpantau.
          </h2>
          <p className="mt-2 max-w-md text-sm font-medium text-white/90">Satukan Energi, Melayani Negeri</p>
        </div>
        <div className="flex gap-1.5">
          <span className="h-1.5 w-10 rounded-full bg-prtred" />
          <span className="h-1.5 w-10 rounded-full bg-prtgreen" />
          <span className="h-1.5 w-10 rounded-full bg-[#0090FF]" />
        </div>
      </div>

      {/* Garis Tengah Pembatas Gradasi Merah - Hijau - Biru */}
      <div
        className="hidden lg:block absolute left-1/2 top-0 bottom-0 -translate-x-1/2 w-[3px] bg-gradient-to-b from-[#E52329] via-[#69B345] to-[#006CB7] z-20 shadow-[0_0_10px_rgba(0,108,183,0.35)]"
        aria-hidden="true"
      />

      {/* Kolom Kanan: Form Login */}
      <div className="relative flex items-center justify-center bg-slate-50/30 p-5 sm:p-10">
        <div className="hidden lg:block absolute top-5 right-5 sm:top-6 sm:right-8">
          <img
            src="/brand/logo-gemas.png"
            alt="GEMAS"
            className="h-11 sm:h-[52px] w-auto object-contain"
          />
        </div>

        <div className="w-full max-w-md pt-4 lg:pt-10">
          <div className="mb-6 flex items-center justify-between lg:hidden">
            <img
              src="/brand/logo-pertamina-retail.png"
              alt="Pertamina Retail"
              className="h-9 w-auto object-contain"
            />
            <img
              src="/brand/logo-gemas.png"
              alt="GEMAS"
              className="h-10 w-auto object-contain"
            />
          </div>

          <h1 className="text-2xl font-extrabold text-navy">
            Selamat Datang di <span className="italic text-brand">GEMAS</span> !
          </h1>
          <p className="mt-1.5 text-sm leading-relaxed text-slate-500">
            Silakan masuk menggunakan akun yang telah terdaftar untuk mengakses layanan pengelolaan arsip Pertamina Retail.
          </p>

          <form onSubmit={submit} className="card mt-6 space-y-4 p-6" noValidate>
            <div>
              <label htmlFor="u" className="label">Username / Email</label>
              <input
                id="u"
                name="username"
                className={`input ${notFoundUser ? "border-amber-400 ring-1 ring-amber-300" : ""}`}
                autoComplete="username"
                placeholder="Contoh: user@pertamina.com"
                autoFocus
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value);
                  if (notFoundUser) {
                    setNotFoundUser("");
                    setSuggestions([]);
                  }
                  if (error) setError("");
                }}
                onBlur={() => checkUsernameOnBlur()}
              />

              {/* Rekomendasi koreksi otomatis jika username tidak terdaftar */}
              {notFoundUser && (
                <div className="mt-2.5 rounded-xl border border-amber-200 bg-amber-50/90 p-3 text-xs text-amber-900">
                  <div className="font-semibold">
                    Username <code className="rounded bg-white px-1 py-0.5 font-mono text-prtred">{notFoundUser}</code> belum terdaftar di data sistem.
                  </div>
                  {suggestions.length > 0 ? (
                    <div className="mt-2">
                      <div className="mb-1.5 text-[11px] font-medium text-amber-800">
                        Mungkin maksud Anda (klik untuk gunakan):
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {suggestions.map((s) => (
                          <button
                            key={s.username}
                            type="button"
                            onClick={() => applySuggestion(s)}
                            className="inline-flex items-center gap-1 rounded-lg bg-white px-2.5 py-1 text-left text-xs font-bold text-brand ring-1 ring-amber-300 transition hover:bg-brand hover:text-white hover:ring-brand"
                          >
                            <span className="font-mono">{s.username}</span>
                            <span className="text-[10px] font-normal opacity-80">· {s.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <p className="mt-1 text-[11px] text-amber-800/90">
                      Contoh format valid: <code className="font-mono font-semibold">pam.demo</code>,{" "}
                      <code className="font-mono font-semibold">region1.demo</code>, atau{" "}
                      <code className="font-mono font-semibold">spbu3110202</code>.
                    </p>
                  )}
                </div>
              )}
            </div>

            <div>
              <label htmlFor="p" className="label">Password</label>
              <div className="relative">
                <input
                  ref={pwdRef}
                  id="p"
                  name="password"
                  className="input pr-10"
                  type={show ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="Masukkan kata sandi akun Anda"
                  disabled={isCurrentUserSuspended}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (error && !isCurrentUserSuspended) setError("");
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShow(!show)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition"
                  aria-label={show ? "Sembunyikan" : "Tampilkan"}
                >
                  {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between pt-1">
              <label className="flex cursor-pointer select-none items-center gap-2 text-sm text-slate-600 hover:text-navy transition">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-brand accent-brand focus:ring-brand cursor-pointer"
                />
                <span>Ingat saya</span>
              </label>

              <button
                type="button"
                onClick={() => setShowForgot(true)}
                className="text-sm font-semibold text-brand hover:text-brand-700 hover:underline transition"
              >
                Lupa Password?
              </button>
            </div>

            {/* Banner Akun Ditangguhkan (10x salah password) */}
            {isCurrentUserSuspended && (
              <div
                role="alert"
                className="space-y-2 rounded-xl border border-red-200 bg-red-50/95 px-3.5 py-3 text-xs text-red-700 shadow-sm"
              >
                <div className="flex items-start gap-2 font-bold text-red-700">
                  <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
                  <span>
                    Login akun <code className="font-mono">{suspended?.username}</code> ditangguhkan sementara karena {MAX_TRIES}x salah kata sandi.
                  </span>
                </div>
                <div className="flex items-center justify-between rounded-lg bg-white px-2.5 py-1.5 ring-1 ring-red-200">
                  <span className="font-medium text-slate-600">Dapat dicoba kembali dalam:</span>
                  <span className="font-mono text-sm font-extrabold text-red-600">{fmtCountdown(remainingSec)}</span>
                </div>
              </div>
            )}

            {/* Indikator sisa percobaan (1 s.d. 9 kali salah password) */}
            {!isCurrentUserSuspended && activeAttempts && activeAttempts.attempts > 0 && (
              <div className="space-y-1.5 rounded-xl bg-slate-50 px-3 py-2.5 text-xs ring-1 ring-slate-200/90">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-navy">
                    Percobaan gagal: {activeAttempts.attempts}/{activeAttempts.maxAttempts}
                  </span>
                  <span className={`font-bold ${remainingTries <= 3 ? "text-red-600" : "text-amber-700"}`}>
                    Sisa {remainingTries} percobaan
                  </span>
                </div>
                <div className="grid grid-cols-10 gap-1">
                  {Array.from({ length: activeAttempts.maxAttempts }, (_, i) => (
                    <span
                      key={i}
                      className={`h-1.5 rounded-full ${
                        i < activeAttempts.attempts
                          ? remainingTries <= 3 ? "bg-red-600" : "bg-amber-500"
                          : "bg-slate-200"
                      }`}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Keterangan Error jika salah username atau kata sandi */}
            {error && !isCurrentUserSuspended && !notFoundUser && (
              <div
                role="alert"
                className="flex items-center gap-2.5 rounded-xl border border-red-200 bg-red-50/90 px-3.5 py-2.5 text-sm font-semibold text-red-600 shadow-sm"
              >
                <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
                <span>{error}</span>
              </div>
            )}

            <button
              className="btn-primary w-full"
              disabled={busy || !username.trim() || !password || isCurrentUserSuspended}
            >
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : isCurrentUserSuspended ? (
                <Lock className="h-4 w-4" />
              ) : (
                <LogIn className="h-4 w-4" />
              )}
              {isCurrentUserSuspended ? `Ditangguhkan (${fmtCountdown(remainingSec)})` : "Masuk"}
            </button>
          </form>

          {/* Akses Cepat Akun Demo (ringkas & dapat dibuka/tutup agar tampilan utama tetap bersih) */}
          {accounts.length > 0 && (
            <div className="mt-4 rounded-2xl border border-amber-200/80 bg-amber-50/60 px-4 py-2.5">
              <button
                type="button"
                onClick={() => setShowDemoPanel((v) => !v)}
                className="flex w-full items-center justify-between text-left text-xs font-bold text-amber-800"
              >
                <span className="inline-flex items-center gap-2">
                  <FlaskConical className="h-3.5 w-3.5" />
                  Gunakan Akun Demo Cepat
                  <DemoTag />
                </span>
                <ChevronDown className={`h-4 w-4 transition-transform ${showDemoPanel ? "rotate-180" : ""}`} />
              </button>

              {showDemoPanel && (
                <div className="mt-3 border-t border-amber-200/70 pt-2.5">
                  <p className="mb-2 text-[11px] text-amber-800/85">
                    Klik akun untuk masuk otomatis (sandi: <code className="rounded bg-white px-1 font-mono font-bold">{demoPassword}</code>)
                  </p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {accounts.map((a) => (
                      <button
                        key={a.username}
                        type="button"
                        disabled={busy}
                        onClick={() => {
                          setUsername(a.username);
                          setPassword(demoPassword);
                          setNotFoundUser("");
                          setSuggestions([]);
                          submit(undefined, a.username, demoPassword);
                        }}
                        className="rounded-xl bg-white p-2 text-left text-xs ring-1 ring-amber-200 transition hover:ring-brand"
                      >
                        <div className="font-bold text-navy">{a.label}</div>
                        <div className="font-mono text-[11px] font-semibold text-brand">{a.username}</div>
                        <div className="truncate text-[11px] text-slate-500">{a.hint}</div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Pemberitahuan Sistem (sesuai visual acuan) */}
          <div className="mt-5 flex items-start gap-3.5 rounded-2xl border border-[#DCE7F3] bg-[#F5F8FC] p-4 text-[13px] leading-relaxed shadow-sm">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-[#1E3A5F]" strokeWidth={2} />
            <div className="text-[#3E526D]">
              <strong className="font-bold text-[#1E3A5F]">Pemberitahuan Sistem:</strong>{" "}
              Aplikasi ini dikhususkan untuk penggunaan internal PT Pertamina Retail. Segala bentuk akses tanpa izin atau penyalahgunaan wewenang akan ditindak tegas sesuai dengan kebijakan kepatuhan dan ketentuan hukum yang berlaku.
            </div>
          </div>

          {/* Watermark / Copyright */}
          <div className="mt-6 text-center text-[11px] text-slate-400/75 leading-relaxed select-none">
            <div>© 2026 PT Pertamina Retail. All rights reserved.</div>
            <div className="font-medium text-slate-400/65">GEMAS (General Services Monitoring Archive System) v1.0</div>
          </div>
        </div>
      </div>

      <Modal
        open={showForgot}
        onClose={() => setShowForgot(false)}
        title="Lupa Password Akun"
        footer={
          <button className="btn-primary" onClick={() => setShowForgot(false)}>
            Mengerti
          </button>
        }
      >
        <div className="space-y-4 py-1 text-sm text-slate-600">
          <div className="flex items-start gap-3.5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 ring-1 ring-amber-200">
              <Lock className="h-5 w-5" />
            </div>
            <p className="leading-relaxed pt-0.5">
              Untuk alasan keamanan dan kepatuhan sistem internal perusahaan, pengelolaan akun GEMAS dilakukan secara terpusat oleh <strong className="font-bold text-navy">Tim General Services (GS)</strong>.
            </p>
          </div>

          <div className="rounded-xl border border-blue-100 bg-blue-50/70 p-4 text-xs text-navy space-y-2">
            <div className="font-bold text-brand flex items-center gap-1.5 text-sm">
              <HelpCircle className="h-4 w-4" />
              Kontak Helpdesk PAM GS :
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-700">
              <div className="flex items-center gap-1.5">
                <span>• Email PAM GS :</span>
                <a
                  href={`mailto:${SUPPORT_EMAIL}`}
                  className="font-mono font-semibold text-brand hover:underline"
                >
                  {SUPPORT_EMAIL}
                </a>
              </div>
              <button
                type="button"
                onClick={copySupportEmail}
                className="inline-flex items-center gap-1 rounded-lg bg-white px-2 py-1 text-[11px] font-semibold text-brand ring-1 ring-blue-200 hover:bg-brand hover:text-white transition"
              >
                {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                {copied ? "Tersalin" : "Salin"}
              </button>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
