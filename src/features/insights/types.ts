export type InsightSeverity = "info" | "warning" | "alert" | "positive";

export type InsightModule = "credit_card" | "behavior" | "spending" | "cashflow" | "activity";

export type Insight = {
  id: string;
  module: InsightModule;
  kind: string;
  severity: InsightSeverity;
  title: string;
  message: string;
  priority: number;
  data?: Record<string, unknown>;
};

export type InsightModuleMetadata = {
  module: InsightModule;
  title: string;
  description: string;
};

export type InsightModuleResult = {
  module: InsightModule;
  metadata: InsightModuleMetadata;
  insights: Insight[];
};

export type InsightsResult = {
  allInsights: Insight[];
  primaryInsight: Insight | null;
  modules: InsightModuleResult[];
};

export type InsightPeriodRange = {
  start: string;
  end: string;
};

export type InsightsContext = {
  referenceDate: Date;
  currentPeriod: InsightPeriodRange;
  previousPeriod: InsightPeriodRange;
  nextPeriod: InsightPeriodRange;
  creditCardCount: number;
  creditCardDueDatePassed: boolean;
  incomeCurrentMonth: number;
  creditCardExpenseCurrentMonth: number;
  creditCardExpensePreviousMonth: number;
  creditCardPaymentsCurrentMonth: number;
  creditCardDebtTotal: number;
  creditCardCurrentStatement: number;
  creditCardNextMonthInstallments: number;
};
