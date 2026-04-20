import { z } from "zod";

export const paymentMethodTypeOptions = [
  "cash",
  "debit_card",
  "credit_card",
] as const;

export interface PaymentMethodSchemaMessages {
  integerNumber: string;
  minDay: string;
  maxDay: string;
  invalidBalance: string;
  requiredName: string;
  maxNameLength: string;
}

const defaultMessages: PaymentMethodSchemaMessages = {
  integerNumber: "Debe ser un número entero.",
  minDay: "El día mínimo es 1.",
  maxDay: "El día máximo es 31.",
  invalidBalance: "Ingresá un saldo válido.",
  requiredName: "El nombre es obligatorio.",
  maxNameLength: "El nombre no puede superar 80 caracteres.",
};

export function createPaymentMethodFormSchema(messages?: Partial<PaymentMethodSchemaMessages>) {
  const resolvedMessages = {
    ...defaultMessages,
    ...messages,
  };

  const optionalDay = z.preprocess(
    (value) => {
      if (value === "" || value === null || value === undefined) {
        return null;
      }

      return Number(value);
    },
    z
      .number()
      .int(resolvedMessages.integerNumber)
      .min(1, resolvedMessages.minDay)
      .max(31, resolvedMessages.maxDay)
      .nullable(),
  );

  const requiredStartingBalance = z.preprocess(
    (value) => {
      if (value === null || value === undefined || value === "") {
        return Number.NaN;
      }

      if (typeof value === "number") {
        return value;
      }

      const normalized = String(value).trim().replace(",", ".");
      return Number(normalized);
    },
    z.number().finite(resolvedMessages.invalidBalance),
  );

  return z.object({
    name: z
      .string()
      .trim()
      .min(1, resolvedMessages.requiredName)
      .max(80, resolvedMessages.maxNameLength),
    type: z.enum(paymentMethodTypeOptions),
    startingBalance: requiredStartingBalance,
    includeInBalance: z.boolean(),
    closingDay: optionalDay,
    dueDay: optionalDay,
  });
}

export const paymentMethodFormSchema = createPaymentMethodFormSchema();

export type PaymentMethodFormInputValues = z.input<typeof paymentMethodFormSchema>;
export type PaymentMethodFormValues = z.output<typeof paymentMethodFormSchema>;
