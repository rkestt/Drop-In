import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { Toaster } from "@/components/notifications/toaster";
import { InstallPrompt } from "@/components/pwa/install-prompt";
import { SwUpdateToast } from "@/components/pwa/sw-update-toast";
import { KarmaListener } from "@/components/notifications/karma-listener";
import { PushNotificationProvider } from "@/components/notifications/push-provider";
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

function resolveSiteUrl(): URL {
  const raw = (process.env.NEXT_PUBLIC_SITE_URL ?? "")
    .trim()
    .replace(/\/+$/, "");
  try {
    return new URL(raw || "http://localhost:3000");
  } catch {
    return new URL("http://localhost:3000");
  }
}

export const metadata: Metadata = {
  metadataBase: resolveSiteUrl(),
  title: {
    default: "Drop-In — Street Edition",
    template: "%s · Drop-In",
  },
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
          {/* Il provider push deve AVVOLGERE l'albero: `/settings` chiama
              `usePushNotifications()`, che fuori dal provider lancia. */}
          <PushNotificationProvider>
            {children}
            <Toaster />
            <InstallPrompt />
            <SwUpdateToast />
            <KarmaListener />
          </PushNotificationProvider>
        </SportProvider>
      </body>
    </html>
  );
}
