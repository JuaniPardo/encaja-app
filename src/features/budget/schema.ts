import { z } from "zod";

const optionalBudgetAmount = z.preprocess(
  (value) => {
    if (value === "" || value === null || value === undefined) {
      return null;
    }

    return Number(value);
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

export type BudgetFormValues = z.infer<typeof budgetFormSchema>;
