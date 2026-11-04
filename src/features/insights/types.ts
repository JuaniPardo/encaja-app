import type { ExpenseBehavior } from "@/types/database";

export type InsightSeverity = "info" | "warning" | "alert" | "positive";

export type InsightModule = "credit_card" | "behavior" | "spending" | "budget" | "cashflow" | "activity";

export type InsightKind =
  | "unpaid"
  | "rolled_debt"
  | "full_payment"
  | "high_usage"
  | "high_debt"
  | "next_month_commitment"
  | "spending_acceleration"
  | "stable"
  | "excess_spending"
  | "category_imbalance"
  | "low_saving"
  | "low_activity"
  | "budget_exceeded"
  | "budget_at_risk"
  | "budget_pace_below";

export type Insight = {
  id: string;
  module: InsightModule;
  kind: InsightKind;
  severity: InsightSeverity;
  title: string;
  message: string;
  priority: number;
  data?: Record<string, unknown>;
};

export type FinancialStateLevel = "healthy" | "stable" | "attention" | "critical";

export type FinancialStateReason =
  | "pressureOverAvailable"
  | "pressureOverIncome"
  | "projectedDeficit"
  | "projectedDeficitWithoutFixedIncome"
  | "expenseNearIncome"
  | "pressureWithoutAvailable"
  | "margin"
  | "marginWithoutCard";

export type FinancialState = {
  level: FinancialStateLevel;
  reason: FinancialStateReason;
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
  transactionCount: number;
};

export type InsightCategoryBudget = {
  categoryId: string;
  categoryName: string;
  expenseBehavior: ExpenseBehavior | null;
  budgeted: number;
  actual: number;
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
  creditCardExpenseCurrentMonthToDate: number;
  creditCardExpensePreviousMonthToDate: number;
  creditCardPaymentsCurrentMonth: number;
  creditCardPreviousMonthStatement: number;
  creditCardRolledDebtCurrent: number;
  creditCardDebtTotal: number;
  creditCardCurrentStatement: number;
  creditCardNextMonthCommitment: number;
  projectedIncomeTotal: number;
  projectedFixedIncome: number;
  projectedExpenseTotal: number;
  projectedExpenseVariable: number;
  projectedBalance: number;
  elapsedDaysCurrentMonth: number;
  daysInCurrentMonth: number;
  relevantTransactionCountCurrentMonth: number;
  expenseByCategoryCurrentMonth: InsightCategoryExpense[];
  expenseBudgetByCategoryCurrentMonth: InsightCategoryBudget[];
  variableExpenseBudgetTotal: number;
};
