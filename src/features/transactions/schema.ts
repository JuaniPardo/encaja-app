import { z } from "zod";

import { parseBudgetAmount } from "@/features/budget/amount-format";

export const transactionTypeOptions = ["income", "expense", "saving"] as const;

const datePattern = /^\d{4}-\d{2}-\d{2}$/;

export interface TransactionSchemaMessages {
  invalidAmount: string;
  amountGtZero: string;
  invalidDate: string;
  invalidOption: string;
  requiredCategory: string;
  invalidCategory: string;
  requiredTransactionDate: string;
  descriptionMaxLength: string;
  notesMaxLength: string;
}

const defaultMessages: TransactionSchemaMessages = {
  invalidAmount: "Ingresá un monto válido.",
  amountGtZero: "El monto debe ser mayor a cero.",
  invalidDate: "Ingresá una fecha válida.",
  invalidOption: "Seleccioná una opción válida.",
  requiredCategory: "Seleccioná una categoría.",
  invalidCategory: "Seleccioná una categoría válida.",
  requiredTransactionDate: "La fecha de transacción es obligatoria.",
  descriptionMaxLength: "La descripción no puede superar 180 caracteres.",
  notesMaxLength: "Las notas no pueden superar 1000 caracteres.",
};

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

export function createTransactionFormSchema(messages?: Partial<TransactionSchemaMessages>) {
  const resolvedMessages = {
    ...defaultMessages,
    ...messages,
  };

  const requiredAmount = z.preprocess(
    (value) => {
      const parsed = parseBudgetAmount(value);
      return parsed === null ? Number.NaN : parsed;
    },
    z
      .number()
      .finite(resolvedMessages.invalidAmount)
      .gt(0, resolvedMessages.amountGtZero),
  );

  const optionalDate = z.preprocess(
    (value) => {
      if (value === "" || value === null || value === undefined) {
        return null;
      }

      return value;
    },
    z.string().regex(datePattern, resolvedMessages.invalidDate).nullable(),
  );

  const optionalUuid = z.preprocess(
    (value) => {
      if (value === "" || value === null || value === undefined) {
        return null;
      }

      return value;
    },
    z.string().uuid(resolvedMessages.invalidOption).nullable(),
  );

  return z.object({
    type: z.enum(transactionTypeOptions),
    categoryId: z
      .string()
      .min(1, resolvedMessages.requiredCategory)
      .uuid(resolvedMessages.invalidCategory),
    amount: requiredAmount,
    transactionDate: z
      .string()
      .min(1, resolvedMessages.requiredTransactionDate)
      .regex(datePattern, resolvedMessages.invalidDate),
    effectiveDate: optionalDate,
    paymentMethodId: optionalUuid,
    description: optionalText(180, resolvedMessages.descriptionMaxLength),
    notes: optionalText(1000, resolvedMessages.notesMaxLength),
  });
}

export const transactionFormSchema = createTransactionFormSchema();

export type TransactionFormInputValues = z.input<typeof transactionFormSchema>;
export type TransactionFormValues = z.output<typeof transactionFormSchema>;
