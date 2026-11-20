/* eslint-disable @next/next/no-img-element */
/** Logo aplikasi GEMAS (PNG transparan di public/brand). `icon` = hanya lambang folder tanpa teks. `contoured` = outline putih mengikuti kontur logo untuk latar gelap. */
export function GemasLogo({
  variant = "full",
  className = "h-9",
  contoured = false,
}: {
  variant?: "full" | "icon";
  className?: string;
  contoured?: boolean;
}) {
  const src = contoured
    ? variant === "icon"
      ? "/brand/logo-gemas-icon-contour.png"
      : "/brand/logo-gemas-contour.png"
    : variant === "icon"
    ? "/brand/logo-gemas-icon.png"
    : "/brand/logo-gemas.png";

  return (
    <img
      src={src}
      alt="GEMAS — General Services Monitoring & Archive System"
      className={`w-auto object-contain ${className}`}
    />
  );
}

/** Logo korporat PT Pertamina Retail (PNG transparan di public/brand). */
export function PertaminaLogo({ className = "h-8" }: { className?: string }) {
  return <img src="/brand/logo-pertamina-retail.png?v=2" alt="Pertamina Retail" className={`w-auto ${className}`} />;
}
