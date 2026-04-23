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
  impact?: number;
  urgency?: number;
  data?: Record<string, unknown>;
};

export type FinancialStateLevel = "healthy" | "stable" | "attention" | "critical";

export type FinancialState = {
  level: FinancialStateLevel;
  title: string;
  message: string;
  pressureScore: number;
  data: {
    availableCurrent: number;
    futurePressureAmount: number;
    futurePressureVsIncome: number | null;
    projectedExpenseVariable: number;
    projectedBalance: number;
  };
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
  financialState: FinancialState;
  allInsights: Insight[];
  primaryInsight: Insight | null;
  modules: InsightModuleResult[];
};

export type InsightPeriodRange = {
  start: string;
  end: string;
};

export type InsightCategoryExpense = {
  categoryId: string;
  categoryName: string;
  amount: number;
  behavior: "fixed" | "variable" | null;
};

export type InsightsContext = {
  referenceDate: Date;
  currentPeriod: InsightPeriodRange;
  previousPeriod: InsightPeriodRange;
  nextPeriod: InsightPeriodRange;
  availableCurrent: number;
  creditCardCount: number;
  incomeCurrentMonth: number;
  expenseCurrentMonth: number;
  savingCurrentMonth: number;
  creditCardExpenseCurrentMonth: number;
  creditCardExpensePreviousMonth: number;
  creditCardPaymentsCurrentMonth: number;
  creditCardPreviousMonthStatement: number;
  creditCardRolledDebtCurrent: number;
  creditCardDebtTotal: number;
  creditCardCurrentStatement: number;
  creditCardNextMonthCommitment: number;
  projectedIncomeTotal: number;
  projectedExpenseTotal: number;
  projectedExpenseVariable: number;
  projectedBalance: number;
  elapsedDaysCurrentMonth: number;
  daysInCurrentMonth: number;
  relevantTransactionCountCurrentMonth: number;
  expenseByCategoryCurrentMonth: InsightCategoryExpense[];
};
