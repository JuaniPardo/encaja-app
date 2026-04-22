import Link from "next/link";
import { Group, Paper, Stack, Text, UnstyledButton } from "@mantine/core";

import { formatSignedCurrency } from "@/features/dashboard/lib/dashboard-math";
import type { FinancialSummary, PaymentMethodTypeLabels, TranslationFn } from "@/features/dashboard/types/dashboard";

type DashboardFinancialMethodsCardProps = {
  isMobile: boolean;
  financialSummary: FinancialSummary;
  currencyFormatter: Intl.NumberFormat;
  paymentMethodTypeLabels: PaymentMethodTypeLabels;
  paymentMethodDrilldownHref: (paymentMethodId: string) => string;
  t: TranslationFn;
};

export function DashboardFinancialMethodsCard({
  isMobile,
  financialSummary,
  currencyFormatter,
  paymentMethodTypeLabels,
  paymentMethodDrilldownHref,
  t,
}: DashboardFinancialMethodsCardProps) {
  return (
    <Paper
      withBorder
      radius="sm"
      p={isMobile ? "xs" : "sm"}
      bg="#ffffff"
      style={{ borderColor: "#d6dde7" }}
    >
      <Stack gap={isMobile ? "xs" : "sm"}>
        <Group justify="space-between" align="flex-start" wrap="wrap" gap={6}>
          <Stack gap={2}>
            <Text size="xs" fw={700} c="#475467">
              {t("dashboard.financialMethods")}
            </Text>
            <Text size="xs" c="#667085">
              {t("dashboard.activeInBalance", undefined, {
                count: financialSummary.includedActiveCount,
              })}
            </Text>
          </Stack>
        </Group>

        <Stack gap={6}>
          <Stack gap={2}>
            <Text size="xs" fw={700} c="#475467">
              {t("dashboard.availabilitySectionTitle")}
            </Text>
            <Text size="10px" c="#98a2b3">
              {t("dashboard.availabilitySectionHint")}
            </Text>
            <Text fw={800} c={financialSummary.availabilityTotalBalance >= 0 ? "#087f5b" : "#c92a2a"}>
              {t("dashboard.totalBalance")}: {currencyFormatter.format(financialSummary.availabilityTotalBalance)}
            </Text>
            <Text size="xs" fw={700} c="#475467">
              {t("dashboard.monthImpact")}:
              {" "}
              {formatSignedCurrency(financialSummary.availabilityTotalMonthImpact, currencyFormatter)}
            </Text>
          </Stack>

          {financialSummary.availabilityRows.length === 0 ? (
            <Text size="xs" c="#667085">
              {t("dashboard.noAvailabilityMethods")}
            </Text>
          ) : (
            <Stack gap={6}>
              {financialSummary.availabilityRows.map((row) => (
                <UnstyledButton
                  key={row.id}
                  component={Link}
                  href={paymentMethodDrilldownHref(row.id)}
                  className="dashboard-clickable-item"
                  style={{
                    display: "block",
                    borderRadius: 8,
                    border: "1px solid #e4e7ec",
                    backgroundColor: "#f8fafc",
                    padding: isMobile ? "6px 8px" : "6px 10px",
                  }}
                >
                  <Group justify="space-between" align="center" wrap="nowrap">
                    <Stack gap={0} style={{ minWidth: 0 }}>
                      <Text size="sm" fw={700} c="#1f2937" truncate>
                        {row.name}
                      </Text>
                      <Text size="xs" c="#667085">
                        {paymentMethodTypeLabels[row.type]} · {t("dashboard.viewMovements")}
                      </Text>
                    </Stack>
                    <Stack gap={0} style={{ minWidth: 0, textAlign: "right" }}>
                      <Text size="sm" fw={800} c={row.currentBalance >= 0 ? "#087f5b" : "#c92a2a"}>
                        {currencyFormatter.format(row.currentBalance)}
                      </Text>
                      <Text size="10px" fw={700} c={row.monthImpact >= 0 ? "#087f5b" : "#c92a2a"}>
                        {t("dashboard.monthlyMovementLabel")}:
                        {" "}
                        {formatSignedCurrency(row.monthImpact, currencyFormatter)}
                      </Text>
                    </Stack>
                  </Group>
                </UnstyledButton>
              ))}
            </Stack>
          )}
        </Stack>

        <Stack gap={6}>
          <Stack gap={2}>
            <Text size="xs" fw={700} c="#475467">
              {t("dashboard.creditCardsSectionTitle")}
            </Text>
            <Text fw={800} c={financialSummary.creditCardDebtTotal > 0.004 ? "#c92a2a" : "#475467"}>
              {t("dashboard.totalDebtLabel")}:
              {" "}
              {formatSignedCurrency(-financialSummary.creditCardDebtTotal, currencyFormatter)}
            </Text>
            <Text size="xs" fw={700} c="#475467">
              {t("dashboard.statementCurrentLabel")}:
              {" "}
              {formatSignedCurrency(-financialSummary.creditCardStatementTotal, currencyFormatter)}
            </Text>
            <Text size="xs" fw={700} c="#b54708">
              {t("dashboard.nextMonthCommitmentLabel")}:
              {" "}
              {formatSignedCurrency(-financialSummary.creditCardNextMonthCommitmentTotal, currencyFormatter)}
            </Text>
            {financialSummary.creditCardTotalInstallments > 0.004 ? (
              <Text size="10px" fw={700} c="#667085">
                {t("dashboard.futureInstallmentsLabel")}:
                {" "}
                {formatSignedCurrency(-financialSummary.creditCardTotalInstallments, currencyFormatter)}
              </Text>
            ) : null}
          </Stack>

          {financialSummary.creditCardRows.length === 0 ? (
            <Text size="xs" c="#667085">
              {t("dashboard.noCreditCardsInBalance")}
            </Text>
          ) : (
            <Stack gap={6}>
              {financialSummary.creditCardRows.map((row) => (
                <UnstyledButton
                  key={row.id}
                  component={Link}
                  href={paymentMethodDrilldownHref(row.id)}
                  className="dashboard-clickable-item"
                  style={{
                    display: "block",
                    borderRadius: 8,
                    border: "1px solid #f1d0d0",
                    backgroundColor: "#fff8f8",
                    padding: isMobile ? "6px 8px" : "6px 10px",
                  }}
                >
                  <Group justify="space-between" align="center" wrap="nowrap">
                    <Stack gap={0} style={{ minWidth: 0 }}>
                      <Text size="sm" fw={700} c="#1f2937" truncate>
                        {row.name}
                      </Text>
                      <Text size="xs" c="#667085">
                        {paymentMethodTypeLabels[row.type]} · {t("dashboard.viewMovements")}
                      </Text>
                    </Stack>
                    <Stack gap={1} style={{ minWidth: 0, textAlign: "right" }}>
                      <Text size="10px" fw={600} c="#667085">
                        {t("dashboard.totalDebtLabel")}
                      </Text>
                      <Text size="sm" fw={800} c="#c92a2a">
                        {formatSignedCurrency(-row.debtTotal, currencyFormatter)}
                      </Text>
                      <Text size="10px" fw={600} c="#667085">
                        {t("dashboard.statementCurrentLabel")}
                      </Text>
                      <Text size="10px" fw={700} c="#475467">
                        {formatSignedCurrency(-row.statementCurrent, currencyFormatter)}
                      </Text>
                      <Text size="10px" fw={600} c="#b54708">
                        {t("dashboard.nextMonthCommitmentLabel")}
                      </Text>
                      <Text size="10px" fw={700} c="#b54708">
                        {formatSignedCurrency(-row.nextMonthCommitment, currencyFormatter)}
                      </Text>
                      {row.totalInstallments > 0.004 ? (
                        <>
                          <Text size="10px" fw={600} c="#98a2b3">
                            {t("dashboard.futureInstallmentsLabel")}
                          </Text>
                          <Text size="10px" fw={700} c="#667085">
                            {formatSignedCurrency(-row.totalInstallments, currencyFormatter)}
                          </Text>
                        </>
                      ) : null}
                    </Stack>
                  </Group>
                </UnstyledButton>
              ))}
            </Stack>
          )}
        </Stack>

        {financialSummary.excludedActiveCount > 0 || financialSummary.inactiveCount > 0 ? (
          <Text size="xs" c="#667085">
            {t("dashboard.outOfBalanceSummary", undefined, {
              excluded: financialSummary.excludedActiveCount,
              inactive: financialSummary.inactiveCount,
            })}
          </Text>
        ) : null}
      </Stack>
    </Paper>
  );
}
