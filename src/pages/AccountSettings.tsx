import { useEffect, useState } from "react";
import { Link, useNavigate } from "@/lib/router-compat";
import { useSearch } from "@tanstack/react-router";
import {
  AlertTriangle,
  Download,
  Eye,
  EyeOff,
  KeyRound,
  Languages,
  Loader2,
  LogOut,
  Mail,
  Monitor,
  ShieldCheck,
  User as UserIcon,
} from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { PasskeysPanel } from "@/components/settings/PasskeysPanel";
import { ConnectedAccounts } from "@/components/settings/ConnectedAccounts";
import { AvatarUpload } from "@/components/settings/AvatarUpload";
import { IdentitiesPanel } from "@/components/settings/IdentitiesPanel";
import { FreezeAccountPanel } from "@/components/settings/FreezeAccountPanel";
import { MergeAccountWizard } from "@/components/settings/MergeAccountWizard";

import { Input } from "@/components/ui/input";
import { PasswordField, isPasswordCompliant } from "@/components/PasswordField";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from "@/hooks/useAuth";
import { db } from "@/lib/db/client";
import {
  revokeOtherSessions,
  signInWithPassword,
  updateAuthUser,
} from "@/lib/auth.functions";
import { toast } from "sonner";
import { LOCALES, LOCALE_LABELS, useI18n } from "@/lib/i18n";
import { useLanguagePreference } from "@/hooks/useLanguagePreference";

type SettingsTab = "profile" | "security" | "identities" | "status";

const SETTINGS_TABS: SettingsTab[] = ["profile", "security", "identities", "status"];

function parseTab(value: unknown): SettingsTab {
  return SETTINGS_TABS.includes(value as SettingsTab) ? (value as SettingsTab) : "profile";
}

