import { BrandLoader } from "@/components/BrandLoader";
import { useEffect } from "react";
import { useNavigate } from "@/lib/router-compat";
import { Loader2 } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { ProfileEditor } from "@/components/dashboard/ProfileEditor";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { useAuth } from "@/hooks/useAuth";

/** /studio — the dedicated Profile Hub (link-in-bio) workspace. */
export default function Studio() {
  const { user, loading } = useAuth();
  const nav = useNavigate();

  useEffect(() => {
    if (!loading && !user) nav("/auth", { replace: true });
  }, [user, loading, nav]);

  return (
    <AppLayout
      width="wide"
      title="Profile Hub Studio"
      description="Your sovereign link-in-bio: components, design, subdomain and verification."
      crumbs={[{ label: "Studio" }]}
    >
      {loading || !user ? (
        <div className="flex min-h-[40vh] items-center justify-center">
          <div className="relative h-24 w-24"><BrandLoader label="Studio laden…" /></div>
        </div>
      ) : (
        <div className="flex flex-1 flex-col space-y-6 pb-8">
          <ErrorBoundary label="Profile Studio" inline>
            <ProfileEditor />
          </ErrorBoundary>
        </div>
      )}
    </AppLayout>
  );
}
