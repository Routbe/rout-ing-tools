import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useNavigate } from "@/lib/router-compat";
import {
  BadgeCheck,
  Ban,
  Check,
  Crown,
  Download,
  Eraser,
  Loader2,
  Mail,
  PauseCircle,
  PlayCircle,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldCheck,
  ShieldOff,
  Trash2,
  Activity,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import { logQuietly, notifyError } from "@/lib/notify";
import { AppLayout } from "@/components/layout/AppLayout";
import { AdminVipPanel } from "@/components/admin/AdminVipPanel";
import { EmailFlowTester } from "@/components/admin/EmailFlowTester";
import { DeliveryMonitorPanel } from "@/components/admin/DeliveryMonitorPanel";
import { MemberStatusPanel } from "@/components/admin/MemberStatusPanel";
import { PromoInvitePanel } from "@/components/admin/PromoInvitePanel";
import { PricingPanel } from "@/components/admin/PricingPanel";
import { useTranslation } from "react-i18next";


import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from "@/hooks/useAuth";
import { euro } from "@/lib/profile";
import { toCsv, downloadCsv } from "@/lib/csv";
import { inboundFailureReason } from "@/lib/payments";
import { SHORT_HANDLE_MESSAGE, needsVipGrant } from "@/lib/handle-rules";
import {
  BUILTIN_AUDIT_VIEWS,
  EMPTY_AUDIT_FILTERS,
  deleteAuditView,
  isBuiltinView,
  listAuditViews,
  saveAuditView,
  viewMatches,
  type AuditFilters,
  type SavedAuditView,
} from "@/lib/audit-views";
import { describeAdminError } from "@/lib/admin-errors";
import {
  EXPORT_JOB_TIMEOUT_MS,
  EXPORT_MAX_ROWS,
  expiresAt,
  isExpired,
  retentionLabel,
} from "@/lib/export-retention";
import {
  amIAdmin,
  approveVerification,
  assignHandle,
  banUser,
  bulkGrantVipToUsers,
  bulkModerateUsers,
  bulkRetryAlias,
  cleanseProfileContent,
  controlUserAlias,
  exportInboundChunk,
  getDeploymentChecklist,
  getSystemHealth,
  listAliases,
  listAuditLogCursor,
  listAuditLogPage,
  listIncompletePayments,
  listInboundPayments,
  listPendingVerifications,
  listTransactions,
  listUsers,
  logExportEvent,
  markPaymentManually,
  matchPaymentReference,
  reprocessInboundPayment,
  resolveIncompletePayment,
  runAliasSync,
  setVerificationStatus,
  suggestHandlesForBankName,
  suspendProfile,
} from "@/lib/admin.functions";
import { parseRoutReference } from "@/lib/reference-parser";
import { AdminOverviewPanel } from "@/components/admin/AdminOverviewPanel";

import type { UserSegment } from "@/lib/admin-segments";

type Pending = Awaited<ReturnType<typeof listPendingVerifications>>[number];
type UserRow = Awaited<ReturnType<typeof listUsers>>["rows"][number];
type AuditRow = Awaited<ReturnType<typeof listAuditLogPage>>["rows"][number];
type Checklist = Awaited<ReturnType<typeof getDeploymentChecklist>>;

/** Consistent, actionable failure toast for every admin action. */
function adminToastError(error: unknown, fallback: string) {
  const info = describeAdminError(error, fallback);
  // De-duplicated: repeated background failures must not stack toasts.
  notifyError(info.title, { description: info.description, key: `admin:${info.title}` });
  return info;
}

type TxRow = Awaited<ReturnType<typeof listTransactions>>["rows"][number];
type InboundRow = Awaited<ReturnType<typeof listInboundPayments>>["rows"][number];
type AliasRow = Awaited<ReturnType<typeof listAliases>>["page"]["rows"][number];
type AliasHealth = Awaited<ReturnType<typeof listAliases>>["health"];
type BulkAction = "suspend" | "unsuspend" | "ban" | "cleanse";

/** Moderation reasons are mandatory and must be meaningful, not a single dot. */
const MIN_REASON = 5;
const reasonValid = (value: string) => value.trim().length >= MIN_REASON;

/** A pending confirmation for any destructive or irreversible admin action. */
type Confirmation = {
  title: string;
  description: string;
  actionLabel: string;
  destructive?: boolean;
  withReason?: boolean;
  run: (reason?: string) => Promise<void> | void;
};

const SYNC_LABEL: Record<string, string> = {
  synced: "Synced 🟢",
  pending: "Pending Sync 🟡",
  failed: "Sync Failed 🔴",
};

/** "07 Aug 2026" — unambiguous in every locale. */
function shortDate(value: string) {
  return new Date(value).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function shortDateTime(value: string) {
  const d = new Date(value);
  return `${shortDate(value)} ${d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
}

const TIER_BADGE: Record<string, string> = {
  early_believer: "Early Believer",
};

/**
 * Alias sync indicator. A profile that has never been touched by ImprovMX can
 * never read "Synced": without a timestamp the state is "Not synced yet".
 */
function SyncBadge({
  status,
  at,
  attempts,
  error,
}: {
  status: string;
  at: string | null;
  attempts?: number;
  error?: string | null;
}) {
  const effective = status === "synced" && !at ? "pending" : status;
  const label = at ? shortDateTime(at) : "never synced";
  return (
    <span className="inline-flex flex-col" data-testid="sync-badge" data-status={effective}>
      <span className="text-[11px]">
        {at ? (SYNC_LABEL[effective] ?? SYNC_LABEL["pending"]) : "Not synced yet ⚪"}
      </span>
      <span className="text-[10px] text-muted-foreground">
        {label}
        {effective === "failed" && attempts ? ` · ${attempts} attempts` : ""}
      </span>
      {effective === "failed" && error ? (
        <span className="max-w-[16rem] truncate text-[10px] text-destructive">{error}</span>
      ) : null}
    </span>
  );
}

const PER_PAGE_OPTIONS = [10, 20, 50, 100];

// Darker text tones so every tag clears WCAG AA on its tinted background.
const STATUS_STYLE: Record<string, string> = {
  paid: "bg-emerald-500/15 text-emerald-800 dark:text-emerald-300",
  active: "bg-emerald-500/15 text-emerald-800 dark:text-emerald-300",
  pending: "bg-amber-500/15 text-amber-900 dark:text-amber-200",
  failed: "bg-destructive/15 text-destructive",
  suspended: "bg-amber-500/15 text-amber-900 dark:text-amber-200",
  banned: "bg-destructive/15 text-destructive",
  matched: "bg-emerald-500/15 text-emerald-800 dark:text-emerald-300",
  unmatched: "bg-amber-500/15 text-amber-900 dark:text-amber-200",
};

function StatusBadge({ status }: { status: string }) {
  const { t } = useTranslation();
  // Known statuses get a localised label; unknown ones fall through untouched.
  const label = t(`admin.status.${status}`, { defaultValue: status });
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
        STATUS_STYLE[status] ?? "bg-muted text-foreground/80"
      }`}
    >
      {label}
    </span>
  );
}


/** Shared "Showing 1-20 of 150" pager used by every paginated tab. */
function Pager({
  page,
  perPage,
  total,
  loading,
  onPage,
  onPerPage,
  idPrefix,
}: {
  page: number;
  perPage: number;
  total: number;
  loading?: boolean;
  onPage: (p: number) => void;
  onPerPage: (n: number) => void;
  idPrefix: string;
}) {
  const pages = Math.max(1, Math.ceil(total / perPage));
  const first = total === 0 ? 0 : (page - 1) * perPage + 1;
  const last = Math.min(total, page * perPage);
  const windowed = [...Array(pages).keys()]
    .map((i) => i + 1)
    .filter((p) => p === 1 || p === pages || Math.abs(p - page) <= 1);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 pt-3 text-xs">
      <p data-testid={`${idPrefix}-range`} className="text-muted-foreground">
        {loading ? "Loading…" : `Showing ${first}-${last} of ${total} entries`}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <Label htmlFor={`${idPrefix}-per-page`} className="text-xs text-muted-foreground">
          Per page
        </Label>
        <select
          id={`${idPrefix}-per-page`}
          data-testid={`${idPrefix}-per-page`}
          className="h-8 rounded-md border border-input bg-background px-2 text-xs"
          value={perPage}
          onChange={(e) => onPerPage(Number(e.target.value))}
        >
          {PER_PAGE_OPTIONS.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
        <Button
          size="sm"
          variant="outline"
          className="h-8"
          data-testid={`${idPrefix}-prev`}
          disabled={page <= 1 || loading}
          onClick={() => onPage(page - 1)}
        >
          Previous
        </Button>
        {windowed.map((p, i) => (
          <span key={p} className="flex items-center gap-1">
            {i > 0 && p - (windowed[i - 1] ?? 0) > 1 ? (
              <span className="text-muted-foreground">…</span>
            ) : null}
            <Button
              size="sm"
              variant={p === page ? "default" : "outline"}
              className="h-8 w-8 p-0"
              aria-current={p === page ? "page" : undefined}
              disabled={loading}
              onClick={() => onPage(p)}
            >
              {p}
            </Button>
          </span>
        ))}
        <Button
          size="sm"
          variant="outline"
          className="h-8"
          data-testid={`${idPrefix}-next`}
          disabled={page >= pages || loading}
          onClick={() => onPage(page + 1)}
        >
          Next
        </Button>
      </div>
    </div>
  );
}

