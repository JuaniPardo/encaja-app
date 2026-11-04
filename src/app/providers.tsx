"use client";

import { MantineProvider, createTheme, localStorageColorSchemeManager } from "@mantine/core";
import { ModalsProvider } from "@mantine/modals";
import { Notifications } from "@mantine/notifications";

import { type Locale } from "@/features/i18n/config";
import { I18nProvider } from "@/features/i18n/provider";
import { colorSchemeStorageKey, defaultColorScheme } from "@/features/layout/color-scheme";

const theme = createTheme({
  primaryColor: "cyan",
  fontFamily: "'IBM Plex Sans', sans-serif",
  headings: {
    fontFamily: "'IBM Plex Sans Condensed', sans-serif",
  },
});

const colorSchemeManager = localStorageColorSchemeManager({ key: colorSchemeStorageKey });

export function AppProviders({
  children,
  initialLocale,
}: {
  children: React.ReactNode;
  initialLocale?: Locale;
}) {
  return (
    <I18nProvider initialLocale={initialLocale}>
      <MantineProvider
        theme={theme}
        defaultColorScheme={defaultColorScheme}
        colorSchemeManager={colorSchemeManager}
      >
        <Notifications position="top-right" />
        <ModalsProvider>{children}</ModalsProvider>
      </MantineProvider>
    </I18nProvider>
  );
}
