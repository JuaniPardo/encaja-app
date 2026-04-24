import { ProtectedShell } from "@/features/layout/protected-shell";
import { WorkspaceProvider } from "@/features/workspace/workspace-provider";
import { resolveInitialWorkspaceContext } from "@/lib/workspace/server-context";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const initialContext = await resolveInitialWorkspaceContext();

  return (
    <WorkspaceProvider initialContext={initialContext}>
      <ProtectedShell>{children}</ProtectedShell>
    </WorkspaceProvider>
  );
}
