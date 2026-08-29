import { useState } from "react";
import {
  Menu,
  QrCode,
  Layers,
  Link2,
  Globe,
  KeyRound,
  BookOpen,
  Palette,
  ShieldCheck,
  ReceiptText,
  ScrollText,
  Mail,
} from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LanguageToggle } from "@/components/LanguageToggle";
import { Link } from "@/lib/router-compat";
import type { LucideIcon } from "lucide-react";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { useI18n } from "@/lib/i18n";

const itemClass =
  "flex items-start gap-3 rounded-xl px-3 py-2.5 text-sm text-foreground hover:bg-muted/60 transition-colors";

const TOOLS = [
  { to: "/", label: "QR Generator", hint: "menu.generator.hint", icon: QrCode },
  { to: "/studio", label: "Profile Hub Studio", hint: "menu.studio.hint", icon: Palette },
  { to: "/batch", label: "Batch Engine", hint: "menu.batch.hint", icon: Layers },
  {
    to: "/dashboard?tab=links",
    label: "Dynamic Links & Analytics",
    hint: "menu.links.hint",
    icon: Link2,
  },
] as const;

const INFRASTRUCTURE = [
  { to: "/domains", label: "Custom Domains", hint: "menu.domains.hint", icon: Globe },
  { to: "/api", label: "API & MCP Endpoints", hint: "menu.api.hint", icon: KeyRound },
  { to: "/self-hosting", label: "Open Source & Docs", hint: "menu.docs.hint", icon: BookOpen },
] as const;

/** Only rendered for accounts holding the admin role. */
const ADMIN_TOOLS = [
  { to: "/admin", label: "Super Admin Portal", hint: "menu.adminPortal.hint", icon: ShieldCheck },
  {
    to: "/admin?tab=inbound",
    label: "Inbound Payments",
    hint: "menu.adminPayments.hint",
    icon: ReceiptText,
  },
  { to: "/admin?tab=audit", label: "Audit Log", hint: "menu.adminAudit.hint", icon: ScrollText },
  { to: "/admin/contact", label: "Contact Messages", hint: "menu.adminContact.hint", icon: Mail },
] as const;

interface NavItem {
  to: string;
  label: string;
  hint: string;
  icon: LucideIcon;
}

function Section({ title, items }: { title: string; items: readonly NavItem[] }) {
  const { t } = useI18n();
  return (
    <nav className="border-t border-border pt-3">
      <p className="eyebrow px-3 pb-1 pt-1">{title}</p>
      {items.map(({ to, label, hint, icon: Icon }) => (
        <Link key={to} to={to} className={itemClass}>
          <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <span className="min-w-0">
            {label}
            <span className="block truncate text-xs text-muted-foreground">{t(hint)}</span>
          </span>
        </Link>
      ))}
    </nav>
  );
}

/** Platform tools & infrastructure only — account links live in the profile popover. */
export function MobileMenu({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const { isAdmin } = useIsAdmin();
  const { t } = useI18n();

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        aria-label={t("menu.open")}
        className={
          className ??
          "h-10 w-10 shrink-0 rounded-xl border border-border flex items-center justify-center transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        }
      >
        <Menu className="h-5 w-5" strokeWidth={1.8} />
      </SheetTrigger>
      <SheetContent
        side="right"
        className="flex w-[86vw] max-w-xs flex-col overflow-y-auto bg-background"
      >
        <SheetHeader>
          <SheetTitle className="text-left font-display text-xl">{t("menu.platform")}</SheetTitle>
        </SheetHeader>

        <div className="mt-4 flex min-h-0 flex-1 flex-col gap-3" onClick={() => setOpen(false)}>
          <Section title={t("menu.tools")} items={TOOLS} />
          <Section title={t("menu.infrastructure")} items={INFRASTRUCTURE} />
          {isAdmin ? <Section title={t("menu.admin")} items={ADMIN_TOOLS} /> : null}

          <div
            className="mt-auto flex items-center gap-2 border-t border-border pt-4"
            onClick={(e) => e.stopPropagation()}
          >
            <LanguageToggle />
            <ThemeToggle />
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
