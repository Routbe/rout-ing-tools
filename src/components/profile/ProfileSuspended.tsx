/** Shown when moderation has suspended a public profile. */
export function ProfileSuspended({ username }: { username: string }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background px-6 text-center">
      <h1 className="font-display text-2xl text-foreground">Profile suspended</h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        The profile <span className="font-mono">@{username}</span> is temporarily unavailable while
        it is under review by the ROUT moderation team.
      </p>
      <a href="/contact" className="mt-2 text-sm font-medium underline underline-offset-4">
        Contact support →
      </a>
    </div>
  );
}
