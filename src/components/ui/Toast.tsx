"use client";
import { createContext, useCallback, useContext, useState, ReactNode } from "react";
import { CheckCircle2, XCircle, Info, X } from "lucide-react";

type T = { id: number; type: "success" | "error" | "info"; msg: string };
const Ctx = createContext<(type: T["type"], msg: string) => void>(() => {});
export const useToast = () => useContext(Ctx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<T[]>([]);
  const push = useCallback((type: T["type"], msg: string) => {
    const id = Date.now() + Math.random();
    setItems((s) => [...s, { id, type, msg }]);
    setTimeout(() => setItems((s) => s.filter((x) => x.id !== id)), type === "error" ? 7000 : 4000);
  }, []);
  return (
    <Ctx.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed right-4 top-4 z-[100] flex w-[min(92vw,380px)] flex-col gap-2" aria-live="polite">
        {items.map((t) => (
          <div key={t.id} role="status" className="pointer-events-auto flex animate-slidein items-start gap-3 rounded-xl bg-white p-3.5 shadow-pop ring-1 ring-slate-100">
            {t.type === "success" ? <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-prtgreen" /> : t.type === "error" ? <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-prtred" /> : <Info className="mt-0.5 h-5 w-5 shrink-0 text-brand" />}
            <p className="flex-1 text-sm text-navy">{t.msg}</p>
            <button aria-label="Tutup" onClick={() => setItems((s) => s.filter((x) => x.id !== t.id))}><X className="h-4 w-4 text-slate-400" /></button>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}
