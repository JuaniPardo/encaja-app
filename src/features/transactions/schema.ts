import { z } from "zod";

export const transactionTypeOptions = ["income", "expense", "saving"] as const;

const datePattern = /^\d{4}-\d{2}-\d{2}$/;

const requiredAmount = z.preprocess(
  (value) => {
    if (value === "" || value === null || value === undefined) {
      return Number.NaN;
    }

    return Number(value);
  },
  z.number().finite("Ingresá un monto válido.").gt(0, "El monto debe ser mayor a cero."),
);

const optionalDate = z.preprocess(
  (value) => {
    if (value === "" || value === null || value === undefined) {
      return null;
    }

    return value;
  },
  z
    .string()
    .regex(datePattern, "Ingresá una fecha válida.")
    .nullable(),
);

const optionalUuid = z.preprocess(
  (value) => {
    if (value === "" || value === null || value === undefined) {
      return null;
    }

    return value;
  },
  z.string().uuid("Seleccioná una opción válida.").nullable(),
);

function optionalText(maxLength: number, message: string) {
  return z.preprocess(
    (value) => {
      if (typeof value !== "string") {
        return value;
      }

      const trimmed = value.trim();
      return trimmed.length === 0 ? null : trimmed;
    },
    z.string().max(maxLength, message).nullable(),
  );
}

export const transactionFormSchema = z.object({
  type: z.enum(transactionTypeOptions),
  categoryId: z
    .string()
    .min(1, "Seleccioná una categoría.")
    .uuid("Seleccioná una categoría válida."),
  amount: requiredAmount,
  transactionDate: z
    .string()
    .min(1, "La fecha de transacción es obligatoria.")
    .regex(datePattern, "Ingresá una fecha válida."),
  effectiveDate: optionalDate,
  paymentMethodId: optionalUuid,
  description: optionalText(180, "La descripción no puede superar 180 caracteres."),
  notes: optionalText(1000, "Las notas no pueden superar 1000 caracteres."),
});

export type TransactionFormInputValues = z.input<typeof transactionFormSchema>;
export type TransactionFormValues = z.output<typeof transactionFormSchema>;
