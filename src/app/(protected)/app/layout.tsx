import { ProtectedShell } from "@/features/layout/protected-shell";
import { WorkspaceProvider } from "@/features/workspace/workspace-provider";

export const dynamic = "force-dynamic";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <WorkspaceProvider>
      <ProtectedShell>{children}</ProtectedShell>
    </WorkspaceProvider>
  );
}
