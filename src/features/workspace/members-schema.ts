import { z } from "zod";

export const inviteWorkspaceMemberSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "El email es obligatorio.")
    .max(320, "El email es demasiado largo.")
    .email("Ingresá un email válido.")
    .transform((value) => value.toLowerCase()),
});

export type InviteWorkspaceMemberInputValues = z.input<typeof inviteWorkspaceMemberSchema>;
export type InviteWorkspaceMemberValues = z.output<typeof inviteWorkspaceMemberSchema>;
