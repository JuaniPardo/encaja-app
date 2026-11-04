import { Paper, Skeleton, Stack, Text } from "@mantine/core";

import type { TranslationFn } from "@/features/dashboard/types/dashboard";

type DashboardInsightsStatusCardProps = {
  isMobile: boolean;
  slot: "financialState" | "primaryInsight";
  status: "loading" | "error";
  t: TranslationFn;
};

export function DashboardInsightsStatusCard({ isMobile, slot, status, t }: DashboardInsightsStatusCardProps) {
  const isFinancialState = slot === "financialState";

  return (
    <Paper
      withBorder
      radius="sm"
      p={isFinancialState ? (isMobile ? "sm" : "md") : isMobile ? "8px" : "10px"}
      aria-busy={status === "loading"}
      style={{
        borderColor: "var(--encaja-border-strong)",
        backgroundColor: "var(--encaja-surface)",
      }}
    >
      <Stack gap={isFinancialState ? (isMobile ? 7 : 9) : 4}>
        <Text size={isFinancialState ? "xs" : "11px"} fw={isFinancialState ? 800 : 700} c="var(--encaja-text-primary)">
          {isFinancialState ? t("dashboard.financialStateTitle") : t("insightsV2.dashboard.slotTitle")}
        </Text>

        {status === "loading" ? (
          <>
            <Skeleton height={isFinancialState ? 20 : 14} width="80%" radius="sm" />
            <Skeleton height={10} width="50%" radius="sm" />
          </>
        ) : (
          <Text size="sm" c="var(--encaja-text-muted)">
            {isFinancialState ? t("dashboard.financialStateLoadError") : t("insightsV2.dashboard.loadError")}
          </Text>
        )}
      </Stack>
    </Paper>
  );
}
