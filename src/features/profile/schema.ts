import { z } from "zod";

export function createProfileFormSchema(messages: {
  requiredName: string;
  maxNameLength: string;
}) {
  return z.object({
    fullName: z
      .string()
      .trim()
      .min(1, messages.requiredName)
      .max(120, messages.maxNameLength),
    language: z.enum(["es", "en"]),
  });
}

export const profileFormSchema = createProfileFormSchema({
  requiredName: "Name is required",
  maxNameLength: "Name is too long",
});

export type ProfileFormInputValues = z.input<typeof profileFormSchema>;
export type ProfileFormValues = z.output<typeof profileFormSchema>;
