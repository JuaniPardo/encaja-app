import Image from "next/image";
import { Container, Stack } from "@mantine/core";

import { AuthLanguageSwitcher } from "./auth-language-switcher";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <Container size={460} py={48}>
      <Stack gap="md">
        <AuthLanguageSwitcher />
        <Stack gap={6} align="center">
          <Image src="/logo-EnCaja.svg" alt="Encaja" width={84} height={84} priority />
        </Stack>
        {children}
      </Stack>
    </Container>
  );
}
