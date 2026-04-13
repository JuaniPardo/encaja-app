import { z } from "zod";

export const savingsRateModeOptions = ["manual", "percentage"] as const;

export interface SettingsSchemaMessages {
  integerNumber: string;
  minDay: string;
  maxDay: string;
  startYearInteger: string;
  startYearMin: string;
  startYearMax: string;
  currencyLength: string;
  requiredDeferredIncomeDay: string;
}

const defaultMessages: SettingsSchemaMessages = {
  integerNumber: "Debe ser un número entero.",
  minDay: "El día mínimo es 1.",
  maxDay: "El día máximo es 31.",
  startYearInteger: "El año debe ser entero.",
  startYearMin: "Año mínimo 2000.",
  startYearMax: "Año máximo 2200.",
  currencyLength: "La moneda debe tener 3 letras.",
  requiredDeferredIncomeDay: "Indicá el día de diferimiento.",
};

export function createSettingsFormSchema(messages?: Partial<SettingsSchemaMessages>) {
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

  return z
    .object({
      startYear: z.preprocess(
        (value) => Number(value),
        z
          .number()
          .int(resolvedMessages.startYearInteger)
          .min(2000, resolvedMessages.startYearMin)
          .max(2200, resolvedMessages.startYearMax),
      ),
      savingsRateMode: z.enum(savingsRateModeOptions),
      deferredIncomeEnabled: z.boolean(),
      deferredIncomeDay: optionalDay,
      showCents: z.boolean(),
      currencyCode: z
        .string()
        .trim()
        .length(3, resolvedMessages.currencyLength)
        .transform((value) => value.toUpperCase()),
    })
    .superRefine((value, context) => {
      if (value.deferredIncomeEnabled && value.deferredIncomeDay === null) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["deferredIncomeDay"],
          message: resolvedMessages.requiredDeferredIncomeDay,
        });
      }
    });
}

export const settingsFormSchema = createSettingsFormSchema();

export type SettingsFormInputValues = z.input<typeof settingsFormSchema>;
export type SettingsFormValues = z.output<typeof settingsFormSchema>;
