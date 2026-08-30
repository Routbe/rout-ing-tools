import { QrCode } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { SocialPlatformIcon } from "@/lib/social-icons";
import {
  ArrowDown,
  ArrowUp,
  BarChart3,
  Check,
  ChevronDown,
  Copy,
  Eye,
  Folder,
  Globe,
  GripVertical,
  Link2,
  Loader2,
  Lock,

  Palette,
  Plus,
  Search,
  Settings,
  Star,
  Trash2,
  Upload,
  X,
  Smartphone,
  Monitor,
} from "lucide-react";
import {
  AreaChart,
  Area,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { Input } from "@/components/ui/input";
import { DataExportCard } from "@/components/dashboard/DataExportCard";
import { CustomDomainPanel } from "@/components/dashboard/CustomDomainPanel";
import { VerifiedBadgeCard } from "@/components/dashboard/VerifiedBadgeCard";
import { SocialSharingCard } from "@/components/dashboard/SocialSharingCard";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Drawer, DrawerContent, DrawerTitle } from "@/components/ui/drawer";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FileUploadInput } from "@/components/FileUploadInput";
import { AvatarUpload } from "@/components/settings/AvatarUpload";

import { useAuth } from "@/hooks/useAuth";
import { useUrlStyle } from "@/hooks/useUrlStyle";
import { useIdentitySpace } from "@/hooks/useIdentitySpace";

import { effectiveUrlStyle, styledProfilePath, type UrlStyle } from "@/lib/profile-url";
import {
  AVATAR_FRAMES,
  BACKGROUND_STYLES,
  BADGE_NAME_FORMATS,
  BADGE_TYPES,
  BANNER_STYLES,
  DEFAULT_DISPLAY_PREFS,
  NAME_ACCENTS,
  TYPOGRAPHY_STYLES,
  formatBadgeName,
  parseDisplayPrefs,
  type ProfileDisplayPrefs,
} from "@/lib/profile-display";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  BLOCK_CATEGORIES,
  BLOCK_KINDS,
  CARD_STYLES,
  handleRuleHint,
  HANDLE_MIN_LENGTH,
  handleIssue,
  PROFILE_THEMES,
  blockHref,
  brandOf,
  isValidHandle,
  isReservedHandle,
  newBlockId,
  normalizeHandle,
  type ProfileBlock,
  type ProfileRecord,
} from "@/lib/profile";
import { ProfileView } from "@/components/profile/ProfileView";
import { VerificationPanel } from "@/components/dashboard/VerificationPanel";
import { DonationPanel } from "@/components/dashboard/DonationPanel";
import {
  checkStudioHandle,
  getStudioAnalytics,
  getStudioProfile,
  saveStudioProfile,
} from "@/lib/studio-profile.functions";
import { SubdomainPanel } from "@/components/dashboard/SubdomainPanel";
import { BadgesPanel } from "@/components/dashboard/BadgesPanel";
import { SocialVerifyPanel } from "@/components/dashboard/SocialVerifyPanel";
import { ReferralPanel } from "@/components/dashboard/ReferralPanel";
import { ReferralAnalytics } from "@/components/dashboard/ReferralAnalytics";
import { BadgeActivityPanel } from "@/components/dashboard/BadgeActivityPanel";
import { EmailForwardingPanel } from "@/components/dashboard/EmailForwardingPanel";
import { EmailAliasDomains } from "@/components/dashboard/EmailAliasDomains";
import { withAuthTimeout, authFailureMessage } from "@/lib/auth-timeout";
import { oauthAvatarOf } from "@/lib/oauth-avatar";
import { BlueskyWizard } from "@/components/dashboard/BlueskyWizard";

type StudioTab = "links" | "design" | "analytics" | "identity" | "settings";

/**
 * `verifiedOnly` tabs are hidden entirely for free members: subdomains,
 * Bluesky handles and e-mail aliases are all entitlements that only exist
 * once a profile is verified, so showing an empty locked tab is just noise.
 */
const TABS: { id: StudioTab; label: string; icon: typeof Link2; verifiedOnly?: boolean }[] = [
  { id: "links", label: "Links & components", icon: Link2 },
  { id: "design", label: "Design & styling", icon: Palette },
  { id: "analytics", label: "Analytics", icon: BarChart3 },
  { id: "identity", label: "Domains & Bluesky", icon: Globe, verifiedOnly: true },
  { id: "settings", label: "Settings & verified", icon: Settings },
];

const TYPOGRAPHY_OPTIONS = TYPOGRAPHY_STYLES;
const BACKGROUND_OPTIONS = BACKGROUND_STYLES;

const QUICK_CREATE = [
  { kind: "link", label: "+ Link" },
  { kind: "__socials", label: "+ Socials" },
  { kind: "__fediverse", label: "+ Matrix/Fediverse" },
  { kind: "vcard", label: "+ vCard" },
] as const;

const RANGE_OPTIONS = [
  { id: "7d", label: "Last 7 days", days: 7 },
  { id: "30d", label: "30 days", days: 30 },
  { id: "all", label: "All time", days: null },
] as const;

