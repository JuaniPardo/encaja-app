"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Box, LoadingOverlay, Paper, Stack, Text } from "@mantine/core";
import { notifications } from "@mantine/notifications";

import { DashboardBudgetVsExpenseCard } from "@/features/dashboard/components/dashboard-budget-vs-expense-card";
import { DashboardFinancialStateCard } from "@/features/dashboard/components/dashboard-financial-state-card";
import { DashboardFinancialMethodsCard } from "@/features/dashboard/components/dashboard-financial-methods-card";
import { DashboardHeaderCard } from "@/features/dashboard/components/dashboard-header-card";
import { DashboardMonthFlowCard } from "@/features/dashboard/components/dashboard-month-flow-card";
import { DashboardOnboardingCtaCard } from "@/features/dashboard/components/dashboard-onboarding-cta-card";
import { DashboardPriorityOverviewCard } from "@/features/dashboard/components/dashboard-priority-overview-card";
import { DashboardPrimaryInsightCard } from "@/features/dashboard/components/dashboard-primary-insight-card";
import { DashboardRecentTransactionsCard } from "@/features/dashboard/components/dashboard-recent-transactions-card";
import { DashboardTopExpenseCategoriesCard } from "@/features/dashboard/components/dashboard-top-expense-categories-card";
import { DashboardTypeSummarySection } from "@/features/dashboard/components/dashboard-type-summary-section";
import { LinkedWorkspaceSummaryCard } from "@/features/dashboard/components/linked-workspace-summary-card";
import { useDashboardData } from "@/features/dashboard/hooks/use-dashboard-data";
import { useDashboardViewModel } from "@/features/dashboard/hooks/use-dashboard-view-model";
import { useDashboardResponsive } from "@/features/dashboard/lib/dashboard-responsive";
import { buildMonthOptions } from "@/features/i18n/formatting";
import { useI18n } from "@/features/i18n/provider";
import { useInsightsV2 } from "@/features/insights/use-insights-v2";
import { canManageWorkspaceSettings } from "@/features/workspace/permissions";
import { buildWorkspaceHref } from "@/features/workspace/routing";
import { useWorkspace } from "@/features/workspace/workspace-provider";

