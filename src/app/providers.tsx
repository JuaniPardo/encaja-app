"use client";

import { MantineProvider, createTheme } from "@mantine/core";
import { ModalsProvider } from "@mantine/modals";
import { Notifications } from "@mantine/notifications";

import { type Locale } from "@/features/i18n/config";
import { I18nProvider } from "@/features/i18n/provider";

const theme = createTheme({
  primaryColor: "teal",
  fontFamily: "'IBM Plex Sans', sans-serif",
  headings: {
    fontFamily: "'IBM Plex Sans Condensed', sans-serif",
  },
});

export function AppProviders({
  children,
  initialLocale,
}: {
  children: React.ReactNode;
  initialLocale?: Locale;
}) {
  return (
    <I18nProvider initialLocale={initialLocale}>
      <MantineProvider theme={theme} defaultColorScheme="light">
        <Notifications position="top-right" />
        <ModalsProvider>{children}</ModalsProvider>
      </MantineProvider>
    </I18nProvider>
  );
}
