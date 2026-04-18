import { Paper, RingProgress, SimpleGrid, Stack, Text } from "@mantine/core";

import { clampToPercent, roundMoney } from "@/features/dashboard/lib/dashboard-math";
import {
  compactSummaryBaseColor,
  compactSummaryNeutralColor,
  compactSummaryTheme,
  dashboardVisibleTypes,
  deviationTolerance,
} from "@/features/dashboard/lib/dashboard-theme";
import type { DashboardTypeLabels, TotalsByType } from "@/features/dashboard/types/dashboard";

type DashboardCompactSummaryStripProps = {
  isNarrowMobile: boolean;
  compactSummaryDonutSize: number;
  compactSummaryDonutThickness: number;
  compactCurrencyFormatter: Intl.NumberFormat;
  totalsByType: TotalsByType;
  typeLabels: DashboardTypeLabels;
};

export function DashboardCompactSummaryStrip({
  isNarrowMobile,
  compactSummaryDonutSize,
  compactSummaryDonutThickness,
  compactCurrencyFormatter,
  totalsByType,
  typeLabels,
}: DashboardCompactSummaryStripProps) {
  return (
    <Paper
      p="xs"
      radius="sm"
      style={{
        border: "1px solid #d6dde7",
        backgroundColor: "#ffffff",
      }}
    >
      <SimpleGrid cols={3} spacing={8}>
        {dashboardVisibleTypes.map((type) => {
          const realValue = roundMoney(Math.max(0, totalsByType[type].real));
          const budgetValue = roundMoney(Math.max(0, totalsByType[type].budget));
          const theme = compactSummaryTheme[type];
          const hasBudget = budgetValue > deviationTolerance;
          const ratio = hasBudget ? Math.min(realValue / budgetValue, 1) : 0;
          const progressValue = clampToPercent(ratio * 100);
          const sections = hasBudget
            ? progressValue > 0
              ? [{ value: progressValue, color: theme.color }]
              : []
            : [{ value: 100, color: compactSummaryNeutralColor }];

          return (
            <Paper
              key={`compact-summary-${type}`}
              radius="sm"
              p={6}
              style={{
                border: "1px solid #e4e7ec",
                backgroundColor: "#f8fafc",
                minWidth: 0,
              }}
            >
              <Stack gap={4} align="center">
                <RingProgress
                  size={compactSummaryDonutSize}
                  thickness={compactSummaryDonutThickness}
                  roundCaps
                  rootColor={compactSummaryBaseColor}
                  sections={sections}
                  label={
                    <Text size={isNarrowMobile ? "9px" : "10px"} fw={800} ta="center" c="#1f2937">
                      {compactCurrencyFormatter.format(realValue)}
                    </Text>
                  }
                />
                <Text size={isNarrowMobile ? "9px" : "10px"} fw={700} c={theme.textColor} ta="center">
                  {typeLabels[type]}
                </Text>
              </Stack>
            </Paper>
          );
        })}
      </SimpleGrid>
    </Paper>
  );
}
