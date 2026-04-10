import { ProtectedShell } from "@/features/layout/protected-shell";
import { WorkspaceProvider } from "@/features/workspace/workspace-provider";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <WorkspaceProvider>
      <ProtectedShell>{children}</ProtectedShell>
    </WorkspaceProvider>
  );
}
