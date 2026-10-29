import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ServiceWorker } from "@/components/ServiceWorker";
import Script from "next/script";
import { themeBootScript } from "@/lib/theme";

export const metadata: Metadata = {
  title: "Okane : ton argent, ton plan",
  description:
    "Répartis ton salaire en enveloppes, suis tes dépenses et atteins tes objectifs d’épargne. Gratuit, sans compte, tes données restent sur ton appareil.",
  applicationName: "Okane",
  appleWebApp: { capable: true, title: "Okane", statusBarStyle: "default" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f5fb" },
    { media: "(prefers-color-scheme: dark)", color: "#0d0b1a" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <head>
        <Script id="okane-theme" strategy="beforeInteractive">
          {themeBootScript}
        </Script>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Bangers&family=Rubik:wght@400;500;600;700;900&display=swap"
        />
      </head>
      <body>
        {children}
        <ServiceWorker />
      </body>
    </html>
  );
}
