import { z } from "zod";

export const workspaceLinkFormSchema = z.object({
  targetWorkspaceId: z
    .string()
    .trim()
    .min(1, "Seleccioná un workspace destino.")
    .uuid("Seleccioná un workspace destino válido."),
});

export type WorkspaceLinkFormInputValues = z.input<typeof workspaceLinkFormSchema>;
export type WorkspaceLinkFormValues = z.output<typeof workspaceLinkFormSchema>;
