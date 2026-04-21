import Link from "next/link";
import { Badge, Button, Group, Paper, Stack, Text } from "@mantine/core";

import type { Insight } from "@/features/insights/types";
import type { TranslationFn } from "@/features/insights/modules/credit-card";

type DashboardPrimaryInsightCardProps = {
  insight: Insight;
  insightsHref: string;
  isMobile: boolean;
  t: TranslationFn;
};

function resolveSeverityColor(severity: Insight["severity"]) {
  if (severity === "alert") {
    return "red";
  }
  if (severity === "warning") {
    return "yellow";
  }
  if (severity === "positive") {
    return "green";
  }
  return "blue";
}

function resolveSeverityLabel(severity: Insight["severity"], t: TranslationFn) {
  if (severity === "alert") {
    return t("insightsV2.severity.alert");
  }
  if (severity === "warning") {
    return t("insightsV2.severity.warning");
  }
  if (severity === "positive") {
    return t("insightsV2.severity.positive");
  }
  return t("insightsV2.severity.info");
}

export function DashboardPrimaryInsightCard({
  insight,
  insightsHref,
  isMobile,
  t,
}: DashboardPrimaryInsightCardProps) {
  return (
    <Paper
      withBorder
      radius="sm"
      p={isMobile ? "xs" : "sm"}
      bg="#ffffff"
      style={{ borderColor: "#d6dde7" }}
    >
      <Stack gap={isMobile ? 6 : 8}>
        <Group justify="space-between" align="center">
          <Text size="xs" fw={700} c="#475467">
            {t("insightsV2.dashboard.slotTitle")}
          </Text>
          <Badge color={resolveSeverityColor(insight.severity)} variant="light">
            {resolveSeverityLabel(insight.severity, t)}
          </Badge>
        </Group>

        <Text fw={800} c="#1f2937">
          {insight.title}
        </Text>

        <Text size="sm" c="#475467">
          {insight.message}
        </Text>

        <Group justify="flex-start">
          <Button component={Link} href={insightsHref} variant="default" radius="md" size={isMobile ? "xs" : "sm"}>
            {t("insightsV2.dashboard.viewAll")}
          </Button>
        </Group>
      </Stack>
    </Paper>
  );
}
