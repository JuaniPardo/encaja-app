import { Fragment } from "react";
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
  const creditMetricsGridColumns = "minmax(0, 1fr) minmax(0, 2fr)";
  const creditMetricsRowsGap = isMobile ? 8 : 12;
  const creditFinancialBlockPadding = isMobile ? 8 : 14;
  const creditMetricsInnerGap = isMobile ? 8 : 12;

  type CreditMetricRow = {
    key: string;
    label: string;
    value: string;
    labelColor: string;
    valueColor: string;
    valueWeight: number;
  };

  const renderCreditMetrics = (rows: CreditMetricRow[]) => (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: `minmax(0, 1fr) minmax(0, auto)`,
        columnGap: creditMetricsInnerGap,
        rowGap: 2,
        alignItems: "center",
      }}
    >
      {rows.map((metric) => (
        <Fragment key={metric.key}>
          <Text size="10px" fw={600} c={metric.labelColor}>
            {metric.label}
          </Text>
          <Text size="10px" fw={metric.valueWeight} c={metric.valueColor} ta="right">
            {metric.value}
          </Text>
        </Fragment>
      ))}
    </div>
  );

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
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: creditMetricsGridColumns,
                      gap: creditMetricsRowsGap,
                      alignItems: "stretch",
                    }}
                  >
                    <Stack
                      gap={2}
                      justify="center"
                      style={{
                        minWidth: 0,
                        paddingLeft: isMobile ? 2 : 6,
                        paddingRight: isMobile ? 4 : 8,
                      }}
                    >
                      <Text size="sm" fw={700} c="#1f2937" truncate>
                        {row.name}
                      </Text>
                      <Text size="xs" c="#667085">
                        {paymentMethodTypeLabels[row.type]}
                      </Text>
                      <Text size="xs" c="#667085">
                        {t("dashboard.viewMovements")}
                      </Text>
                    </Stack>

                    <div
                      style={{
                        borderLeft: "1px solid #f1d0d0",
                        paddingLeft: creditFinancialBlockPadding,
                        minWidth: 0,
                      }}
                    >
                      {renderCreditMetrics([
                        {
                          key: "previous-month-statement",
                          label: t("dashboard.previousMonthStatementLabel"),
                          value: formatSignedCurrency(-row.previousMonthStatement, currencyFormatter),
                          labelColor: "#667085",
                          valueColor: "#667085",
                          valueWeight: 700,
                        },
                        {
                          key: "month-payments",
                          label: t("dashboard.monthPaymentsLabel"),
                          value: formatSignedCurrency(row.monthPayments, currencyFormatter),
                          labelColor: "#087f5b",
                          valueColor: "#087f5b",
                          valueWeight: 700,
                        },
                        {
                          key: "month-consumption",
                          label: t("dashboard.statementCurrentLabel"),
                          value: formatSignedCurrency(-row.monthConsumption, currencyFormatter),
                          labelColor: "#667085",
                          valueColor: "#1f2937",
                          valueWeight: 800,
                        },
                        ...(row.nextMonthInstallments > 0.004
                          ? [{
                          key: "next-month-installments",
                          label: t("dashboard.nextMonthCommitmentLabel"),
                          value: formatSignedCurrency(-row.nextMonthInstallments, currencyFormatter),
                          labelColor: "#b54708",
                          valueColor: "#b54708",
                          valueWeight: 700,
                          }]
                          : []),
                      ])}
                    </div>
                  </div>
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
