import { createFileRoute, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { BrandLoader } from "@/components/BrandLoader";

export const Route = createFileRoute("/_authenticated")({
  component: AuthenticatedLayout,
});

/**
 * Session gate for every signed-in surface. The session cookie is httpOnly, so
 * the check runs through the shared auth context (one server lookup per mount);
 * the blocked URL is kept so the member lands back where they intended.
 */
function AuthenticatedLayout() {
  const navigate = useNavigate();
  const location = useRouterState({ select: (s) => s.location });
  const { user, loading } = useAuth();

  useEffect(() => {
    if (loading || user) return;
    if (location.pathname.startsWith("/auth")) return;
    const redirect = `${location.pathname}${location.searchStr ?? ""}`;
    navigate({ to: "/auth", search: { redirect }, replace: true } as never);
  }, [loading, user, navigate, location.pathname, location.searchStr]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="relative h-24 w-24">
          <BrandLoader label="Beveiligde sessie controleren…" />
        </div>
      </div>
    );
  }

  if (!user) return null;

  return <Outlet />;
}
