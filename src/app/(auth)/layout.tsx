import { Container, Stack } from "@mantine/core";

import { AuthLanguageSwitcher } from "./auth-language-switcher";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <Container size={460} py={48}>
      <Stack gap="md">
        <AuthLanguageSwitcher />
        {children}
      </Stack>
    </Container>
  );
}
