import { headers } from "next/headers";
import { redirect } from "next/navigation";
import AppShell from "@/components/layout/AppShell";
import WorkspaceSync from "@/components/layout/WorkspaceSync";
import SupabaseRealtimeBridge from "@/components/layout/SupabaseRealtimeBridge";
import AuthBootstrap from "@/components/auth/AuthBootstrap";
import { getSessionUser } from "@/lib/auth/session-server";
import { ROUTES, routeAllowedForRole } from "@/lib/auth/routes";
import {
  hydrateSessionUser,
  loadWorkspaceBootstrap,
} from "@/lib/workspace/load-workspace";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSessionUser();
  if (!user) {
    redirect(ROUTES.login);
  }

  const hydrated = hydrateSessionUser(user);
  const pathname = (await headers()).get("x-pathname") ?? "";
  if (pathname && !routeAllowedForRole(pathname, hydrated.role)) {
    redirect(ROUTES.dashboard);
  }
  const initialWorkspace = await loadWorkspaceBootstrap(hydrated);

  return (
    <>
      <AuthBootstrap user={hydrated} />
      <AppShell user={hydrated}>
        <WorkspaceSync user={hydrated} initialPayload={initialWorkspace} />
        <SupabaseRealtimeBridge />
        {children}
      </AppShell>
    </>
  );
}
