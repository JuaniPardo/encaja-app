import { Box, Group, Paper, RingProgress, SimpleGrid, Stack, Text } from "@mantine/core";

import { clampToPercent } from "@/features/dashboard/lib/dashboard-math";
import { dashboardVisibleTypes, typeTheme } from "@/features/dashboard/lib/dashboard-theme";
import type { DashboardTypeLabels, DonutDataByType, TranslationFn } from "@/features/dashboard/types/dashboard";

type DashboardDistributionPanelProps = {
  isMobile: boolean;
  isTablet: boolean;
  cardPadding: "xs" | "sm";
  distributionColumns: number;
  donutData: DonutDataByType;
  donutSize: number;
  donutThickness: number;
  compactCurrencyFormatter: Intl.NumberFormat;
  typeLabels: DashboardTypeLabels;
  t: TranslationFn;
};

export function DashboardDistributionPanel({
  isMobile,
  isTablet,
  cardPadding,
  distributionColumns,
  donutData,
  donutSize,
  donutThickness,
  compactCurrencyFormatter,
  typeLabels,
  t,
}: DashboardDistributionPanelProps) {
  return (
    <Paper
      p={cardPadding}
      radius="sm"
      style={{
        border: "1px solid #d6dde7",
        backgroundColor: "#ffffff",
      }}
    >
      <Stack gap={isMobile ? 6 : "xs"}>
        <Text size="xs" fw={800} c="#344054">
          {t("dashboard.monthMovementsTitle")}
        </Text>

        <SimpleGrid cols={distributionColumns} spacing={isMobile ? 6 : 8}>
          {dashboardVisibleTypes.map((type) => {
            const donut = donutData[type];
            const hasData = donut.slices.length > 0;
            const stackVisuals = isMobile || isTablet;

            return (
              <Paper
                key={type}
                p={isMobile ? 6 : "xs"}
                radius="sm"
                style={{
                  border: "1px solid #e4e7ec",
                  backgroundColor: "#fbfcff",
                  minHeight: hasData ? donutSize + (isMobile ? 22 : 30) : isMobile ? 76 : 96,
                }}
              >
                <Box
                  style={{
                    display: "grid",
                    gridTemplateColumns: stackVisuals ? "1fr" : `${donutSize}px minmax(0, 1fr)`,
                    gap: stackVisuals ? 8 : 6,
                    alignItems: "center",
                  }}
                >
                  <Box
                    style={{
                      display: "flex",
                      justifyContent: "center",
                      alignItems: "center",
                    }}
                  >
                    <RingProgress
                      size={donutSize}
                      thickness={donutThickness}
                      roundCaps
                      sections={
                        hasData
                          ? donut.slices.map((slice) => ({
                              value: clampToPercent(slice.value),
                              color: slice.color,
                            }))
                          : [{ value: 100, color: "#e4e7ec" }]
                      }
                      label={
                        <Text size={isMobile ? "9px" : "10px"} c="#344054" ta="center" fw={700}>
                          {compactCurrencyFormatter.format(donut.total)}
                        </Text>
                      }
                    />
                  </Box>

                  <Stack
                    gap={3}
                    style={{
                      minWidth: 0,
                      maxWidth: stackVisuals ? "100%" : 220,
                      marginInline: stackVisuals ? "auto" : 0,
                      width: "100%",
                    }}
                  >
                    <Text size="xs" fw={700} c={typeTheme[type].main}>
                      {typeLabels[type]}
                    </Text>
                    {!hasData ? (
                      <Text size={isMobile ? "11px" : "xs"} c="#98a2b3">
                        {t("dashboard.noRealDataInPeriod")}
                      </Text>
                    ) : (
                      donut.slices.map((slice) => (
                        <Group key={`${type}-${slice.label}`} justify="space-between" gap={6} wrap="nowrap">
                          <Group gap={6} wrap="nowrap" style={{ minWidth: 0 }}>
                            <Box h={8} w={8} style={{ borderRadius: 2, backgroundColor: slice.color }} />
                            <Text size={isMobile ? "11px" : "xs"} c="#344054" lineClamp={1}>
                              {slice.label}
                            </Text>
                          </Group>
                          <Text
                            size={isMobile ? "11px" : "xs"}
                            c="#344054"
                            fw={700}
                            style={{ textAlign: "right", whiteSpace: "nowrap" }}
                          >
                            {compactCurrencyFormatter.format(slice.amount)}
                          </Text>
                        </Group>
                      ))
                    )}
                  </Stack>
                </Box>
              </Paper>
            );
          })}
        </SimpleGrid>
      </Stack>
    </Paper>
  );
}
