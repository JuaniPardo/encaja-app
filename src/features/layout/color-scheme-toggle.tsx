"use client";

import {
  ActionIcon,
  Box,
  Tooltip,
  useComputedColorScheme,
  useMantineColorScheme,
} from "@mantine/core";

import { useI18n } from "@/features/i18n/provider";
import { defaultColorScheme } from "@/features/layout/color-scheme";

function ColorSchemeIcon({ children }: { children: React.ReactNode }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export function ColorSchemeToggle() {
  const { t } = useI18n();
  const { setColorScheme } = useMantineColorScheme();
  const computedColorScheme = useComputedColorScheme(defaultColorScheme);
  const isDark = computedColorScheme === "dark";
  const label = isDark ? t("common.colorScheme.toLight") : t("common.colorScheme.toDark");

  return (
    <Tooltip label={label} withArrow position="bottom">
      <ActionIcon
        variant="light"
        color="gray"
        size="sm"
        onClick={() => setColorScheme(isDark ? "light" : "dark")}
        aria-label={label}
      >
        <Box component="span" darkHidden lh={0}>
          <ColorSchemeIcon>
            <path d="M20.5 14.5A8.5 8.5 0 0 1 9.5 3.5a8.5 8.5 0 1 0 11 11Z" />
          </ColorSchemeIcon>
        </Box>
        <Box component="span" lightHidden lh={0}>
          <ColorSchemeIcon>
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M18.7 5.3l-1.4 1.4M6.7 17.3l-1.4 1.4" />
          </ColorSchemeIcon>
        </Box>
      </ActionIcon>
    </Tooltip>
  );
}
