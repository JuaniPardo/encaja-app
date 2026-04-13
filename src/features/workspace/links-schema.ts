import { z } from "zod";

export interface WorkspaceLinkSchemaMessages {
  requiredTargetWorkspace: string;
  invalidTargetWorkspace: string;
}

const defaultMessages: WorkspaceLinkSchemaMessages = {
  requiredTargetWorkspace: "Seleccioná un workspace destino.",
  invalidTargetWorkspace: "Seleccioná un workspace destino válido.",
};

export function createWorkspaceLinkFormSchema(messages?: Partial<WorkspaceLinkSchemaMessages>) {
  const resolvedMessages = {
    ...defaultMessages,
    ...messages,
  };

  return z.object({
    targetWorkspaceId: z
      .string()
      .trim()
      .min(1, resolvedMessages.requiredTargetWorkspace)
      .uuid(resolvedMessages.invalidTargetWorkspace),
  });
}

export const workspaceLinkFormSchema = createWorkspaceLinkFormSchema();

export type WorkspaceLinkFormInputValues = z.input<typeof workspaceLinkFormSchema>;
export type WorkspaceLinkFormValues = z.output<typeof workspaceLinkFormSchema>;
