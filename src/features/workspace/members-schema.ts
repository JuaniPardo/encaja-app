import { z } from "zod";

export interface InviteWorkspaceMemberSchemaMessages {
  requiredEmail: string;
  longEmail: string;
  invalidEmail: string;
}

const defaultMessages: InviteWorkspaceMemberSchemaMessages = {
  requiredEmail: "El email es obligatorio.",
  longEmail: "El email es demasiado largo.",
  invalidEmail: "Ingresá un email válido.",
};

export function createInviteWorkspaceMemberSchema(
  messages?: Partial<InviteWorkspaceMemberSchemaMessages>,
) {
  const resolvedMessages = {
    ...defaultMessages,
    ...messages,
  };

  return z.object({
    email: z
      .string()
      .trim()
      .min(1, resolvedMessages.requiredEmail)
      .max(320, resolvedMessages.longEmail)
      .email(resolvedMessages.invalidEmail)
      .transform((value) => value.toLowerCase()),
  });
}

export const inviteWorkspaceMemberSchema = createInviteWorkspaceMemberSchema();

export type InviteWorkspaceMemberInputValues = z.input<typeof inviteWorkspaceMemberSchema>;
export type InviteWorkspaceMemberValues = z.output<typeof inviteWorkspaceMemberSchema>;
