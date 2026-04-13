import { z } from "zod";

export interface WorkspaceSchemaMessages {
  minNameLength: string;
  maxNameLength: string;
}

const defaultMessages: WorkspaceSchemaMessages = {
  minNameLength: "El nombre debe tener al menos 2 caracteres.",
  maxNameLength: "El nombre debe tener como máximo 80 caracteres.",
};

export function createWorkspaceFormSchema(messages?: Partial<WorkspaceSchemaMessages>) {
  const resolvedMessages = {
    ...defaultMessages,
    ...messages,
  };

  const workspaceNameSchema = z
    .string()
    .trim()
    .min(2, resolvedMessages.minNameLength)
    .max(80, resolvedMessages.maxNameLength);

  return z.object({
    name: workspaceNameSchema,
  });
}

export const workspaceFormSchema = createWorkspaceFormSchema();

export type WorkspaceFormInputValues = z.input<typeof workspaceFormSchema>;
export type WorkspaceFormValues = z.output<typeof workspaceFormSchema>;
