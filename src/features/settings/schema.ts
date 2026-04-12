import { z } from "zod";

export const savingsRateModeOptions = ["manual", "percentage"] as const;

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

export const settingsFormSchema = z
  .object({
    startYear: z.preprocess(
      (value) => Number(value),
      z
        .number()
        .int("El año debe ser entero.")
        .min(2000, "Año mínimo 2000.")
        .max(2200, "Año máximo 2200."),
    ),
    savingsRateMode: z.enum(savingsRateModeOptions),
    deferredIncomeEnabled: z.boolean(),
    deferredIncomeDay: optionalDay,
    showCents: z.boolean(),
    currencyCode: z
      .string()
      .trim()
      .length(3, "La moneda debe tener 3 letras.")
      .transform((value) => value.toUpperCase()),
  })
  .superRefine((value, context) => {
    if (value.deferredIncomeEnabled && value.deferredIncomeDay === null) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["deferredIncomeDay"],
        message: "Indicá el día de diferimiento.",
      });
    }
  });

export type SettingsFormInputValues = z.input<typeof settingsFormSchema>;
export type SettingsFormValues = z.output<typeof settingsFormSchema>;
