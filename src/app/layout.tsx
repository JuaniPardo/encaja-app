import type { Metadata } from "next";
import { cookies } from "next/headers";
import { IBM_Plex_Sans, IBM_Plex_Sans_Condensed } from "next/font/google";

import "@mantine/core/styles.css";
import "@mantine/dates/styles.css";
import "@mantine/notifications/styles.css";
import "./globals.css";

import { AppProviders } from "@/app/providers";
import { defaultLocale, localeCookieName, normalizeLocale } from "@/features/i18n/config";

const sans = IBM_Plex_Sans({
  variable: "--font-sans",
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
});

const condensed = IBM_Plex_Sans_Condensed({
  variable: "--font-heading",
  weight: ["500", "600", "700"],
  subsets: ["latin"],
});

function resolveMetadataBase() {
  const rawUrl =
    process.env.NEXT_PUBLIC_SITE_URL ??
    process.env.VERCEL_PROJECT_PRODUCTION_URL ??
    process.env.VERCEL_URL;

  if (!rawUrl) {
    return new URL("http://localhost:3000");
  }

  const normalizedUrl = rawUrl.startsWith("http") ? rawUrl : `https://${rawUrl}`;

  try {
    return new URL(normalizedUrl);
  } catch {
    return new URL("http://localhost:3000");
  }
}

export const metadata: Metadata = {
  metadataBase: resolveMetadataBase(),
  title: "Encaja",
  description: "Presupuesto y control financiero familiar",
  icons: {
    icon: "/logo-EnCaja.svg",
    shortcut: "/logo-EnCaja.svg",
    apple: "/logo-EnCaja.svg",
  },
  openGraph: {
    title: "Encaja",
    description: "Presupuesto y control financiero familiar",
    images: [{ url: "/logo-EnCaja.svg", alt: "Logo de Encaja" }],
  },
  twitter: {
    card: "summary",
    title: "Encaja",
    description: "Presupuesto y control financiero familiar",
    images: ["/logo-EnCaja.svg"],
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const initialLocale =
    normalizeLocale(cookieStore.get(localeCookieName)?.value ?? null) ?? defaultLocale;

  return (
    <html lang={initialLocale} className={`${sans.variable} ${condensed.variable}`}>
      <body>
        <AppProviders initialLocale={initialLocale}>{children}</AppProviders>
      </body>
    </html>
  );
}
