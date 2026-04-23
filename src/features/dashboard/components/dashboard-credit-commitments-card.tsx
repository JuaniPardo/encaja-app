import { Fragment } from "react";
import { Group, Paper, Stack, Text } from "@mantine/core";

import { formatSignedCurrency } from "@/features/dashboard/lib/dashboard-math";
import type { FinancialSummary, TranslationFn } from "@/features/dashboard/types/dashboard";

type DashboardCreditCommitmentsCardProps = {
  isMobile: boolean;
  financialSummary: FinancialSummary;
  currencyFormatter: Intl.NumberFormat;
  t: TranslationFn;
};

export function DashboardCreditCommitmentsCard({
  isMobile,
  financialSummary,
  currencyFormatter,
  t,
}: DashboardCreditCommitmentsCardProps) {
  const hasCreditCards = financialSummary.creditCardRows.length > 0;

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
        <Text size="xs" fw={800} c="#344054">
          {t("dashboard.creditCommitmentsTitle")}
        </Text>

        {!hasCreditCards ? (
          <Text size="xs" c="#98a2b3">
            {t("dashboard.noCreditCardsInBalance")}
          </Text>
        ) : (
          <Stack gap={8}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "minmax(0, 1fr) minmax(0, auto)",
                columnGap: 10,
                rowGap: 8,
              }}
            >
              {[
                {
                  key: "previous",
                  label: t("dashboard.previousMonthStatementLabel"),
                  value: formatSignedCurrency(-financialSummary.creditCardPreviousMonthStatementTotal, currencyFormatter),
                  color: "#667085",
                },
                {
                  key: "payments",
                  label: t("dashboard.monthPaymentsLabel"),
                  value: formatSignedCurrency(financialSummary.creditCardMonthPaymentsTotal, currencyFormatter),
                  color: "#087f5b",
                },
                {
                  key: "consumption",
                  label: t("dashboard.statementCurrentLabel"),
                  value: formatSignedCurrency(-financialSummary.creditCardMonthConsumptionTotal, currencyFormatter),
                  color: "#c92a2a",
                },
                {
                  key: "rolled",
                  label: t("dashboard.creditRolledDebtLabel"),
                  value: formatSignedCurrency(-financialSummary.creditCardRolledDebtTotal, currencyFormatter),
                  color: financialSummary.creditCardRolledDebtTotal > 0 ? "#c92a2a" : "#087f5b",
                },
                {
                  key: "next",
                  label: t("dashboard.nextMonthCommitmentLabel"),
                  value: formatSignedCurrency(-financialSummary.creditCardNextMonthInstallmentsTotal, currencyFormatter),
                  color: "#b54708",
                },
              ].map((row) => (
                <Fragment key={row.key}>
                  <Text size="xs" fw={600} c="#475467">
                    {row.label}
                  </Text>
                  <Text size="xs" fw={700} c={row.color} ta="right">
                    {row.value}
                  </Text>
                </Fragment>
              ))}
            </div>

            <Group justify="space-between" align="center" wrap="wrap" gap={6}>
              <Text size="xs" c="#667085">
                {t("dashboard.creditCardsSectionTitle")}
              </Text>
              <Text size="xs" fw={700} c="#475467">
                {financialSummary.creditCardRows.length}
              </Text>
            </Group>
          </Stack>
        )}
      </Stack>
    </Paper>
  );
}
