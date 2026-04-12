import { z } from "zod";

export const categoryTypeOptions = ["income", "expense", "saving"] as const;
export const categoryExpenseBehaviorOptions = ["fixed", "variable"] as const;

const optionalSortOrder = z.preprocess(
  (value) => {
    if (value === "" || value === null || value === undefined) {
      return null;
    }

    return Number(value);
  },
  z.number().int("Debe ser un número entero.").min(0, "No puede ser negativo.").nullable(),
);

const optionalExpenseBehavior = z.preprocess(
  (value) => {
    if (value === "" || value === null || value === undefined) {
      return null;
    }

    return value;
  },
  z.enum(categoryExpenseBehaviorOptions).nullable(),
);

export const categoryFormSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, "El nombre es obligatorio.")
      .max(80, "El nombre no puede superar 80 caracteres."),
    type: z.enum(categoryTypeOptions),
    expenseBehavior: optionalExpenseBehavior,
    sortOrder: optionalSortOrder,
  })
  .superRefine((values, context) => {
    if (values.type !== "expense") {
      return;
    }

    if (!values.expenseBehavior) {
      context.addIssue({
        path: ["expenseBehavior"],
        code: z.ZodIssueCode.custom,
        message: "Definí si el gasto es fijo o variable.",
      });
    }
  });

export type CategoryFormInputValues = z.input<typeof categoryFormSchema>;
export type CategoryFormValues = z.output<typeof categoryFormSchema>;