export default function Admin() {
  const nav = useNavigate();
  const { user, loading } = useAuth();

  const checkAdmin = useServerFn(amIAdmin);
  const loadUsers = useServerFn(listUsers);
  const suspend = useServerFn(suspendProfile);
  const ban = useServerFn(banUser);
  const setHandle = useServerFn(assignHandle);
  const cleanse = useServerFn(cleanseProfileContent);
  const loadPending = useServerFn(listPendingVerifications);
  const loadIncomplete = useServerFn(listIncompletePayments);
  const approve = useServerFn(approveVerification);
  const resolveIncomplete = useServerFn(resolveIncompletePayment);
  const setStatus = useServerFn(setVerificationStatus);
  const suggestHandles = useServerFn(suggestHandlesForBankName);
  const loadAudit = useServerFn(listAuditLogPage);
  const loadAuditCursor = useServerFn(listAuditLogCursor);
  const loadChecklist = useServerFn(getDeploymentChecklist);
  const logExport = useServerFn(logExportEvent);

  const loadTx = useServerFn(listTransactions);
  const loadAliases = useServerFn(listAliases);
  const aliasControl = useServerFn(controlUserAlias);
  const bulkModerate = useServerFn(bulkModerateUsers);
  const markPaid = useServerFn(markPaymentManually);
  const syncAliases = useServerFn(runAliasSync);
  const loadInbound = useServerFn(listInboundPayments);
  const exportInboundChunkFn = useServerFn(exportInboundChunk);
  const loadHealth = useServerFn(getSystemHealth);
  const bulkVip = useServerFn(bulkGrantVipToUsers);
  const bulkRetryAliasFn = useServerFn(bulkRetryAlias);
  const matchReference = useServerFn(matchPaymentReference);

  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  // — Users & moderation ------------------------------------------------
  const [query, setQuery] = useState("");
  const [users, setUsers] = useState<UserRow[]>([]);
  const [userTotal, setUserTotal] = useState(0);
  const [userPage, setUserPage] = useState(1);
  const [userPerPage, setUserPerPage] = useState(20);
  const [usersLoading, setUsersLoading] = useState(false);
  const [handleDraft, setHandleDraft] = useState<Record<string, string>>({});
  const [vipDraft, setVipDraft] = useState<Record<string, boolean>>({});
  const [moderating, setModerating] = useState<{
    row: UserRow;
    kind: "suspend" | "ban";
  } | null>(null);
  const [moderationReason, setModerationReason] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [segment, setSegment] = useState<UserSegment>("all");
  const [bulk, setBulk] = useState<BulkAction | null>(null);
  const [bulkReason, setBulkReason] = useState("");
  const [banAck, setBanAck] = useState(false);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [confirmReason, setConfirmReason] = useState("");

  // — Verifications -----------------------------------------------------
  const [pending, setPending] = useState<Pending[]>([]);
  const [incomplete, setIncomplete] = useState<Pending[]>([]);
  const [incompleteBusy, setIncompleteBusy] = useState<string | null>(null);
  const [incompleteReason, setIncompleteReason] = useState("");
  const [rejecting, setRejecting] = useState<Pending | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [bankName, setBankName] = useState("");
  const [bankSuggestions, setBankSuggestions] = useState<string[]>([]);
  const [bankMessage, setBankMessage] = useState("");
  const [referenceMatch, setReferenceMatch] = useState<Awaited<ReturnType<typeof matchPaymentReference>> | null>(null);
  const [referenceMatching, setReferenceMatching] = useState(false);

  // — Transactions & audit ---------------------------------------------
  const [tx, setTx] = useState<TxRow[]>([]);
  const [txTotal, setTxTotal] = useState(0);
  const [txPage, setTxPage] = useState(1);
  const [txPerPage, setTxPerPage] = useState(20);
  const [txLoading, setTxLoading] = useState(false);

  const [inbound, setInbound] = useState<InboundRow[]>([]);
  const [inboundTotal, setInboundTotal] = useState(0);
  const [inboundPage, setInboundPage] = useState(1);
  const [inboundPerPage, setInboundPerPage] = useState(20);
  const [inboundLoading, setInboundLoading] = useState(false);
  const [inboundDetail, setInboundDetail] = useState<InboundRow | null>(null);
  const [reprocessing, setReprocessing] = useState<string | null>(null);
  const [exportingInbound, setExportingInbound] = useState(false);
  const [exportJob, setExportJob] = useState<{
    status: "running" | "done" | "failed";
    scanned: number;
    total: number;
    rows: number;
    filename?: string;
    csv?: string;
    error?: string;
    /** Retention deadline — the file is dropped from memory afterwards. */
    expiresAt?: number;
  } | null>(null);

  const [audit, setAudit] = useState<AuditRow[]>([]);
  /** Keyset pagination: a stack of cursors, one per page already visited. */
  const [auditCursors, setAuditCursors] = useState<(string | null)[]>([null]);
  const [auditNextCursor, setAuditNextCursor] = useState<string | null>(null);
  const [auditPerPage, setAuditPerPage] = useState(20);
  const [auditActions, setAuditActions] = useState<string[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditExporting, setAuditExporting] = useState(false);
  const [filters, setFilters] = useState<AuditFilters>(EMPTY_AUDIT_FILTERS);
  const [auditViews, setAuditViews] = useState<SavedAuditView[]>(BUILTIN_AUDIT_VIEWS);
  const [viewName, setViewName] = useState("");
  const auditSearchTimer = useRef<number | undefined>(undefined);

  // — Deployment checklist ----------------------------------------------
  const [checklist, setChecklist] = useState<Checklist | null>(null);
  const [checklistLoading, setChecklistLoading] = useState(false);
  const [checklistError, setChecklistError] = useState<string | null>(null);


  // — Network -----------------------------------------------------------
  const [aliases, setAliases] = useState<AliasRow[]>([]);
  const [aliasTotal, setAliasTotal] = useState(0);
  const [aliasPage, setAliasPage] = useState(1);
  const [aliasPerPage, setAliasPerPage] = useState(20);
  const [aliasHealth, setAliasHealth] = useState<AliasHealth | null>(null);
  const [aliasLoading, setAliasLoading] = useState(false);
  const [aliasQueue, setAliasQueue] = useState<{
    pending: number;
    failed: number;
    done: number;
  } | null>(null);

  const searchTimer = useRef<number | undefined>(undefined);
  const [health, setHealth] = useState<Awaited<ReturnType<typeof getSystemHealth>> | null>(null);
  const [activeTab, setActiveTab] = useState("users");
  const { t } = useTranslation();
  const [viewAsUser, setViewAsUser] = useState<UserRow | null>(null);

  const refreshUsers = useCallback(
    async (page = userPage, perPage = userPerPage, q = query, seg = segment) => {
      setUsersLoading(true);
      try {
        const res = await loadUsers({
          data: { query: q || undefined, page, perPage, segment: seg === "all" ? undefined : seg },
        });
        setUsers(res.rows);
        setUserTotal(res.total);
        setHandleDraft(Object.fromEntries(res.rows.map((r) => [r.userId, r.username ?? ""])));
        setVipDraft(Object.fromEntries(res.rows.map((r) => [r.userId, r.handleGrant === "vip"])));
      } catch (error) {
        adminToastError(error, "Could not load users.");
      } finally {
        setUsersLoading(false);
      }
    },
    [loadUsers, query, userPage, userPerPage, segment],
  );

  /** Segment chips reload page 1 with the new filter — server-side, not client-side. */
  const onSegmentChange = (next: UserSegment) => {
    setSegment(next);
    setUserPage(1);
    void refreshUsers(1, userPerPage, query, next);
  };
  /** Configuration self-check — never throws, always renders a status. */
  const loadChecklistNow = useCallback(async () => {
    setChecklistLoading(true);
    setChecklistError(null);
    try {
      setChecklist(await loadChecklist());
    } catch (error) {
      const info = describeAdminError(error, "Could not read the deployment status.");
      setChecklistError(`${info.title} — ${info.description}`);
    } finally {
      setChecklistLoading(false);
    }
  }, [loadChecklist]);

  useEffect(() => {
    void loadChecklistNow();
  }, [loadChecklistNow]);


  /**
   * Cursor (keyset) paginated audit log. `cursor = null` means "first page";
   * every following page is anchored on the last row of the previous one, so
   * the query cost stays flat no matter how large the trail grows.
   */
  const refreshAudit = useCallback(
    async (cursor: string | null = null, perPage = auditPerPage, f = filters) => {
      setAuditLoading(true);
      try {
        const res = await loadAuditCursor({
          data: {
            cursor,
            perPage,
            adminEmail: f.adminEmail || undefined,
            action: f.action || undefined,
            from: f.from || undefined,
            to: f.to || undefined,
            search: f.search || undefined,
          },
        });
        setAudit(res.rows);
        setAuditNextCursor(res.nextCursor);
        setAuditActions(res.actions);
        if (cursor === null) setAuditCursors([null]);
      } catch (error) {
        const info = describeAdminError(error, "Could not load the audit log.");
        // Configuration problems must be visible; a transient read is not fatal.
        if (info.kind === "config") {
          notifyError(info.title, { description: info.description, key: `admin:${info.title}` });
        }
      } finally {
        setAuditLoading(false);
      }
    },
    [auditPerPage, filters, loadAuditCursor],
  );


  const refreshTx = useCallback(
    async (page = txPage, perPage = txPerPage) => {
      setTxLoading(true);
      try {
        const res = await loadTx({ data: { page, perPage } });
        setTx(res.rows);
        setTxTotal(res.total);
      } catch (error) {
        adminToastError(error, "Could not load transactions.");
      } finally {
        setTxLoading(false);
      }
    },
    [loadTx, txPage, txPerPage],
  );

  const refreshInbound = useCallback(
    async (page = inboundPage, perPage = inboundPerPage) => {
      setInboundLoading(true);
      try {
        const res = await loadInbound({ data: { page, perPage } });
        setInbound(res.rows);
        setInboundTotal(res.total);
      } catch (error) {
        adminToastError(error, "Could not load inbound payments.");
      } finally {
        setInboundLoading(false);
      }
    },
    [inboundPage, inboundPerPage, loadInbound],
  );

  const reprocessInbound = useServerFn(reprocessInboundPayment);

  /** Re-runs the reference matcher for one inbound bank e-mail. */
  const onReprocess = async (row: InboundRow) => {
    setReprocessing(row.eventId);
    try {
      const res = await reprocessInbound({ data: { eventId: row.eventId } });
      if (res.reason === "activated") {
        toast.success(`${res.reference} matched — membership activated.`);
      } else if (res.reason === "already_active") {
        toast.info(`${res.reference} was already active.`);
      } else {
        toast.error(`${res.reference} still has no matching payment.`);
      }
      await refreshInbound(inboundPage, inboundPerPage);
      setInboundDetail(null);
    } catch (error) {
      adminToastError(error, "Could not reprocess this payment.");
    } finally {
      setReprocessing(null);
    }
  };

  /**
   * Asynchronous, server-authorised CSV export. The file is built chunk by
   * chunk in the background — the portal stays usable and a download link
   * appears as soon as the last chunk lands.
   */
  const onExportInbound = async () => {
    setExportingInbound(true);
    setExportJob({ status: "running", scanned: 0, total: 0, rows: 0 });
    const startedAt = Date.now();
    const appliedFilters = { dataset: "inbound", scope: "all" };
    void logExport({ data: { dataset: "inbound_payments", phase: "started", filters: appliedFilters } }).catch(() => {});
    try {
      const collected: Record<string, string>[] = [];
      let columns: string[] = [];
      let page = 1;
      let total = 0;

      // Hard stop keeps a runaway dataset from looping forever.
      for (let guard = 0; guard < 500; guard += 1) {
        // Cost control: abandon a job that outlives its timeout budget.
        if (Date.now() - startedAt > EXPORT_JOB_TIMEOUT_MS) {
          throw new Error("Export timed out — narrow the filters and try again.");
        }
        if (collected.length >= EXPORT_MAX_ROWS) break;

        const chunk = await exportInboundChunkFn({ data: { page, perPage: 100 } });
        columns = chunk.columns;
        total = chunk.total;
        collected.push(...chunk.rows);
        setExportJob({
          status: "running",
          scanned: chunk.scanned,
          total: chunk.total,
          rows: collected.length,
        });
        if (chunk.done) break;
        page += 1;
      }

      const csv = toCsv(collected, columns);
      setExportJob({
        status: "done",
        scanned: total,
        total,
        rows: collected.length,
        csv,
        filename: `rout-inbound-payments-${new Date().toISOString().slice(0, 10)}.csv`,
        expiresAt: expiresAt(),
      });
      void logExport({
        data: { dataset: "inbound_payments", phase: "completed", filters: appliedFilters, rows: collected.length },
      }).catch(() => {});
      toast.success(`Export ready — ${collected.length} row${collected.length === 1 ? "" : "s"}.`, {
        description: `Use the download link to save the file. ${retentionLabel()}`,
      });
    } catch (error) {
      const info = describeAdminError(error, "Export failed.");
      setExportJob({
        status: "failed",
        scanned: 0,
        total: 0,
        rows: 0,
        error: `${info.title} — ${info.description}`,
      });
      void logExport({
        data: { dataset: "inbound_payments", phase: "failed", filters: appliedFilters, note: info.title },
      }).catch(() => {});
      toast.error(info.title, { description: info.description });
    } finally {
      setExportingInbound(false);
    }
  };

  /** Drops a finished export once its retention window closes. */
  useEffect(() => {
    if (exportJob?.status !== "done" || !exportJob.expiresAt) return;
    const remaining = Math.max(0, exportJob.expiresAt - Date.now());
    const timer = window.setTimeout(() => {
      setExportJob((job) =>
        job && job.expiresAt && isExpired(job.expiresAt)
          ? { ...job, csv: undefined, error: "Download link expired — run the export again." }
          : job,
      );
    }, remaining + 250);
    return () => window.clearTimeout(timer);
  }, [exportJob?.status, exportJob?.expiresAt]);


  const refreshAliases = useCallback(
    async (page = aliasPage, perPage = aliasPerPage) => {
      setAliasLoading(true);
      try {
        const res = await loadAliases({ data: { page, perPage } });
        setAliases(res.page.rows);
        setAliasTotal(res.page.total);
        setAliasHealth(res.health);
        setAliasQueue(res.queue);
      } catch (error) {
        logQuietly("admin:aliases", error);
        notifyError("Could not load alias status.", { key: "admin:aliases" });
      } finally {
        setAliasLoading(false);
      }
    },
    [aliasPage, aliasPerPage, loadAliases],
  );

  useEffect(() => {
    if (loading) return;
    if (!user) {
      nav("/auth", { replace: true });
      return;
    }
    (async () => {
      try {
        const res = await checkAdmin({});
        if (!res.isAdmin) {
          setAllowed(false);
          nav("/", { replace: true });
          return;
        }
        setAllowed(true);
        setPending(await loadPending({}));
        setIncomplete(await loadIncomplete({}));
        void refreshUsers(1, 20, "");
        void refreshAudit(null, 20, EMPTY_AUDIT_FILTERS);
        setAuditViews(listAuditViews());
        void refreshTx(1, 20);
        void refreshInbound(1, 20);
        void refreshAliases(1, 20);
        loadHealth({})
          .then(setHealth)
          .catch((error) => logQuietly("admin:health", error));
      } catch {
        setAllowed(false);
        nav("/", { replace: true });
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, loading, nav]);

  /** Debounced server-side search. */
  const onQueryChange = (value: string) => {
    setQuery(value);
    window.clearTimeout(searchTimer.current);
    searchTimer.current = window.setTimeout(() => {
      setUserPage(1);
      void refreshUsers(1, userPerPage, value);
    }, 400);
  };

  const onSuspend = async (row: UserRow, suspended: boolean, reason?: string) => {
    setBusy(row.userId);
    try {
      const res = await suspend({ data: { userId: row.userId, suspended, reason } });
      if (!res.ok) throw new Error(res.reason);
      toast.success(suspended ? "Profile suspended." : "Profile reinstated.");
      void refreshUsers();
      void refreshAudit(null);
    } catch (error) {
      adminToastError(error, "Could not update this profile.");
    } finally {
      setBusy(null);
      setModerating(null);
      setModerationReason("");
    }
  };

  const onBan = async (row: UserRow, banned: boolean, reason?: string) => {
    setBusy(row.userId);
    try {
      const res = await ban({ data: { userId: row.userId, banned, reason } });
      if (!res.ok) throw new Error(res.reason);
      toast.success(banned ? "User banned — sign-in blocked and alias frozen." : "Ban lifted.");
      void refreshUsers();
      void refreshAliases();
      void refreshAudit(null);
    } catch (error) {
      adminToastError(error, "Could not update the ban state.");
    } finally {
      setBusy(null);
      setModerating(null);
      setModerationReason("");
    }
  };

  const onSaveHandle = async (row: UserRow) => {
    const handle = (handleDraft[row.userId] ?? "").trim();
    if (!handle) return toast.error("Enter a handle first.");
    setBusy(row.userId);
    try {
      const res = await setHandle({
        data: { userId: row.userId, handle, vipGrant: vipDraft[row.userId] ?? false },
      });
      if (!res.ok) {
        toast.error(res.reason);
        return;
      }
      toast.success(
        res.vip ? `VIP handle @${res.handle} granted.` : `Handle @${res.handle} updated.`,
      );
      void refreshUsers();
      void refreshAliases();
      void refreshAudit(null);
    } catch (error) {
      adminToastError(error, "Could not change this handle.");
    } finally {
      setBusy(null);
    }
  };

  const onCleanse = async (
    row: UserRow,
    payload: { clearTagline?: boolean; resetAvatar?: boolean; removeBlockIndexes?: number[] },
  ) => {
    setBusy(row.userId);
    try {
      const res = await cleanse({ data: { userId: row.userId, ...payload } });
      if (!res.ok) throw new Error(res.reason);
      toast.success("Content removed.");
      void refreshUsers();
      void refreshAudit(null);
    } catch (error) {
      adminToastError(error, "Could not cleanse this profile.");
    } finally {
      setBusy(null);
    }
  };

  const onApprove = async (row: Pending) => {
    setBusy(row.paymentId);
    try {
      const res = await approve({ data: { paymentId: row.paymentId } });
      if (!res.ok) throw new Error("failed");
      toast.success(
        `Badge granted — "Your ROUT verification is live!" sent to ${row.email ?? "the user"}`,
      );
      setPending((prev) =>
        prev.map((p) => (p.paymentId === row.paymentId ? { ...p, status: "paid" } : p)),
      );
      void refreshTx(1);
      void refreshAudit(null);
    } catch (error) {
      adminToastError(error, "Could not approve this payment.");
    } finally {
      setBusy(null);
    }
  };

  const onSetStatus = async (paymentId: string, status: "pending" | "failed", reason?: string) => {
    setBusy(paymentId);
    try {
      const res = await setStatus({ data: { paymentId, status, reason } });
      if (!res.ok) throw new Error("failed");
      setPending((prev) => prev.map((p) => (p.paymentId === paymentId ? { ...p, status } : p)));
      toast.success(status === "failed" ? "Payment marked as failed." : "Payment reopened.");
      void refreshTx();
      void refreshAudit(null);
    } catch (error) {
      adminToastError(error, "Could not update this payment.");
    } finally {
      setBusy(null);
      setRejecting(null);
      setRejectReason("");
    }
  };

  const onResolveIncomplete = async (
    row: Pending,
    action: "approve" | "fail" | "retry",
    reason?: string,
  ) => {
    setIncompleteBusy(row.paymentId);
    try {
      const res = await resolveIncomplete({ data: { paymentId: row.paymentId, action, reason } });
      if (!res.ok) throw new Error(res.reason);
      const nextStatus = action === "approve" ? "paid" : action === "fail" ? "failed" : "pending";
      setIncomplete((prev) =>
        prev.map((p) => (p.paymentId === row.paymentId ? { ...p, status: nextStatus } : p)),
      );
      toast.success(
        action === "approve"
          ? `Badge granted — verification activated for ${row.email ?? "the user"}.`
          : action === "fail"
            ? "Payment marked as failed."
            : "Payment reset to pending for customer retry.",
      );
      void refreshTx();
      void refreshAudit(null);
    } catch (error) {
      adminToastError(error, "Could not resolve this incomplete payment.");
    } finally {
      setIncompleteBusy(null);
      setIncompleteReason("");
    }
  };

  const onAlias = async (row: AliasRow, action: "pause" | "resume" | "delete") => {
    setBusy(row.userId);
    try {
      await aliasControl({ data: { userId: row.userId, action } });
      toast.success(`Alias ${action}d.`);
      void refreshAliases();
      void refreshAudit(null);
    } catch {
      toast.error("Alias control failed.");
    } finally {
      setBusy(null);
    }
  };

  const onBankMatch = async () => {
    if (bankName.trim().length < 2) return;
    try {
      const res = await suggestHandles({ data: { bankName } });
      setBankSuggestions(res.suggestions);
      if (res.suggestions.length === 0) toast.info("No free handle for that name.");
    } catch {
      toast.error("Could not generate handles.");
    }
  };

  /** Every destructive action routes through one confirmation modal. */
  const askConfirm = (c: Confirmation) => {
    setConfirmReason("");
    setConfirmation(c);
  };

  const allSelected = users.length > 0 && selected.length === users.length;

  const toggleSelected = (userId: string, checked: boolean) =>
    setSelected((prev) =>
      checked ? [...new Set([...prev, userId])] : prev.filter((id) => id !== userId),
    );

  const toggleAllSelected = (checked: boolean) =>
    setSelected(checked ? users.map((u) => u.userId) : []);

  // Without the backend ImprovMX key every alias action is a no-op: the whole
  // sync surface is disabled and replaced by a setup guide.
  const improvmxReady = aliasHealth?.configured === true;

  // Suspending or banning in bulk always needs a written reason.
  const bulkNeedsReason = bulk === "suspend" || bulk === "ban";

  const BULK_COPY: Record<BulkAction, { title: string; description: string; label: string }> = {
    suspend: {
      title: "Suspend selected accounts?",
      description:
        "Their public profiles show a suspension notice and dynamic QR redirects are paused.",
      label: "Suspend accounts",
    },
    unsuspend: {
      title: "Reinstate selected accounts?",
      description: "Their public profiles and dynamic QR redirects go live again.",
      label: "Reinstate accounts",
    },
    ban: {
      title: "Permanently ban selected accounts?",
      description: "Sign-in is blocked, profiles go dark and @rout.be aliases are frozen.",
      label: "Ban accounts",
    },
    cleanse: {
      title: "Wipe content on selected accounts?",
      description: "Bios are cleared and avatars reset. This cannot be undone.",
      label: "Wipe content",
    },
  };

  const onBulkRun = async () => {
    if (!bulk || selected.length === 0) return;
    setBusy("bulk");
    try {
      const res = await bulkModerate({
        data: { userIds: selected, action: bulk, reason: bulkReason || undefined },
      });
      toast.success(
        `${BULK_COPY[bulk].label}: ${res.succeeded} of ${selected.length} accounts updated${
          res.failed > 0 ? ` · ${res.failed} failed` : ""
        }.`,
      );
      setSelected([]);
      void refreshUsers();
      void refreshAliases();
      void refreshAudit(null);
    } catch {
      toast.error("The bulk action could not be completed.");
    } finally {
      setBusy(null);
      setBulk(null);
      setBulkReason("");
    }
  };

  const onBulkVipGrant = async () => {
    if (selected.length === 0) return;
    setBusy("bulk");
    try {
      const res = await bulkVip({ data: { userIds: selected } });
      toast.success(`VIP grant: ${res.succeeded} of ${selected.length} accounts updated${res.failed > 0 ? ` · ${res.failed} failed` : ""}.`);
      setSelected([]);
      void refreshUsers();
      void refreshAudit(null);
    } catch (error) {
      adminToastError(error, "Could not grant VIP to the selected accounts.");
    } finally {
      setBusy(null);
    }
  };

  const onBulkRetryAlias = async () => {
    if (selected.length === 0) return;
    setBusy("bulk");
    try {
      const res = await bulkRetryAliasFn({ data: { userIds: selected } });
      toast.success(`Alias retry: ${res.succeeded} of ${selected.length} accounts synced${res.failed > 0 ? ` · ${res.failed} still failing` : ""}.`);
      setSelected([]);
      void refreshUsers();
      void refreshAliases();
    } catch (error) {
      adminToastError(error, "Could not retry alias sync for the selected accounts.");
    } finally {
      setBusy(null);
    }
  };

  /** Auto-parses a `ROUT-XXXXXX` reference out of a pasted bank message and pre-fills the match. */
  const onBankMessageChange = (value: string) => {
    setBankMessage(value);
    const parsed = parseRoutReference(value);
    if (!parsed) {
      setReferenceMatch(null);
      return;
    }
    setReferenceMatching(true);
    matchReference({ data: { text: value } })
      .then(setReferenceMatch)
      .catch((error) => logQuietly("admin:reference-match", error))
      .finally(() => setReferenceMatching(false));
  };

  /** Manual payment override — marks paid, unlocks Early Believer, queues the alias. */
  const onMarkPaid = async (row: UserRow, paid: boolean) => {
    setBusy(row.userId);
    try {
      const res = await markPaid({ data: { userId: row.userId, paid } });
      if (!res.ok) throw new Error(res.reason);
      const sync = res.sync;
      toast.success(
        paid
          ? `Marked paid (manual_admin) · Early Believer active · alias sync: ${sync.done} synced, ${sync.retrying} retrying, ${sync.failed} failed.`
          : "Early Believer status revoked and alias removal queued.",
      );
      void refreshUsers();
      void refreshAliases();
      void refreshAudit(null);
    } catch {
      toast.error("Could not update the payment status.");
    } finally {
      setBusy(null);
    }
  };

  const onSyncNow = async (retryFailed = false, userId?: string) => {
    setBusy(userId ?? "sync");
    try {
      const res = await syncAliases({ data: { retryFailed, ...(userId ? { userId } : {}) } });
      setAliasQueue(res.queue);
      if (!res.configured) {
        toast.error(res.error ?? "ImprovMX is not configured.");
        return;
      }
      if (res.failed > 0) {
        toast.error(
          `${res.failed} alias job${res.failed === 1 ? "" : "s"} failed — ${res.error ?? "see the sync status for details"}.`,
        );
      } else {
        toast.success(
          `Sync run: ${res.done} synced, ${res.retrying} retrying (${res.processed} jobs).`,
        );
      }
      void refreshAliases();
      void refreshUsers();
    } catch {
      toast.error("The sync engine could not be reached.");
    } finally {
      setBusy(null);
    }
  };

  /** Search and filtering happen server-side, so the page is the view. */
  const visibleAudit = audit;

  /** Applies a saved (or built-in) filter set and reloads page 1. */
  const applyAuditView = (view: SavedAuditView) => {
    setFilters(view.filters);
    void refreshAudit(null, auditPerPage, view.filters);
  };

  /** Exports every audit entry matching the current filters, not just this page. */
  const exportAuditCsv = async () => {
    setAuditExporting(true);
    const auditFilterPayload = {
      adminEmail: filters.adminEmail,
      action: filters.action,
      from: filters.from,
      to: filters.to,
      search: filters.search,
    };
    void logExport({
      data: { dataset: "audit_log", phase: "started", filters: auditFilterPayload },
    }).catch(() => {});
    try {
      const collected: AuditRow[] = [];
      for (let page = 1; page <= 100; page += 1) {
        const res = await loadAudit({
          data: {
            page,
            perPage: 100,
            adminEmail: filters.adminEmail || undefined,
            action: filters.action || undefined,
            from: filters.from || undefined,
            to: filters.to || undefined,
            search: filters.search || undefined,
          },
        });
        collected.push(...res.rows);
        if (collected.length >= res.total || res.rows.length === 0) break;
      }

      if (collected.length === 0) {
        toast.info("Nothing to export.");
        return;
      }

      const csv = toCsv(
        collected.map((e) => ({
          timestamp: new Date(e.createdAt).toISOString(),
          admin: e.adminEmail ?? "",
          action: e.action,
          target_user_id: e.targetUserId ?? "",
          target: e.targetLabel ?? "",
          notes: e.notes ?? "",
        })),
        ["timestamp", "admin", "action", "target_user_id", "target", "notes"],
      );
      downloadCsv(`rout-audit-log-${new Date().toISOString().slice(0, 10)}.csv`, csv);
      void logExport({
        data: {
          dataset: "audit_log",
          phase: "downloaded",
          rows: collected.length,
          filters: auditFilterPayload,
        },
      }).catch(() => {});
      toast.success(`Exported ${collected.length} entries.`);
    } catch (error) {
      const info = adminToastError(error, "Could not export the audit log.");
      void logExport({
        data: { dataset: "audit_log", phase: "failed", filters: auditFilterPayload, note: info.title },
      }).catch(() => {});
    } finally {
      setAuditExporting(false);
    }
  };


  const exportTxCsv = () => {
    if (tx.length === 0) return toast.info("Nothing to export.");
    const csv = toCsv(
      tx.map((t) => ({
        timestamp: new Date(t.createdAt).toISOString(),
        reference: t.reference ?? "",
        handle: t.username ?? "",
        email: t.email ?? "",
        tier: t.tier,
        method: t.method,
        amount_eur: (t.amountCents / 100).toFixed(2),
        donation_eur: (t.donationCents / 100).toFixed(2),
        status: t.status,
      })),
      [
        "timestamp",
        "reference",
        "handle",
        "email",
        "tier",
        "method",
        "amount_eur",
        "donation_eur",
        "status",
      ],
    );
    downloadCsv(`rout-transactions-${new Date().toISOString().slice(0, 10)}.csv`, csv);
    toast.success(`Exported ${tx.length} transactions.`);
  };

  const pendingActionable = useMemo(() => pending.filter((p) => p.status !== "paid"), [pending]);

  if (allowed !== true) {
    return (
      <AppLayout>
        {allowed === false ? (
          <div className="flex min-h-[50vh] items-center justify-center text-sm text-muted-foreground">
            Niet gemachtigd.
          </div>
        ) : (
          /* Skeletonkaarten i.p.v. een kale spinner: de console voelt meteen "aanwezig". */
          <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-8" aria-busy="true">
            <div className="h-7 w-56 animate-pulse rounded-lg bg-muted" />
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="rounded-2xl border border-border bg-card p-4">
                  <div className="h-3 w-24 animate-pulse rounded bg-muted" />
                  <div className="mt-3 h-7 w-16 animate-pulse rounded bg-muted" />
                </div>
              ))}
            </div>
            {[0, 1].map((i) => (
              <div key={i} className="space-y-3 rounded-2xl border border-border bg-card p-4">
                <div className="h-4 w-40 animate-pulse rounded bg-muted" />
                {[0, 1, 2, 3].map((r) => (
                  <div key={r} className="h-9 animate-pulse rounded-lg bg-muted/70" />
                ))}
              </div>
            ))}
          </div>
        )}
      </AppLayout>
    );
  }


  return (
    <AppLayout>
      <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-8">
        <header className="space-y-1">
          <h1 className="flex items-center gap-2 font-display text-2xl">
            <ShieldCheck className="h-5 w-5" aria-hidden /> {t("admin.title")}
          </h1>
          <p className="text-sm text-muted-foreground">{t("admin.subtitle")}</p>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <a href="/admin/ops" className="inline-block text-sm underline">
              {t("admin.ops_link")}
            </a>
            <a href="/admin/sepa" className="inline-block text-sm underline">
              {t("admin.sepa_link")}
            </a>
          </div>
        </header>

        {health ? (
          <section
            data-testid="admin-health-kpis"
            className="grid grid-cols-2 gap-3 rounded-2xl border border-border bg-card p-4 sm:grid-cols-5"
          >
            {[
              [t("admin.kpi.active_users"), health.activeUsers],
              [t("admin.kpi.pending_verifications"), health.pendingVerifications],
              [t("admin.kpi.incomplete_payments"), health.incompletePayments],
              [t("admin.kpi.pending_sepa"), health.pendingSepaPayments],
              [t("admin.kpi.failed_alias"), health.failedAliasSyncs],
              [
                t("admin.kpi.improvmx"),
                health.improvmxConfigured
                  ? t("admin.kpi.configured")
                  : t("admin.kpi.not_configured"),
              ],
            ].map(([label, value]) => (
              <div key={label as string} className="space-y-0.5">
                <p className="flex items-center gap-1 text-[11px] uppercase tracking-wide text-muted-foreground">
                  <Activity className="h-3 w-3" aria-hidden /> {label}
                </p>
                <p className="text-lg font-semibold">{value}</p>
              </div>
            ))}
          </section>
        ) : null}

        <AdminOverviewPanel />

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          {/* Sub-tabs overflow badly on phones; a native select replaces the row below sm. */}
          <select
            className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm sm:hidden"
            aria-label={t("admin.section")}
            value={activeTab}
            onChange={(e) => setActiveTab(e.target.value)}
          >
            <option value="users">{t("admin.tab.users")}</option>
            <option value="verifications">{t("admin.tab.verifications")}</option>
            <option value="transactions">{t("admin.tab.transactions")}</option>
            <option value="inbound">{t("admin.tab.inbound")}</option>
            <option value="members">{t("admin.tab.members")}</option>
            <option value="vip">{t("admin.tab.vip")}</option>
            <option value="network">{t("admin.tab.network")}</option>
            <option value="promos">{t("admin.tab.promos")}</option>
            <option value="pricing">Prijzen</option>
            <option value="deployment">{t("admin.tab.deployment")}</option>
          </select>
          <TabsList className="hidden h-auto w-full flex-wrap justify-start gap-1 sm:flex">
            <TabsTrigger value="users" data-testid="tab-users">
              {t("admin.tab.users")}
            </TabsTrigger>
            <TabsTrigger value="verifications" data-testid="tab-verifications">
              {t("admin.tab.verifications")}
            </TabsTrigger>
            <TabsTrigger value="transactions" data-testid="tab-transactions">
              {t("admin.tab.transactions")}
            </TabsTrigger>
            <TabsTrigger value="inbound" data-testid="tab-inbound">
              {t("admin.tab.inbound")}
            </TabsTrigger>
            <TabsTrigger value="members" data-testid="tab-members">
              {t("admin.tab.members")}
            </TabsTrigger>
            <TabsTrigger value="vip" data-testid="tab-vip">
              {t("admin.tab.vip")}
            </TabsTrigger>
            <TabsTrigger value="network" data-testid="tab-network">
              {t("admin.tab.network")}
            </TabsTrigger>

            <TabsTrigger value="promos" data-testid="tab-promos">
              {t("admin.tab.promos")}
            </TabsTrigger>
            <TabsTrigger value="pricing" data-testid="tab-pricing">
              Prijzen
            </TabsTrigger>
            <TabsTrigger value="delivery" data-testid="tab-delivery">
              Levering
            </TabsTrigger>
            <TabsTrigger value="deployment" data-testid="tab-deployment">
              {t("admin.tab.deployment")}
            </TabsTrigger>
          </TabsList>


          {/* ---------------------------------------------------------- */}
          <TabsContent value="users" className="space-y-3">
            <section className="space-y-4 rounded-2xl border border-border bg-card p-4 pb-6 sm:p-5">
              <div className="flex flex-wrap items-end gap-2">
                <div className="min-w-[16rem] flex-1 space-y-1">
                  <Label htmlFor="admin-search" className="text-xs">
                    {t("admin.users.search_label")}
                  </Label>
                  <div className="relative">
                    <Search
                      className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground"
                      aria-hidden
                    />
                    <Input
                      id="admin-search"
                      value={query}
                      onChange={(e) => onQueryChange(e.target.value)}
                      placeholder="jane@domain.com / @jane / uuid"
                      className="h-9 pl-8"
                    />
                  </div>
                </div>
                {usersLoading ? <Loader2 className="mb-2 h-4 w-4 animate-spin" /> : null}
              </div>

              <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border/70 bg-muted/40 p-2">
                <label className="flex items-center gap-2 text-xs">
                  <Checkbox
                    checked={allSelected}
                    onCheckedChange={(v) => toggleAllSelected(v === true)}
                    aria-label="Select all users on this page"
                    data-testid="select-all-users"
                  />
                  Select all on page
                </label>
                <span className="text-xs text-muted-foreground" data-testid="bulk-count">
                  {selected.length} selected
                </span>
                <div className="ml-auto flex flex-wrap gap-1.5">
                  {(
                    [
                      ["suspend", "Suspend Selected"],
                      ["unsuspend", "Unsuspend Selected"],
                      ["ban", "Ban Selected"],
                      ["cleanse", "Cleanse Content"],
                    ] as [BulkAction, string][]
                  ).map(([action, label]) => (
                    <Button
                      key={action}
                      size="sm"
                      variant="outline"
                      className={action === "ban" ? "h-8 text-destructive" : "h-8"}
                      data-testid={`bulk-${action}`}
                      disabled={selected.length === 0 || busy === "bulk"}
                      onClick={() => {
                        setBulkReason("");
                        setBanAck(false);
                        setBulk(action);
                      }}
                    >
                      {label}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                {users.length === 0 && !usersLoading ? (
                  <p className="text-sm text-muted-foreground">{t("admin.users.none")}</p>
                ) : null}
                {users.map((row) => {
                  const handle = handleDraft[row.userId] ?? "";
                  const vip = vipDraft[row.userId] ?? false;
                  const short = needsVipGrant(handle);
                  return (
                    <div
                      key={row.userId}
                      data-testid="admin-user-row"
                      className="rounded-xl border border-border/70 p-3"
                    >
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <div className="flex items-start gap-2">
                          <Checkbox
                            className="mt-1"
                            checked={selected.includes(row.userId)}
                            onCheckedChange={(v) => toggleSelected(row.userId, v === true)}
                            aria-label={`Select ${row.email ?? row.userId}`}
                            data-testid="select-user"
                          />
                          <div>
                            <p className="text-sm font-medium">
                              {row.displayName ?? "Unnamed"}{" "}
                              {row.verified ? (
                                <BadgeCheck
                                  className="inline h-3.5 w-3.5 text-primary"
                                  aria-hidden
                                />
                              ) : null}
                            </p>
                            <p className="text-xs font-medium text-foreground">
                              @{row.username ?? "—"}
                            </p>
                            <p className="text-xs text-muted-foreground">{row.email ?? "—"}</p>
                            <p className="font-mono text-[10px] text-muted-foreground">
                              {row.userId}
                            </p>
                            <SyncBadge
                              status={row.aliasSyncStatus}
                              at={row.aliasSyncedAt}
                              attempts={row.aliasSyncAttempts}
                              error={row.aliasSyncError}
                            />
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <StatusBadge status={row.isBanned ? "banned" : row.status} />
                          <span
                            data-testid="paid-badge"
                            className={
                              row.isPaid
                                ? "rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] uppercase text-emerald-600"
                                : "rounded-full bg-muted px-2 py-0.5 text-[10px] uppercase text-muted-foreground"
                            }
                          >
                            {row.isPaid ? t("admin.users.paid") : t("admin.users.unpaid")}
                          </span>
                          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] uppercase">
                            {row.tier}
                          </span>
                          {row.handleGrant === "vip" ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] uppercase text-amber-600">
                              <Crown className="h-3 w-3" aria-hidden /> VIP
                            </span>
                          ) : null}
                        </div>
                      </div>

                      <div className="mt-3 grid gap-3 lg:grid-cols-2">
                        <div className="space-y-1">
                          <Label htmlFor={`handle-${row.userId}`} className="text-xs">
                            Handle
                          </Label>
                          <div className="flex gap-2">
                            <Input
                              id={`handle-${row.userId}`}
                              value={handle}
                              onChange={(e) =>
                                setHandleDraft((p) => ({ ...p, [row.userId]: e.target.value }))
                              }
                              placeholder="influencer"
                              className="h-9"
                            />
                            <Button
                              className="h-9"
                              disabled={busy === row.userId}
                              onClick={() =>
                                askConfirm({
                                  title: `Override the handle to @${handle.trim().replace(/^@/, "").toLowerCase()}?`,
                                  description:
                                    "The previous @rout.be alias is released and the new one is queued for sync.",
                                  actionLabel: "Change handle",
                                  run: async () => {
                                    await onSaveHandle(row);
                                  },
                                })
                              }
                            >
                              Save
                            </Button>
                          </div>
                          <p className="break-all font-mono text-[11px] leading-relaxed text-muted-foreground">
                            <span className="block">
                              rout.be/@{handle.trim().replace(/^@/, "").toLowerCase() || "…"}
                            </span>
                            <span className="block">
                              {handle.trim().replace(/^@/, "").toLowerCase() || "…"}@rout.be
                            </span>
                          </p>
                          <div className="flex items-center gap-2 pt-1">
                            <Switch
                              id={`vip-${row.userId}`}
                              checked={vip}
                              onCheckedChange={(v) =>
                                setVipDraft((p) => ({ ...p, [row.userId]: v }))
                              }
                            />
                            <Label htmlFor={`vip-${row.userId}`} className="text-xs">
                              VIP grant — allow a 3–4 character handle
                            </Label>
                          </div>
                          {short && !vip ? (
                            <p className="text-[11px] text-amber-700 dark:text-amber-300">
                              {SHORT_HANDLE_MESSAGE}
                            </p>
                          ) : null}
                        </div>

                        <div className="space-y-2">
                          <p className="text-xs font-medium text-muted-foreground">
                            Standard actions
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            <Button
                              size="sm"
                              variant="secondary"
                              className="h-8"
                              disabled={busy === row.userId}
                              onClick={() =>
                                askConfirm({
                                  title: "Clear this bio?",
                                  description:
                                    "The bio and tagline disappear from the public profile. This cannot be undone.",
                                  actionLabel: "Clear bio",
                                  run: () => onCleanse(row, { clearTagline: true }),
                                })
                              }
                            >
                              <Eraser className="mr-1.5 h-3.5 w-3.5" aria-hidden /> Clear bio
                            </Button>
                            <Button
                              size="sm"
                              variant="secondary"
                              className="h-8"
                              disabled={busy === row.userId}
                              onClick={() =>
                                askConfirm({
                                  title: "Reset this avatar?",
                                  description:
                                    "The profile picture is removed and replaced by the default placeholder.",
                                  actionLabel: "Reset avatar",
                                  run: () => onCleanse(row, { resetAvatar: true }),
                                })
                              }
                            >
                              <RotateCcw className="mr-1.5 h-3.5 w-3.5" aria-hidden /> Reset avatar
                            </Button>
                            <Button
                              size="sm"
                              variant={row.isPaid ? "outline" : "default"}
                              className="h-8"
                              data-testid="mark-paid"
                              disabled={busy === row.userId}
                              onClick={() =>
                                askConfirm({
                                  title: row.isPaid
                                    ? "Revoke Early Believer status?"
                                    : "Mark as paid and activate Early Believer?",
                                  description: row.isPaid
                                    ? "The verified badge is removed and their @rout.be e-mail address is deleted."
                                    : "Marks the membership as paid for life, grants the Early Believer badge and the verified checkmark, records it as a manual admin activation and creates their @rout.be e-mail address.",
                                  actionLabel: row.isPaid ? "Revoke status" : "Mark as Paid",
                                  destructive: row.isPaid,
                                  run: () => onMarkPaid(row, !row.isPaid),
                                })
                              }
                            >
                              <BadgeCheck className="mr-1.5 h-3.5 w-3.5" aria-hidden />
                              {row.isPaid ? "Revoke paid" : "Mark as Paid & Activate"}
                            </Button>
                            {row.aliasSyncStatus === "failed" ? (
                              <Button
                                size="sm"
                                variant="secondary"
                                className="h-8"
                                data-testid="retry-alias"
                                disabled={busy === row.userId || !improvmxReady}
                                onClick={() => void onSyncNow(false, row.userId)}
                              >
                                <RefreshCw className="mr-1.5 h-3.5 w-3.5" aria-hidden /> Retry alias
                                sync
                              </Button>
                            ) : null}
                          </div>

                          {row.tagline ? (
                            <p className="line-clamp-2 text-[11px] text-muted-foreground">
                              Bio: {row.tagline}
                            </p>
                          ) : null}
                          {row.blocks.length > 0 ? (
                            <ul className="space-y-1">
                              {row.blocks.slice(0, 6).map((b, index) => (
                                <li
                                  key={`${row.userId}-${index}`}
                                  className="flex items-center justify-between gap-2 text-[11px]"
                                >
                                  <span className="truncate text-muted-foreground">
                                    {b.label ?? b.kind ?? "link"} — {b.value ?? ""}
                                  </span>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-6 px-2 text-destructive"
                                    disabled={busy === row.userId}
                                    onClick={() =>
                                      askConfirm({
                                        title: "Remove this link?",
                                        description: `“${b.label ?? b.kind ?? "link"}” is deleted from the public profile.`,
                                        actionLabel: "Remove link",
                                        destructive: true,
                                        run: () => onCleanse(row, { removeBlockIndexes: [index] }),
                                      })
                                    }
                                  >
                                    <Trash2 className="h-3 w-3" aria-hidden />
                                  </Button>
                                </li>
                              ))}
                            </ul>
                          ) : null}
                          {row.moderationReason ? (
                            <p className="text-[11px] text-destructive">
                              Reason: {row.moderationReason}
                            </p>
                          ) : null}
                        </div>
                      </div>

                      {/* Danger zone: isolated so a stray tap cannot ban anyone. */}
                      <details
                        className="mt-3 rounded-xl border border-destructive/40 bg-destructive/5 p-3"
                        data-testid="danger-zone"
                      >
                        <summary className="cursor-pointer text-xs font-semibold text-destructive">
                          Danger zone
                        </summary>
                        <p className="mt-2 text-[11px] text-muted-foreground">
                          These actions take the profile offline and require a written reason.
                        </p>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          <Button
                            size="sm"
                            variant={row.isSuspended ? "outline" : "destructive"}
                            className="h-8"
                            data-testid="suspend-user"
                            disabled={busy === row.userId}
                            onClick={() => {
                              if (row.isSuspended) return onSuspend(row, false);
                              setModerationReason("");
                              setBanAck(false);
                              setModerating({ row, kind: "suspend" });
                            }}
                          >
                            <ShieldOff className="mr-1.5 h-3.5 w-3.5" aria-hidden />
                            {row.isSuspended ? "Reinstate profile" : "Suspend profile"}
                          </Button>
                          <Button
                            size="sm"
                            variant={row.isBanned ? "outline" : "destructive"}
                            className="h-8"
                            data-testid="ban-user"
                            disabled={busy === row.userId}
                            onClick={() => {
                              if (row.isBanned) return onBan(row, false);
                              setModerationReason("");
                              setBanAck(false);
                              setModerating({ row, kind: "ban" });
                            }}
                          >
                            <Ban className="mr-1.5 h-3.5 w-3.5" aria-hidden />
                            {row.isBanned ? "Lift ban" : "Ban & freeze e-mail alias"}
                          </Button>
                        </div>
                      </details>
                    </div>
                  );
                })}
              </div>

              <Pager
                idPrefix="users"
                page={userPage}
                perPage={userPerPage}
                total={userTotal}
                loading={usersLoading}
                onPage={(p) => {
                  setUserPage(p);
                  void refreshUsers(p, userPerPage, query);
                }}
                onPerPage={(n) => {
                  setUserPerPage(n);
                  setUserPage(1);
                  void refreshUsers(1, n, query);
                }}
              />
            </section>
          </TabsContent>

          {/* ---------------------------------------------------------- */}
          <TabsContent value="verifications" className="space-y-3">
            <section className="space-y-3 rounded-2xl border border-border bg-card p-4 pb-6 sm:p-5">
              <h2 className="text-lg font-medium">Bank name → handle matching</h2>
              <div className="flex flex-wrap items-end gap-2">
                <div className="min-w-[16rem] flex-1 space-y-1">
                  <Label htmlFor="bank-name" className="text-xs">
                    Name on the SEPA transfer
                  </Label>
                  <Input
                    id="bank-name"
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                    placeholder="Jona De Vries"
                    className="h-9"
                  />
                </div>
                <Button className="h-9" onClick={onBankMatch}>
                  Generate handles
                </Button>
              </div>
              {bankSuggestions.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {bankSuggestions.map((s) => (
                    <span key={s} className="rounded-full bg-muted px-2.5 py-1 font-mono text-xs">
                      @{s}
                    </span>
                  ))}
                </div>
              ) : null}
            </section>

            <section className="space-y-3 rounded-2xl border border-border bg-card p-4 pb-6 sm:p-5">
              <h2 className="text-lg font-medium">
                Pending verifications ({pendingActionable.length})
              </h2>
              {pending.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nothing waiting for approval.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      <tr>
                        <th className="py-2 pr-3">User</th>
                        <th className="py-2 pr-3">Type</th>
                        <th className="py-2 pr-3">Reference</th>
                        <th className="py-2 pr-3">Amount</th>
                        <th className="py-2 pr-3">Status</th>
                        <th className="py-2" />
                      </tr>
                    </thead>
                    <tbody>
                      {pending.map((row) => (
                        <tr key={row.paymentId} className="border-t border-border/60 align-top">
                          <td className="py-2 pr-3">
                            <div className="font-medium">{row.displayName ?? "Unnamed"}</div>
                            <div className="font-mono text-[11px] text-foreground">
                              @{row.username ?? "—"}
                            </div>
                            <div className="break-all text-muted-foreground">
                              {row.email ?? `${row.userId.slice(0, 8)}…${row.userId.slice(-4)}`}
                            </div>
                          </td>
                          <td className="py-2 pr-3">
                            <span className="whitespace-nowrap rounded-full bg-muted px-2 py-0.5 text-[10px] uppercase">
                              {TIER_BADGE[row.tier] ?? row.tier}
                            </span>
                          </td>
                          <td className="py-2 pr-3 font-mono">{row.reference}</td>
                          <td className="py-2 pr-3 whitespace-nowrap">
                            {euro(row.amountCents + row.donationCents)}
                          </td>

                          <td className="py-2 pr-3">
                            <StatusBadge status={row.status} />
                          </td>
                          <td className="py-2">
                            <div className="flex flex-wrap justify-end gap-1.5">
                              {row.status === "paid" ? (
                                <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                                  <Check className="h-3.5 w-3.5" aria-hidden /> Approved
                                </span>
                              ) : (
                                <>
                                  <Button
                                    size="sm"
                                    className="h-8"
                                    disabled={busy === row.paymentId}
                                    onClick={() => onApprove(row)}
                                  >
                                    {busy === row.paymentId ? (
                                      <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                                    ) : (
                                      <BadgeCheck className="mr-1.5 h-3.5 w-3.5" aria-hidden />
                                    )}
                                    Approve &amp; grant badge
                                  </Button>
                                  {row.status === "failed" ? (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="h-8"
                                      disabled={busy === row.paymentId}
                                      onClick={() => onSetStatus(row.paymentId, "pending")}
                                    >
                                      <RotateCcw className="mr-1.5 h-3.5 w-3.5" aria-hidden />
                                      Reopen
                                    </Button>
                                  ) : (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="h-8 text-destructive"
                                      disabled={busy === row.paymentId}
                                      onClick={() => {
                                        setRejectReason("");
                                        setRejecting(row);
                                      }}
                                    >
                                      <Ban className="mr-1.5 h-3.5 w-3.5" aria-hidden />
                                      Reject
                                    </Button>
                                  )}
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <section className="space-y-3 rounded-2xl border border-border bg-card p-4 pb-6 sm:p-5">
              <h2 className="text-lg font-medium">Incomplete Stripe payments ({incomplete.length})</h2>
              {incomplete.length === 0 ? (
                <p className="text-sm text-muted-foreground">No incomplete payments waiting for resolution.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      <tr>
                        <th className="py-2 pr-3">User</th>
                        <th className="py-2 pr-3">Reference</th>
                        <th className="py-2 pr-3">Amount</th>
                        <th className="py-2 pr-3">Status</th>
                        <th className="py-2" />
                      </tr>
                    </thead>
                    <tbody>
                      {incomplete.map((row) => (
                        <tr key={row.paymentId} className="border-t border-border/60 align-top">
                          <td className="py-2 pr-3">
                            <div className="font-medium">{row.displayName ?? "Unnamed"}</div>
                            <div className="font-mono text-[11px] text-foreground">
                              @{row.username ?? "—"}
                            </div>
                            <div className="break-all text-muted-foreground">
                              {row.email ?? `${row.userId.slice(0, 8)}…${row.userId.slice(-4)}`}
                            </div>
                          </td>
                          <td className="py-2 pr-3 font-mono">{row.reference}</td>
                          <td className="py-2 pr-3 whitespace-nowrap">
                            {euro(row.amountCents + row.donationCents)}
                          </td>
                          <td className="py-2 pr-3">
                            <StatusBadge status={row.status} />
                          </td>
                          <td className="py-2">
                            <div className="flex flex-wrap justify-end gap-1.5">
                              <Button
                                size="sm"
                                className="h-8"
                                disabled={incompleteBusy === row.paymentId}
                                onClick={() => onResolveIncomplete(row, "approve")}
                              >
                                {incompleteBusy === row.paymentId ? (
                                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <BadgeCheck className="mr-1.5 h-3.5 w-3.5" aria-hidden />
                                )}
                                Approve &amp; grant badge
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-8"
                                disabled={incompleteBusy === row.paymentId}
                                onClick={() => onResolveIncomplete(row, "retry")}
                              >
                                <RotateCcw className="mr-1.5 h-3.5 w-3.5" aria-hidden />
                                Retry
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-8 text-destructive"
                                disabled={incompleteBusy === row.paymentId}
                                onClick={() => {
                                  setIncompleteReason("");
                                  onResolveIncomplete(row, "fail", incompleteReason || undefined);
                                }}
                              >
                                <Ban className="mr-1.5 h-3.5 w-3.5" aria-hidden />
                                Mark failed
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </TabsContent>

          {/* ---------------------------------------------------------- */}
          <TabsContent value="transactions" className="space-y-3">
            <section className="space-y-3 rounded-2xl border border-border bg-card p-4 pb-6 sm:p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-lg font-medium">Financial records</h2>
                <Button size="sm" variant="outline" className="h-8" onClick={exportTxCsv}>
                  <Download className="mr-1.5 h-3.5 w-3.5" aria-hidden /> Export CSV
                </Button>
              </div>
              <div className="-mx-3 overflow-x-auto px-3 sm:mx-0 sm:px-0">
                <table className="w-full min-w-[38rem] text-left text-xs">
                  <thead className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th className="py-2 pr-3">Date</th>
                      <th className="py-2 pr-3">Reference</th>
                      <th className="py-2 pr-3">User</th>
                      <th className="py-2 pr-3">Amount</th>
                      <th className="py-2 pr-3">Status</th>
                      <th className="py-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {tx.map((t) => (
                      <tr key={t.paymentId} className="border-t border-border/60">
                        <td className="py-2 pr-3 whitespace-nowrap">{shortDate(t.createdAt)}</td>
                        <td className="py-2 pr-3 font-mono">{t.reference ?? "—"}</td>
                        <td className="py-2 pr-3 break-all">
                          {t.username
                            ? `@${t.username}`
                            : (t.email ?? `${t.userId.slice(0, 8)}…${t.userId.slice(-4)}`)}
                        </td>
                        <td className="py-2 pr-3">{euro(t.amountCents + t.donationCents)}</td>

                        <td className="py-2 pr-3">
                          <StatusBadge status={t.status} />
                        </td>
                        <td className="py-2">
                          <div className="flex justify-end gap-1.5">
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7"
                              disabled={busy === t.paymentId || t.status === "pending"}
                              onClick={() => onSetStatus(t.paymentId, "pending")}
                            >
                              Pending
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-destructive"
                              disabled={busy === t.paymentId || t.status === "failed"}
                              onClick={() => onSetStatus(t.paymentId, "failed")}
                            >
                              Failed
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pager
                idPrefix="tx"
                page={txPage}
                perPage={txPerPage}
                total={txTotal}
                loading={txLoading}
                onPage={(p) => {
                  setTxPage(p);
                  void refreshTx(p, txPerPage);
                }}
                onPerPage={(n) => {
                  setTxPerPage(n);
                  setTxPage(1);
                  void refreshTx(1, n);
                }}
              />
            </section>

            <section className="space-y-3 rounded-2xl border border-border bg-card p-4 pb-6 sm:p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-lg font-medium">Admin audit log</h2>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant={filters.action === "PAYMENT_REPROCESSED" ? "default" : "outline"}
                    className="h-8"
                    data-testid="audit-filter-reprocessed"
                    onClick={() => {
                      const next =
                        filters.action === "PAYMENT_REPROCESSED"
                          ? EMPTY_AUDIT_FILTERS
                          : { ...EMPTY_AUDIT_FILTERS, action: "PAYMENT_REPROCESSED" };
                      setFilters(next);
                      void refreshAudit(null, auditPerPage, next);
                    }}
                  >
                    <RotateCcw className="mr-1.5 h-3.5 w-3.5" aria-hidden />
                    {filters.action === "PAYMENT_REPROCESSED" ? "Show all" : "Reprocessed payments"}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8"
                    data-testid="audit-export"
                    disabled={auditExporting}
                    onClick={() => void exportAuditCsv()}
                  >
                    {auditExporting ? (
                      <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" aria-hidden />
                    ) : (
                      <Download className="mr-1.5 h-3.5 w-3.5" aria-hidden />
                    )}
                    Export CSV
                  </Button>
                </div>
              </div>

              <details className="rounded-xl border border-border/70 bg-muted/30 p-3" open>
                <summary className="cursor-pointer text-xs font-medium">
                  Search &amp; filters
                </summary>
                <div className="mt-3 space-y-2">
                  <div className="space-y-1" data-testid="audit-views">
                    <Label className="text-xs">Saved views</Label>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {auditViews.map((v) => (
                        <span key={v.id} className="flex items-center">
                          <Button
                            size="sm"
                            variant={viewMatches(v, filters) ? "default" : "outline"}
                            className="h-8"
                            onClick={() => applyAuditView(v)}
                          >
                            {v.name}
                          </Button>
                          {isBuiltinView(v.id) ? null : (
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-7"
                              aria-label={`Delete view ${v.name}`}
                              onClick={() => setAuditViews(deleteAuditView(v.id))}
                            >
                              <Trash2 className="h-3.5 w-3.5" aria-hidden />
                            </Button>
                          )}
                        </span>
                      ))}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <Input
                        aria-label="Name for this filter set"
                        placeholder="Name this filter set"
                        className="h-8 w-52"
                        value={viewName}
                        onChange={(e) => setViewName(e.target.value)}
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8"
                        data-testid="audit-view-save"
                        disabled={!viewName.trim()}
                        onClick={() => {
                          setAuditViews(saveAuditView(viewName, filters));
                          setViewName("");
                          toast.success("Filter set saved.");
                        }}
                      >
                        Save current filters
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="audit-search-input" className="text-xs">
                      Search
                    </Label>
                    <Input
                      id="audit-search-input"
                      aria-label="Search the audit log"
                      data-testid="audit-search"
                      placeholder="Search actions, admins or target UUID"
                      className="h-9"
                      value={filters.search}
                      onChange={(e) => {
                        const search = e.target.value;
                        setFilters((f) => ({ ...f, search }));
                        window.clearTimeout(auditSearchTimer.current);
                        auditSearchTimer.current = window.setTimeout(() => {
                          void refreshAudit(null, auditPerPage, { ...filters, search });
                        }, 350);
                      }}
                    />
                  </div>

                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                    <div className="space-y-1">
                      <Label htmlFor="audit-admin" className="text-xs">
                        Admin e-mail
                      </Label>
                      <Input
                        id="audit-admin"
                        aria-label="Filter by admin e-mail"
                        placeholder="admin@rout.be"
                        className="h-9"
                        value={filters.adminEmail}
                        onChange={(e) => setFilters((f) => ({ ...f, adminEmail: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="audit-action" className="text-xs">
                        Action type
                      </Label>
                      <select
                        id="audit-action"
                        aria-label="Filter by action"
                        className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                        value={filters.action}
                        onChange={(e) => setFilters((f) => ({ ...f, action: e.target.value }))}
                      >
                        <option value="">All actions</option>
                        {auditActions.map((a) => (
                          <option key={a} value={a}>
                            {a}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="audit-from" className="text-xs">
                        From date
                      </Label>
                      <Input
                        id="audit-from"
                        type="date"
                        aria-label="From date"
                        className="h-9"
                        value={filters.from}
                        onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="audit-to" className="text-xs">
                        To date
                      </Label>
                      <Input
                        id="audit-to"
                        type="date"
                        aria-label="To date"
                        className="h-9"
                        value={filters.to}
                        onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value }))}
                      />
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button
                      className="h-9"
                      onClick={() => {
                        void refreshAudit(null, auditPerPage, filters);
                      }}
                    >
                      Apply filters
                    </Button>
                    <Button
                      variant="outline"
                      className="h-9"
                      onClick={() => {
                        const cleared = EMPTY_AUDIT_FILTERS;
                        setFilters(cleared);
                        void refreshAudit(null, auditPerPage, cleared);
                      }}
                    >
                      Reset
                    </Button>
                  </div>
                </div>
              </details>

              <div className="-mx-3 overflow-x-auto px-3 sm:mx-0 sm:px-0">
                <table className="w-full min-w-[36rem] text-left text-xs">
                  <thead className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th className="py-2 pr-3">When</th>
                      <th className="py-2 pr-3">Admin</th>
                      <th className="py-2 pr-3">Action</th>
                      <th className="py-2 pr-3">Target</th>
                      <th className="py-2">Notes</th>
                    </tr>
                  </thead>
                  <tbody data-testid="audit-rows">
                    {visibleAudit.map((e) => (
                      <tr key={e.id} className="border-t border-border/60">
                        <td className="py-2 pr-3 whitespace-nowrap">
                          {shortDateTime(e.createdAt)}
                        </td>
                        <td className="py-2 pr-3">{e.adminEmail ?? "—"}</td>
                        <td className="py-2 pr-3 font-mono">{e.action}</td>
                        <td className="py-2 pr-3 break-all">
                          {e.targetLabel ?? e.targetUserId ?? "—"}
                        </td>
                        <td className="py-2 text-muted-foreground">{e.notes ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {visibleAudit.length === 0 && !auditLoading ? (
                <p
                  data-testid="audit-empty"
                  className="rounded-xl border border-dashed border-border p-4 text-center text-xs text-muted-foreground"
                >
                  No audit entries match these filters. Try clearing the search or widening the date
                  range.
                </p>
              ) : null}

              <div
                className="flex flex-wrap items-center justify-between gap-2 pt-1"
                data-testid="audit-cursor-pager"
              >
                <p className="text-xs text-muted-foreground">
                  Page {auditCursors.length} · {audit.length} entries · cursor-based
                </p>
                <div className="flex items-center gap-2">
                  <select
                    aria-label="Audit entries per page"
                    className="h-8 rounded-md border border-border bg-background px-2 text-xs"
                    value={auditPerPage}
                    onChange={(e) => {
                      const n = Number(e.target.value);
                      setAuditPerPage(n);
                      void refreshAudit(null, n, filters);
                    }}
                  >
                    {[20, 50, 100].map((n) => (
                      <option key={n} value={n}>
                        {n} / page
                      </option>
                    ))}
                  </select>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8"
                    data-testid="audit-prev"
                    disabled={auditLoading || auditCursors.length <= 1}
                    onClick={() => {
                      const stack = auditCursors.slice(0, -1);
                      setAuditCursors(stack);
                      void refreshAudit(stack[stack.length - 1] ?? null, auditPerPage, filters);
                    }}
                  >
                    Previous
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8"
                    data-testid="audit-next"
                    disabled={auditLoading || !auditNextCursor}
                    onClick={() => {
                      const next = auditNextCursor;
                      if (!next) return;
                      setAuditCursors((s) => [...s, next]);
                      void refreshAudit(next, auditPerPage, filters);
                    }}
                  >
                    Next
                  </Button>
                </div>
              </div>

            </section>
          </TabsContent>

          {/* ---------------------------------------------------------- */}
          <TabsContent value="inbound" className="space-y-3">
            <section className="space-y-3 rounded-2xl border border-border bg-card p-4 pb-6 sm:p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-lg font-medium">Inbound bank references</h2>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8"
                    data-testid="inbound-export"
                    disabled={exportingInbound}
                    onClick={() => void onExportInbound()}
                  >
                    {exportingInbound ? (
                      <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" aria-hidden />
                    ) : (
                      <Download className="mr-1.5 h-3.5 w-3.5" aria-hidden />
                    )}
                    Export CSV
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8"
                    data-testid="inbound-refresh"
                    disabled={inboundLoading}
                    onClick={() => void refreshInbound(inboundPage, inboundPerPage)}
                  >
                    <RefreshCw className="mr-1.5 h-3.5 w-3.5" aria-hidden /> Refresh
                  </Button>
                </div>
              </div>
              {exportJob ? (
                <div
                  data-testid="inbound-export-status"
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/70 bg-muted/30 p-3 text-xs"
                >
                  {exportJob.status === "running" ? (
                    <span className="flex items-center gap-2 text-muted-foreground">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                      Building export in the background —{" "}
                      {exportJob.total > 0
                        ? `${Math.min(100, Math.round((exportJob.scanned / exportJob.total) * 100))}%`
                        : "starting"}{" "}
                      ({exportJob.rows} rows ready)
                    </span>
                  ) : exportJob.status === "failed" ? (
                    <>
                      <span className="text-destructive">{exportJob.error}</span>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          className="h-8"
                          data-testid="inbound-export-retry"
                          disabled={exportingInbound}
                          onClick={() => void onExportInbound()}
                        >
                          <RefreshCw className="mr-1.5 h-3.5 w-3.5" aria-hidden /> Retry export
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8"
                          onClick={() => setExportJob(null)}
                        >
                          Dismiss
                        </Button>
                      </div>
                    </>
                  ) : (
                    <>
                      <span className="text-muted-foreground">
                        Export ready — {exportJob.rows} row{exportJob.rows === 1 ? "" : "s"}.{" "}
                        {retentionLabel()}
                      </span>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          className="h-8"
                          data-testid="inbound-export-download"
                          disabled={!exportJob.csv}
                          onClick={() => {
                            if (!exportJob.csv || !exportJob.filename) return;
                            downloadCsv(exportJob.filename, exportJob.csv);
                            void logExport({
                              data: {
                                dataset: "inbound_payments",
                                phase: "downloaded",
                                rows: exportJob.rows,
                                filters: { scope: "all" },
                              },
                            }).catch(() => {});
                          }}
                        >
                          <Download className="mr-1.5 h-3.5 w-3.5" aria-hidden />{" "}
                          {exportJob.csv ? "Download CSV" : "Link expired"}
                        </Button>

                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8"
                          onClick={() => setExportJob(null)}
                        >
                          Dismiss
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              ) : null}

              <p className="text-xs text-muted-foreground">
                Every <span className="font-mono">ROUT-XXXX</span> reference parsed out of a
                forwarded bank notification. Matched references activate the membership
                automatically; unmatched ones need a manual look.
              </p>

              {inbound.length === 0 ? (
                <p
                  data-testid="inbound-empty"
                  className="rounded-xl border border-dashed border-border p-4 text-center text-xs text-muted-foreground"
                >
                  {inboundLoading
                    ? "Loading inbound payments…"
                    : "No inbound bank e-mails processed yet."}
                </p>
              ) : (
                <div className="-mx-3 overflow-x-auto px-3 sm:mx-0 sm:px-0">
                  <table className="w-full min-w-[42rem] text-left text-xs">
                    <thead className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      <tr>
                        <th className="py-2 pr-3">Received</th>
                        <th className="py-2 pr-3">Reference</th>
                        <th className="py-2 pr-3">Match</th>
                        <th className="py-2 pr-3">Amount</th>
                        <th className="py-2 pr-3">Status</th>
                        <th className="py-2 pr-3">User</th>
                        <th className="py-2" />
                      </tr>
                    </thead>
                    <tbody data-testid="inbound-rows">
                      {inbound.map((r) => (
                        <tr
                          key={r.eventId}
                          tabIndex={0}
                          role="button"
                          data-testid="inbound-row"
                          className="cursor-pointer border-t border-border/60 hover:bg-muted/50 focus:bg-muted/50 focus:outline-none"
                          onClick={() => setInboundDetail(r)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              setInboundDetail(r);
                            }
                          }}
                        >
                          <td className="py-2 pr-3 whitespace-nowrap">
                            {shortDateTime(r.receivedAt)}
                          </td>
                          <td className="py-2 pr-3 font-mono">{r.reference}</td>
                          <td className="py-2 pr-3">
                            <StatusBadge status={r.matched ? "matched" : "unmatched"} />
                          </td>
                          <td className="py-2 pr-3 whitespace-nowrap">
                            {r.amountCents === null
                              ? "—"
                              : euro(r.amountCents + (r.donationCents ?? 0))}
                          </td>
                          <td className="py-2 pr-3">
                            {r.status ? <StatusBadge status={r.status} /> : "—"}
                          </td>
                          <td className="py-2 pr-3 break-all">
                            {r.username ? `@${r.username}` : (r.email ?? "—")}
                          </td>
                          <td className="py-2 text-right">
                            {inboundFailureReason(r) ? (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-8"
                                disabled={reprocessing === r.eventId}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  void onReprocess(r);
                                }}
                              >
                                {reprocessing === r.eventId ? (
                                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <RotateCcw className="mr-1.5 h-3.5 w-3.5" aria-hidden />
                                )}
                                Reprocess
                              </Button>
                            ) : null}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {inbound.length > 0 ? (
                <Pager
                  idPrefix="inbound"
                  page={inboundPage}
                  perPage={inboundPerPage}
                  total={inboundTotal}
                  loading={inboundLoading}
                  onPage={(p) => {
                    setInboundPage(p);
                    void refreshInbound(p, inboundPerPage);
                  }}
                  onPerPage={(n) => {
                    setInboundPerPage(n);
                    setInboundPage(1);
                    void refreshInbound(1, n);
                  }}
                />
              ) : null}
            </section>
          </TabsContent>

          {/* ---------------------------------------------------------- */}
          <TabsContent value="members" className="space-y-3">
            <MemberStatusPanel />
          </TabsContent>

          <TabsContent value="vip" className="space-y-3">
            <AdminVipPanel />
          </TabsContent>



          {/* ---------------------------------------------------------- */}
          <TabsContent value="network" className="space-y-3">
            <section className="space-y-3 rounded-2xl border border-border bg-card p-4 pb-6 sm:p-5">
              <h2 className="flex items-center gap-2 text-lg font-medium">
                <Mail className="h-4 w-4" aria-hidden /> ImprovMX aliasing
              </h2>

              {aliasHealth && !improvmxReady ? (
                <div
                  data-testid="improvmx-missing-key"
                  className="space-y-2 rounded-xl border border-amber-500/50 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-300"
                >
                  <p className="font-semibold">ImprovMX API key missing in environment secrets</p>
                  <p>
                    Aliasing is paused: no @rout.be address can be created, renamed or frozen until
                    the key is available on the server.
                  </p>
                  <ol className="list-decimal space-y-0.5 pl-4">
                    <li>Open improvmx.com → Account → API and copy the private key.</li>
                    <li>
                      Store it as the backend secret{" "}
                      <code className="font-mono">IMPROVMX_API_KEY</code> (never in the app code).
                    </li>
                    <li>Come back here and press “Run sync now” to drain the queued aliases.</li>
                  </ol>
                </div>
              ) : null}

              <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border/70 bg-muted/40 p-2 text-xs">
                <span data-testid="queue-summary">
                  Queue — pending {aliasQueue?.pending ?? 0} · failed {aliasQueue?.failed ?? 0} ·
                  done {aliasQueue?.done ?? 0}
                </span>
                <div className="ml-auto flex flex-wrap gap-1.5">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8"
                    data-testid="run-sync"
                    disabled={busy === "sync" || !improvmxReady}
                    onClick={() => onSyncNow(false)}
                  >
                    <RefreshCw className="mr-1.5 h-3.5 w-3.5" aria-hidden /> Run sync now
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8"
                    data-testid="retry-failed"
                    disabled={busy === "sync" || !improvmxReady}
                    onClick={() => onSyncNow(true)}
                  >
                    <RotateCcw className="mr-1.5 h-3.5 w-3.5" aria-hidden /> Retry failed
                  </Button>
                </div>
              </div>

              <div className="rounded-xl border border-border/70 p-3 text-xs">
                {aliasHealth ? (
                  <ul className="space-y-1">
                    <li>
                      Domain:{" "}
                      <span className="font-mono tracking-normal">{aliasHealth.domain}</span>
                    </li>
                    <li>
                      API key:{" "}
                      {improvmxReady ? (
                        <span className="text-emerald-600 dark:text-emerald-400">configured</span>
                      ) : (
                        <span className="text-amber-700 dark:text-amber-300">
                          not configured — aliases stay pending
                        </span>
                      )}
                    </li>
                    <li>
                      Remote aliases:{" "}
                      {aliasHealth.remoteCount === null ? "—" : aliasHealth.remoteCount}
                    </li>
                    {aliasHealth.error ? (
                      <li className="text-destructive">{aliasHealth.error}</li>
                    ) : null}
                  </ul>
                ) : (
                  <Loader2 className="h-4 w-4 animate-spin" />
                )}
              </div>

              {!improvmxReady ? (
                <p
                  data-testid="alias-empty"
                  className="rounded-xl border border-dashed border-border p-4 text-center text-xs text-muted-foreground"
                >
                  Configure IMPROVMX_API_KEY to view and sync aliases.
                </p>
              ) : aliases.length === 0 ? (
                <p
                  data-testid="alias-empty"
                  className="rounded-xl border border-dashed border-border p-4 text-center text-xs text-muted-foreground"
                >
                  {aliasLoading ? "Loading aliases…" : "No aliases provisioned yet."}
                </p>
              ) : (
                <div className="-mx-3 overflow-x-auto px-3 sm:mx-0 sm:px-0">
                  <table className="w-full min-w-[40rem] text-left text-xs">
                    <thead className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      <tr>
                        <th className="py-2 pr-3">Alias</th>
                        <th className="py-2 pr-3">Forwards to</th>
                        <th className="py-2 pr-3">Status</th>
                        <th className="py-2 pr-3">Sync</th>
                        <th className="py-2" />
                      </tr>
                    </thead>
                    <tbody>
                      {aliases.map((a) => (
                        <tr key={a.userId} className="border-t border-border/60">
                          <td className="py-2 pr-3 font-mono">{a.alias ?? "—"}</td>
                          <td className="py-2 pr-3">{a.forwardingEmail ?? "—"}</td>
                          <td className="py-2 pr-3">
                            <StatusBadge status={a.aliasStatus} />
                          </td>
                          <td className="py-2 pr-3">
                            <SyncBadge
                              status={a.syncStatus}
                              at={a.syncedAt}
                              attempts={a.syncAttempts}
                              error={a.syncError}
                            />
                          </td>
                          <td className="py-2">
                            <div className="flex justify-end gap-1.5">
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7"
                                disabled={busy === a.userId}
                                onClick={() => onAlias(a, "pause")}
                              >
                                <PauseCircle className="mr-1 h-3.5 w-3.5" aria-hidden /> Pause
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7"
                                disabled={busy === a.userId}
                                onClick={() => onAlias(a, "resume")}
                              >
                                <PlayCircle className="mr-1 h-3.5 w-3.5" aria-hidden /> Resume
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-destructive"
                                disabled={busy === a.userId}
                                onClick={() =>
                                  askConfirm({
                                    title: `Delete ${a.alias ?? "this alias"}?`,
                                    description:
                                      "The ImprovMX forwarder is removed. Incoming mail will bounce.",
                                    actionLabel: "Delete alias",
                                    destructive: true,
                                    run: () => onAlias(a, "delete"),
                                  })
                                }
                              >
                                <Trash2 className="mr-1 h-3.5 w-3.5" aria-hidden /> Delete
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {aliases.length > 0 ? (
                <Pager
                  idPrefix="alias"
                  page={aliasPage}
                  perPage={aliasPerPage}
                  total={aliasTotal}
                  loading={aliasLoading}
                  onPage={(p) => {
                    setAliasPage(p);
                    void refreshAliases(p, aliasPerPage);
                  }}
                  onPerPage={(n) => {
                    setAliasPerPage(n);
                    setAliasPage(1);
                    void refreshAliases(1, n);
                  }}
                />
              ) : null}
            </section>
          </TabsContent>

          {/* ---------------------------------------------------------- */}
          <TabsContent value="promos" className="space-y-3">
            <PromoInvitePanel />
          </TabsContent>

          {/* ---------------------------------------------------------- */}
          <TabsContent value="pricing" className="space-y-3">
            <PricingPanel />
          </TabsContent>

          <TabsContent value="delivery" className="space-y-3">
            <DeliveryMonitorPanel />
          </TabsContent>


          <TabsContent value="deployment" className="space-y-3">
            <EmailFlowTester defaultEmail={user?.email ?? ""} />

            <section
              className="space-y-3 rounded-2xl border border-border bg-card p-4 sm:p-5"
              data-testid="deployment-checklist"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-sm font-semibold">Deployment checklist</h2>
                  <p className="text-xs text-muted-foreground">
                    Backend configuration required by the admin portal.
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8"
                  disabled={checklistLoading}
                  onClick={() => void loadChecklistNow()}
                >
                  {checklistLoading ? (
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" aria-hidden />
                  ) : null}
                  Re-check
                </Button>
              </div>

              {checklistError ? (
                <p className="rounded-xl border border-destructive/40 bg-destructive/5 p-3 text-xs text-destructive">
                  {checklistError}
                </p>
              ) : null}

              {checklist ? (
                <>
                  <p
                    className={`rounded-xl border p-3 text-xs ${
                      checklist.ok
                        ? "border-emerald-500/40 bg-emerald-500/5 text-emerald-600"
                        : "border-amber-500/40 bg-amber-500/5 text-amber-600"
                    }`}
                  >
                    {checklist.ok
                      ? "All required secrets are configured and the privileged key works."
                      : (checklist.serviceRoleError ??
                        "One or more required secrets are missing.")}
                  </p>
                  <ul className="space-y-2">
                    {checklist.items.map((item) => (
                      <li
                        key={item.name}
                        className="flex flex-wrap items-start justify-between gap-2 rounded-xl border border-border p-3"
                        data-testid={`checklist-${item.name}`}
                      >
                        <div className="min-w-0">
                          <p className="text-xs font-medium">
                            {item.label}{" "}
                            <code className="text-[11px] text-muted-foreground">{item.name}</code>
                          </p>
                          <p className="text-[11px] text-muted-foreground">{item.hint}</p>
                          {item.preview ? (
                            <p className="text-[11px] text-muted-foreground">{item.preview}</p>
                          ) : null}
                        </div>
                        <span
                          className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] ${
                            item.present
                              ? "bg-emerald-500/10 text-emerald-600"
                              : item.required
                                ? "bg-destructive/10 text-destructive"
                                : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {item.present ? "Configured" : item.required ? "Missing" : "Optional"}
                        </span>
                      </li>
                    ))}
                  </ul>
                  <p className="text-[11px] text-muted-foreground">
                    Last checked {new Date(checklist.checkedAt).toLocaleString()} · {retentionLabel()}
                  </p>
                </>
              ) : checklistLoading ? (
                <p className="text-xs text-muted-foreground">Checking configuration…</p>
              ) : null}
            </section>
          </TabsContent>
        </Tabs>

      </div>

      {/* Reject a payment ------------------------------------------------ */}
      <Dialog
        open={Boolean(inboundDetail)}
        onOpenChange={(open) => !open && setInboundDetail(null)}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Inbound payment {inboundDetail?.reference}</DialogTitle>
            <DialogDescription>
              Everything parsed out of the forwarded bank notification.
            </DialogDescription>
          </DialogHeader>
          {inboundDetail ? (
            <div className="space-y-3 text-sm">
              <dl className="grid grid-cols-[9rem_1fr] gap-x-3 gap-y-2">
                <dt className="text-muted-foreground">Payment ID</dt>
                <dd className="break-all font-mono text-xs">{inboundDetail.eventId}</dd>
                <dt className="text-muted-foreground">Timestamp</dt>
                <dd>{shortDateTime(inboundDetail.receivedAt)}</dd>
                <dt className="text-muted-foreground">Amount</dt>
                <dd>
                  {inboundDetail.amountCents === null
                    ? "—"
                    : euro(inboundDetail.amountCents + (inboundDetail.donationCents ?? 0))}
                  {inboundDetail.donationCents
                    ? ` (incl. ${euro(inboundDetail.donationCents)} tip)`
                    : ""}
                </dd>
                <dt className="text-muted-foreground">Currency</dt>
                <dd>{inboundDetail.amountCents === null ? "—" : "EUR"}</dd>
                <dt className="text-muted-foreground">Parsed reference</dt>
                <dd className="font-mono">{inboundDetail.reference}</dd>
                <dt className="text-muted-foreground">Payer</dt>
                <dd className="break-all">
                  {inboundDetail.username ? `@${inboundDetail.username}` : "—"}
                  {inboundDetail.email ? ` · ${inboundDetail.email}` : ""}
                </dd>
                <dt className="text-muted-foreground">Status</dt>
                <dd>
                  <StatusBadge
                    status={inboundDetail.matched ? (inboundDetail.status ?? "matched") : "unmatched"}
                  />
                </dd>
              </dl>

              {inboundFailureReason(inboundDetail) ? (
                <p
                  data-testid="inbound-failure-reason"
                  className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive-foreground"
                >
                  <strong className="mb-1 block text-destructive">Not activated</strong>
                  {inboundFailureReason(inboundDetail)}
                </p>
              ) : (
                <p className="rounded-xl border border-border bg-muted/50 p-3 text-xs text-muted-foreground">
                  Matched and activated — the membership and @rout.be alias are live.
                </p>
              )}
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setInboundDetail(null)}>
              Close
            </Button>
            {inboundDetail && inboundFailureReason(inboundDetail) ? (
              <Button
                disabled={reprocessing === inboundDetail.eventId}
                onClick={() => void onReprocess(inboundDetail)}
              >
                {reprocessing === inboundDetail.eventId ? (
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                ) : (
                  <RotateCcw className="mr-1.5 h-4 w-4" aria-hidden />
                )}
                Reprocess payment
              </Button>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(rejecting)} onOpenChange={(open) => !open && setRejecting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject this payment?</DialogTitle>
            <DialogDescription>
              The member is notified by e-mail. No badge is granted.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="Reason (optional) — shown to the member"
            rows={3}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejecting(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() =>
                rejecting && onSetStatus(rejecting.paymentId, "failed", rejectReason || undefined)
              }
            >
              Reject payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Suspend / ban --------------------------------------------------- */}
      <Dialog open={Boolean(moderating)} onOpenChange={(open) => !open && setModerating(null)}>
        <DialogContent className="max-w-[calc(100vw-2rem)] overflow-hidden sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {moderating?.kind === "ban" ? "Permanently ban this user?" : "Suspend this profile?"}
            </DialogTitle>
            <DialogDescription>
              {moderating?.kind === "ban"
                ? "This person can no longer sign in, their public page goes offline and their @rout.be e-mail address stops working."
                : "Their public page shows a suspension notice and their dynamic QR links stop redirecting until you reinstate them."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="moderation-reason" className="text-xs">
              Reason (required — stored in the audit log and sent to the member)
            </Label>
            <Textarea
              id="moderation-reason"
              data-testid="moderation-reason"
              value={moderationReason}
              onChange={(e) => setModerationReason(e.target.value)}
              placeholder="Why is this account being moderated?"
              rows={3}
            />
            <p className="text-[11px] text-muted-foreground">
              {moderationReason.trim().length < MIN_REASON
                ? `At least ${MIN_REASON} characters (${moderationReason.trim().length}/${MIN_REASON}).`
                : "Reason looks good."}
            </p>
            {moderating?.kind === "ban" ? (
              <label className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/5 p-2 text-xs">
                <Checkbox
                  className="mt-0.5"
                  checked={banAck}
                  onCheckedChange={(v) => setBanAck(v === true)}
                  data-testid="ban-ack"
                  aria-label="Confirm this permanent ban"
                />
                <span>
                  I understand this permanently bans{" "}
                  <strong className="break-all">
                    {moderating.row.username
                      ? `@${moderating.row.username}`
                      : (moderating.row.email ?? moderating.row.userId)}
                  </strong>
                  .
                </span>
              </label>
            ) : null}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setModerating(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              data-testid="moderation-confirm-run"
              disabled={
                !reasonValid(moderationReason) ||
                (moderating?.kind === "ban" && !banAck) ||
                Boolean(busy)
              }
              onClick={() => {
                if (!moderating) return;
                const reason = moderationReason.trim();
                if (moderating.kind === "ban") void onBan(moderating.row, true, reason);
                else void onSuspend(moderating.row, true, reason);
              }}
            >
              {moderating?.kind === "ban" ? "Ban user" : "Suspend profile"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Bulk moderation confirmation ----------------------------------- */}
      <Dialog open={Boolean(bulk)} onOpenChange={(open) => !open && setBulk(null)}>
        <DialogContent
          data-testid="bulk-confirm"
          className="max-w-[calc(100vw-2rem)] overflow-hidden sm:max-w-lg"
        >
          <DialogHeader>
            <DialogTitle>{bulk ? BULK_COPY[bulk].title : ""}</DialogTitle>
            <DialogDescription>
              This affects <strong>{selected.length}</strong>{" "}
              {selected.length === 1 ? "account" : "accounts"}.{" "}
              {bulk ? BULK_COPY[bulk].description : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="bulk-reason" className="text-xs">
              Reason {bulkNeedsReason ? "(required)" : "(optional)"}
            </Label>
            <Textarea
              id="bulk-reason"
              value={bulkReason}
              onChange={(e) => setBulkReason(e.target.value)}
              placeholder="Stored in the audit log and sent to each member"
              rows={3}
            />
            {bulkNeedsReason && !reasonValid(bulkReason) ? (
              <p className="text-[11px] text-muted-foreground">
                At least {MIN_REASON} characters required.
              </p>
            ) : null}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setBulk(null)}>
              Cancel
            </Button>
            <Button
              variant={bulk === "unsuspend" ? "default" : "destructive"}
              data-testid="bulk-confirm-run"
              disabled={busy === "bulk" || (bulkNeedsReason && !reasonValid(bulkReason))}
              onClick={() => void onBulkRun()}
            >
              {bulk ? `${BULK_COPY[bulk].label} (${selected.length})` : ""}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Generic destructive-action confirmation -------------------------- */}
      <Dialog open={Boolean(confirmation)} onOpenChange={(open) => !open && setConfirmation(null)}>
        <DialogContent
          data-testid="action-confirm"
          className="max-w-[calc(100vw-2rem)] overflow-hidden sm:max-w-lg"
        >
          <DialogHeader>
            <DialogTitle>{confirmation?.title}</DialogTitle>
            <DialogDescription>{confirmation?.description}</DialogDescription>
          </DialogHeader>
          {confirmation?.withReason ? (
            <Textarea
              value={confirmReason}
              onChange={(e) => setConfirmReason(e.target.value)}
              placeholder="Reason (optional)"
              rows={3}
            />
          ) : null}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setConfirmation(null)}>
              Cancel
            </Button>
            <Button
              variant={confirmation?.destructive ? "destructive" : "default"}
              data-testid="action-confirm-run"
              onClick={() => {
                const current = confirmation;
                setConfirmation(null);
                void current?.run(confirmReason || undefined);
              }}
            >
              {confirmation?.actionLabel}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
