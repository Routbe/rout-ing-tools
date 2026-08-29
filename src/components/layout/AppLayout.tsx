import type { ReactNode } from "react";
import { BarChart3, ChevronRight } from "lucide-react";
import { Link } from "@/lib/router-compat";
import { RoutLogo } from "@/components/RoutLogo";
import { Footer } from "@/components/Footer";
import { BackToTop } from "@/components/BackToTop";
import { NameOnboardingDialog } from "@/components/onboarding/NameOnboardingDialog";

import { ProfileMenu } from "@/components/ProfileMenu";
import { MobileMenu } from "@/components/MobileMenu";
import { LanguageToggle } from "@/components/LanguageToggle";

import { cn } from "@/lib/utils";
import { useHeaderReveal } from "@/hooks/useHeaderReveal";

export interface Crumb {
  label: string;
  to?: string;
}

interface AppLayoutProps {
  children: ReactNode;
  /** Page title rendered under the breadcrumbs. */
  title?: string;
  description?: string;
  crumbs?: Crumb[];
  /** Optional actions on the title row. */
  actions?: ReactNode;
  /** Studio uses the full viewport width; the generator uses 'full' (no gutter). */
  width?: "default" | "wide" | "full";
}

/**
 * Global, indestructible app frame: the header and footer are always visible
 * and only the content between them swaps on navigation, so route changes
 * unmount heavy page state instead of stacking modals in memory.
 */
export function AppLayout({
  children,
  title,
  description,
  crumbs,
  actions,
  width = "default",
}: AppLayoutProps) {
  const hidden = useHeaderReveal();
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header
        data-testid="app-header"
        data-hidden={hidden ? "true" : "false"}
        className={cn(
          "fixed left-0 right-0 top-0 z-50 w-full border-b border-border/50 bg-background/90 backdrop-blur-md transition-transform duration-300 ease-in-out",
          hidden ? "-translate-y-full" : "translate-y-0",
        )}
      >
        <div className="container mx-auto flex h-16 items-center gap-4 px-4">
          <Link to="/" className="shrink-0" aria-label="ROUT home">
            <RoutLogo size={28} />
          </Link>

          <div className="ml-auto flex items-center gap-2">
            <LanguageToggle className="hidden sm:inline-flex" />
            <ProfileMenu />
            <MobileMenu />
          </div>
        </div>
      </header>

      <main className="flex-1 pt-16">
        <div
          className={cn(
            "mx-auto w-full",
            width === "full" ? "max-w-full" : "px-4 py-8 sm:px-6",
            width === "wide" ? "max-w-7xl" : width === "default" ? "max-w-5xl" : "",
          )}
        >
          {(crumbs?.length || title) && (
            <div className="mb-6 grid grid-cols-[minmax(0,1fr)_auto] items-end gap-4 sm:flex sm:flex-wrap sm:justify-between">
              <div className="min-w-0">
                {crumbs?.length ? (
                  <nav
                    aria-label="Breadcrumb"
                    className="mb-2 flex items-center gap-1 text-xs text-muted-foreground"
                  >
                    <Link to="/" className="hover:text-foreground">
                      ROUT
                    </Link>
                    {crumbs.map((c) => (
                      <span key={c.label} className="flex min-w-0 items-center gap-1">
                        <ChevronRight className="h-3 w-3 shrink-0" aria-hidden />
                        {c.to ? (
                          <Link to={c.to} className="truncate hover:text-foreground">
                            {c.label}
                          </Link>
                        ) : (
                          <span className="truncate text-foreground">{c.label}</span>
                        )}
                      </span>
                    ))}
                  </nav>
                ) : null}
                {title ? (
                  <h1 className="text-[28px] font-medium leading-tight sm:text-[34px]">{title}</h1>
                ) : null}
                {description ? (
                  <p className="mt-1 text-sm text-muted-foreground">{description}</p>
                ) : null}
              </div>
              {actions ? <div className="shrink-0">{actions}</div> : null}
            </div>
          )}

          {children}
        </div>
      </main>

      <Footer />
      <BackToTop />
      <NameOnboardingDialog />

    </div>
  );
}

/** Small stat card used by the dashboard analytics section. */
export function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-muted-foreground">
        <BarChart3 className="h-3.5 w-3.5" aria-hidden /> {label}
      </div>
      <p className="mt-2 text-2xl font-medium">{value}</p>
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
