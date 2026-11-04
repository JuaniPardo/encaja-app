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
  detailRows = [],
  tone,
  isMobile,
}: {
  title: string;
  value: string;
  helper: string;
  detailRows?: Array<{
    label: string;
    value: string;
    color?: string;
  }>;
  tone: MetricTone;
  isMobile: boolean;
}) {
  return (
    <Paper
      withBorder={false}
      radius="md"
      p={isMobile ? "sm" : "md"}
      style={{
        backgroundColor: tone.backgroundColor,
      }}
    >
      <Stack gap={5}>
        <Text size="xs" fw={700} c={tone.titleColor}>
          {title}
        </Text>
        <Text fw={900} size={isMobile ? "xl" : "1.85rem"} c={tone.valueColor} lh={1.1}>
          {value}
        </Text>
        <Text size="xs" c="var(--encaja-text-muted)">
          {helper}
        </Text>
        {detailRows.length > 0 ? (
          <Stack gap={4} pt={2}>
            {detailRows.map((row) => (
              <Group key={row.label} justify="space-between" align="center" wrap="nowrap" gap={8}>
                <Text size="11px" c="var(--encaja-text-muted)" lineClamp={1}>
                  {row.label}
                </Text>
                <Text size="11px" fw={700} c={row.color ?? "var(--encaja-text-primary)"} style={{ whiteSpace: "nowrap" }}>
                  {row.value}
                </Text>
              </Group>
            ))}
          </Stack>
        ) : null}
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
  const rolledDebtAmount = financialSummary.creditCardRolledDebtTotal;

  return (
    <Paper
      withBorder
      radius="sm"
      p={isMobile ? "xs" : "sm"}
      style={{
        borderColor: "var(--encaja-border-soft)",
        backgroundColor: "var(--encaja-surface)",
      }}
    >
      <Stack gap={isMobile ? "xs" : "sm"}>
        <Group justify="space-between" align="center" wrap="wrap" gap={6}>
          <Text size="xs" fw={800} c="var(--encaja-text-primary)">
            {t("dashboard.priorityBlockTitle")}
          </Text>
          <Text size="xs" c="var(--encaja-text-muted)">
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
              titleColor: "var(--encaja-positive-text)",
              valueColor: availableAmount >= 0 ? "var(--encaja-positive-text)" : "var(--encaja-negative-text)",
              borderColor: "var(--encaja-positive-border)",
              backgroundColor: "var(--encaja-positive-bg)",
            }}
            isMobile={isMobile}
          />

          <PriorityMetricCard
            title={t("dashboard.cardSpendingMonth")}
            value={currencyFormatter.format(cardSpendingAmount)}
            helper={t("dashboard.cardSpendingMonthHelper")}
            detailRows={[
              {
                label: t("dashboard.nextMonthCommitmentLabel"),
                value: formatSignedCurrency(-nextCommitmentAmount, currencyFormatter),
                color: "var(--encaja-warning-text)",
              },
              {
                label: t("dashboard.creditRolledDebtLabel"),
                value: formatSignedCurrency(-rolledDebtAmount, currencyFormatter),
                color: rolledDebtAmount > 0 ? "var(--encaja-negative-text)" : "var(--encaja-positive-text)",
              },
            ]}
            tone={{
              titleColor: "var(--encaja-critical-text)",
              valueColor: cardSpendingAmount > 0 ? "var(--encaja-critical-text)" : "var(--encaja-text-primary)",
              borderColor: "var(--encaja-negative-border)",
              backgroundColor: "var(--encaja-negative-bg)",
            }}
            isMobile={isMobile}
          />
        </Box>
      </Stack>
    </Paper>
  );
}
