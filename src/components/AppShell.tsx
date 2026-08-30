import { useState, type ReactNode } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { CalendarClock, ClipboardList, LogOut, Menu, ShieldCheck, Sparkles } from "lucide-react";

import { AuthGate } from "@/components/AuthGate";
import { KijamiiMark } from "@/components/KijamiiMark";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useAuth } from "@/lib/auth";
import { MARKET_LABELS } from "@/lib/domain/types";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/timesheet", label: "My Timesheet", icon: CalendarClock, adminOnly: false },
  { to: "/submissions", label: "Previous Submissions", icon: ClipboardList, adminOnly: false },
  { to: "/insights", label: "My Time", icon: Sparkles, adminOnly: false },
  { to: "/admin", label: "Admin Overview", icon: ShieldCheck, adminOnly: true },
] as const;

function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const { employee } = useAuth();
  const isAdmin = employee?.role === "admin";

  return (
    <nav className="flex flex-col gap-0.5">
      {NAV.filter((item) => !item.adminOnly || isAdmin).map((item) => {
        const active = pathname.startsWith(item.to);
        return (
          <Link
            key={item.to}
            to={item.to}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-2.5 rounded-md px-3 py-2 text-[13px] font-medium transition-colors",
              active
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
            )}
          >
            <item.icon className="size-4 shrink-0" />
            <span className="truncate">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

function ShellChrome({
  title,
  description,
  actions,
  children,
}: {
  title: string;
  description?: string | undefined;
  actions?: ReactNode | undefined;
  children: ReactNode;
}) {
  const { employee, signOut } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    void navigate({ to: "/", replace: true });
  };

  // The market is shown as text, never as a control: people cannot reassign
  // themselves, and every submitted row records the market it was filed under.
  const marketLabel = employee?.primaryMarket ? MARKET_LABELS[employee.primaryMarket] : null;
  const extraMarkets = (employee?.markets.length ?? 0) - 1;

  return (
    <div className="min-h-screen bg-background lg:grid lg:grid-cols-[248px_minmax(0,1fr)]">
      <aside className="sticky top-0 hidden h-screen flex-col justify-between bg-sidebar px-4 py-5 lg:flex">
        <div className="space-y-6">
          <KijamiiMark />
          <div>
            <p className="label-xs mb-2 px-3 text-sidebar-foreground/50">Workspace</p>
            <NavLinks />
          </div>
        </div>
        <div className="rounded-lg bg-sidebar-accent/60 p-3">
          <p className="truncate text-[13px] font-semibold text-sidebar-accent-foreground">
            {employee?.fullName}
          </p>
          <p className="truncate text-[11px] text-sidebar-foreground/60">{employee?.email}</p>
          {marketLabel && (
            <p className="mt-1 truncate text-[11px] text-sidebar-foreground/50">
              {marketLabel}
              {extraMarkets > 0 && ` +${extraMarkets}`}
              {employee?.department ? ` · ${employee.department}` : ""}
            </p>
          )}
          <button
            onClick={() => void handleSignOut()}
            className="mt-2.5 inline-flex items-center gap-1.5 text-[12px] font-medium text-sidebar-foreground/70 transition-colors hover:text-sidebar-primary"
          >
            <LogOut className="size-3.5" /> Sign out
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-col">
        <header className="sticky top-0 z-30 border-b bg-surface/95 backdrop-blur">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 sm:px-6">
            <div className="flex min-w-0 items-center gap-3">
              <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
                <SheetTrigger asChild>
                  <Button variant="outline" size="icon" className="shrink-0 lg:hidden">
                    <Menu className="size-4" />
                    <span className="sr-only">Open navigation</span>
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-[260px] bg-sidebar p-4">
                  <SheetTitle className="sr-only">Navigation</SheetTitle>
                  <div className="space-y-6">
                    <KijamiiMark />
                    <NavLinks onNavigate={() => setMobileOpen(false)} />
                    <button
                      onClick={() => void handleSignOut()}
                      className="inline-flex items-center gap-1.5 px-3 text-[12px] font-medium text-sidebar-foreground/70"
                    >
                      <LogOut className="size-3.5" /> Sign out
                    </button>
                  </div>
                </SheetContent>
              </Sheet>
              <div className="min-w-0">
                <h1 className="truncate text-base font-bold sm:text-lg">{title}</h1>
                {description && (
                  <p className="truncate text-xs text-muted-foreground">{description}</p>
                )}
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {marketLabel && (
                <span className="hidden items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-semibold sm:inline-flex">
                  <span className="label-xs">Market</span>
                  {marketLabel}
                  {extraMarkets > 0 && (
                    <span className="text-muted-foreground">+{extraMarkets}</span>
                  )}
                </span>
              )}
              {actions}
              <ThemeToggle />
              <div className="hidden items-center gap-2 border-l pl-3 sm:flex">
                <span className="grid size-8 place-items-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">
                  {initialsOf(employee?.fullName ?? "")}
                </span>
                <div className="hidden leading-tight lg:block">
                  <p className="text-[13px] font-semibold">{employee?.fullName}</p>
                </div>
              </div>
            </div>
          </div>
        </header>
        <main className="min-w-0 flex-1 px-4 py-5 sm:px-6 sm:py-6">{children}</main>
      </div>
    </div>
  );
}

export function AppShell(props: {
  title: string;
  description?: string | undefined;
  actions?: ReactNode | undefined;
  children: ReactNode;
}) {
  return (
    <AuthGate>
      <ShellChrome {...props} />
    </AuthGate>
  );
}
