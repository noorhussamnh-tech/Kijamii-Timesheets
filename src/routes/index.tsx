import { useEffect } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { KijamiiMark } from "@/components/KijamiiMark";
import { Button } from "@/components/ui/button";
import { useTimesheet } from "@/lib/timesheet-store";
import { ThemeToggle } from "@/components/ThemeToggle";
import { verticals } from "@/data/reference";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Sign in — Kijamii Timesheets" },
      {
        name: "description",
        content:
          "Sign in with your Kijamii work account to log weekly hours across Egypt, UAE and KSA.",
      },
      { property: "og:title", content: "Sign in — Kijamii Timesheets" },
      {
        property: "og:description",
        content: "Internal weekly timesheets for Kijamii teams in Egypt, UAE and KSA.",
      },
    ],
  }),
  component: SignIn,
});

function GoogleGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
      <path
        fill="#4285F4"
        d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.4a5.5 5.5 0 0 1-2.4 3.6v3h3.9c2.3-2.1 3.6-5.2 3.6-8.8Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.2 0 5.9-1.1 7.9-2.9l-3.9-3c-1.1.7-2.4 1.2-4 1.2a7 7 0 0 1-6.6-4.8H1.4v3.1A11.9 11.9 0 0 0 12 24Z"
      />
      <path fill="#FBBC05" d="M5.4 14.5a7.1 7.1 0 0 1 0-4.9V6.5H1.4a11.9 11.9 0 0 0 0 10.7l4-2.7Z" />
      <path
        fill="#EA4335"
        d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4C17.9 1.2 15.2 0 12 0A11.9 11.9 0 0 0 1.4 6.5l4 3.1A7 7 0 0 1 12 4.8Z"
      />
    </svg>
  );
}

function SignIn() {
  const { signIn, signedIn, marketId, setMarketId } = useTimesheet();
  const navigate = useNavigate();

  useEffect(() => {
    if (signedIn) void navigate({ to: "/timesheet" });
  }, [signedIn, navigate]);

  return (
    <div className="grid min-h-screen lg:grid-cols-[minmax(0,1fr)_440px]">
      <div className="hidden flex-col justify-between bg-sidebar px-10 py-10 lg:flex">
        <KijamiiMark />
        <div className="max-w-sm">
          <p className="label-xs text-sidebar-foreground/50">Kijamii Prism</p>
          <h2 className="mt-2 text-2xl font-bold text-sidebar-accent-foreground">
            Weekly hours, logged in minutes.
          </h2>
          <p className="mt-3 text-[13px] leading-relaxed text-sidebar-foreground/70">
            Log time against clients, jobs and services for Egypt, UAE and KSA. Drafts autosave, and
            submitted weeks are locked for review.
          </p>
        </div>
        <p className="text-[11px] text-sidebar-foreground/40">
          Internal tool · Access limited to approved Kijamii accounts
        </p>
      </div>

      <div className="relative flex items-center justify-center bg-background px-5 py-12">
        <ThemeToggle className="absolute top-4 right-4" />
        <div className="w-full max-w-sm">
          <div className="lg:hidden">
            <KijamiiMark tone="light" />
          </div>
          <div className="mt-6 rounded-xl border bg-surface p-6 shadow-card">
            <h1 className="text-lg font-bold">Timesheets</h1>
            <p className="mt-1 text-[13px] text-muted-foreground">
              Sign in using your Kijamii work account.
            </p>

            <Button
              variant="outline"
              className="mt-5 h-10 w-full justify-center gap-2 text-[13px] font-semibold"
              onClick={signIn}
            >
              <GoogleGlyph /> Continue with Google
            </Button>

            <div className="mt-6 border-t pt-4">
              <p className="label-xs mb-2">Prototype: preview vertical</p>
              <div className="grid grid-cols-2 gap-1.5">
                {verticals.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => setMarketId(m.id)}
                    className={`rounded-md border px-2 py-2 text-xs font-semibold transition-colors ${
                      marketId === m.id
                        ? "border-brand bg-brand-soft text-brand"
                        : "text-muted-foreground hover:border-border-strong"
                    }`}
                  >
                    {m.name}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-[11px] text-muted-foreground">
                In production the vertical comes from the employee's assignment, and it is stored
                with every submitted row.
              </p>
            </div>

          </div>
          <p className="mt-4 text-center text-[11px] text-muted-foreground">
            Access will be restricted to approved @kijamii.com addresses.
          </p>
        </div>
      </div>
    </div>
  );
}
