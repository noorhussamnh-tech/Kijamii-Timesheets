import { useEffect, useState, type ReactNode } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  CalendarClock,
  Check,
  ChevronDown,
  ClipboardList,
  LogOut,
  Menu,
  ShieldCheck,
} from "lucide-react";
import { KijamiiMark } from "@/components/KijamiiMark";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { getVertical, verticals } from "@/data/reference";
import { useTimesheet } from "@/lib/timesheet-store";
import { cn } from "@/lib/utils";

const nav = [
  { to: "/timesheet", label: "My Timesheet", icon: CalendarClock },
  { to: "/submissions", label: "Previous Submissions", icon: ClipboardList },
  { to: "/admin", label: "Admin Overview", icon: ShieldCheck },
] as const;

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <nav className="flex flex-col gap-0.5">
      {nav.map((item) => {
        const active = pathname.startsWith(item.to);
        return (
          <Link
            key={item.to}
            to={item.to}
            onClick={onNavigate}
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

export function AppShell({
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
  const { signedIn, authReady, signOut, employee, marketId, setMarketId } = useTimesheet();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (authReady && !signedIn) void navigate({ to: "/" });
  }, [authReady, signedIn, navigate]);


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
            {employee.name}
          </p>
          <p className="truncate text-[11px] text-sidebar-foreground/60">{employee.email}</p>
          <button
            onClick={() => {
              signOut();
              void navigate({ to: "/" });
            }}
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
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-[260px] bg-sidebar p-4">
                  <SheetTitle className="sr-only">Navigation</SheetTitle>
                  <div className="space-y-6">
                    <KijamiiMark />
                    <NavLinks onNavigate={() => setMobileOpen(false)} />
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
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-2">
                    <span className="label-xs hidden sm:inline">Vertical</span>
                    <span className="text-xs font-semibold">{getVertical(marketId).name}</span>
                    <ChevronDown className="size-3.5 opacity-70" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  {verticals.map((m) => (
                    <DropdownMenuItem
                      key={m.id}
                      onClick={() => setMarketId(m.id)}
                      className="flex items-center justify-between gap-2"
                    >
                      <span className={cn(marketId === m.id && "font-semibold")}>{m.name}</span>
                      {marketId === m.id && <Check className="size-3.5 text-brand" />}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
              {actions}
              <ThemeToggle />
              <div className="hidden items-center gap-2 border-l pl-3 sm:flex">
                <span className="grid size-8 place-items-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">
                  {employee.initials}
                </span>
                <div className="hidden leading-tight lg:block">
                  <p className="text-[13px] font-semibold">{employee.name}</p>
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
