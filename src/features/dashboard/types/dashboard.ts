import type { Database, PaymentMethodType, TransactionType } from "@/types/database";

export type DashboardLocale = "es" | "en";

export type TranslationFn = (
  key: string,
  fallback?: string,
  values?: Record<string, string | number>,
) => string;

export type CategoryRow = Database["public"]["Tables"]["categories"]["Row"];

export type WorkspaceSettingsLiteRow = Pick<
  Database["public"]["Tables"]["workspace_settings"]["Row"],
  "start_year" | "currency_code" | "show_cents"
>;

export type LinkedWorkspacePaymentMethodBalanceRow =
  Database["public"]["Functions"]["list_linked_workspace_payment_method_balances"]["Returns"][number];

export type BudgetPeriodIdRow = Pick<Database["public"]["Tables"]["budget_periods"]["Row"], "id">;

export type BudgetItemLiteRow = Pick<
  Database["public"]["Tables"]["budget_items"]["Row"],
  "category_id" | "amount"
>;

export type TransactionLiteRow = Pick<
  Database["public"]["Tables"]["transactions"]["Row"],
  "category_id" | "amount" | "transaction_date" | "effective_date" | "type" | "payment_method_id" | "direction"
>;

export type TransactionIdRow = Pick<Database["public"]["Tables"]["transactions"]["Row"], "id">;

export type PaymentMethodBalanceRow = Pick<
  Database["public"]["Tables"]["payment_methods"]["Row"],
  "id" | "name" | "type" | "is_active" | "include_in_balance" | "current_balance"
>;

export type CategorySummaryRow = {
  categoryId: string;
  categoryName: string;
  categoryIsActive: boolean;
  budgetAmount: number;
  realAmount: number;
  deviation: number;
  executionPercent: number | null;
};

export type TotalsByType = Record<
  TransactionType,
  {
    budget: number;
    real: number;
    deviation: number;
  }
>;

export type DonutSlice = {
  label: string;
  amount: number;
  value: number;
  color: string;
};

export type DonutDataByType = Record<
  TransactionType,
  {
    total: number;
    slices: DonutSlice[];
  }
>;

export type FinancialMethodRow = {
  id: string;
  name: string;
  type: PaymentMethodType;
  currentBalance: number;
  monthImpact: number;
};

export type FinancialCreditCardRow = {
  id: string;
  name: string;
  type: "credit_card";
  previousMonthStatement: number;
  monthPayments: number;
  monthConsumption: number;
  rolledDebt: number;
  nextMonthInstallments: number;
};

export type FinancialSummary = {
  availabilityRows: FinancialMethodRow[];
  creditCardRows: FinancialCreditCardRow[];
  availabilityTotalBalance: number;
  availabilityTotalMonthImpact: number;
  creditCardPreviousMonthStatementTotal: number;
  creditCardMonthPaymentsTotal: number;
  creditCardMonthConsumptionTotal: number;
  creditCardRolledDebtTotal: number;
  creditCardNextMonthInstallmentsTotal: number;
  includedActiveCount: number;
  excludedActiveCount: number;
  inactiveCount: number;
};

export type LinkedWorkspaceBalanceGroup = {
  linkId: string;
  workspaceId: string;
  workspaceName: string;
  currencyCode: string;
  visibilityMode: string;
  totalBalance: number;
  paymentMethods: Array<{
    id: string;
    name: string;
    type: PaymentMethodType;
    balance: number;
  }>;
};

export type DashboardTypeLabels = Record<TransactionType, string>;

export type PaymentMethodTypeLabels = Record<PaymentMethodType, string>;
