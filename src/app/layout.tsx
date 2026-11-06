import "./globals.css";
import type { Metadata, Viewport } from "next";
import { ToastProvider } from "@/components/ui/Toast";

export const metadata: Metadata = {
  title: "GEMAS — General Services Monitoring & Archive System",
  description: "Pengelolaan Arsip Lebih Mudah, Terstruktur, dan Terpantau. PT Pertamina Retail.",
  robots: { index: false, follow: false },
  icons: { icon: "/brand/logo-gemas-icon.png", apple: "/brand/logo-gemas-icon.png" },
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#006CB7" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
