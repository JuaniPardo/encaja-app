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

export const metadata: Metadata = {
  title: "Encaja",
  description: "Presupuesto y control financiero familiar",
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
