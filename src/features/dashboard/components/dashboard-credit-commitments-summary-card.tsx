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
      color: "#667085",
    },
    {
      key: "payments",
      label: t("dashboard.monthPaymentsLabel"),
      value: formatSignedCurrency(financialSummary.creditCardMonthPaymentsTotal, compactCurrencyFormatter),
      color: "#087f5b",
    },
    {
      key: "consumption",
      label: t("dashboard.statementCurrentLabel"),
      value: formatSignedCurrency(-financialSummary.creditCardMonthConsumptionTotal, compactCurrencyFormatter),
      color: "#c92a2a",
    },
    {
      key: "rolled",
      label: t("dashboard.creditRolledDebtLabel"),
      value: formatSignedCurrency(-financialSummary.creditCardRolledDebtTotal, compactCurrencyFormatter),
      color: financialSummary.creditCardRolledDebtTotal > 0 ? "#c92a2a" : "#087f5b",
    },
    {
      key: "next",
      label: t("dashboard.nextMonthCommitmentLabel"),
      value: formatSignedCurrency(-financialSummary.creditCardNextMonthInstallmentsTotal, compactCurrencyFormatter),
      color: "#b54708",
    },
  ];

  return (
    <Paper
      withBorder
      radius="sm"
      p={isMobile ? "xs" : "sm"}
      style={{
        borderColor: "#e5e9f0",
        backgroundColor: "#ffffff",
      }}
    >
      <Stack gap={isMobile ? "xs" : "sm"}>
        <Group justify="space-between" align="center">
          <Text size="xs" fw={800} c="#344054">
            {t("dashboard.creditCommitmentsTitle")}
          </Text>
          <UnstyledButton component={Link} href={detailHref}>
            <Text size="11px" fw={700} c="#3b5bdb">
              {t("dashboard.viewDetail")}
            </Text>
          </UnstyledButton>
        </Group>

        <Stack gap={6}>
          {rows.map((row) => (
            <Group key={row.key} justify="space-between" align="center" wrap="nowrap" gap={8}>
              <Text size="xs" c="#667085" lineClamp={1}>
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
