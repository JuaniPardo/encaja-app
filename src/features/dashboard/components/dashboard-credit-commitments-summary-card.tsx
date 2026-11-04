import Link from "next/link";
import { Group, Paper, Stack, Text, UnstyledButton } from "@mantine/core";

import { formatSignedCurrency } from "@/features/dashboard/lib/dashboard-math";
import type { FinancialSummary, TranslationFn } from "@/features/dashboard/types/dashboard";

type DashboardCreditCommitmentsSummaryCardProps = {
  isMobile: boolean;
  financialSummary: FinancialSummary;
  compactCurrencyFormatter: Intl.NumberFormat;
  detailHref: string;
  t: TranslationFn;
};

export function DashboardCreditCommitmentsSummaryCard({
  isMobile,
  financialSummary,
  compactCurrencyFormatter,
  detailHref,
  t,
}: DashboardCreditCommitmentsSummaryCardProps) {
  const rows = [
    {
      key: "previous",
      label: t("dashboard.previousMonthStatementLabel"),
      value: formatSignedCurrency(-financialSummary.creditCardPreviousMonthStatementTotal, compactCurrencyFormatter),
      color: "var(--encaja-text-muted)",
    },
    {
      key: "payments",
      label: t("dashboard.monthPaymentsLabel"),
      value: formatSignedCurrency(financialSummary.creditCardMonthPaymentsTotal, compactCurrencyFormatter),
      color: "var(--encaja-positive-text)",
    },
    {
      key: "consumption",
      label: t("dashboard.statementCurrentLabel"),
      value: formatSignedCurrency(-financialSummary.creditCardMonthConsumptionTotal, compactCurrencyFormatter),
      color: "var(--encaja-negative-text)",
    },
    {
      key: "rolled",
      label: t("dashboard.creditRolledDebtLabel"),
      value: formatSignedCurrency(-financialSummary.creditCardRolledDebtTotal, compactCurrencyFormatter),
      color: financialSummary.creditCardRolledDebtTotal > 0 ? "var(--encaja-negative-text)" : "var(--encaja-positive-text)",
    },
    {
      key: "next",
      label: t("dashboard.nextMonthCommitmentLabel"),
      value: formatSignedCurrency(-financialSummary.creditCardNextMonthInstallmentsTotal, compactCurrencyFormatter),
      color: "var(--encaja-warning-text)",
    },
  ];

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
        <Group justify="space-between" align="center">
          <Text size="xs" fw={800} c="var(--encaja-text-primary)">
            {t("dashboard.creditCommitmentsTitle")}
          </Text>
          <UnstyledButton component={Link} href={detailHref}>
            <Text size="11px" fw={700} c="var(--encaja-link-text)">
              {t("dashboard.viewDetail")}
            </Text>
          </UnstyledButton>
        </Group>

        <Stack gap={6}>
          {rows.map((row) => (
            <Group key={row.key} justify="space-between" align="center" wrap="nowrap" gap={8}>
              <Text size="xs" c="var(--encaja-text-muted)" lineClamp={1}>
                {row.label}
              </Text>
              <Text size="xs" fw={700} c={row.color} style={{ whiteSpace: "nowrap" }}>
                {row.value}
              </Text>
            </Group>
          ))}
        </Stack>
      </Stack>
    </Paper>
  );
}
