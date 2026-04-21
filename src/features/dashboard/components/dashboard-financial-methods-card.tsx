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
            <Text fw={800} c={financialSummary.totalBalance >= 0 ? "#087f5b" : "#c92a2a"}>
              {t("dashboard.totalBalance")}: {currencyFormatter.format(financialSummary.totalBalance)}
            </Text>
            <Text size="xs" fw={700} c={financialSummary.totalMonthImpact >= 0 ? "#087f5b" : "#c92a2a"}>
              {t("dashboard.monthImpact")}: {formatSignedCurrency(financialSummary.totalMonthImpact, currencyFormatter)}
            </Text>
            <Text
              size="xs"
              fw={700}
              c={financialSummary.totalPendingInstallments >= 0 ? "#087f5b" : "#c92a2a"}
            >
              {t("dashboard.pendingInstallments")}:
              {" "}
              {formatSignedCurrency(financialSummary.totalPendingInstallments, currencyFormatter)}
            </Text>
            <Text size="xs" c="#667085">
              {t("dashboard.activeInBalance", undefined, {
                count: financialSummary.activeIncludedRows.length,
              })}
            </Text>
          </Stack>
        </Group>

        {financialSummary.activeIncludedRows.length === 0 ? (
          <Text size="xs" c="#667085">
            {t("dashboard.noActiveMethodsInMainBalance")}
          </Text>
        ) : (
          <Stack gap={6}>
            {financialSummary.activeIncludedRows.map((row) => (
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
                      {t("dashboard.monthlyMovementLabel")}: {formatSignedCurrency(row.monthImpact, currencyFormatter)}
                    </Text>
                    {row.type === "credit_card" && Math.abs(row.pendingInstallments) > 0.004 ? (
                      <Text size="10px" fw={700} c={row.pendingInstallments >= 0 ? "#087f5b" : "#c92a2a"}>
                        {t("dashboard.pendingInstallmentsShort")}:
                        {" "}
                        {formatSignedCurrency(row.pendingInstallments, currencyFormatter)}
                      </Text>
                    ) : null}
                  </Stack>
                </Group>
              </UnstyledButton>
            ))}
          </Stack>
        )}

        {financialSummary.excludedActiveCount > 0 || financialSummary.inactiveCount > 0 ? (
          <Text size="xs" c="#98a2b3">
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
