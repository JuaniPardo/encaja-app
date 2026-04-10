import { z } from "zod";

export const paymentMethodTypeOptions = [
  "cash",
  "debit_card",
  "credit_card",
  "bank_transfer",
  "other",
] as const;

const optionalDay = z.preprocess(
  (value) => {
    if (value === "" || value === null || value === undefined) {
      return null;
    }

    return Number(value);
  },
  z
    .number()
    .int("Debe ser un número entero.")
    .min(1, "El día mínimo es 1.")
    .max(31, "El día máximo es 31.")
    .nullable(),
);

export const paymentMethodFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "El nombre es obligatorio.")
    .max(80, "El nombre no puede superar 80 caracteres."),
  type: z.enum(paymentMethodTypeOptions),
  closingDay: optionalDay,
  dueDay: optionalDay,
});

export type PaymentMethodFormValues = z.infer<typeof paymentMethodFormSchema>;
