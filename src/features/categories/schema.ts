import { z } from "zod";

export const categoryTypeOptions = ["income", "expense", "saving"] as const;

const optionalSortOrder = z.preprocess(
  (value) => {
    if (value === "" || value === null || value === undefined) {
      return null;
    }

    return Number(value);
  },
  z.number().int("Debe ser un número entero.").min(0, "No puede ser negativo.").nullable(),
);

export const categoryFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "El nombre es obligatorio.")
    .max(80, "El nombre no puede superar 80 caracteres."),
  type: z.enum(categoryTypeOptions),
  sortOrder: optionalSortOrder,
});

export type CategoryFormInputValues = z.input<typeof categoryFormSchema>;
export type CategoryFormValues = z.output<typeof categoryFormSchema>;
