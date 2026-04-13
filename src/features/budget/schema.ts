import { z } from "zod";

import { parseBudgetAmount } from "@/features/budget/amount-format";

export interface BudgetSchemaMessages {
  invalidAmount: string;
  negativeAmount: string;
  invalidCategory: string;
}

const defaultMessages: BudgetSchemaMessages = {
  invalidAmount: "Ingresá un monto válido.",
  negativeAmount: "El monto no puede ser negativo.",
  invalidCategory: "Categoría inválida.",
};

export function createBudgetFormSchema(messages?: Partial<BudgetSchemaMessages>) {
  const resolvedMessages = {
    ...defaultMessages,
    ...messages,
  };

  const optionalBudgetAmount = z.preprocess(
    (value) => {
      if (value === "") {
        return 0;
      }

      if (value === null || value === undefined) {
        return null;
      }

      const parsed = parseBudgetAmount(value);
      if (parsed === null) {
        return Number.NaN;
      }

      return parsed;
    },
    z
      .number()
      .finite(resolvedMessages.invalidAmount)
      .min(0, resolvedMessages.negativeAmount)
      .nullable(),
  );

  return z.object({
    items: z.array(
      z.object({
        categoryId: z.string().uuid(resolvedMessages.invalidCategory),
        amount: optionalBudgetAmount,
      }),
    ),
  });
}

export const budgetFormSchema = createBudgetFormSchema();

export type BudgetFormInputValues = z.input<typeof budgetFormSchema>;
export type BudgetFormValues = z.output<typeof budgetFormSchema>;
