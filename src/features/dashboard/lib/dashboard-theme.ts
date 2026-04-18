import { transactionTypeColorCssVar } from "@/features/transactions/type-colors";
import type { TransactionType } from "@/types/database";

export const deviationTolerance = 0.005;

export const typeOrder: Record<TransactionType, number> = {
  income: 0,
  expense: 1,
  saving: 2,
  transfer: 3,
};

export const dashboardVisibleTypes: TransactionType[] = ["income", "expense", "saving"];

export const compactSummaryTheme: Record<
  TransactionType,
  {
    color: string;
    textColor: string;
  }
> = {
  income: {
    color: transactionTypeColorCssVar("income", 6),
    textColor: transactionTypeColorCssVar("income", 7),
  },
  expense: {
    color: transactionTypeColorCssVar("expense", 6),
    textColor: transactionTypeColorCssVar("expense", 7),
  },
  saving: {
    color: transactionTypeColorCssVar("saving", 6),
    textColor: transactionTypeColorCssVar("saving", 7),
  },
  transfer: {
    color: transactionTypeColorCssVar("transfer", 6),
    textColor: transactionTypeColorCssVar("transfer", 7),
  },
};

export const compactSummaryBaseColor = "var(--mantine-color-gray-3)";
export const compactSummaryNeutralColor = "var(--mantine-color-gray-5)";

export const typeTheme: Record<
  TransactionType,
  {
    main: string;
    header: string;
    palette: string[];
  }
> = {
  income: {
    main: transactionTypeColorCssVar("income", 6),
    header: transactionTypeColorCssVar("income", 7),
    palette: [
      transactionTypeColorCssVar("income", 6),
      transactionTypeColorCssVar("income", 5),
      transactionTypeColorCssVar("income", 4),
      transactionTypeColorCssVar("income", 3),
      transactionTypeColorCssVar("income", 2),
      transactionTypeColorCssVar("income", 1),
    ],
  },
  expense: {
    main: transactionTypeColorCssVar("expense", 6),
    header: transactionTypeColorCssVar("expense", 7),
    palette: [
      transactionTypeColorCssVar("expense", 6),
      transactionTypeColorCssVar("expense", 5),
      transactionTypeColorCssVar("expense", 4),
      transactionTypeColorCssVar("expense", 3),
      transactionTypeColorCssVar("expense", 2),
      transactionTypeColorCssVar("expense", 1),
    ],
  },
  saving: {
    main: transactionTypeColorCssVar("saving", 6),
    header: transactionTypeColorCssVar("saving", 7),
    palette: [
      transactionTypeColorCssVar("saving", 6),
      transactionTypeColorCssVar("saving", 5),
      transactionTypeColorCssVar("saving", 4),
      transactionTypeColorCssVar("saving", 3),
      transactionTypeColorCssVar("saving", 2),
      transactionTypeColorCssVar("saving", 1),
    ],
  },
  transfer: {
    main: transactionTypeColorCssVar("transfer", 6),
    header: transactionTypeColorCssVar("transfer", 7),
    palette: [
      transactionTypeColorCssVar("transfer", 6),
      transactionTypeColorCssVar("transfer", 5),
      transactionTypeColorCssVar("transfer", 4),
      transactionTypeColorCssVar("transfer", 3),
      transactionTypeColorCssVar("transfer", 2),
      transactionTypeColorCssVar("transfer", 1),
    ],
  },
};
