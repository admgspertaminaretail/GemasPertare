/* eslint-disable @next/next/no-img-element */
/** Logo aplikasi GEMAS (PNG transparan di public/brand). `icon` = hanya lambang folder tanpa teks. */
export function GemasLogo({ variant = "full", className = "h-9" }: { variant?: "full" | "icon"; className?: string }) {
  return variant === "icon"
    ? <img src="/brand/logo-gemas-icon.png" alt="GEMAS" className={`w-auto ${className}`} />
    : <img src="/brand/logo-gemas.png" alt="GEMAS — General Services Monitoring & Archive System" className={`w-auto ${className}`} />;
}

/** Logo korporat PT Pertamina Retail (PNG transparan di public/brand). */
export function PertaminaLogo({ className = "h-8" }: { className?: string }) {
  return <img src="/brand/logo-pertamina-retail.png" alt="Pertamina Retail" className={`w-auto ${className}`} />;
}
