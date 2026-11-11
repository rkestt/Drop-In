import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { Toaster } from "@/components/notifications/toaster";
import { KarmaListener } from "@/components/notifications/karma-listener";
import { SportProvider } from "@/lib/sport/sport-context";
import "./globals.css";

const syne = localFont({
  src: "./fonts/Syne-variable.woff2",
  variable: "--font-syne",
  weight: "400 800",
  display: "swap",
  adjustFontFallback: false,
});

const sourceSans = localFont({
  src: "./fonts/SourceSans3-variable.woff2",
  variable: "--font-source-sans",
  weight: "400 700",
  display: "swap",
  adjustFontFallback: false,
});

export const metadata: Metadata = {
  title: "Drop-In — Street Edition",
  description: "Trova campetti, unisciti a partite, gioca a basket in strada.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black",
    title: "Drop-In",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  viewportFit: "cover",
  themeColor: "#141414",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="it"
      className={`${syne.variable} ${sourceSans.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-[var(--bg-base)] text-[var(--text-primary)] font-[family-name:var(--font-source-sans)]">
        <SportProvider>
          {children}
          <Toaster />
          <KarmaListener />
        </SportProvider>
      </body>
    </html>
  );
}
