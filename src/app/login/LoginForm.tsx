"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Loader2, LogIn, FlaskConical } from "lucide-react";
import { SpbuScene } from "@/components/art/SpbuScene";
import { GemasMark } from "@/components/art/Mascot";
import { DemoTag } from "@/components/ui/kit";
import { api } from "@/lib/client";

export function LoginForm({ next, accounts, demoPassword }: { next?: string; accounts: { label: string; username: string; hint: string }[]; demoPassword: string }) {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e?: React.FormEvent, u = username, p = password) => {
    e?.preventDefault();
    setBusy(true); setError("");
    try {
      await api("/api/auth/login", { username: u, password: p });
      router.replace(next && next.startsWith("/") && !next.startsWith("//") ? next : "/home");
      router.refresh();
    } catch (err: any) { setError(err.message); setBusy(false); }
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden flex-col justify-between overflow-hidden bg-gradient-to-br from-brand via-brand-600 to-navy p-10 text-white lg:flex">
        <div className="flex items-center gap-3"><GemasMark size={44} /><div><div className="text-2xl font-extrabold tracking-wide">GEMAS</div><div className="text-xs text-white/70">General Services Monitoring &amp; Archive System</div></div></div>
        <div>
          <SpbuScene className="mx-auto w-full max-w-[560px] drop-shadow-2xl" />
          <h2 className="mt-4 text-3xl font-extrabold leading-tight">Pengelolaan Arsip Lebih Mudah,<br />Terstruktur, dan Terpantau.</h2>
          <p className="mt-2 max-w-md text-sm text-white/75">Satu platform untuk SPBU, Region, dan Head Office PT Pertamina Retail.</p>
        </div>
        <div className="flex gap-1.5"><span className="h-1.5 w-10 rounded-full bg-prtred" /><span className="h-1.5 w-10 rounded-full bg-white" /><span className="h-1.5 w-10 rounded-full bg-prtgreen" /></div>
      </div>

      <div className="flex items-center justify-center p-5 sm:p-10">
        <div className="w-full max-w-md">
          <div className="mb-6 flex items-center gap-3 lg:hidden"><GemasMark size={40} /><div className="text-2xl font-extrabold text-navy">GEMAS</div></div>
          <h1 className="text-2xl font-extrabold text-navy">Masuk ke GEMAS</h1>
          <p className="mt-1 text-sm text-slate-500">Gunakan akun yang diberikan oleh Admin PAM.</p>
          <form onSubmit={submit} className="card mt-6 space-y-4 p-6" noValidate>
            <div><label htmlFor="u" className="label">Username</label><input id="u" className="input" autoComplete="username" autoFocus value={username} onChange={(e) => setUsername(e.target.value)} /></div>
            <div>
              <label htmlFor="p" className="label">Kata sandi</label>
              <div className="relative">
                <input id="p" className="input pr-10" type={show ? "text" : "password"} autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
                <button type="button" onClick={() => setShow(!show)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" aria-label={show ? "Sembunyikan" : "Tampilkan"}>{show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button>
              </div>
            </div>
            {error && <div role="alert" className="rounded-xl bg-red-50 px-3.5 py-2.5 text-sm text-prtred ring-1 ring-red-100">{error}</div>}
            <button className="btn-primary w-full" disabled={busy || !username || !password}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}Masuk</button>
          </form>

          {accounts.length > 0 && (
            <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50/60 p-4">
              <div className="mb-2 flex items-center gap-2 text-sm font-bold text-amber-800"><FlaskConical className="h-4 w-4" />Akun Demo <DemoTag /></div>
              <p className="mb-3 text-xs text-amber-800/80">Mode demonstrasi — data bukan data operasional perusahaan. Kata sandi: <code className="rounded bg-white px-1 font-mono">{demoPassword}</code></p>
              <div className="grid gap-2 sm:grid-cols-2">
                {accounts.map((a) => (
                  <button key={a.username} type="button" disabled={busy} onClick={() => { setUsername(a.username); setPassword(demoPassword); submit(undefined, a.username, demoPassword); }}
                    className="rounded-xl bg-white p-2.5 text-left text-xs ring-1 ring-amber-200 transition hover:ring-brand">
                    <div className="font-bold text-navy">{a.label}</div><div className="truncate text-slate-500">{a.hint}</div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
