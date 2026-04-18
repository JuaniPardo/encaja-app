"use client";

import { useCallback, useMemo, useState } from "react";
import { Grid, LoadingOverlay, Stack } from "@mantine/core";

import { DashboardCompactSummaryStrip } from "@/features/dashboard/components/dashboard-compact-summary-strip";
import { DashboardDistributionPanel } from "@/features/dashboard/components/dashboard-distribution-panel";
import { DashboardFinancialMethodsCard } from "@/features/dashboard/components/dashboard-financial-methods-card";
import { DashboardHeaderCard } from "@/features/dashboard/components/dashboard-header-card";
import { DashboardOnboardingCtaCard } from "@/features/dashboard/components/dashboard-onboarding-cta-card";
import { DashboardPeriodKpis } from "@/features/dashboard/components/dashboard-period-kpis";
import { DashboardTypeSummarySection } from "@/features/dashboard/components/dashboard-type-summary-section";
import { LinkedWorkspaceSummaryCard } from "@/features/dashboard/components/linked-workspace-summary-card";
import { useDashboardData } from "@/features/dashboard/hooks/use-dashboard-data";
import { useDashboardViewModel } from "@/features/dashboard/hooks/use-dashboard-view-model";
import { useDashboardResponsive } from "@/features/dashboard/lib/dashboard-responsive";
import { buildMonthOptions } from "@/features/i18n/formatting";
import { useI18n } from "@/features/i18n/provider";
import { useWorkspace } from "@/features/workspace/workspace-provider";

export default function DashboardPage() {
  const { supabase, workspace } = useWorkspace();
  const { intlLocale, locale, t } = useI18n();
  const monthOptions = useMemo(() => buildMonthOptions(intlLocale), [intlLocale]);

  const now = useMemo(() => new Date(), []);
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);

  const {
    categories,
    budgetItems,
    transactionRows,
    allTransactionsImpact,
    paymentMethodRows,
    linkedWorkspacePaymentMethodBalances,
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
    savingsVsIncome,
    donutData,
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
    monthOptions,
    startYear,
    categories,
    budgetItems,
    transactionRows,
    allTransactionsImpact,
    paymentMethodRows,
    linkedWorkspacePaymentMethodBalances,
    currencyFormatter,
    showCents,
    isBootstrapping,
    hasAnyTransactions,
  });

  const {
    isMobile,
    isNarrowMobile,
    isDesktop,
    kpiColumns,
    distributionColumns,
    cardPadding,
    tableHorizontalSpacing,
    tableVerticalSpacing,
    executionBarWidth,
    donutSize,
    donutThickness,
    compactSummaryDonutSize,
    compactSummaryDonutThickness,
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

  return (
    <Stack gap={isMobile ? "xs" : "sm"} pos="relative">
      <LoadingOverlay visible={isBootstrapping || isLoadingSummary} />

      {shouldShowOnboardingCta ? <DashboardOnboardingCtaCard onboardingHref={onboardingHref} t={t} /> : null}

      <DashboardHeaderCard
        isMobile={isMobile}
        selectedPeriodLabel={selectedPeriodLabel}
        workspaceName={workspace.name}
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

      {isMobile ? (
        <DashboardCompactSummaryStrip
          isNarrowMobile={isNarrowMobile}
          compactSummaryDonutSize={compactSummaryDonutSize}
          compactSummaryDonutThickness={compactSummaryDonutThickness}
          compactCurrencyFormatter={compactCurrencyFormatter}
          totalsByType={metrics.totalsByType}
          typeLabels={typeLabels}
        />
      ) : null}

      {isDesktop ? (
        <Grid gap="sm" align="stretch">
          <Grid.Col span={6}>
            <DashboardFinancialMethodsCard
              isMobile={isMobile}
              financialSummary={financialSummary}
              currencyFormatter={currencyFormatter}
              paymentMethodTypeLabels={paymentMethodTypeLabels}
              paymentMethodDrilldownHref={paymentMethodDrilldownHref}
              t={t}
            />
          </Grid.Col>
          <Grid.Col span={6}>
            <DashboardPeriodKpis
              isDesktop={isDesktop}
              isMobile={isMobile}
              kpiColumns={kpiColumns}
              balanceBudget={metrics.balanceBudget}
              balanceReal={metrics.balanceReal}
              balanceDelta={metrics.balanceDelta}
              savingReal={metrics.totalsByType.saving.real}
              savingBudget={metrics.totalsByType.saving.budget}
              savingsVsIncome={savingsVsIncome}
              currencyFormatter={currencyFormatter}
              percentageFormatter={percentageFormatter}
              t={t}
              stackLayout
            />
          </Grid.Col>
        </Grid>
      ) : (
        <>
          <DashboardFinancialMethodsCard
            isMobile={isMobile}
            financialSummary={financialSummary}
            currencyFormatter={currencyFormatter}
            paymentMethodTypeLabels={paymentMethodTypeLabels}
            paymentMethodDrilldownHref={paymentMethodDrilldownHref}
            t={t}
          />
          <DashboardPeriodKpis
            isDesktop={isDesktop}
            isMobile={isMobile}
            kpiColumns={kpiColumns}
            balanceBudget={metrics.balanceBudget}
            balanceReal={metrics.balanceReal}
            balanceDelta={metrics.balanceDelta}
            savingReal={metrics.totalsByType.saving.real}
            savingBudget={metrics.totalsByType.saving.budget}
            savingsVsIncome={savingsVsIncome}
            currencyFormatter={currencyFormatter}
            percentageFormatter={percentageFormatter}
            t={t}
          />
        </>
      )}

      {shouldShowLinkedWorkspaceSummary ? (
        <LinkedWorkspaceSummaryCard
          isMobile={isMobile}
          linkedWorkspaceBalanceGroups={linkedWorkspaceBalanceGroups}
          linkedWorkspaceCurrencyFormatters={linkedWorkspaceCurrencyFormatters}
          t={t}
        />
      ) : null}

      <Stack gap={isMobile ? "xs" : "sm"}>
        {summaryRows.map(({ type, rows }) => (
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

      {!isMobile ? (
        <DashboardDistributionPanel
          isMobile={isMobile}
          cardPadding={cardPadding}
          distributionColumns={distributionColumns}
          donutData={donutData}
          donutSize={donutSize}
          donutThickness={donutThickness}
          compactCurrencyFormatter={compactCurrencyFormatter}
          typeLabels={typeLabels}
          t={t}
        />
      ) : null}
    </Stack>
  );
}
