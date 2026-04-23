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
      borderColor: "#f4c7c3",
      backgroundColor: "#fff8f7",
    };
  }

  if (level === "attention") {
    return {
      badgeColor: "yellow",
      borderColor: "#f2dda4",
      backgroundColor: "#fffaf0",
    };
  }

  if (level === "healthy") {
    return {
      badgeColor: "green",
      borderColor: "#b8e6c8",
      backgroundColor: "#f4fff8",
    };
  }

  return {
    badgeColor: "blue",
    borderColor: "#c6daf8",
    backgroundColor: "#f5f9ff",
  };
}

function resolveLevelLabel(level: FinancialState["level"], t: TranslationFn) {
  return t(`insightsV2.financialState.levels.${level}.title`);
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
      p={isMobile ? "xs" : "sm"}
      style={{
        borderColor: tone.borderColor,
        backgroundColor: tone.backgroundColor,
      }}
    >
      <Stack gap={isMobile ? 8 : 10}>
        <Group justify="space-between" align="center" wrap="wrap" gap={6}>
          <Text size="xs" fw={800} c="#344054">
            {t("dashboard.financialStateTitle")}
          </Text>
          <Badge variant="light" color={tone.badgeColor}>
            {resolveLevelLabel(financialState.level, t)}
          </Badge>
        </Group>

        <Text size={isMobile ? "sm" : "md"} fw={700} c="#1f2937" lh={1.3}>
          {financialState.message}
        </Text>

        <Group justify="space-between" align="center" wrap="wrap" gap={6}>
          <Text size="xs" c="#667085">
            {t("dashboard.financialStatePressureLabel")}
          </Text>
          <Text size="xs" fw={700} c="#344054">
            {currencyFormatter.format(financialState.data.futurePressureAmount)}
          </Text>
        </Group>
      </Stack>
    </Paper>
  );
}
