import Link from "next/link";
import { Badge, Group, Paper, Stack, Text, UnstyledButton } from "@mantine/core";

import type { Insight } from "@/features/insights/types";
import type { TranslationFn } from "@/features/insights/intl";

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
      borderColor: "#f0d2d0",
      backgroundColor: "#fffafa",
      badgeVariant: "light" as const,
    };
  }
  if (severity === "warning") {
    return {
      borderColor: "#eee3c5",
      backgroundColor: "#fffdf6",
      badgeVariant: "light" as const,
    };
  }
  if (severity === "positive") {
    return {
      borderColor: "#cde6d6",
      backgroundColor: "#f9fffb",
      badgeVariant: "light" as const,
    };
  }
  return {
    borderColor: "#dae4f6",
    backgroundColor: "#f8fbff",
    badgeVariant: "light" as const,
  };
}

function resolveInsightKindLabel(insight: Insight, t: TranslationFn) {
  if (insight.kind === "rolled_debt" || insight.kind === "unpaid") {
    return t("insightsV2.dashboard.kindBadge.pendingDebt");
  }
  if (insight.kind === "high_debt") {
    return t("insightsV2.dashboard.kindBadge.highDebt");
  }
  if (insight.kind === "high_usage") {
    return t("insightsV2.dashboard.kindBadge.highUsage");
  }
  if (insight.kind === "next_month_commitment") {
    return t("insightsV2.dashboard.kindBadge.futureCommitment");
  }
  if (insight.kind === "excess_spending") {
    return t("insightsV2.dashboard.kindBadge.expensePressure");
  }
  if (insight.kind === "category_imbalance") {
    return t("insightsV2.dashboard.kindBadge.categoryImbalance");
  }
  if (insight.kind === "low_saving") {
    return t("insightsV2.dashboard.kindBadge.lowSaving");
  }
  if (insight.kind === "low_activity") {
    return t("insightsV2.dashboard.kindBadge.lowActivity");
  }
  if (insight.kind === "full_payment" || insight.kind === "stable") {
    return t("insightsV2.dashboard.kindBadge.controlled");
  }
  return t("insightsV2.dashboard.kindBadge.attention");
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
            <Text size="11px" fw={700} c="#667085">
              {t("insightsV2.dashboard.slotTitle")}
            </Text>
            <Badge color={resolveSeverityColor(insight.severity)} variant={tone.badgeVariant} size="xs">
              {resolveInsightKindLabel(insight, t)}
            </Badge>
          </Group>

          <Text fw={700} c="#1f2937" size="sm" lineClamp={1}>
            {insight.title}
          </Text>

          <Text size="11px" c="#667085" lineClamp={1}>
            {insight.message}
          </Text>
        </Stack>
      </Paper>
    </UnstyledButton>
  );
}
