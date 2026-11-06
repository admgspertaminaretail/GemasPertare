"use client";
import { ReactNode, useEffect } from "react";
import { X, Loader2 } from "lucide-react";

export function Modal({ open, onClose, title, children, footer, wide }: { open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode; wide?: boolean | "xl" }) {
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", h); document.body.style.overflow = ""; };
  }, [open, onClose]);
  if (!open) return null;
  const maxW = wide === "xl" ? "sm:max-w-5xl" : wide ? "sm:max-w-3xl" : "sm:max-w-lg";
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-navy/50 p-0 backdrop-blur-sm sm:items-center sm:p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-label={title} className={`flex max-h-[92vh] w-full animate-slidein flex-col rounded-t-2xl bg-white shadow-pop sm:rounded-2xl ${maxW}`}>
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h2 className="text-base font-bold text-navy">{title}</h2>
          <button onClick={onClose} aria-label="Tutup" className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"><X className="h-5 w-5" /></button>
        </div>
        <div className="scroll-thin overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 px-5 py-3">{footer}</div>}
      </div>
    </div>
  );
}

export function ConfirmModal({ open, title, message, confirmLabel = "Ya, lanjutkan", danger, busy, onConfirm, onClose, children }: { open: boolean; title: string; message?: string; confirmLabel?: string; danger?: boolean; busy?: boolean; onConfirm: () => void; onClose: () => void; children?: ReactNode }) {
  return (
    <Modal open={open} onClose={onClose} title={title} footer={<>
      <button className="btn-ghost" onClick={onClose} disabled={busy}>Batal</button>
      <button className={danger ? "btn-danger" : "btn-primary"} onClick={onConfirm} disabled={busy}>{busy && <Loader2 className="h-4 w-4 animate-spin" />}{confirmLabel}</button>
    </>}>
      {message && <p className="text-sm text-slate-600">{message}</p>}
      {children}
    </Modal>
  );
}
