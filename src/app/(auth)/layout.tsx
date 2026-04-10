import { Container } from "@mantine/core";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <Container size={460} py={48}>
      {children}
    </Container>
  );
}
