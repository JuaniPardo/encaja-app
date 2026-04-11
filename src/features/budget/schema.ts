import { z } from "zod";

import { parseBudgetAmount } from "@/features/budget/amount-format";

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
    .finite("Ingresá un monto válido.")
    .min(0, "El monto no puede ser negativo.")
    .nullable(),
);

export const budgetFormSchema = z.object({
  items: z.array(
    z.object({
      categoryId: z.string().uuid("Categoría inválida."),
      amount: optionalBudgetAmount,
    }),
  ),
});

export type BudgetFormInputValues = z.input<typeof budgetFormSchema>;
export type BudgetFormValues = z.output<typeof budgetFormSchema>;
