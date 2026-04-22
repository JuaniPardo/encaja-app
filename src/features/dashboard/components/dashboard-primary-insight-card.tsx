import Link from "next/link";
import { Badge, Group, Paper, Stack, Text, UnstyledButton } from "@mantine/core";

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

function resolveCardTone(severity: Insight["severity"]) {
  if (severity === "alert") {
    return {
      borderColor: "#f3b1b1",
      backgroundColor: "#fff5f5",
      badgeVariant: "filled" as const,
    };
  }
  if (severity === "warning") {
    return {
      borderColor: "#f4d9a0",
      backgroundColor: "#fffaf0",
      badgeVariant: "light" as const,
    };
  }
  if (severity === "positive") {
    return {
      borderColor: "#b2e2c1",
      backgroundColor: "#f4fff8",
      badgeVariant: "light" as const,
    };
  }
  return {
    borderColor: "#cfe0ff",
    backgroundColor: "#f5f9ff",
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
        p={isMobile ? "xs" : "sm"}
        bg={tone.backgroundColor}
        style={{ borderColor: tone.borderColor }}
      >
        <Stack gap={isMobile ? 4 : 6}>
          <Group justify="space-between" align="center">
            <Text size="xs" fw={700} c="#475467">
              {t("insightsV2.dashboard.slotTitle")}
            </Text>
            <Badge color={resolveSeverityColor(insight.severity)} variant={tone.badgeVariant}>
              {resolveInsightKindLabel(insight, t)}
            </Badge>
          </Group>

          <Text fw={800} c="#1f2937" size="sm" lineClamp={1}>
            {insight.title}
          </Text>

          <Text size="xs" c="#475467" lineClamp={1}>
            {insight.message}
          </Text>
        </Stack>
      </Paper>
    </UnstyledButton>
  );
}