/** /settings — profile, security, linked identities and account control in four tabs. */
export default function AccountSettings() {
  const { user, loading, signOut } = useAuth();
  const nav = useNavigate();
  const { t } = useI18n();
  const { language, save: saveLanguage } = useLanguagePreference();
  const search = useSearch({ strict: false }) as { tab?: string };
  const tab = parseTab(search.tab);

  const setTab = (next: SettingsTab) => {
    nav(`/settings?tab=${next}`, { replace: true });
  };

  const [displayName, setDisplayName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);

  const [email, setEmail] = useState("");
  const [emailCurrentPassword, setEmailCurrentPassword] = useState("");
  const [busyEmail, setBusyEmail] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [busyPassword, setBusyPassword] = useState(false);

  const [mfaEnabled, setMfaEnabled] = useState(false);
  const [mfaDialogOpen, setMfaDialogOpen] = useState(false);
  const [mfaCode, setMfaCode] = useState("");

  const [exporting, setExporting] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!loading && !user) nav("/auth", { replace: true });
  }, [user, loading, nav]);

  useEffect(() => {
    if (!user) return;
    setDisplayName((user.user_metadata?.display_name as string) ?? "");
    let alive = true;
    void db
      .from("profiles")
      .select("avatar_url")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!alive) return;
        const fromProfile = (data as { avatar_url?: string | null } | null)?.avatar_url ?? null;
        const fromOauth =
          (user.user_metadata?.avatar_url as string | undefined) ??
          (user.user_metadata?.picture as string | undefined) ??
          null;
        setAvatarUrl(fromProfile ?? fromOauth);
      });
    // 2FA is not part of our own auth layer yet.
    setMfaEnabled(false);
    return () => {
      alive = false;
    };
  }, [user]);

  if (loading || !user) {
    return (
      <AppLayout title="Settings &amp; security" crumbs={[{ label: "Settings" }]}>
        <div className="flex min-h-[40vh] items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    );
  }

  const saveProfile = async () => {
    setSavingProfile(true);
    const result = await updateAuthUser({
      data: { metadata: { display_name: displayName.trim() } },
    });
    const { error: profileError } = await db
      .from("profiles")
      .update({ display_name: displayName.trim() || null, avatar_url: avatarUrl })
      .eq("id", user.id);
    setSavingProfile(false);
    if (!result.ok) return toast.error(result.message ?? "Could not save your profile.");
    if (profileError) return toast.error(profileError.message);
    toast.success("Profile saved");
  };

  /** Confirms the member's identity before an e-mail or password change. */
  const reauthenticate = async (password: string) => {
    const result = await signInWithPassword({
      data: { email: user.email ?? "", password },
    });
    return result.ok;
  };

  const changeEmail = async () => {
    const next = email.trim();
    if (!/^\S+@\S+\.\S+$/.test(next)) return toast.error("Enter a valid e-mail address.");
    if (!emailCurrentPassword)
      return toast.error("Enter your current password to confirm this change.");
    setBusyEmail(true);
    if (!(await reauthenticate(emailCurrentPassword))) {
      setBusyEmail(false);
      return toast.error("Current password is incorrect.");
    }
    const result = await updateAuthUser({ data: { email: next } });
    setBusyEmail(false);
    if (!result.ok) return toast.error(result.message ?? "Could not change your e-mail address.");
    toast.success("Check your inbox to confirm the new address.");
    setEmail("");
    setEmailCurrentPassword("");
  };

  const changePassword = async () => {
    if (!currentPassword) return toast.error("Enter your current password.");
    if (newPassword.length < 8) return toast.error("Use at least 8 characters.");
    if (newPassword !== confirmPassword) return toast.error("Passwords do not match.");
    setBusyPassword(true);
    if (!(await reauthenticate(currentPassword))) {
      setBusyPassword(false);
      return toast.error("Current password is incorrect.");
    }
    const result = await updateAuthUser({ data: { password: newPassword } });
    setBusyPassword(false);
    if (!result.ok) return toast.error(result.message ?? "Could not update your password.");
    toast.success("Password updated");
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
  };

  const enable2fa = async () => {
    toast.info("Two-factor authentication is coming soon.");
  };

  const verify2fa = async () => {
    toast.info("2FA verification is coming soon — hang tight!");
  };

  const signOutOthers = async () => {
    try {
      await revokeOtherSessions({});
      toast.success("Signed out of all other sessions.");
    } catch {
      toast.error("Could not sign out your other sessions.");
    }
  };

  const exportData = async () => {
    setExporting(true);
    try {
      const [{ data: saved }, { data: tracked }] = await Promise.all([
        db.from("saved_qrs").select("*"),
        db.from("tracked_qrs").select("*").eq("user_id", user.id),
      ]);
      const payload = {
        exported_at: new Date().toISOString(),
        profile: {
          id: user.id,
          email: user.email,
          display_name: user.user_metadata?.display_name ?? null,
        },
        saved_qrs: saved ?? [],
        dynamic_links: tracked ?? [],
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `rout-account-data-${user.id}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Export downloaded");
    } catch {
      toast.error("Could not export account data.");
    } finally {
      setExporting(false);
    }
  };

  const deleteAccount = async () => {
    if (deleteConfirmText !== "DELETE") return;
    setDeleting(true);
    try {
      await Promise.all([
        db.from("saved_qrs").delete().neq("id", ""),
        db.from("tracked_qrs").delete().eq("user_id", user.id),
      ]);
      const { error } = await db.rpc("delete_account" as never);
      if (error) {
        toast.error(
          "Your data was removed, but the account itself could not be deleted automatically. Contact support to finish closing your account.",
        );
      } else {
        toast.success("Account deleted.");
      }
      await signOut();
      nav("/", { replace: true });
    } catch {
      toast.error("Something went wrong while deleting your account.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <AppLayout
      title="Settings &amp; security"
      description={`Signed in as ${user.email}`}
      crumbs={[{ label: "Settings" }]}
    >
      <Tabs value={tab} onValueChange={(v) => setTab(parseTab(v))} className="mt-4">
        <TabsList className="grid h-auto w-full grid-cols-2 gap-1 sm:grid-cols-4">
          <TabsTrigger value="profile" className="h-9">
            {t("settings.tabs.profile")}
          </TabsTrigger>
          <TabsTrigger value="security" className="h-9">
            {t("settings.tabs.security")}
          </TabsTrigger>
          <TabsTrigger value="identities" className="h-9">
            {t("settings.tabs.identities")}
          </TabsTrigger>
          <TabsTrigger value="status" className="h-9">
            {t("settings.tabs.status")}
          </TabsTrigger>
        </TabsList>

        {/* Tab 1 — Profile */}
        <TabsContent value="profile" className="space-y-4">
          <section className="space-y-3 rounded-2xl border border-border bg-card p-4 sm:p-5">
            <h2 className="flex items-center gap-2 text-lg font-medium">
              <UserIcon className="h-4 w-4" /> Profile
            </h2>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                Profielfoto
              </label>
              <AvatarUpload
                value={avatarUrl}
                name={displayName || user.email}
                onChange={setAvatarUrl}
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                Display Name
              </label>
              <Input
                value={displayName}
                placeholder="Jona Zeno"
                maxLength={80}
                onChange={(e) => setDisplayName(e.target.value)}
                className="input-field h-11 rounded-xl"
              />
            </div>
            <Button onClick={saveProfile} disabled={savingProfile} className="h-11 w-full sm:w-auto">
              Save profile
            </Button>
          </section>

          <section className="space-y-3 rounded-2xl border border-border bg-card p-4 sm:p-5">
            <h2 className="flex items-center gap-2 text-lg font-medium">
              <Languages className="h-4 w-4" /> {t("settings.language.title")}
            </h2>
            <p className="text-sm text-muted-foreground">{t("settings.language.body")}</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {LOCALES.map((code) => {
                const active = language === code;
                return (
                  <button
                    key={code}
                    type="button"
                    onClick={async () => {
                      const { error } = await saveLanguage(code);
                      if (error) toast.error(error.message);
                      else toast.success(t("settings.language.saved"));
                    }}
                    aria-pressed={active}
                    className={`flex h-11 items-center justify-between rounded-xl border px-3 text-sm transition-colors ${
                      active
                        ? "border-foreground bg-muted/60 text-foreground"
                        : "border-border text-muted-foreground hover:bg-muted/40 hover:text-foreground"
                    }`}
                  >
                    <span>{LOCALE_LABELS[code]}</span>
                    <span className="text-xs uppercase tracking-wide">{code}</span>
                  </button>
                );
              })}
            </div>
          </section>
        </TabsContent>

        {/* Tab 2 — Account & security */}
        <TabsContent value="security" className="space-y-4">
          <section className="space-y-3 rounded-2xl border border-border bg-card p-4 sm:p-5">
            <h2 className="flex items-center gap-2 text-lg font-medium">
              <Mail className="h-4 w-4" /> E-mail address
            </h2>
            <Badge
              variant="outline"
              className="w-fit gap-1.5 rounded-full px-3 py-1 text-xs font-normal"
            >
              <ShieldCheck className="h-3.5 w-3.5 text-green-600" /> {user.email}
            </Badge>
            <Input
              value={email}
              type="email"
              placeholder="new@email.com"
              maxLength={255}
              onChange={(e) => setEmail(e.target.value)}
              className="input-field h-11 rounded-xl"
            />
            <Input
              value={emailCurrentPassword}
              type="password"
              placeholder="Current password"
              maxLength={72}
              onChange={(e) => setEmailCurrentPassword(e.target.value)}
              className="input-field h-11 rounded-xl"
            />
            <Button onClick={changeEmail} disabled={busyEmail} className="h-11 w-full sm:w-auto">
              Update email
            </Button>
          </section>

          <section className="space-y-3 rounded-2xl border border-border bg-card p-4 sm:p-5">
            <h2 className="flex items-center gap-2 text-lg font-medium">
              <KeyRound className="h-4 w-4" /> Password
            </h2>
            <div className="relative">
              <Input
                value={currentPassword}
                type={showCurrent ? "text" : "password"}
                placeholder="Current password"
                maxLength={72}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="input-field h-11 rounded-xl pr-10"
              />
              <button
                type="button"
                onClick={() => setShowCurrent((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                aria-label="Toggle password visibility"
              >
                {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <PasswordField label="New password" value={newPassword} onChange={setNewPassword} />
            <div className="relative">
              <Input
                value={confirmPassword}
                type={showConfirm ? "text" : "password"}
                placeholder="Confirm new password"
                maxLength={72}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="input-field h-11 rounded-xl pr-10 focus-visible:ring-2 focus-visible:ring-ring"
              />
              <button
                type="button"
                onClick={() => setShowConfirm((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md"
                aria-label="Toggle password visibility"
              >
                {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <Button
              onClick={changePassword}
              disabled={busyPassword || !isPasswordCompliant(newPassword)}
              className="h-11 w-full sm:w-auto"
            >
              Update password
            </Button>
          </section>

          <PasskeysPanel />

          <ConnectedAccounts />

          <section className="space-y-3 rounded-2xl border border-border bg-card p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="flex items-center gap-2 text-lg font-medium">
                <ShieldCheck className="h-4 w-4" /> Two-Factor Authentication (2FA)
              </h2>
              <Badge
                className={
                  mfaEnabled
                    ? "bg-green-500/15 text-green-700 hover:bg-green-500/15"
                    : "bg-muted text-muted-foreground hover:bg-muted"
                }
              >
                Status: {mfaEnabled ? "Enabled" : "Disabled"}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              Add an extra layer of security to your account using an authenticator app (TOTP).
            </p>
            <Button onClick={enable2fa} variant="outline" className="h-11 w-full sm:w-auto">
              Enable 2FA
            </Button>
          </section>

          <section className="space-y-3 rounded-2xl border border-border bg-card p-4 sm:p-5">
            <h2 className="flex items-center gap-2 text-lg font-medium">
              <Monitor className="h-4 w-4" /> Active Sessions
            </h2>
            <div className="rounded-xl border border-border bg-background p-3">
              <p className="text-sm font-medium text-foreground">
                {typeof navigator !== "undefined"
                  ? navigator.userAgent.split(") ")[0] + ")"
                  : "This device"}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Current session · last active just now
              </p>
            </div>
            <Button onClick={signOutOthers} variant="outline" className="h-11 w-full sm:w-auto">
              Sign out of all other sessions
            </Button>
          </section>

          <section className="space-y-3 rounded-2xl border border-border bg-card p-4 sm:p-5">
            <h2 className="text-lg font-medium">Developer access</h2>
            <p className="text-sm text-muted-foreground">
              Manage API keys, scopes and MCP endpoints in the developer hub.
            </p>
            <Button asChild variant="outline" className="h-11 w-full sm:w-auto">
              <Link to="/api">Open API &amp; MCP hub</Link>
            </Button>
          </section>
        </TabsContent>

        {/* Tab 3 — Linked identities */}
        <TabsContent value="identities" className="space-y-4">
          <IdentitiesPanel />
        </TabsContent>

        {/* Tab 4 — Account status & control */}
        <TabsContent value="status" className="space-y-4">
          <FreezeAccountPanel />

          <MergeAccountWizard />

          <section className="space-y-3 rounded-2xl border border-border bg-card p-4 sm:p-5">
            <h2 className="text-lg font-medium">Mijn gegevens</h2>
            <p className="text-sm text-muted-foreground">
              Eén pagina met alles wat we bewaren: exporteren of definitief verwijderen.
            </p>
            <Button asChild variant="outline" className="h-11 w-full sm:w-auto">
              <Link to="/my-data">Open mijn gegevens</Link>
            </Button>
          </section>

          <section className="space-y-4 rounded-2xl border border-red-500/30 bg-red-500/5 p-4 sm:p-5">
            <h2 className="flex items-center gap-2 text-lg font-medium text-red-600">
              <AlertTriangle className="h-4 w-4" /> Danger Zone
            </h2>

            <div className="flex flex-col gap-2 rounded-xl border border-border bg-background p-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">Download Account Data</p>
                <p className="text-xs text-muted-foreground">
                  Export your QR codes, dynamic links and profile data.
                </p>
              </div>
              <Button onClick={exportData} disabled={exporting} variant="outline" className="gap-1.5">
                <Download className="h-4 w-4" /> Export JSON/ZIP
              </Button>
            </div>

            <div className="flex flex-col gap-2 rounded-xl border border-border bg-background p-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">Delete Account</p>
                <p className="text-xs text-muted-foreground">
                  Permanently delete your account and all associated data. This cannot be undone.
                </p>
              </div>
              <Button
                onClick={() => setDeleteDialogOpen(true)}
                className="bg-red-600 text-white hover:bg-red-700"
              >
                Delete account…
              </Button>
            </div>
          </section>

          <Button
            variant="outline"
            className="h-11 w-full gap-2 text-destructive sm:w-auto"
            onClick={async () => {
              await signOut();
              nav("/", { replace: true });
            }}
          >
            <LogOut className="h-4 w-4" /> Sign out
          </Button>
        </TabsContent>
      </Tabs>

      <Dialog open={mfaDialogOpen} onOpenChange={setMfaDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Set up authenticator app</DialogTitle>
            <DialogDescription>
              Scan this QR code with your authenticator app, then enter the 6-digit code to confirm.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4">
            <div className="flex h-40 w-40 items-center justify-center rounded-xl border border-dashed border-border bg-muted/40 text-xs text-muted-foreground">
              QR placeholder
            </div>
            <Input
              value={mfaCode}
              onChange={(e) => setMfaCode(e.target.value)}
              placeholder="6-digit code"
              maxLength={6}
              className="h-11 rounded-xl text-center tracking-widest"
            />
            <Button onClick={verify2fa} className="h-11 w-full">
              Verify &amp; enable
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete account</DialogTitle>
            <DialogDescription>
              This will permanently delete your account and all associated data. Type{" "}
              <span className="font-mono font-semibold">DELETE</span> to confirm.
            </DialogDescription>
          </DialogHeader>
          <Input
            value={deleteConfirmText}
            onChange={(e) => setDeleteConfirmText(e.target.value)}
            placeholder="DELETE"
            className="h-11 rounded-xl"
          />
          <Button
            onClick={deleteAccount}
            disabled={deleteConfirmText !== "DELETE" || deleting}
            className="h-11 w-full bg-red-600 text-white hover:bg-red-700"
          >
            {deleting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              "Permanently delete my account"
            )}
          </Button>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
