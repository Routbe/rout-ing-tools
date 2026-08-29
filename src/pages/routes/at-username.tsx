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




function PublicProfile() {
  const { username } = useParams({ strict: false }) as { username: string };
  const { profile, suspended, loading, error, retry } = useProfileRecord(username);

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
    return <ProfileLookupError username={username} onRetry={retry} />;
  }

  if (!profile) {
    return <ProfileMissing username={username} />;
  }

  // Moderation: a suspended profile is never rendered publicly.
  if (suspended || profile.status === "suspended" || profile.status === "banned") {
    return <ProfileSuspended username={username} />;
  }


  // Shared identity: /@handle renders the same profile as /u/@handle.
  return <ProfileView profile={profile} free={!profile.verified} />;
}

export default PublicProfile;
