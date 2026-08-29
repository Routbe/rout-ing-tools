import { useEffect } from "react";
import { RouteErrorFallback, RoutePendingSkeleton } from "@/components/RouteFallbacks";
import { createFileRoute, useParams } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import {
  ProfileLookupError,
  ProfileMissing,
  ProfileView,
} from "@/components/profile/ProfileView";
import { ProfileSuspended } from "@/components/profile/ProfileSuspended";
import { useProfileRecord } from "@/hooks/useProfileRecord";



function FreeProfile() {
  const { username } = useParams({ strict: false }) as { username: string };
  // Normalise: strip a leading @ so /u/@john and /u/john resolve identically.
  const handle = username.replace(/^@/, "").toLowerCase();
  const { profile, suspended, loading, error, retry } = useProfileRecord(handle);

  useEffect(() => {
    if (profile) document.title = `${profile.display_name || `@${profile.username}`} — ROUT`;
  }, [profile]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // A failed lookup must never render as "still available".
  if (error) {
    return <ProfileLookupError username={handle} onRetry={retry} />;
  }

  if (!profile) return <ProfileMissing username={handle} free />;

  if (suspended || profile.status === "suspended" || profile.status === "banned") {
    return <ProfileSuspended username={handle} />;
  }

  return <ProfileView profile={profile} free />;
}

export default FreeProfile;
