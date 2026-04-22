"use client";

import { useEffect } from "react";
import { Badge, LoadingOverlay, Paper, Stack, Text, Title } from "@mantine/core";
import { notifications } from "@mantine/notifications";

import { useI18n } from "@/features/i18n/provider";
import { useInsightsV2 } from "@/features/insights/use-insights-v2";
import type { Insight } from "@/features/insights/types";
import { useWorkspace } from "@/features/workspace/workspace-provider";

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

function resolveSeverityLabel(
  severity: Insight["severity"],
  t: (key: string, fallback?: string, values?: Record<string, string | number>) => string,
) {
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

export default function InsightsPage() {
  const { workspace, supabase } = useWorkspace();
  const { intlLocale, t } = useI18n();

  const { isLoading, errorMessage, result } = useInsightsV2({
    supabase,
    workspaceId: workspace.id,
    intlLocale,
    t,
  });

  useEffect(() => {
    if (!errorMessage) {
      return;
    }

    notifications.show({
      color: "red",
      title: t("insightsV2.notifications.loadErrorTitle"),
      message: errorMessage,
    });
  }, [errorMessage, t]);

  return (
    <Stack gap="sm" pos="relative">
      <LoadingOverlay visible={isLoading} />

      <Stack gap={2}>
        <Title order={2} component="h1">
          {t("insightsV2.title")}
        </Title>
        <Text c="#667085" size="sm">
          {t("insightsV2.subtitle")}
        </Text>
      </Stack>

      {result.modules.length === 0 ? (
        <Paper withBorder radius="sm" p="md" style={{ borderColor: "#d6dde7" }}>
          <Text size="sm" c="#667085">
            {t("insightsV2.emptyState")}
          </Text>
        </Paper>
      ) : (
        result.modules.map((moduleResult) => (
          <Paper
            key={moduleResult.module}
            withBorder
            radius="sm"
            p="md"
            style={{
              borderColor: "#d6dde7",
              backgroundColor: "#ffffff",
            }}
          >
            <Stack gap="sm">
              <Text fw={800} size="lg" c="#1f2937">
                {moduleResult.metadata.title}
              </Text>

              {moduleResult.insights.length === 0 ? (
                <Text size="sm" c="#667085">
                  {t("insightsV2.moduleEmptyState")}
                </Text>
              ) : (
                <Stack gap="xs">
                  {moduleResult.insights.map((insight) => (
                    <Paper
                      key={insight.id}
                      withBorder
                      radius="sm"
                      p="sm"
                      style={{
                        borderColor: "#e4e7ec",
                        backgroundColor: "#f8fafc",
                      }}
                    >
                      <Stack gap={6}>
                        <Stack gap={4}>
                          <Badge color={resolveSeverityColor(insight.severity)} variant="light" w="fit-content">
                            {resolveSeverityLabel(insight.severity, t)}
                          </Badge>
                          <Text fw={700} c="#1f2937">
                            {insight.title}
                          </Text>
                          <Text size="sm" c="#475467">
                            {insight.message}
                          </Text>
                        </Stack>
                      </Stack>
                    </Paper>
                  ))}
                </Stack>
              )}

              <Text size="sm" c="#667085">
                {moduleResult.metadata.description}
              </Text>
            </Stack>
          </Paper>
        ))
      )}
    </Stack>
  );
}
