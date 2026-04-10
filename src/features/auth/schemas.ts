import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().trim().email("Ingresá un email válido."),
  password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres."),
});

export type LoginValues = z.infer<typeof loginSchema>;

export const registerSchema = z.object({
  fullName: z.string().trim().max(120, "El nombre no puede superar 120 caracteres.").optional(),
  email: z.string().trim().email("Ingresá un email válido."),
  password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres."),
});

export type RegisterValues = z.infer<typeof registerSchema>;