export default function DashboardPage() {
  const { supabase, workspace, workspaces, createDemoWorkspace, switchWorkspace } = useWorkspace();
  const { intlLocale, locale, t } = useI18n();
  const monthOptions = useMemo(() => buildMonthOptions(intlLocale), [intlLocale]);
  const canCreateDemoWorkspace = canManageWorkspaceSettings(workspace.role);
  const [isCreatingDemoWorkspace, setIsCreatingDemoWorkspace] = useState(false);

  const now = useMemo(() => new Date(), []);
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  const demoWorkspace = useMemo(
    () => workspaces.find((workspaceItem) => workspaceItem.isDemo) ?? null,
    [workspaces],
  );
  const demoWorkspaceHref = useMemo(
    () => (demoWorkspace ? buildWorkspaceHref(demoWorkspace.slug) : null),
    [demoWorkspace],
  );
  const insightsHref = useMemo(() => buildWorkspaceHref(workspace.slug, "/insights"), [workspace.slug]);

  const {
    categories,
    budgetItems,
    transactionRows,
    allTransactionsImpact,
    nextMonthCommitmentByMethodId,
    previousMonthStatementByMethodId,
    currentMonthPaymentsByMethodId,
    paymentMethodRows,
    linkedWorkspacePaymentMethodBalances,
    systemCategoryKeyById,
    startYear,
    currencyCode,
    showCents,
    hasAnyTransactions,
    isBootstrapping,
    isLoadingSummary,
    setIsLoadingSummary,
  } = useDashboardData({
    supabase,
    workspaceId: workspace.id,
    locale,
    selectedYear,
    selectedMonth,
    t,
  });

  const currencyFormatter = useMemo(() => {
    return new Intl.NumberFormat(intlLocale, {
      style: "currency",
      currency: currencyCode || "ARS",
      minimumFractionDigits: showCents ? 2 : 0,
      maximumFractionDigits: showCents ? 2 : 0,
    });
  }, [currencyCode, intlLocale, showCents]);

  const {
    isLoading: isLoadingInsights,
    errorMessage: insightsErrorMessage,
    result: insightsResult,
  } = useInsightsV2({
    supabase,
    workspaceId: workspace.id,
    intlLocale,
    t,
    referenceDate: now,
  });

  useEffect(() => {
    if (!insightsErrorMessage) {
      return;
    }

    notifications.show({
      color: "red",
      title: t("insightsV2.notifications.loadErrorTitle"),
      message: insightsErrorMessage,
    });
  }, [insightsErrorMessage, t]);

  const percentageFormatter = useMemo(() => {
    return new Intl.NumberFormat(intlLocale, {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    });
  }, [intlLocale]);

  const compactFormatter = useMemo(() => {
    return new Intl.NumberFormat(intlLocale, {
      notation: "compact",
      maximumFractionDigits: 1,
    });
  }, [intlLocale]);

  const compactCurrencyFormatter = useMemo(() => {
    return new Intl.NumberFormat(intlLocale, {
      style: "currency",
      currency: currencyCode || "ARS",
      notation: "compact",
      maximumFractionDigits: 1,
    });
  }, [currencyCode, intlLocale]);

  const {
    typeLabels,
    paymentMethodTypeLabels,
    yearOptions,
    metrics,
    summaryRows,
    financialSummary,
    linkedWorkspaceBalanceGroups,
    linkedWorkspaceCurrencyFormatters,
    shouldShowLinkedWorkspaceSummary,
    shouldShowOnboardingCta,
    onboardingHref,
    selectedPeriodLabel,
    paymentMethodDrilldownHref,
    categoryDrilldownHref,
  } = useDashboardViewModel({
    locale,
    intlLocale,
    t,
    workspaceSlug: workspace.slug,
    selectedYear,
    selectedMonth,
    referenceDate: now,
    monthOptions,
    startYear,
    categories,
    systemCategoryKeyById,
    budgetItems,
    transactionRows,
    allTransactionsImpact,
    nextMonthCommitmentByMethodId,
    previousMonthStatementByMethodId,
    currentMonthPaymentsByMethodId,
    paymentMethodRows,
    linkedWorkspacePaymentMethodBalances,
    currencyFormatter,
    showCents,
    isBootstrapping,
    hasAnyTransactions,
  });

  const {
    isMobile,
    isDesktop,
    tableHorizontalSpacing,
    tableVerticalSpacing,
    executionBarWidth,
    tableColumnWidths,
  } = useDashboardResponsive();

  const handleSelectMonth = useCallback(
    (month: number) => {
      setIsLoadingSummary(true);
      setSelectedMonth(month);
    },
    [setIsLoadingSummary],
  );

  const handleSelectYear = useCallback(
    (year: number) => {
      setIsLoadingSummary(true);
      setSelectedYear(year);
    },
    [setIsLoadingSummary],
  );

  const handleCreateDemoWorkspace = useCallback(async () => {
    if (!canCreateDemoWorkspace) {
      notifications.show({
        color: "yellow",
        title: t("workspaceSettings.notifications.permissionDeniedTitle"),
        message: t("dashboard.gettingStarted.demoWorkspaceNotAllowed"),
      });
      return;
    }

    if (demoWorkspace) {
      switchWorkspace(demoWorkspace.slug);
      return;
    }

    setIsCreatingDemoWorkspace(true);

    try {
      const defaultDemoWorkspaceName = t("workspaceSettings.modals.createWorkspace.demoDefaultName");
      const createdWorkspace = await createDemoWorkspace(defaultDemoWorkspaceName);
      notifications.show({
        color: "cyan",
        title: t("dashboard.notifications.demoWorkspaceCreatedTitle"),
        message: t("dashboard.notifications.demoWorkspaceCreatedMessage", undefined, {
          workspaceName: createdWorkspace.name,
        }),
      });
      switchWorkspace(createdWorkspace.slug);
    } catch (error) {
      notifications.show({
        color: "red",
        title: t("dashboard.notifications.createDemoWorkspaceError"),
        message: error instanceof Error ? error.message : t("dashboard.notifications.createDemoWorkspaceError"),
      });
    } finally {
      setIsCreatingDemoWorkspace(false);
    }
  }, [canCreateDemoWorkspace, createDemoWorkspace, demoWorkspace, switchWorkspace, t]);

  const summaryRowsByType = useMemo(() => {
    return new Map(summaryRows.map((row) => [row.type, row.rows]));
  }, [summaryRows]);

  const expenseRows = summaryRowsByType.get("expense") ?? [];
  const sectionGap = isMobile ? "xs" : "sm";

  const primaryInsightBlock = shouldShowOnboardingCta ? (
    <DashboardOnboardingCtaCard
      onboardingHref={onboardingHref}
      demoWorkspaceHref={demoWorkspaceHref}
      hasDemoWorkspace={demoWorkspace !== null}
      canCreateDemoWorkspace={canCreateDemoWorkspace}
      isCreatingDemoWorkspace={isCreatingDemoWorkspace}
      onCreateDemoWorkspace={() => {
        void handleCreateDemoWorkspace();
      }}
      t={t}
    />
  ) : !isLoadingInsights && insightsResult.primaryInsight ? (
    <DashboardPrimaryInsightCard
      insight={insightsResult.primaryInsight}
      insightsHref={insightsHref}
      isMobile={isMobile}
      t={t}
    />
  ) : (
    <Paper
      withBorder
      radius="sm"
      p={isMobile ? "xs" : "sm"}
      style={{
        borderColor: "#d6dde7",
        backgroundColor: "#ffffff",
      }}
    >
      <Text size="xs" c="#667085">
        {t("insightsV2.emptyState")}
      </Text>
    </Paper>
  );

  return (
    <Stack gap={sectionGap} pos="relative">
      <LoadingOverlay visible={isBootstrapping || isLoadingSummary} />

      <DashboardHeaderCard
        isMobile={isMobile}
        selectedPeriodLabel={selectedPeriodLabel}
        workspaceSlug={workspace.slug}
        currencyCode={currencyCode}
        monthOptions={monthOptions}
        yearOptions={yearOptions}
        selectedMonth={selectedMonth}
        selectedYear={selectedYear}
        onSelectMonth={handleSelectMonth}
        onSelectYear={handleSelectYear}
        t={t}
      />

      <DashboardPriorityOverviewCard
        isMobile={isMobile}
        financialSummary={financialSummary}
        currencyFormatter={currencyFormatter}
        t={t}
      />

      {isDesktop ? (
        <Box
          style={{
            display: "grid",
            gridTemplateColumns: "1.35fr 1fr",
            gap: 16,
            alignItems: "start",
          }}
        >
          <DashboardFinancialStateCard
            isMobile={isMobile}
            financialState={insightsResult.financialState}
            currencyFormatter={currencyFormatter}
            t={t}
          />

          {primaryInsightBlock}
        </Box>
      ) : (
        <>
          <DashboardFinancialStateCard
            isMobile={isMobile}
            financialState={insightsResult.financialState}
            currencyFormatter={currencyFormatter}
            t={t}
          />
          {primaryInsightBlock}
        </>
      )}

      {isDesktop ? (
        <Box
          style={{
            display: "grid",
            gridTemplateColumns: "1.6fr 1fr",
            gap: 16,
            alignItems: "start",
          }}
        >
          <Stack gap={sectionGap}>
            <DashboardMonthFlowCard
              isMobile={isMobile}
              selectedYear={selectedYear}
              selectedMonth={selectedMonth}
              transactionRows={transactionRows}
              compactCurrencyFormatter={compactCurrencyFormatter}
              t={t}
            />
          </Stack>
          <Stack gap={sectionGap}>
            <DashboardTopExpenseCategoriesCard
              isMobile={isMobile}
              rows={expenseRows}
              compactCurrencyFormatter={compactCurrencyFormatter}
              categoryDrilldownHref={categoryDrilldownHref}
              t={t}
            />
          </Stack>
        </Box>
      ) : (
        <Stack gap={sectionGap}>
          <DashboardMonthFlowCard
            isMobile={isMobile}
            selectedYear={selectedYear}
            selectedMonth={selectedMonth}
            transactionRows={transactionRows}
            compactCurrencyFormatter={compactCurrencyFormatter}
            t={t}
          />
          <DashboardTopExpenseCategoriesCard
            isMobile={isMobile}
            rows={expenseRows}
            compactCurrencyFormatter={compactCurrencyFormatter}
            categoryDrilldownHref={categoryDrilldownHref}
            t={t}
          />
        </Stack>
      )}

      <DashboardBudgetVsExpenseCard
        isMobile={isMobile}
        expenseBudget={metrics.totalsByType.expense.budget}
        expenseReal={metrics.totalsByType.expense.real}
        expenseDeviation={metrics.totalsByType.expense.deviation}
        expenseRows={expenseRows}
        compactFormatter={compactFormatter}
        percentageFormatter={percentageFormatter}
        t={t}
      />

      {isDesktop ? (
        <Box
          style={{
            display: "grid",
            gridTemplateColumns: "1.6fr 1fr",
            gap: 16,
            alignItems: "start",
          }}
        >
          <DashboardTypeSummarySection
            type="expense"
            rows={expenseRows}
            totals={metrics.totalsByType.expense}
            typeLabel={typeLabels.expense}
            isMobile={isMobile}
            tableHorizontalSpacing={tableHorizontalSpacing}
            tableVerticalSpacing={tableVerticalSpacing}
            tableColumnWidths={tableColumnWidths}
            executionBarWidth={executionBarWidth}
            compactFormatter={compactFormatter}
            currencyFormatter={currencyFormatter}
            percentageFormatter={percentageFormatter}
            categoryDrilldownHref={categoryDrilldownHref}
            t={t}
          />
          <DashboardRecentTransactionsCard
            isMobile={isMobile}
            locale={locale}
            categories={categories}
            transactionRows={transactionRows}
            compactCurrencyFormatter={compactCurrencyFormatter}
            categoryDrilldownHref={categoryDrilldownHref}
            typeLabels={typeLabels}
            t={t}
          />
        </Box>
      ) : (
        <>
          <DashboardRecentTransactionsCard
            isMobile={isMobile}
            locale={locale}
            categories={categories}
            transactionRows={transactionRows}
            compactCurrencyFormatter={compactCurrencyFormatter}
            categoryDrilldownHref={categoryDrilldownHref}
            typeLabels={typeLabels}
            t={t}
          />
          <DashboardTypeSummarySection
            type="expense"
            rows={expenseRows}
            totals={metrics.totalsByType.expense}
            typeLabel={typeLabels.expense}
            isMobile={isMobile}
            tableHorizontalSpacing={tableHorizontalSpacing}
            tableVerticalSpacing={tableVerticalSpacing}
            tableColumnWidths={tableColumnWidths}
            executionBarWidth={executionBarWidth}
            compactFormatter={compactFormatter}
            currencyFormatter={currencyFormatter}
            percentageFormatter={percentageFormatter}
            categoryDrilldownHref={categoryDrilldownHref}
            t={t}
          />
        </>
      )}

      <DashboardFinancialMethodsCard
        isMobile={isMobile}
        financialSummary={financialSummary}
        currencyFormatter={currencyFormatter}
        paymentMethodTypeLabels={paymentMethodTypeLabels}
        paymentMethodDrilldownHref={paymentMethodDrilldownHref}
        t={t}
      />

      {shouldShowLinkedWorkspaceSummary ? (
        <LinkedWorkspaceSummaryCard
          isMobile={isMobile}
          linkedWorkspaceBalanceGroups={linkedWorkspaceBalanceGroups}
          linkedWorkspaceCurrencyFormatters={linkedWorkspaceCurrencyFormatters}
          t={t}
        />
      ) : null}

      <Stack gap={sectionGap}>
        {summaryRows
          .filter((row) => row.type !== "expense")
          .map(({ type, rows }) => (
            <DashboardTypeSummarySection
              key={type}
              type={type}
              rows={rows}
              totals={metrics.totalsByType[type]}
              typeLabel={typeLabels[type]}
              isMobile={isMobile}
              tableHorizontalSpacing={tableHorizontalSpacing}
              tableVerticalSpacing={tableVerticalSpacing}
              tableColumnWidths={tableColumnWidths}
              executionBarWidth={executionBarWidth}
              compactFormatter={compactFormatter}
              currencyFormatter={currencyFormatter}
              percentageFormatter={percentageFormatter}
              categoryDrilldownHref={categoryDrilldownHref}
              t={t}
            />
          ))}
      </Stack>
    </Stack>
  );
}
