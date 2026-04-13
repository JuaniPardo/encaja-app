import { z } from "zod";

export interface AuthSchemaMessages {
  invalidEmail: string;
  passwordMinLength: string;
  fullNameMaxLength: string;
}

const defaultMessages: AuthSchemaMessages = {
  invalidEmail: "Ingresá un email válido.",
  passwordMinLength: "La contraseña debe tener al menos 6 caracteres.",
  fullNameMaxLength: "El nombre no puede superar 120 caracteres.",
};

export function createLoginSchema(messages?: Partial<AuthSchemaMessages>) {
  const resolvedMessages = {
    ...defaultMessages,
    ...messages,
  };

  return z.object({
    email: z.string().trim().email(resolvedMessages.invalidEmail),
    password: z.string().min(6, resolvedMessages.passwordMinLength),
  });
}

export const loginSchema = createLoginSchema();

export type LoginValues = z.infer<typeof loginSchema>;

export function createRegisterSchema(messages?: Partial<AuthSchemaMessages>) {
  const resolvedMessages = {
    ...defaultMessages,
    ...messages,
  };

  return z.object({
    fullName: z.string().trim().max(120, resolvedMessages.fullNameMaxLength).optional(),
    email: z.string().trim().email(resolvedMessages.invalidEmail),
    password: z.string().min(6, resolvedMessages.passwordMinLength),
  });
}

export const registerSchema = createRegisterSchema();

export type RegisterValues = z.infer<typeof registerSchema>;
