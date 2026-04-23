import { Box, Group, Paper, Stack, Text } from "@mantine/core";

import { formatSignedCurrency } from "@/features/dashboard/lib/dashboard-math";
import type { FinancialSummary, TranslationFn } from "@/features/dashboard/types/dashboard";

type DashboardPriorityOverviewCardProps = {
  isMobile: boolean;
  financialSummary: FinancialSummary;
  currencyFormatter: Intl.NumberFormat;
  t: TranslationFn;
};

type MetricTone = {
  titleColor: string;
  valueColor: string;
  borderColor: string;
  backgroundColor: string;
};

function PriorityMetricCard({
  title,
  value,
  helper,
  tone,
  isMobile,
}: {
  title: string;
  value: string;
  helper: string;
  tone: MetricTone;
  isMobile: boolean;
}) {
  return (
    <Paper
      withBorder
      radius="md"
      p={isMobile ? "sm" : "md"}
      style={{
        borderColor: tone.borderColor,
        backgroundColor: tone.backgroundColor,
      }}
    >
      <Stack gap={4}>
        <Text size="xs" fw={700} c={tone.titleColor}>
          {title}
        </Text>
        <Text fw={900} size={isMobile ? "xl" : "1.85rem"} c={tone.valueColor} lh={1.1}>
          {value}
        </Text>
        <Text size="xs" c="#667085">
          {helper}
        </Text>
      </Stack>
    </Paper>
  );
}

export function DashboardPriorityOverviewCard({
  isMobile,
  financialSummary,
  currencyFormatter,
  t,
}: DashboardPriorityOverviewCardProps) {
  const availableAmount = financialSummary.availabilityTotalBalance;
  const cardSpendingAmount = financialSummary.creditCardMonthConsumptionTotal;
  const nextCommitmentAmount = financialSummary.creditCardNextMonthInstallmentsTotal;

  return (
    <Paper
      withBorder
      radius="sm"
      p={isMobile ? "xs" : "sm"}
      style={{
        borderColor: "#d6dde7",
        backgroundColor: "#ffffff",
      }}
    >
      <Stack gap={isMobile ? "xs" : "sm"}>
        <Group justify="space-between" align="center" wrap="wrap" gap={6}>
          <Text size="xs" fw={800} c="#344054">
            {t("dashboard.priorityBlockTitle")}
          </Text>
          <Text size="xs" c="#667085">
            {t("dashboard.current")}
          </Text>
        </Group>

        <Box
          style={{
            display: "grid",
            gridTemplateColumns: isMobile ? "1fr" : "repeat(2, minmax(0, 1fr))",
            gap: isMobile ? 8 : 10,
          }}
        >
          <PriorityMetricCard
            title={t("dashboard.availableNow")}
            value={currencyFormatter.format(availableAmount)}
            helper={t("dashboard.totalBalanceDescription")}
            tone={{
              titleColor: "#087f5b",
              valueColor: availableAmount >= 0 ? "#087f5b" : "#c92a2a",
              borderColor: "#b6e3c9",
              backgroundColor: "#f2fff7",
            }}
            isMobile={isMobile}
          />

          <PriorityMetricCard
            title={t("dashboard.cardSpendingMonth")}
            value={currencyFormatter.format(cardSpendingAmount)}
            helper={t("dashboard.cardSpendingMonthHelper")}
            tone={{
              titleColor: "#b42318",
              valueColor: cardSpendingAmount > 0 ? "#b42318" : "#344054",
              borderColor: "#f1c0bd",
              backgroundColor: "#fff7f6",
            }}
            isMobile={isMobile}
          />
        </Box>

        <Group justify="space-between" align="center" wrap="wrap" gap={6}>
          <Text size="xs" fw={700} c="#475467">
            {t("dashboard.nextMonthCommitmentLabel")}
          </Text>
          <Text size="xs" fw={700} c="#b54708">
            {formatSignedCurrency(-nextCommitmentAmount, currencyFormatter)}
          </Text>
        </Group>
      </Stack>
    </Paper>
  );
}
