import { z } from "zod";

export const workspaceNameSchema = z
  .string()
  .trim()
  .min(2, "El nombre debe tener al menos 2 caracteres.")
  .max(80, "El nombre debe tener como máximo 80 caracteres.");

export const workspaceFormSchema = z.object({
  name: workspaceNameSchema,
});

export type WorkspaceFormInputValues = z.input<typeof workspaceFormSchema>;
export type WorkspaceFormValues = z.output<typeof workspaceFormSchema>;
