import { ReactNode } from "react";
import { STATUS_STYLE, StatusValue } from "@/lib/constants";

export function StatusBadge({ status }: { status: string }) {
  const cls = STATUS_STYLE[status as StatusValue] || "bg-slate-50 text-slate-500 ring-slate-200";
  return <span className={`chip whitespace-nowrap ${cls}`}>{status}</span>;
}

export function DemoTag({ className = "" }: { className?: string }) {
  return <span className={`chip bg-amber-50 text-amber-700 ring-amber-200 ${className}`}>Data Demo</span>;
}

export function PageHeader({ title, subtitle, actions, icon }: { title: string; subtitle?: ReactNode; actions?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
      <div className="flex items-start gap-3">
        {icon && <div className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-brand text-white shadow-card">{icon}</div>}
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-navy sm:text-2xl">{title}</h1>
          {subtitle && <p className="mt-0.5 max-w-3xl text-sm text-slate-500">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

const TONES: Record<string, string> = {
  blue: "bg-brand text-white", navy: "bg-navy text-white", red: "bg-prtred text-white", green: "bg-prtgreen text-white", amber: "bg-amber-500 text-white", slate: "bg-slate-500 text-white",
};
export function KpiCard({ label, value, hint, icon, tone = "blue" }: { label: string; value: ReactNode; hint?: string; icon?: ReactNode; tone?: keyof typeof TONES }) {
  return (
    <div className="card flex items-center gap-4 p-4" title={hint}>
      <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${TONES[tone]}`}>{icon}</div>
      <div className="min-w-0">
        <div className="text-2xl font-extrabold leading-none text-navy">{value}</div>
        <div className="mt-1 truncate text-xs font-medium text-slate-500">{label}</div>
      </div>
    </div>
  );
}

export function Empty({ title, text, action, art }: { title: string; text?: string; action?: ReactNode; art?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
      {art ?? (
        <svg width="110" height="90" viewBox="0 0 110 90" aria-hidden>
          <ellipse cx="55" cy="80" rx="38" ry="6" fill="#E5F1FB" />
          <path d="M20 40 L55 25 L90 40 L90 70 L55 82 L20 70Z" fill="#E7B877" /><path d="M20 40 L55 54 L90 40 L55 25Z" fill="#F3D29C" />
          <path d="M55 54 L55 82 L20 70 L20 40Z" fill="#D9A25F" /><path d="M42 33 L68 44" stroke="#fff" strokeWidth="5" opacity=".6" />
        </svg>
      )}
      <h3 className="mt-3 text-base font-bold text-navy">{title}</h3>
      {text && <p className="mt-1 max-w-sm text-sm text-slate-500">{text}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`skeleton rounded-xl ${className}`} />;
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="card flex flex-col items-center p-8 text-center">
      <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-prtred">!</div>
      <p className="text-sm font-semibold text-navy">Terjadi kendala</p>
      <p className="mt-1 text-sm text-slate-500">{message}</p>
      {onRetry && <button className="btn-ghost mt-4" onClick={onRetry}>Coba lagi</button>}
    </div>
  );
}
