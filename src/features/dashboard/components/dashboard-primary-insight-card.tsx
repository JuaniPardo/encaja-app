import Link from "next/link";
import { Badge, Group, Paper, Stack, Text, UnstyledButton } from "@mantine/core";

import type { Insight } from "@/features/insights/types";
import type { TranslationFn } from "@/features/insights/intl";
import { resolveInsightKindLabel } from "@/features/insights/kind-label";

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

function resolveCardTone(severity: Insight["severity"]) {
  if (severity === "alert") {
    return {
      borderColor: "var(--encaja-negative-border-soft)",
      backgroundColor: "var(--encaja-negative-bg)",
      badgeVariant: "light" as const,
    };
  }
  if (severity === "warning") {
    return {
      borderColor: "var(--encaja-warning-border-soft)",
      backgroundColor: "var(--encaja-warning-bg)",
      badgeVariant: "light" as const,
    };
  }
  if (severity === "positive") {
    return {
      borderColor: "var(--encaja-positive-border-soft)",
      backgroundColor: "var(--encaja-positive-bg)",
      badgeVariant: "light" as const,
    };
  }
  return {
    borderColor: "var(--encaja-info-border-soft)",
    backgroundColor: "var(--encaja-info-bg)",
    badgeVariant: "light" as const,
  };
}

export function DashboardPrimaryInsightCard({
  insight,
  insightsHref,
  isMobile,
  t,
}: DashboardPrimaryInsightCardProps) {
  const tone = resolveCardTone(insight.severity);

  return (
    <UnstyledButton
      component={Link}
      href={insightsHref}
      style={{ display: "block" }}
      aria-label={t("insightsV2.dashboard.open")}
    >
      <Paper
        withBorder
        radius="sm"
        p={isMobile ? "8px" : "10px"}
        bg={tone.backgroundColor}
        style={{ borderColor: tone.borderColor }}
      >
        <Stack gap={4}>
          <Group justify="space-between" align="center">
            <Group gap={6} align="baseline" wrap="nowrap">
              <Text size="11px" fw={700} c="var(--encaja-text-muted)">
                {t("insightsV2.dashboard.slotTitle")}
              </Text>
              <Text size="11px" c="var(--encaja-text-muted)">
                {t("dashboard.todayLabel")}
              </Text>
            </Group>
            <Badge color={resolveSeverityColor(insight.severity)} variant={tone.badgeVariant} size="xs">
              {resolveInsightKindLabel(insight, t)}
            </Badge>
          </Group>

          <Text fw={700} c="var(--encaja-text-strong)" size="sm" lineClamp={1}>
            {insight.title}
          </Text>

          <Text size="11px" c="var(--encaja-text-muted)" lineClamp={1}>
            {insight.message}
          </Text>
        </Stack>
      </Paper>
    </UnstyledButton>
  );
}
