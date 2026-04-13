import { z } from "zod";

import type { FeedbackType } from "@/types/database";

export const feedbackTypeOptions = ["bug", "suggestion", "question", "other"] as const;

export interface FeedbackSchemaMessages {
  requiredType: string;
  invalidType: string;
  requiredMessage: string;
  maxMessageLength: string;
}

const defaultMessages: FeedbackSchemaMessages = {
  requiredType: "Seleccioná un tipo de feedback.",
  invalidType: "Seleccioná un tipo de feedback válido.",
  requiredMessage: "Contanos qué pasó o qué querés mejorar.",
  maxMessageLength: "El mensaje no puede superar 1500 caracteres.",
};

export function createFeedbackFormSchema(messages?: Partial<FeedbackSchemaMessages>) {
  const resolvedMessages = {
    ...defaultMessages,
    ...messages,
  };

  return z.object({
    type: z
      .string()
      .trim()
      .min(1, resolvedMessages.requiredType)
      .refine(
        (value): value is FeedbackType =>
          (feedbackTypeOptions as readonly string[]).includes(value),
        resolvedMessages.invalidType,
      ),
    message: z
      .string()
      .trim()
      .min(1, resolvedMessages.requiredMessage)
      .max(1500, resolvedMessages.maxMessageLength),
  });
}

export const feedbackFormSchema = createFeedbackFormSchema();

export type FeedbackFormInputValues = z.input<typeof feedbackFormSchema>;
export type FeedbackFormValues = z.output<typeof feedbackFormSchema>;
