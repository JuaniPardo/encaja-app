"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Button,
  Checkbox,
  Group,
  LoadingOverlay,
  Paper,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";

import { useI18n } from "@/features/i18n/provider";
import { buildStartProgress, type StartProgress, type StartStatus } from "@/features/start/progress";
import { buildWorkspaceHref } from "@/features/workspace/routing";
import { useWorkspace } from "@/features/workspace/workspace-provider";
import type { Database } from "@/types/database";

type TransactionIdRow = Pick<Database["public"]["Tables"]["transactions"]["Row"], "id">;

type StartCopy = {
  status: string;
  action: string;
  insight: string;
  cta: string;
};

const earlyStageGuidanceKeys = [
  "start.guidance.message1",
  "start.guidance.message2",
  "start.guidance.message3",
  "start.guidance.message4",
  "start.guidance.message5",
  "start.guidance.message6",
] as const;

function getDayOfYear(currentDate: Date) {
  const startOfYear = new Date(currentDate.getFullYear(), 0, 0);
  const msDiff = currentDate.getTime() - startOfYear.getTime();
  return Math.floor(msDiff / 86_400_000);
}

function getWorkspaceSeed(workspaceId: string) {
  return workspaceId
    .split("")
    .reduce((accumulator, character) => accumulator + character.charCodeAt(0), 0);
}

function resolveGuidanceInsight(
  status: StartStatus,
  workspaceId: string,
  t: (key: string, fallback?: string) => string,
) {
  if (status === "ready_for_balance") {
    return null;
  }

  const index = (getWorkspaceSeed(workspaceId) + getDayOfYear(new Date())) % earlyStageGuidanceKeys.length;
  return t(earlyStageGuidanceKeys[index]);
}

const defaultStartProgress: StartProgress = buildStartProgress({
  hasAnyTransactions: false,
  hasIncomeTransactions: false,
  expenseTransactionCount: 0,
});

