"use client";

import { SegmentedControl } from "@mantine/core";

import { normalizeLocale } from "@/features/i18n/config";
import { useI18n } from "@/features/i18n/provider";

export function AuthLanguageSwitcher() {
  const { locale, setLocale, t } = useI18n();

  return (
    <SegmentedControl
      size="xs"
      value={locale}
      onChange={(value) => {
        const normalizedLocale = normalizeLocale(value);
        if (!normalizedLocale) {
          return;
        }

        setLocale(normalizedLocale);
      }}
      data={[
        { value: "es", label: t("settings.language.spanishOption") },
        { value: "en", label: t("settings.language.englishOption") },
      ]}
      aria-label={t("auth.language.switchAriaLabel")}
      fullWidth
    />
  );
}
