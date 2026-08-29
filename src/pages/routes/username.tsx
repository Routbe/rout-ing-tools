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
import { ProfileFrozen } from "@/components/profile/ProfileFrozen";
import { useProfileRecord } from "@/hooks/useProfileRecord";
import { canonicalHandle } from "@/lib/profile-url";
import { looksLikeBase36Slug } from "@/lib/base36";
import { RESERVED_SLUGS } from "@/lib/reserved-slugs";
import { ShortLinkResolver } from "@/pages/ShortLink";

/**
 * Clean namespace: `rout.be/<handle>` is reserved for verified members.
 * Unverified handles keep living under `/u/<handle>` so the root namespace
 * never collides with product routes.
 */


function CleanProfile() {
  const { username } = useParams({ from: "/$username" });
  // rout.be/A89K — een 4-teken Base36-code is een short link, geen handle.
  if (looksLikeBase36Slug(username)) return <ShortLinkResolver slug={username} />;
  // A reserved slug (`/docs`, `/self-hosting`, `/claim`, …) can never be a
  // handle: show a clean not-found instead of querying the database.
  if (RESERVED_SLUGS.has(canonicalHandle(username))) {
    return <ProfileMissing username={canonicalHandle(username)} />;
  }
  return <HandleProfile username={username} />;
}

function HandleProfile({ username }: { username: string }) {
  const handle = canonicalHandle(username);
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

  if (!profile) return <ProfileMissing username={handle} />;

  if (suspended || profile.status === "suspended" || profile.status === "banned") {
    return <ProfileSuspended username={handle} />;
  }

  // Self-paused (frozen) accounts stay private until the owner signs in again.
  if (profile.status === "frozen") {
    return <ProfileFrozen username={handle} />;
  }

  // Shared identity, flexible URL: /handle, /@handle, /u/handle and /u/@handle
  // all render the same profile. Never a 404 or an interstitial gate.
  return <ProfileView profile={profile} free={!profile.verified} />;
}

export default CleanProfile;