export default function StartPage() {
  const { supabase, workspace } = useWorkspace();
  const { t } = useI18n();
  const [isLoading, setIsLoading] = useState(true);
  const [progress, setProgress] = useState<StartProgress>(defaultStartProgress);

  const copyByStatus = useMemo<Record<StartStatus, StartCopy>>(
    () => ({
      no_movements: {
        status: t("start.status.noMovements"),
        action: t("start.action.firstExpense"),
        insight: t("start.insight.noMovements"),
        cta: t("start.cta.newTransaction"),
      },
      started: {
        status: t("start.status.started"),
        action: t("start.action.keepLogging"),
        insight: t("start.insight.started"),
        cta: t("start.cta.newTransaction"),
      },
      ready_for_balance: {
        status: t("start.status.readyForBalance"),
        action: t("start.action.reviewBalance"),
        insight: t("start.insight.readyForBalance"),
        cta: t("start.cta.goDashboard"),
      },
    }),
    [t],
  );

  const checklistItems = useMemo(
    () => [
      {
        id: "first-income",
        label: t("start.checklist.firstIncome"),
        done: progress.checklist.firstIncome,
      },
      {
        id: "three-expenses",
        label: t("start.checklist.threeExpenses"),
        done: progress.checklist.threeExpenses,
      },
      {
        id: "review-balance",
        label: t("start.checklist.reviewBalance"),
        done: progress.checklist.reviewBalance,
      },
    ],
    [progress.checklist.firstIncome, progress.checklist.reviewBalance, progress.checklist.threeExpenses, t],
  );

  const actionHref = useMemo(() => {
    if (progress.status === "ready_for_balance") {
      return buildWorkspaceHref(workspace.slug);
    }

    const searchParams = new URLSearchParams({ new: "1" });
    if (progress.recommendedTransactionType) {
      searchParams.set("prefillType", progress.recommendedTransactionType);
    }

    return `${buildWorkspaceHref(workspace.slug, "/transactions")}?${searchParams.toString()}`;
  }, [progress.recommendedTransactionType, progress.status, workspace.slug]);

  const loadProgress = useCallback(async () => {
    setIsLoading(true);

    const anyTransactionsResponse = await supabase
      .from("transactions")
      .select("id")
      .eq("workspace_id", workspace.id)
      .limit(1);

    const incomeTransactionsResponse = await supabase
      .from("transactions")
      .select("id")
      .eq("workspace_id", workspace.id)
      .eq("type", "income")
      .limit(1);

    const expenseTransactionsResponse = await supabase
      .from("transactions")
      .select("id")
      .eq("workspace_id", workspace.id)
      .eq("type", "expense")
      .limit(3);

    setIsLoading(false);

    const hasError =
      anyTransactionsResponse.error ||
      incomeTransactionsResponse.error ||
      expenseTransactionsResponse.error;

    if (hasError) {
      const message =
        anyTransactionsResponse.error?.message ||
        incomeTransactionsResponse.error?.message ||
        expenseTransactionsResponse.error?.message ||
        t("start.notifications.loadErrorFallback");

      notifications.show({
        color: "red",
        title: t("start.notifications.loadErrorTitle"),
        message,
      });
      setProgress(defaultStartProgress);
      return;
    }

    const anyRows = (anyTransactionsResponse.data ?? []) as TransactionIdRow[];
    const incomeRows = (incomeTransactionsResponse.data ?? []) as TransactionIdRow[];
    const expenseRows = (expenseTransactionsResponse.data ?? []) as TransactionIdRow[];

    setProgress(
      buildStartProgress({
        hasAnyTransactions: anyRows.length > 0,
        hasIncomeTransactions: incomeRows.length > 0,
        expenseTransactionCount: expenseRows.length,
      }),
    );
  }, [supabase, t, workspace.id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadProgress();
  }, [loadProgress]);

  const copy = copyByStatus[progress.status];
  const guidanceInsight = useMemo(
    () => resolveGuidanceInsight(progress.status, workspace.id, t),
    [progress.status, t, workspace.id],
  );
  const insightMessage = guidanceInsight ?? copy.insight;

  return (
    <Stack gap="sm" pos="relative">
      <LoadingOverlay visible={isLoading} />

      <Stack gap={2}>
        <Title order={2} component="h1">{t("start.title")}</Title>
        <Text c="dimmed" size="sm">
          {t("start.subtitle")}
        </Text>
      </Stack>

      <Paper withBorder radius="md" p="md">
        <Stack gap={4}>
          <Text size="xs" c="dimmed" fw={600}>
            {t("start.sections.currentStatus")}
          </Text>
          <Text size="lg" fw={700}>
            {copy.status}
          </Text>
        </Stack>
      </Paper>

      <Paper withBorder radius="md" p="md">
        <Group justify="space-between" align="flex-end" wrap="wrap" gap="sm">
          <Stack gap={4}>
            <Text size="xs" c="dimmed" fw={600}>
              {t("start.sections.primaryAction")}
            </Text>
            <Text size="lg" fw={700}>
              {copy.action}
            </Text>
          </Stack>

          <Button component={Link} href={actionHref}>
            {copy.cta}
          </Button>
        </Group>
      </Paper>

      <Paper withBorder radius="md" p="md">
        <Stack gap={4}>
          <Text size="xs" c="dimmed" fw={600}>
            {t("start.sections.insight")}
          </Text>
          <Text size="sm">{insightMessage}</Text>
        </Stack>
      </Paper>

      <Paper withBorder radius="md" p="md">
        <Stack gap="xs">
          <Group justify="space-between" align="center" wrap="wrap" gap="xs">
            <Text size="xs" c="dimmed" fw={600}>
              {t("start.sections.checklist")}
            </Text>
            <Text size="xs" c="dimmed">
              {t("start.progressSummary", undefined, {
                completed: progress.checklist.completed,
                total: progress.checklist.total,
              })}
            </Text>
          </Group>

          <Stack gap={4}>
            {checklistItems.map((item) => (
              <Checkbox
                key={item.id}
                checked={item.done}
                readOnly
                label={item.label}
                size="sm"
                color={item.done ? "cyan" : "gray"}
              />
            ))}
          </Stack>
        </Stack>
      </Paper>
    </Stack>
  );
}
