import { useEffect } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AlertCircle, Loader2 } from "lucide-react";

import { KijamiiMark } from "@/components/KijamiiMark";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";

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
      <path
        fill="#FBBC05"
        d="M5.4 14.5a7.1 7.1 0 0 1 0-4.9V6.5H1.4a11.9 11.9 0 0 0 0 10.7l4-2.7Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4C17.9 1.2 15.2 0 12 0A11.9 11.9 0 0 0 1.4 6.5l4 3.1A7 7 0 0 1 12 4.8Z"
      />
    </svg>
  );
}

function SignIn() {
  const { status, signIn, error } = useAuth();
  const navigate = useNavigate();

  // Someone already signed in has no reason to see this page.
  useEffect(() => {
    if (status === "ready" || status === "onboarding" || status === "unauthorized") {
      void navigate({ to: "/timesheet", replace: true });
    }
  }, [status, navigate]);

  const busy = status === "loading";

  return (
    <div className="grid min-h-screen lg:grid-cols-[minmax(0,1fr)_440px]">
      <div className="hidden flex-col justify-between bg-sidebar px-10 py-10 lg:flex">
        <KijamiiMark />
        <div className="max-w-sm">
          <p className="label-xs text-sidebar-foreground/50">Kijamii</p>
          <h2 className="mt-2 text-2xl font-bold text-sidebar-accent-foreground">
            Weekly hours, logged in minutes.
          </h2>
          <p className="mt-3 text-[13px] leading-relaxed text-sidebar-foreground/70">
            Log time against clients and services for Egypt, UAE and KSA. Drafts save as you type,
            and submitted weeks are locked for review.
          </p>
        </div>
        <p className="text-[11px] text-sidebar-foreground/40">
          Internal tool · Access limited to Kijamii work accounts
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
              onClick={() => void signIn()}
              disabled={busy || status === "misconfigured"}
            >
              {busy ? <Loader2 className="size-4 animate-spin" /> : <GoogleGlyph />}
              {busy ? "Checking your session…" : "Continue with Google"}
            </Button>

            {status === "misconfigured" && (
              <p className="mt-4 flex items-start gap-2 text-[12px] font-medium text-destructive">
                <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
                Sign-in is unavailable because the app is missing its Supabase configuration.
              </p>
            )}

            {error && (
              <p className="mt-4 flex items-start gap-2 text-[12px] font-medium text-destructive">
                <AlertCircle className="mt-0.5 size-3.5 shrink-0" /> {error}
              </p>
            )}
          </div>
          <p className="mt-4 text-center text-[11px] text-muted-foreground">
            Access is restricted to approved @kijamii.com accounts.
          </p>
        </div>
      </div>
    </div>
  );
}
