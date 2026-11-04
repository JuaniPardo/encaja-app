import { Badge, Group, Paper, Stack, Text } from "@mantine/core";

import type { TranslationFn } from "@/features/dashboard/types/dashboard";
import type { FinancialState } from "@/features/insights/types";

type DashboardFinancialStateCardProps = {
  isMobile: boolean;
  financialState: FinancialState;
  currencyFormatter: Intl.NumberFormat;
  t: TranslationFn;
};

type LevelTone = {
  badgeColor: string;
  borderColor: string;
  backgroundColor: string;
};

function resolveLevelTone(level: FinancialState["level"]): LevelTone {
  if (level === "critical") {
    return {
      badgeColor: "red",
      borderColor: "var(--encaja-negative-border)",
      backgroundColor: "var(--encaja-negative-bg)",
    };
  }

  if (level === "attention") {
    return {
      badgeColor: "yellow",
      borderColor: "var(--encaja-warning-border)",
      backgroundColor: "var(--encaja-warning-bg)",
    };
  }

  if (level === "healthy") {
    return {
      badgeColor: "green",
      borderColor: "var(--encaja-positive-border)",
      backgroundColor: "var(--encaja-positive-bg)",
    };
  }

  return {
    badgeColor: "blue",
    borderColor: "var(--encaja-info-border)",
    backgroundColor: "var(--encaja-info-bg)",
  };
}

function resolveLevelLabel(level: FinancialState["level"], t: TranslationFn) {
  return t(`insightsV2.financialState.levels.${level}.title`);
}

function resolveQuickMessage(level: FinancialState["level"], t: TranslationFn) {
  return t(`dashboard.financialStateQuickMessage.${level}`);
}

export function DashboardFinancialStateCard({
  isMobile,
  financialState,
  currencyFormatter,
  t,
}: DashboardFinancialStateCardProps) {
  const tone = resolveLevelTone(financialState.level);

  return (
    <Paper
      withBorder
      radius="sm"
      p={isMobile ? "sm" : "md"}
      style={{
        borderColor: tone.borderColor,
        backgroundColor: tone.backgroundColor,
      }}
    >
      <Stack gap={isMobile ? 7 : 9}>
        <Group justify="space-between" align="center" wrap="wrap" gap={6}>
          <Group gap={6} align="baseline" wrap="nowrap">
            <Text size="xs" fw={800} c="var(--encaja-text-primary)">
              {t("dashboard.financialStateTitle")}
            </Text>
            <Text size="11px" c="var(--encaja-text-muted)">
              {t("dashboard.todayLabel")}
            </Text>
          </Group>
          <Badge variant="light" color={tone.badgeColor}>
            {resolveLevelLabel(financialState.level, t)}
          </Badge>
        </Group>

        <Text size={isMobile ? "md" : "lg"} fw={800} c="var(--encaja-text-strong)" lh={1.2}>
          {resolveQuickMessage(financialState.level, t)}
        </Text>

        <Text size="xs" c="var(--encaja-text-muted)">
          {financialState.message}
        </Text>

        <Group justify="space-between" align="center" wrap="wrap" gap={6}>
          <Text size="11px" c="var(--encaja-text-muted)">
            {t("dashboard.financialStatePressureLabel")}
          </Text>
          <Text size="11px" fw={700} c="var(--encaja-text-primary)">
            {currencyFormatter.format(financialState.data.futurePressureAmount)}
          </Text>
        </Group>
      </Stack>
    </Paper>
  );
}