/** Smart input hint per component type. */
function inputHint(kind: string): { prefix?: string; help: string } {
  const def = BLOCK_KINDS.find((k) => k.kind === kind);
  if (def?.base)
    return {
      prefix: def.base.replace(/^https?:\/\//, ""),
      help: "Enter just your handle or username — we build the link.",
    };
  switch (kind) {
    case "email":
      return { help: "E-mail address — becomes a mailto: link." };
    case "phone":
    case "whatsapp":
    case "whatsapp_chat":
      return { help: "Phone number in international format (+1…)." };
    case "matrix":
      return { help: "Matrix ID in the format @user:server." };
    case "lightning":
      return { help: "Lightning address, e.g. jona@getalby.com." };
    case "evm":
      return { help: "Public wallet address (0x…)." };
    case "location":
      return { help: "Full address — becomes a map link." };
    default:
      return { help: "Full URL including https://." };
  }
}

/**
 * ROUT Studio — the creator workspace for the public Profile Hub.
 * Four fixed tabs (links, design, analytics, settings) with a live mobile
 * preview alongside, fully decoupled from the QR generator.
 */
export function ProfileEditor() {
  const { user } = useAuth();
  const { style: rawUrlStyle, save: saveUrlStylePref } = useUrlStyle();

  const loadProfileEditor = useServerFn(getStudioProfile);
  const checkHandle = useServerFn(checkStudioHandle);
  const saveProfile = useServerFn(saveStudioProfile);
  const loadAnalytics = useServerFn(getStudioAnalytics);
  const [tab, setTab] = useState<StudioTab>("links");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);

  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [dirty, setDirty] = useState(false);
  const [handle, setHandle] = useState("");
  const [claimed, setClaimed] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [tagline, setTagline] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [faviconUrl, setFaviconUrl] = useState("");
  const [theme, setTheme] = useState("noir");
  const [cardStyle, setCardStyle] = useState("bordered");
  const [prefs, setPrefs] = useState<ProfileDisplayPrefs>(DEFAULT_DISPLAY_PREFS);
  const setPref = <K extends keyof ProfileDisplayPrefs>(key: K, value: ProfileDisplayPrefs[K]) =>
    setPrefs((p) => ({ ...p, [key]: value }));
  const [blocks, setBlocks] = useState<ProfileBlock[]>([]);
  const [verified, setVerified] = useState(false);
  const { space: identitySpace, select: selectIdentitySpace } = useIdentitySpace(verified);

  const [legalName, setLegalName] = useState<string | null>(null);
  const [drawer, setDrawer] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [query, setQuery] = useState("");
  /** Standaard staat "Soeverein & Fediverse" voor: soevereine tools eerst. */
  const [cat, setCat] = useState<string>("featured");
  /** Live view: realistisch telefoonframe of breed desktopvenster. */
  const [previewDevice, setPreviewDevice] = useState<"mobile" | "desktop">("mobile");

  const [openBlock, setOpenBlock] = useState<string | null>(null);
  const [stats, setStats] = useState<{ qrs: number; scans: number } | null>(null);
  const [range, setRange] = useState<(typeof RANGE_OPTIONS)[number]["id"]>("30d");
  const [series, setSeries] = useState<{ date: string; scans: number }[] | null>(null);
  const [availability, setAvailability] = useState<"idle" | "checking" | "available" | "taken">(
    "idle",
  );
  const dragId = useRef<string | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    let active = true;
    setLoading(true);
    setLoadError(null);
    (async () => {
      try {
        console.info("[studio:profile-load:start]", { attempt: loadAttempt });
        const started = Date.now();
        const data = await withAuthTimeout(loadProfileEditor(), "studio:getStudioProfile", 8_000);
        if (!active) return;
        console.info(`[studio:profile-load:done] ${Date.now() - started}ms found=${Boolean(data)}`);
        if (data) {
          setHandle(data.username ?? "");
          setClaimed(data.username ?? null);
          setVerified(Boolean(data.verified) && data.status === "active");
          setLegalName(data.verifiedLegalName || null);
          setDisplayName(data.displayName ?? "");
          setTagline(data.tagline ?? "");
          setAvatarUrl(data.avatarUrl ?? oauthAvatarOf(user) ?? "");
          setFaviconUrl(data.faviconUrl ?? "");
          setTheme(data.theme ?? "noir");
          setCardStyle(data.cardStyle ?? "bordered");
          setBlocks(Array.isArray(data.blocks) ? (data.blocks as unknown as ProfileBlock[]) : []);
        } else {
          const wanted = (user.user_metadata?.desired_handle as string | undefined) ?? "";
          setHandle(normalizeHandle(wanted || user.email?.split("@")[0] || ""));
          setDisplayName((user.user_metadata?.full_name as string | undefined) ?? "");
          setAvatarUrl(oauthAvatarOf(user) ?? "");
        }
        // Weergavevoorkeuren komen uit de database; lokale legacy-waarden
        // dienen alleen nog als terugval voor wie nog niet opnieuw opsloeg.
        let loadedPrefs = parseDisplayPrefs(data?.displayPrefs ?? null);
        if (!data?.displayPrefs || Object.keys(data.displayPrefs).length === 0) {
          try {
            const raw = localStorage.getItem(`rout_studio_extra_${user.id}`);
            if (raw) loadedPrefs = parseDisplayPrefs({ ...loadedPrefs, ...JSON.parse(raw) });
          } catch {
            /* ignore */
          }
        }
        setPrefs(loadedPrefs);
        setLoadError(null);
      } catch (error) {
        if (!active) return;
        console.error("[studio:profile-load:failed]", {
          message: error instanceof Error ? error.message : String(error),
          name: error instanceof Error ? error.name : typeof error,
          status: (error as { status?: number } | null)?.status ?? null,
          body: (error as { body?: unknown } | null)?.body ?? null,
          raw: error,
        });

        setLoadError(
          authFailureMessage(error, "We konden je profiel niet laden. Probeer het opnieuw."),
        );
      } finally {
        // Never leave the studio spinning: the loader stops on success and failure.
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [user, loadProfileEditor, loadAttempt]);




  // Privacy-first counters: only aggregated counts, no visitor profiles (Neon).
  useEffect(() => {
    if (!user || tab !== "analytics") return;
    let active = true;
    const opt = RANGE_OPTIONS.find((r) => r.id === range);
    (async () => {
      try {
        const data = await loadAnalytics({ data: { days: opt?.days ?? null } });
        if (!active) return;
        setStats({ qrs: data.qrs, scans: data.scans });
        setSeries(data.series);
      } catch (error) {
        if (!active) return;
        console.error("[studio:analytics:failed]", error);
        setStats({ qrs: 0, scans: 0 });
        setSeries([]);
      }
    })();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, tab, range]);

  /** Canonical public host — always rout.be, even in preview/dev. */
  const host = "rout.be";
  const normalized = normalizeHandle(handle);
  const reserved = isReservedHandle(normalized);
  const handleCtx = {
    tier: (verified ? "verified" : "free") as "verified" | "free",
    // Privacy-modus: geen koppeling met de wettelijke naam, geen cijferplicht.
    legalName: prefs.identityMode === "private" ? null : legalName,
    identityMode: prefs.identityMode,
  };
  const handleProblem = normalized ? handleIssue(normalized, handleCtx) : null;
  const handleOk = isValidHandle(normalized) && !reserved && !handleProblem;
  // Volg de actieve identiteitsruimte; schone root-URLs blijven Pro-only.
  const urlStyle = effectiveUrlStyle(
    identitySpace === "verified" ? "clean" : rawUrlStyle === "clean" || rawUrlStyle === "clean_at" ? "u" : rawUrlStyle,
    verified,
  );
  const publicPath = styledProfilePath(claimed ?? "", urlStyle);


  const visibleTabs = useMemo(() => TABS.filter((t) => !t.verifiedOnly || verified), [verified]);
  // Losing verification (or loading it late) must never leave the studio on a
  // tab that is no longer rendered — that would show an empty pane.
  useEffect(() => {
    if (!visibleTabs.some((t) => t.id === tab)) setTab("links");
  }, [visibleTabs, tab]);

  // Debounced real-time handle availability check against the profiles table.
  useEffect(() => {
    if (!normalized || !handleOk) {
      setAvailability("idle");
      return;
    }
    if (normalized === claimed) {
      setAvailability("available");
      return;
    }
    setAvailability("checking");
    const id = setTimeout(async () => {
      const data = await checkHandle({ data: { handle: normalized } });
      setAvailability(data.ok ? "available" : "taken");
    }, 400);
    return () => clearTimeout(id);
  }, [normalized, handleOk, claimed, user, checkHandle]);

  const draft: ProfileRecord = useMemo(
    () => ({
      id: user?.id ?? "draft",
      username: normalized || "handle",
      display_name: displayName,
      tagline,
      avatar_url: avatarUrl || null,
      favicon_url: faviconUrl || null,
      theme,
      card_style: cardStyle,
      blocks,
      verified,
      status: verified ? "active" : "pending",
      verified_legal_name: legalName,
      display_prefs: prefs,
    }),
    [
      user,
      normalized,
      displayName,
      tagline,
      avatarUrl,
      faviconUrl,
      theme,
      cardStyle,
      blocks,
      verified,
      legalName,
      prefs,
    ],
  );

  /**
   * Debounced copy of the draft (max. 1 preview re-render per 150ms) so typing
   * stays at 60 FPS on phones instead of re-rendering the whole profile view
   * on every keystroke.
   */
  const [previewDraft, setPreviewDraft] = useState<ProfileRecord>(draft);
  useEffect(() => {
    const id = setTimeout(() => setPreviewDraft(draft), 150);
    return () => clearTimeout(id);
  }, [draft]);

  // Autosave: flag changes and save silently after 1.2s of rest.
  const firstDraft = useRef(true);
  useEffect(() => {
    if (loading) return;
    if (firstDraft.current) {
      firstDraft.current = false;
      return;
    }
    setDirty(true);
  }, [draft, loading]);

  useEffect(() => {
    if (!dirty || saving || !handleOk) return;
    const id = setTimeout(() => void save(true), 1200);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dirty, draft, handleOk]);

  const save = async (silent = false) => {
    if (!user) return;
    if (!handleOk) {
      if (silent) return;
      return toast.error(handleProblem ?? `Choose a valid handle — ${handleRuleHint(handleCtx)}.`);
    }
    setSaving(true);
    const result = await saveProfile({
      data: {
        username: normalized,
        displayName: displayName.trim() || null,
        tagline: tagline.trim() || null,
        avatarUrl: avatarUrl.trim() || null,
        faviconUrl: faviconUrl.trim() || null,
        theme,
        cardStyle,
        blocks: blocks as unknown as never,
        displayPrefs: prefs as unknown as never,
      },
    });
    setSaving(false);
    if (!result.ok) {
      if (silent) return;
      if (result.reason === "handle_taken") return toast.error("That handle is already taken.");
      if (result.reason === "handle_reserved")
        return toast.error("That handle is reserved by the system.");
      if (result.reason === "handle_invalid") return toast.error("That handle is not valid.");
      return toast.error(result.reason ?? "Saving failed");
    }
    setClaimed(normalized);
    setDirty(false);
    setSavedAt(Date.now());
    if (!silent) toast.success("Studio saved");
  };

  const addBlock = (kind: string) => {
    const def = BLOCK_KINDS.find((k) => k.kind === kind)!;
    const id = newBlockId();
    setBlocks((b) => [...b, { id, kind, label: def.label, value: "" }]);
    setOpenBlock(id);
    setDrawer(false);
    // Search term and category are kept for next time.
  };

  const quickCreate = (kind: (typeof QUICK_CREATE)[number]["kind"]) => {
    if (kind === "__socials") {
      setCat("socials");
      setDrawer(true);
      return;
    }
    if (kind === "__fediverse") {
      setCat("featured");
      setDrawer(true);
      return;
    }
    addBlock(kind);
  };

  const patch = (id: string, next: Partial<ProfileBlock>) =>
    setBlocks((b) => b.map((x) => (x.id === id ? { ...x, ...next } : x)));

  /** Every reorder gets a floating Undo toast, one click back. */
  const reorderWithUndo = (mutate: (list: ProfileBlock[]) => ProfileBlock[]) => {
    setBlocks((b) => {
      const next = mutate(b);
      if (next === b) return b;
      const before = b;
      toast("Order changed", {
        action: { label: "Undo", onClick: () => setBlocks(before) },
      });
      return next;
    });
  };

  const move = (id: string, delta: number) =>
    reorderWithUndo((b) => {
      const from = b.findIndex((x) => x.id === id);
      const to = from + delta;
      if (from < 0 || to < 0 || to >= b.length) return b;
      const next = [...b];
      next.splice(to, 0, next.splice(from, 1)[0]);
      return next;
    });

  const dropOn = (targetId: string) => {
    const from = dragId.current;
    dragId.current = null;
    setDragging(null);
    setDropTarget(null);
    if (!from || from === targetId) return;
    reorderWithUndo((b) => {
      const next = b.filter((x) => x.id !== from);
      const moved = b.find((x) => x.id === from);
      if (!moved) return b;
      next.splice(
        next.findIndex((x) => x.id === targetId),
        0,
        moved,
      );
      return next;
    });
  };

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    return BLOCK_CATEGORIES.filter((c) => cat === "all" || cat === c.id)
      .map((c) => ({
        ...c,
        items: BLOCK_KINDS.filter(
          (k) => k.category === c.id && (!q || k.label.toLowerCase().includes(q)),
        ),
      }))
      .filter((c) => c.items.length > 0);
  }, [cat, query]);

  // Top clicked components: proportional estimate over total scans, ranked by position
  // until per-block click tracking ships. Purely presentational, no fabricated identities.
  const topClicked = useMemo(() => {
    const visible = blocks.filter((b) => !b.hidden && b.value);
    if (!visible.length || !stats?.scans) return [];
    const weights = visible.map((_, i) => visible.length - i);
    const totalWeight = weights.reduce((a, b) => a + b, 0);
    return visible
      .map((b, i) => {
        const clicks = Math.round((weights[i] / totalWeight) * stats.scans);
        return { block: b, clicks };
      })
      .sort((a, b) => b.clicks - a.clicks)
      .slice(0, 6);
  }, [blocks, stats]);
  const maxClicks = topClicked[0]?.clicks || 1;

  if (loadError) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 text-center">
        <p className="text-sm font-medium">Je profiel kon niet geladen worden</p>
        <p className="max-w-sm text-sm text-muted-foreground">{loadError}</p>
        <Button variant="outline" onClick={() => setLoadAttempt((n) => n + 1)}>
          Opnieuw proberen
        </Button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }


  const showSaveBar = tab !== "analytics";

  return (
    <div className={cn("flex flex-1 flex-col space-y-4", showSaveBar && "pb-16 lg:pb-4")}>
      {/* Namespace banner — crystal clear which tier is active */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card px-3 py-2.5">
        <span
          className={cn(
            "rounded-full px-2 py-0.5 text-[11px] font-medium",
            verified ? "bg-primary/10" : "bg-muted",
          )}
        >
          {verified ? "Pro tier" : "Free tier"}
        </span>
        <span className="min-w-0 break-all font-mono text-[13px] font-medium">
          {host}
          {styledProfilePath(normalized || "handle", urlStyle)}
        </span>
        {claimed && (
          <a
            href={publicPath}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-auto text-xs font-medium underline"
          >
            View live →
          </a>
        )}
      </div>

      {/* Studio tabs */}
      <div
        role="tablist"
        aria-label="Studio"
        className="flex w-full gap-1 overflow-x-auto rounded-xl border border-border bg-card p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {visibleTabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            role="tab"
            type="button"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={cn(
              "flex h-10 shrink-0 items-center gap-1.5 rounded-lg px-3 text-xs font-medium transition-colors",
              tab === id
                ? "bg-foreground text-background"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="h-4 w-4" aria-hidden />
            <span className="whitespace-nowrap">{label}</span>
          </button>
        ))}
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-4">
          {tab === "links" && (
            <>
              {/* Permanent Profile Info Card */}
              <section className="space-y-4 rounded-2xl border border-border bg-card p-4 sm:p-5">
                <h2 className="text-lg font-medium">Profile Info</h2>
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                  <div className="w-full sm:max-w-xs">
                    <AvatarUpload
                      value={avatarUrl || null}
                      name={displayName}
                      onChange={(url) => setAvatarUrl(url ?? "")}
                    />
                  </div>

                  <div className="min-w-0 flex-1 space-y-2">
                    <Input
                      value={displayName}
                      maxLength={60}
                      placeholder="Jona Zeno"
                      onChange={(e) => setDisplayName(e.target.value)}
                      className="input-field h-10 rounded-xl"
                      aria-label="Display Name"
                    />
                    <Input
                      value={tagline}
                      maxLength={120}
                      placeholder="Open-source developer & designer"
                      onChange={(e) => setTagline(e.target.value)}
                      className="input-field h-10 rounded-xl"
                      aria-label="Bio / Tagline"
                    />
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-background px-3 py-2">
                  <span className="min-w-0 flex-1 truncate font-mono text-xs text-muted-foreground">
                    rout.be{styledProfilePath(normalized || "handle", urlStyle)}
                  </span>
                  <button
                    type="button"
                    onClick={() => setTab("settings")}
                    className="shrink-0 rounded-lg border border-border px-2 py-1 text-[11px] font-medium hover:bg-muted"
                  >
                    Edit handle
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      void navigator.clipboard.writeText(
                        `https://rout.be${styledProfilePath(normalized || "handle", urlStyle)}`,
                      );
                      toast.success("Link copied!");
                    }}
                    className="shrink-0 rounded-lg border border-border px-2 py-1 text-[11px] font-medium hover:bg-muted"
                  >
                    Copy link
                  </button>
                </div>
              </section>

              <section className="space-y-3 rounded-2xl border border-border bg-card p-4 sm:p-5">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-medium">Components</h2>
                  <span className="text-[11px] text-muted-foreground">
                    {blocks.filter((b) => !b.hidden).length} visible
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => setDrawer(true)}
                  className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-foreground text-sm font-medium text-background transition-opacity hover:opacity-90"
                >
                  <Plus className="h-4 w-4" aria-hidden /> + Add component
                </button>

                <div className="flex flex-wrap gap-2">
                  {QUICK_CREATE.map((q) => (
                    <button
                      key={q.kind}
                      type="button"
                      onClick={() => quickCreate(q.kind)}
                      className="h-8 shrink-0 rounded-full border border-border px-3 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    >
                      {q.label}
                    </button>
                  ))}
                </div>

                {blocks.length === 0 && (
                  <p className="rounded-xl border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
                    No components yet — add your first social link, header, or custom URL.
                  </p>
                )}

                <ul className="space-y-2">
                  {blocks.map((b, index) => {
                    const hint = inputHint(b.kind);
                    const open = openBlock === b.id;
                    return (
                      <li
                        key={b.id}
                        draggable
                        onDragStart={() => {
                          dragId.current = b.id;
                          setDragging(b.id);
                        }}
                        onDragEnd={() => {
                          dragId.current = null;
                          setDragging(null);
                          setDropTarget(null);
                        }}
                        onDragOver={(e) => {
                          e.preventDefault();
                          if (dragId.current && dragId.current !== b.id) setDropTarget(b.id);
                        }}
                        onDragLeave={() => setDropTarget((t) => (t === b.id ? null : t))}
                        onDrop={() => dropOn(b.id)}
                        className={cn(
                          "relative overflow-hidden rounded-xl border bg-background p-3 transition-all",
                          b.hidden ? "border-border opacity-60" : "border-border",
                          dragging === b.id && "opacity-40",
                          dropTarget === b.id &&
                            "before:absolute before:inset-x-2 before:-top-px before:h-0.5 before:rounded-full before:bg-primary",
                        )}
                        style={{ borderLeft: `4px solid ${brandOf(b.kind)}` }}
                      >
                        <div className="flex min-w-0 items-center gap-2">
                          <GripVertical
                            className="h-4 w-4 shrink-0 cursor-grab text-muted-foreground"
                            aria-hidden
                          />
                          <span
                            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-border bg-muted/40"
                            style={{ color: brandOf(b.kind) }}
                          >
                            <SocialPlatformIcon
                              source={b.value?.trim() || b.kind}
                              className="h-4 w-4 text-current"
                            />
                          </span>
                          <button
                            type="button"
                            onClick={() => setOpenBlock(open ? null : b.id)}
                            className="min-w-0 flex-1 text-left"
                          >
                            <span className="block truncate text-sm font-medium">{b.label}</span>
                            <span className="block truncate text-[11px] text-muted-foreground">
                              {b.value ? blockHref(b) : "Not filled in yet"}
                            </span>
                          </button>
                          <Switch
                            checked={!b.hidden}
                            onCheckedChange={(on) => patch(b.id, { hidden: !on })}
                            aria-label={b.hidden ? "Show component" : "Hide component"}
                            className="shrink-0 data-[state=checked]:bg-emerald-500"
                          />
                          <button
                            type="button"
                            aria-label="Settings"
                            onClick={() => setOpenBlock(open ? null : b.id)}
                            className="shrink-0 rounded-lg p-1 text-muted-foreground hover:bg-muted"
                          >
                            <ChevronDown
                              className={cn("h-4 w-4 transition-transform", open && "rotate-180")}
                            />
                          </button>
                        </div>

                        {open && (
                          <div className="mt-3 space-y-2 border-t border-border pt-3">
                            <Input
                              className="input-field h-11 rounded-xl"
                              placeholder={BLOCK_KINDS.find((k) => k.kind === b.kind)?.placeholder}
                              value={b.value}
                              maxLength={400}
                              onChange={(e) => patch(b.id, { value: e.target.value })}
                            />
                            <p className="text-[11px] text-muted-foreground">
                              {hint.prefix && (
                                <span className="mr-1 font-mono text-foreground">
                                  {hint.prefix}
                                </span>
                              )}
                              {hint.help}
                            </p>
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                aria-label="Move up"
                                disabled={index === 0}
                                onClick={() => move(b.id, -1)}
                                className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted disabled:opacity-30"
                              >
                                <ArrowUp className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                aria-label="Move down"
                                disabled={index === blocks.length - 1}
                                onClick={() => move(b.id, 1)}
                                className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted disabled:opacity-30"
                              >
                                <ArrowDown className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setBlocks((x) => x.filter((y) => y.id !== b.id))}
                                className="ml-auto inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-[11px] font-medium text-muted-foreground hover:bg-muted hover:text-destructive"
                              >
                                <Trash2 className="h-3.5 w-3.5" /> Delete
                              </button>
                            </div>
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </section>
              <section className="space-y-3">
                <h2 className="px-1 text-lg font-medium">Referrals &amp; Rewards</h2>
                <p className="px-1 text-sm text-muted-foreground">
                  Nodig vrienden uit met je persoonlijke link. 3 vrienden = 50% korting,
                  3 geverifieerde vrienden = gratis verificatie, 10 vrienden = gratis
                  verificatie én de Epic badge “The Influencer”.
                </p>
                <ReferralPanel />
                <ReferralAnalytics />
              </section>

              <SocialVerifyPanel handle={normalized || handle} />

              {/* Eén bron van waarheid: QR-styling gebeurt in de generator. */}
              <section className="space-y-3 rounded-2xl border border-border bg-card p-4 sm:p-5">
                <h2 className="text-lg font-medium">Profiel-QR</h2>
                <p className="text-sm text-muted-foreground">
                  Je profiel-QR ontwerp je in de QR-generator: kleuren, patronen, hoeken en logo.
                  De code verwijst altijd naar je profiel, dus geprinte kaartjes blijven geldig.
                </p>
                <a
                  href="/qr?type=profile_hub"
                  className="inline-flex h-9 items-center gap-2 rounded-xl bg-foreground px-3 text-xs font-medium text-background transition-opacity hover:opacity-90"
                >
                  <QrCode className="h-3.5 w-3.5" aria-hidden /> Stijl &amp; download profiel-QR
                </a>
              </section>


              <BadgesPanel />
              <BadgeActivityPanel />
            </>
          )}

          {tab === "design" && (
            <>
              <section className="space-y-3 rounded-2xl border border-border bg-card p-4 sm:p-5">
                <h2 className="text-lg font-medium">Avatar & Header</h2>
                <div className="space-y-2">
                  <label className="input-label" htmlFor="p-name">
                    Display Name
                  </label>
                  <Input
                    id="p-name"
                    value={displayName}
                    maxLength={60}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="input-field h-11 rounded-xl"
                  />
                </div>
                <div className="space-y-2">
                  <label className="input-label" htmlFor="p-tag">
                    Bio / Tagline
                  </label>
                  <Input
                    id="p-tag"
                    value={tagline}
                    maxLength={120}
                    placeholder="Sovereign QR infrastructure"
                    onChange={(e) => setTagline(e.target.value)}
                    className="input-field h-11 rounded-xl"
                  />
                </div>
                <div className="flex items-center gap-4">
                  <div className="h-14 w-14 shrink-0 overflow-hidden rounded-full border border-border bg-muted/40">
                    {avatarUrl ? (
                      <img
                        src={avatarUrl}
                        alt="Avatar preview"
                        className="h-full w-full object-cover"
                      />
                    ) : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <FileUploadInput type="image" value={avatarUrl} onValueChange={setAvatarUrl} />
                  </div>
                  {avatarUrl && (
                    <Button variant="ghost" size="sm" onClick={() => setAvatarUrl("")}>
                      Remove
                    </Button>
                  )}
                </div>
                <div className="space-y-2 border-t border-border pt-3">
                  <label className="input-label">Favicon (Optional)</label>
                  <FileUploadInput type="image" value={faviconUrl} onValueChange={setFaviconUrl} />
                  {faviconUrl && (
                    <Button variant="ghost" size="sm" onClick={() => setFaviconUrl("")}>
                      Remove
                    </Button>
                  )}
                  <p className="text-[11px] text-muted-foreground">
                    By default your public page uses your avatar as browser icon. Optionally upload
                    a separate favicon (.ico/.png) for maximum branding.
                  </p>
                </div>
              </section>

              <section className="space-y-3 rounded-2xl border border-border bg-card p-4 sm:p-5">
                <h2 className="text-lg font-medium">Theme & Button Style</h2>
                <p className="input-label">Theme Preset</p>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {PROFILE_THEMES.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setTheme(t.id)}
                      className={cn(
                        "flex flex-col gap-2 rounded-xl border p-2.5 text-left transition-colors",
                        theme === t.id ? "border-primary ring-1 ring-primary" : "border-border",
                      )}
                    >
                      <span
                        className="block h-10 w-full rounded-lg border border-border"
                        style={{ background: t.bg }}
                        aria-hidden
                      />
                      <span className="text-xs font-medium">{t.label}</span>
                    </button>
                  ))}
                </div>
                <p className="input-label pt-2">Button Shape</p>
                <div className="flex flex-wrap gap-2">
                  {CARD_STYLES.map((c) => {
                    const shapeLabel = c.label;
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => setCardStyle(c.id)}
                        className={cn(
                          "h-10 shrink-0 rounded-full border px-3 text-xs font-medium transition-colors",
                          cardStyle === c.id ? "border-primary/50 bg-primary/10" : "border-border",
                        )}
                      >
                        {shapeLabel}
                      </button>
                    );
                  })}
                </div>
              </section>

              <section className="space-y-3 rounded-2xl border border-border bg-card p-4 sm:p-5">
                <h2 className="text-lg font-medium">Typography</h2>
                <div className="flex flex-wrap gap-2">
                  {TYPOGRAPHY_OPTIONS.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setPref("typography", t.id)}
                      className={cn(
                        "h-10 shrink-0 rounded-full border px-3 text-xs font-medium transition-colors",
                        prefs.typography === t.id
                          ? "border-primary/50 bg-primary/10"
                          : "border-border",
                      )}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </section>

              <section className="space-y-3 rounded-2xl border border-border bg-card p-4 sm:p-5">
                <h2 className="text-lg font-medium">Background Style</h2>
                <div className="flex flex-wrap gap-2">
                  {BACKGROUND_OPTIONS.map((o) => (
                    <button
                      key={o.id}
                      type="button"
                      onClick={() => setPref("backgroundStyle", o.id)}
                      className={cn(
                        "h-10 shrink-0 rounded-full border px-3 text-xs font-medium transition-colors",
                        prefs.backgroundStyle === o.id
                          ? "border-primary/50 bg-primary/10"
                          : "border-border",
                      )}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              </section>

              <section className="space-y-4 rounded-2xl border border-border bg-card p-4 sm:p-5">
                <div>
                  <h2 className="text-lg font-medium">Canvas &amp; patroon</h2>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Laat leeg om het gekozen thema te volgen.
                  </p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {(
                    [
                      { key: "canvasColor" as const, label: "Achtergrondkleur" },
                      { key: "patternColor" as const, label: "Patroon- en randkleur" },
                    ]
                  ).map((f) => (
                    <div key={f.key} className="space-y-1.5">
                      <p className="input-label">{f.label}</p>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          aria-label={f.label}
                          value={prefs[f.key] ?? "#111111"}
                          onChange={(e) => setPref(f.key, e.target.value)}
                          className="h-10 w-12 shrink-0 cursor-pointer rounded-lg border border-border bg-transparent p-1"
                        />
                        <Input
                          value={prefs[f.key] ?? ""}
                          onChange={(e) => setPref(f.key, e.target.value || null)}
                          placeholder="#0d0d0d"
                          spellCheck={false}
                          className="h-10 font-mono text-xs"
                        />
                        {prefs[f.key] && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-10 shrink-0 text-xs"
                            onClick={() => setPref(f.key, null)}
                          >
                            Wis
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <section className="space-y-4 rounded-2xl border border-border bg-card p-4 sm:p-5">
                <h2 className="text-lg font-medium">Banner</h2>
                <div className="flex flex-wrap gap-2">
                  {BANNER_STYLES.map((o) => (
                    <button
                      key={o.id}
                      type="button"
                      onClick={() => setPref("bannerStyle", o.id)}
                      className={cn(
                        "h-10 shrink-0 rounded-full border px-3 text-xs font-medium transition-colors",
                        prefs.bannerStyle === o.id
                          ? "border-primary/50 bg-primary/10"
                          : "border-border",
                      )}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
                {prefs.bannerStyle === "gradient" && (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <p className="input-label">Van</p>
                      <input
                        type="color"
                        aria-label="Bannerkleur van"
                        value={prefs.bannerFrom ?? "#1a1a1a"}
                        onChange={(e) => setPref("bannerFrom", e.target.value)}
                        className="h-10 w-full cursor-pointer rounded-lg border border-border bg-transparent p-1"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <p className="input-label">Naar</p>
                      <input
                        type="color"
                        aria-label="Bannerkleur naar"
                        value={prefs.bannerTo ?? "#c9a84c"}
                        onChange={(e) => setPref("bannerTo", e.target.value)}
                        className="h-10 w-full cursor-pointer rounded-lg border border-border bg-transparent p-1"
                      />
                    </div>
                  </div>
                )}
                {prefs.bannerStyle === "image" && (
                  <div className="space-y-1.5">
                    <p className="input-label">Afbeeldings-URL (https)</p>
                    <Input
                      value={prefs.bannerImageUrl ?? ""}
                      onChange={(e) => setPref("bannerImageUrl", e.target.value || null)}
                      placeholder="https://…/banner.jpg"
                      spellCheck={false}
                      className="h-10 text-xs"
                    />
                  </div>
                )}
              </section>

              <section className="space-y-4 rounded-2xl border border-border bg-card p-4 sm:p-5">
                <h2 className="text-lg font-medium">Avatar &amp; naam</h2>
                <div className="space-y-2">
                  <p className="input-label">Avatarkader</p>
                  <div className="flex flex-wrap gap-2">
                    {AVATAR_FRAMES.map((o) => (
                      <button
                        key={o.id}
                        type="button"
                        onClick={() => setPref("avatarFrame", o.id)}
                        className={cn(
                          "h-10 shrink-0 rounded-full border px-3 text-xs font-medium transition-colors",
                          prefs.avatarFrame === o.id
                            ? "border-primary/50 bg-primary/10"
                            : "border-border",
                        )}
                      >
                        {o.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <p className="input-label">Naamaccent</p>
                  <div className="flex flex-wrap gap-2">
                    {NAME_ACCENTS.map((o) => (
                      <button
                        key={o.id}
                        type="button"
                        onClick={() => setPref("nameAccent", o.id)}
                        className={cn(
                          "h-10 shrink-0 rounded-full border px-3 text-xs font-medium transition-colors",
                          prefs.nameAccent === o.id
                            ? "border-primary/50 bg-primary/10"
                            : "border-border",
                        )}
                      >
                        {o.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-1.5">
                  <p className="input-label">Statuslijn</p>
                  <Input
                    value={prefs.statusLine ?? ""}
                    maxLength={60}
                    onChange={(e) => setPref("statusLine", e.target.value || null)}
                    placeholder="Beschikbaar voor werk"
                    className="h-10 text-xs"
                  />
                  <p className="text-xs text-muted-foreground">
                    Max. 60 tekens, verschijnt onder je handle.
                  </p>
                </div>
              </section>



              <section className="space-y-3 rounded-2xl border border-border bg-card p-4 sm:p-5">
                <h2 className="text-lg font-medium">Branding</h2>
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">&ldquo;Made with ROUT&rdquo;-voetnoot</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {verified
                        ? "Als geverifieerd lid is je profiel standaard white-label. Zet het merkje aan als je ROUT wil steunen."
                        : "Gratis profielen tonen de subtiele ROUT-voetnoot. Verifieer je account voor een white-label profiel."}
                    </p>
                  </div>
                  <Switch
                    aria-label="Made with ROUT tonen"
                    disabled={!verified}
                    checked={verified ? (prefs.showWatermark ?? false) : true}
                    onCheckedChange={(v) => setPref("showWatermark", v)}
                  />
                </div>
                <div className="flex items-start justify-between gap-4 border-t border-border pt-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">&ldquo;Contact opslaan&rdquo;-knop</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Bezoekers bewaren je profiel als contactkaart (vCard) in hun adresboek.
                    </p>
                  </div>
                  <Switch
                    aria-label="Contact opslaan-knop tonen"
                    checked={prefs.showVcardButton}
                    onCheckedChange={(v) => setPref("showVcardButton", v)}
                  />
                </div>
              </section>

            </>
          )}

          {tab === "analytics" && (
            <section className="space-y-4 rounded-2xl border border-border bg-card p-4 sm:p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-lg font-medium">Analytics</h2>
                <Select value={range} onValueChange={(v) => setRange(v as typeof range)}>
                  <SelectTrigger className="h-9 w-40 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {RANGE_OPTIONS.map((r) => (
                      <SelectItem key={r.id} value={r.id}>
                        {r.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <p className="text-xs text-muted-foreground">
                Privacy-first metrics: no cookies, no user profiles, purely aggregated counts.
              </p>
              {!stats ? (
                <div className="flex h-24 items-center justify-center">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <div className="grid gap-2 sm:grid-cols-3">
                  {[
                    { label: "Dynamic QR Codes", value: stats.qrs },
                    { label: "Total Scans", value: stats.scans },
                    { label: "Active Components", value: blocks.filter((b) => !b.hidden).length },
                  ].map((s) => (
                    <div key={s.label} className="rounded-xl border border-border p-3">
                      <p className="text-2xl font-medium">{s.value}</p>
                      <p className="text-[11px] text-muted-foreground">{s.label}</p>
                    </div>
                  ))}
                </div>
              )}

              <div className="rounded-xl border border-border p-3">
                <p className="mb-2 text-xs font-medium text-muted-foreground">Traffic trend</p>
                {series === null ? (
                  <div className="flex h-40 items-center justify-center">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  </div>
                ) : series.length === 0 ? (
                  <div className="flex h-40 items-center justify-center text-center text-xs text-muted-foreground">
                    No scan or view data recorded yet for this timeframe.
                  </div>
                ) : (
                  <div className="h-40">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={series}>
                        <defs>
                          <linearGradient id="scanFill" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="currentColor" stopOpacity={0.3} />
                            <stop offset="100%" stopColor="currentColor" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                        <XAxis dataKey="date" fontSize={10} tickLine={false} axisLine={false} />
                        <YAxis
                          fontSize={10}
                          tickLine={false}
                          axisLine={false}
                          allowDecimals={false}
                        />
                        <Tooltip />
                        <Area
                          type="monotone"
                          dataKey="scans"
                          stroke="currentColor"
                          fill="url(#scanFill)"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>

              <div className="rounded-xl border border-border p-3">
                <p className="mb-2 text-xs font-medium text-muted-foreground">
                  Top Clicked Components
                </p>
                {topClicked.length === 0 ? (
                  <p className="py-4 text-center text-xs text-muted-foreground">
                    No click data yet.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {topClicked.map(({ block, clicks }) => (
                      <li key={block.id} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="truncate font-medium">{block.label}</span>
                          <span className="shrink-0 text-muted-foreground">{clicks} clicks</span>
                        </div>
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-foreground"
                            style={{ width: `${Math.max(4, (clicks / maxClicks) * 100)}%` }}
                          />
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </section>
          )}

          {tab === "settings" && (
            <>
              <section className="space-y-5 rounded-2xl border border-border bg-card p-4 sm:p-5">
                <h2 className="text-lg font-medium">Data & domein</h2>
                <DataExportCard />
                <div className="h-px bg-border" />
                <CustomDomainPanel />
                <div className="h-px bg-border" />
                <VerifiedBadgeCard handle={handle || null} />
              </section>

              <SocialSharingCard
                handle={handle || null}
                displayName={displayName}
                prefs={prefs}
                setPref={setPref}
              />

              <section className="rounded-2xl border border-border bg-card p-4 sm:p-5">
                <h2 className="text-lg font-medium">Handle & Identifier</h2>
                <p id="handle-help" className="mt-1 text-xs text-muted-foreground">
                  {handleRuleHint(handleCtx)}
                </p>
                <div className="mt-3 flex min-w-0 items-center gap-2">
                  <span className="shrink-0 font-mono text-sm text-muted-foreground">
                    {host}
                    {styledProfilePath("", urlStyle)}
                  </span>
                  <Input
                    value={handle}
                    maxLength={30}
                    placeholder="yourname"
                    minLength={HANDLE_MIN_LENGTH}
                    autoComplete="off"
                    autoCapitalize="none"
                    spellCheck={false}
                    inputMode="text"
                    aria-invalid={normalized ? !handleOk : undefined}
                    aria-describedby="handle-help"
                    onChange={(e) =>
                      // Geen @, spaties, cijferruis of symbolen: strak en leesbaar.
                      setHandle(e.target.value.toLowerCase().replace(/[^a-z0-9._-]/g, ""))
                    }
                    className="input-field h-11 min-w-0 flex-1 rounded-xl focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background aria-[invalid=true]:border-destructive"
                  />
                </div>
                {normalized && (
                  <p className="mt-2 break-all text-xs">
                    {!handleOk ? (
                      <span className="text-muted-foreground" role="status">
                        {handleProblem ?? handleIssue(normalized, handleCtx)}
                      </span>
                    ) : availability === "checking" ? (
                      <span className="text-muted-foreground">Checking availability…</span>
                    ) : availability === "taken" ? (
                      <span className="inline-flex items-center gap-1 font-mono text-destructive">
                        <X className="h-3.5 w-3.5" /> @{normalized} is already registered
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 font-mono text-emerald-600 dark:text-emerald-400">
                        <Check className="h-3.5 w-3.5" /> @{normalized} is available
                      </span>
                    )}
                  </p>
                )}
              </section>

              <section className="space-y-4 rounded-2xl border border-border bg-card p-4 sm:p-5">
                <div>
                  <h2 className="text-lg font-medium">Identiteit, URL &amp; badge</h2>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {verified
                      ? "Eén account, twee publieke ruimtes: je geverifieerde profiel en je privé alias-hub."
                      : "Je alias-hub is actief. Directe rout.be/ links komen vrij met Pro."}
                  </p>
                </div>

                <div className="space-y-2">
                  <p className="input-label">Actieve identiteit</p>
                  <div className="flex flex-wrap gap-2">
                    {(
                      [
                        {
                          id: "legal" as const,
                          space: "verified" as const,
                          label: "Echte naam · Directe URL",
                          note: "bv. rout.be/creatief",
                          pro: true,
                        },
                        {
                          id: "private" as const,
                          space: "alias" as const,
                          label: "Privé alias",
                          note: "bv. rout.be/u/creatief",
                          pro: false,
                        },
                      ]
                    ).map((m) => {
                      const locked = m.pro && !verified;
                      const active = identitySpace === m.space;
                      return (
                        <button
                          key={m.id}
                          type="button"
                          disabled={locked}
                          aria-disabled={locked}
                          onClick={() => {
                            if (locked) return;
                            setPref("identityMode", m.id);
                            selectIdentitySpace(m.space);
                            void saveUrlStylePref((m.space === "alias" ? "u" : "clean") as UrlStyle);
                          }}
                          className={cn(
                            "min-w-[9rem] flex-1 rounded-xl border px-3 py-2 text-left text-xs transition-colors",
                            locked
                              ? "cursor-not-allowed border-border opacity-60"
                              : active
                                ? "border-primary/50 bg-primary/10"
                                : "border-border",
                          )}
                        >
                          <span className="flex items-center gap-1.5 font-medium">
                            {locked && <Lock className="h-3.5 w-3.5" aria-hidden />}
                            {m.label}
                            {locked && (
                              <span className="ml-auto rounded bg-foreground px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase text-background">
                                Pro
                              </span>
                            )}
                          </span>
                          <span className="mt-0.5 block text-muted-foreground">{m.note}</span>
                        </button>
                      );
                    })}
                  </div>
                  {!verified && (
                    <p className="text-[11px] text-muted-foreground">
                      Directe rout.be/ links en het blauwe vinkje zijn exclusief voor Pro-accounts.
                    </p>
                  )}
                  <p className="text-[11px] text-muted-foreground">
                    Geverifieerde handles krijgen nooit automatische cijfers. In privé-modus hoeft je
                    alias niets met je wettelijke naam te maken te hebben.
                  </p>
                </div>

                <div className="space-y-2">
                  <p className="input-label">Je profiel-URL</p>
                  <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-background/60 px-3 py-2.5">
                    <span className="truncate font-mono text-sm text-foreground">
                      {host}
                      {styledProfilePath(normalized || "handle", urlStyle)}
                    </span>
                    <span className="shrink-0 text-[10px] uppercase tracking-wide text-muted-foreground">
                      {identitySpace === "verified" ? "Geverifieerd" : "Privé alias"}
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Je URL volgt automatisch je actieve identiteit — geen cijfers, geen symbolen.
                  </p>
                </div>



                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">Badge tonen</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Verberg je badge als je liever geen status op je profiel toont.
                    </p>
                  </div>
                  <Switch
                    aria-label="Badge tonen"
                    disabled={!verified}
                    checked={prefs.badgeVisible}
                    onCheckedChange={(v) => setPref("badgeVisible", v)}
                  />
                </div>

                <div className="space-y-2">
                  <p className="input-label">Badgetype</p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {BADGE_TYPES.map((b) => (
                      <button
                        key={b.id}
                        type="button"
                        disabled={!verified || !prefs.badgeVisible}
                        onClick={() => setPref("badgeType", b.id)}
                        className={cn(
                          "rounded-xl border px-3 py-2 text-left text-xs transition-colors disabled:opacity-50",
                          prefs.badgeType === b.id
                            ? "border-primary/50 bg-primary/10"
                            : "border-border",
                        )}
                      >
                        <span className="block font-medium">{b.label}</span>
                        <span className="block text-muted-foreground">{b.note}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {prefs.badgeType === "verified" && (
                  <div className="space-y-2">
                    <p className="input-label">Naamweergave in de badge</p>
                    <div className="flex flex-wrap gap-2">
                      {BADGE_NAME_FORMATS.map((f) => (
                        <button
                          key={f.id}
                          type="button"
                          disabled={!verified || !prefs.badgeVisible}
                          onClick={() => setPref("badgeNameFormat", f.id)}
                          className={cn(
                            "h-10 shrink-0 rounded-full border px-3 text-xs font-medium transition-colors disabled:opacity-50",
                            prefs.badgeNameFormat === f.id
                              ? "border-primary/50 bg-primary/10"
                              : "border-border",
                          )}
                        >
                          {f.label}
                        </button>
                      ))}
                    </div>
                    {legalName && (
                      <p className="text-[11px] text-muted-foreground">
                        Voorbeeld: {formatBadgeName(legalName, prefs.badgeNameFormat)}
                      </p>
                    )}
                  </div>
                )}
              </section>
              {/* Steunpagina staat er voor iedereen — free én Pro. */}
              <DonationPanel
                handle={claimed || normalized || null}
                urlStyle={urlStyle}
                verified={verified}
              />
              {!verified && <VerificationPanel />}

            </>
          )}

          {tab === "identity" && verified && (
            <>
              <SubdomainPanel />
              <EmailForwardingPanel />
              <EmailAliasDomains />
              <BlueskyWizard />
            </>
          )}

        </div>

        {/* Live preview — desktop: pinned next to the editor */}
        <aside className="hidden lg:sticky lg:top-20 lg:block lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto">
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Live view
            </p>
            {/* Viewport-switcher: telefoonmockup ↔ desktopvenster */}
            <div
              role="group"
              aria-label="Preview-formaat"
              className="inline-flex items-center rounded-full border border-border bg-muted/40 p-0.5"
            >
              {(
                [
                  { id: "mobile", label: "Mobiel", Icon: Smartphone },
                  { id: "desktop", label: "Desktop", Icon: Monitor },
                ] as const
              ).map(({ id, label, Icon }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setPreviewDevice(id)}
                  aria-pressed={previewDevice === id}
                  title={label}
                  className={cn(
                    "inline-flex h-7 items-center gap-1.5 rounded-full px-2.5 text-[11px] font-medium transition-all",
                    previewDevice === id
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <Icon className="h-3.5 w-3.5" aria-hidden />
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="transition-all duration-300 ease-out">
          {previewDevice === "mobile" ? (
            /* Smartphone: 9:19.5, ronde hoeken, dunne bezel en camera-eiland */
            <div className="mx-auto w-full max-w-[290px] rounded-[2.6rem] border border-border/70 bg-foreground/90 p-[10px] shadow-[0_24px_60px_-20px_rgba(0,0,0,0.55)] transition-all duration-300">
              <div className="relative overflow-hidden rounded-[2rem] bg-background">
                <span className="absolute left-1/2 top-2 z-10 flex h-3 w-20 -translate-x-1/2 items-center justify-center gap-1 rounded-full bg-foreground/80">
                  <span className="h-1 w-8 rounded-full bg-background/25" />
                  <span className="h-1.5 w-1.5 rounded-full bg-background/35" />
                </span>
                <div className="scrollbar-slim aspect-[9/19.5] overflow-y-auto text-foreground">
                  <ProfileView profile={previewDraft} free={!verified} />
                </div>
              </div>
            </div>
          ) : (
            /* Laptop: matte bezel met webcamstip, hinge en onderdek met trackpad-lip */
            <div className="mx-auto w-full max-w-[520px] transition-all duration-300">
              <div className="rounded-t-2xl bg-foreground/90 p-[10px] pt-[18px] shadow-[0_20px_50px_-24px_rgba(0,0,0,0.5)]">
                <span className="mx-auto mb-[8px] block h-1 w-1 rounded-full bg-background/40" />
                <div className="scrollbar-slim aspect-[16/10] overflow-y-auto rounded-[4px] bg-background text-foreground">
                  {/* 1:1 desktopproporties: render op 1280px en zoom mee met de kaart */}
                  <div className="w-[1280px]" style={{ zoom: 0.26 }}>
                    <ProfileView profile={previewDraft} free={!verified} layout="wide" />
                  </div>

                </div>
              </div>
              {/* Hinge */}
              <div className="mx-auto h-1.5 w-[102%] -translate-x-[1%] rounded-sm bg-foreground/70" />
              {/* Onderdek + trackpad-lip */}
              <div className="mx-auto h-2.5 w-[112%] -translate-x-[5.4%] rounded-b-xl bg-foreground/80" />
              <div className="mx-auto h-1.5 w-16 rounded-b-full bg-foreground/60" />
            </div>
          )}
          </div>
          <p className="mt-2 text-center text-[11px] text-muted-foreground">
            Wijzigingen zijn direct zichtbaar — opslaan maakt ze live.
          </p>

        </aside>

      </div>

      {/* Low, compact mobile bar: subtle autosave status + primary live-preview action.
          Desktop already shows the pinned preview aside, so this bar is mobile-only. */}
      {showSaveBar && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/70 px-3 py-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] backdrop-blur-lg lg:hidden">
          <div className="mx-auto flex max-w-3xl items-center gap-2">
            <p
              aria-live="polite"
              className="flex min-w-0 flex-1 items-center gap-1.5 truncate text-[11px] text-muted-foreground"
            >
              {saving ? (
                <>
                  <Loader2 className="h-3 w-3 shrink-0 animate-spin" aria-hidden /> Opslaan…
                </>
              ) : dirty ? (
                <>
                  <Loader2 className="h-3 w-3 shrink-0 animate-spin" aria-hidden /> Wijzigingen
                  opslaan…
                </>
              ) : (
                <>
                  <Check className="h-3 w-3 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
                  Automatisch opgeslagen
                </>
              )}
            </p>
            <button
              type="button"
              onClick={() => setPreviewOpen(true)}
              className="flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-xl bg-foreground px-4 text-xs font-medium text-background"
            >
              <Eye className="h-3.5 w-3.5" aria-hidden /> Bekijk live preview
            </button>
          </div>
        </div>
      )}

      {/* Mobile live preview — drawer with a phone-mockup frame */}
      <Drawer open={previewOpen} onOpenChange={setPreviewOpen}>
        <DrawerContent className="flex max-h-[92vh] flex-col">
          <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
            <DrawerTitle className="text-sm font-medium">Live view</DrawerTitle>
            <button
              type="button"
              aria-label="Close"
              onClick={() => setPreviewOpen(false)}
              className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="flex min-h-0 flex-1 items-start justify-center overflow-y-auto bg-muted/30 p-4">
            <div className="mx-auto w-full max-w-[320px] rounded-[2.6rem] border border-border/70 bg-foreground/90 p-[10px] shadow-[0_24px_60px_-20px_rgba(0,0,0,0.55)]">
              <div className="relative overflow-hidden rounded-[2rem] bg-background">
                <span className="absolute left-1/2 top-2 z-10 h-1.5 w-16 -translate-x-1/2 rounded-full bg-foreground/25" />
                <div className="scrollbar-slim aspect-[9/19.5] overflow-y-auto text-foreground">
                  <ProfileView profile={previewDraft} free={!verified} />
                </div>
              </div>
            </div>

          </div>
        </DrawerContent>
      </Drawer>

      <Drawer open={drawer} onOpenChange={setDrawer}>
        <DrawerContent
          className="flex max-h-[88vh] flex-col"
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.preventDefault();
              setDrawer(false);
            }
          }}
        >
          {/* Fixed header: title, search bar and categories stay visible */}
          <div className="shrink-0 border-b border-border bg-background">
            <div className="flex items-center justify-between px-4 pb-2">
              <DrawerTitle className="font-display text-lg">+ Add component</DrawerTitle>
              <button
                type="button"
                aria-label="Close"
                onClick={() => setDrawer(false)}
                className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="px-4 pb-3">
              <div className="relative">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden
                />
                <Input
                  autoFocus
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key !== "Enter") return;
                    e.preventDefault();
                    const first = groups[0]?.items[0];
                    if (first) addBlock(first.kind);
                  }}
                  placeholder="Search a platform…"
                  className="input-field h-11 rounded-xl pl-9 pr-9"
                  aria-label="Search a component"
                />
                {(query || cat !== "all") && (
                  <button
                    type="button"
                    aria-label="Clear filters"
                    onClick={() => {
                      setQuery("");
                      setCat("all");
                    }}
                    className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
            <div className="overflow-x-auto px-4 pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <div className="flex w-max min-w-full items-center gap-2">
                {[{ id: "all", label: "All" }, ...BLOCK_CATEGORIES].map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setCat(c.id)}
                    className={cn(
                      "inline-flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3 text-xs font-medium transition-colors",
                      cat === c.id
                        ? "border-primary/40 bg-primary/10 text-foreground"
                        : "border-border text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {c.id === "featured" && <Star className="h-3.5 w-3.5" aria-hidden />}
                    {c.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="scrollbar-slim flex max-h-[60vh] min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 pb-8 pt-3">
            {groups.length === 0 ? (
              <p className="py-6 text-center text-xs text-muted-foreground">No results.</p>
            ) : (
              groups.map((g) => (
                <div key={g.id} className="space-y-2">
                  <div className="flex items-center gap-2 px-0.5">
                    {g.id === "featured" ? (
                      <Star className="h-3.5 w-3.5 text-primary" aria-hidden />
                    ) : (
                      <Folder className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
                    )}
                    <span
                      className={cn(
                        "text-[11px] font-medium uppercase tracking-wide",
                        g.id === "featured" ? "text-foreground" : "text-muted-foreground",
                      )}
                    >
                      {g.label}
                    </span>
                    <span className="text-[11px] text-muted-foreground">({g.items.length})</span>
                    {g.id === "featured" && (
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium">
                        Recommended
                      </span>
                    )}
                  </div>
                  {/* Compacte kaartengrid in plaats van volle-breedte rijen */}
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {g.items.map((k) => (
                      <button
                        key={k.kind}
                        type="button"
                        onClick={() => addBlock(k.kind)}
                        title={k.label}
                        className={cn(
                          "group flex min-w-0 flex-col items-center gap-2 rounded-2xl border p-3 text-center transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md",
                          g.id === "featured"
                            ? "border-primary/40 bg-primary/5 hover:border-primary/70"
                            : "border-border bg-card hover:border-foreground/25",
                        )}
                      >
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-border bg-muted/40 transition-transform duration-200 group-hover:scale-105">
                          <SocialPlatformIcon source={k.kind} className="h-[18px] w-[18px]" />
                        </span>
                        <span className="w-full truncate text-xs font-medium">{k.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ))

            )}
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
}
