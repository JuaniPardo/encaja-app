import { z } from "zod";

import { parseBudgetAmount } from "@/features/budget/amount-format";

export interface BudgetSchemaMessages {
  invalidAmount: string;
  negativeAmount: string;
  invalidCategory: string;
  invalidSubcategory: string;
}

const defaultMessages: BudgetSchemaMessages = {
  invalidAmount: "Ingresá un monto válido.",
  negativeAmount: "El monto no puede ser negativo.",
  invalidCategory: "Categoría inválida.",
  invalidSubcategory: "Subcategoría inválida.",
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
        subcategoryId: z.preprocess(
          (value) => {
            if (value === "" || value === null || value === undefined) {
              return null;
            }

            return value;
          },
          z.string().uuid(resolvedMessages.invalidSubcategory).nullable(),
        ),
        amount: optionalBudgetAmount,
      }),
    ),
  });
}

export const budgetFormSchema = createBudgetFormSchema();

export type BudgetFormInputValues = z.input<typeof budgetFormSchema>;
export type BudgetFormValues = z.output<typeof budgetFormSchema>;
