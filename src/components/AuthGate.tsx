import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Loader2, ShieldAlert } from "lucide-react";

import { KijamiiMark } from "@/components/KijamiiMark";
import { Onboarding } from "@/components/Onboarding";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";

function Centered({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-screen place-items-center bg-background px-4">
      <div className="w-full max-w-md text-center">{children}</div>
    </div>
  );
}

/**
 * Decides what a signed-in person is allowed to see.
 *
 * This is presentation only. The database refuses unauthorized reads and
 * writes regardless of what renders here, so a person who edits the URL gains
 * nothing -- they reach a page whose queries return nothing.
 */
/**
 * Remembers, for this browser tab only, that the markets were confirmed.
 *
 * sessionStorage rather than localStorage on purpose: the point is to ask
 * again at the next sign-in, not to remember the answer forever.
 */
const CONFIRMED_KEY = "kijamii-markets-confirmed";

export function AuthGate({ children }: { children: ReactNode }) {
  const { status, employee, signOut } = useAuth();
  const navigate = useNavigate();
  const [confirmed, setConfirmed] = useState(true);

  useEffect(() => {
    if (status !== "ready" || !employee) return;
    try {
      setConfirmed(window.sessionStorage.getItem(CONFIRMED_KEY) === employee.id);
    } catch {
      // Storage unavailable: ask, rather than silently skipping the question.
      setConfirmed(false);
    }
  }, [status, employee]);

  const markConfirmed = useCallback(() => {
    setConfirmed(true);
    try {
      if (employee) window.sessionStorage.setItem(CONFIRMED_KEY, employee.id);
    } catch {
      /* storage unavailable; it will simply ask again */
    }
  }, [employee]);

  if (status === "misconfigured") {
    return (
      <Centered>
        <KijamiiMark tone="light" className="justify-center" />
        <h1 className="mt-6 text-base font-bold">Timesheets is not configured</h1>
        <p className="mt-2 text-[13px] text-muted-foreground">
          The Supabase environment variables are missing. Set{" "}
          <code className="rounded bg-muted px-1">VITE_SUPABASE_URL</code> and{" "}
          <code className="rounded bg-muted px-1">VITE_SUPABASE_PUBLISHABLE_KEY</code>, then
          redeploy.
        </p>
      </Centered>
    );
  }

  if (status === "loading") {
    return (
      <Centered>
        <p className="flex items-center justify-center gap-2 text-[13px] text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Loading…
        </p>
      </Centered>
    );
  }

  if (status === "signedOut") {
    void navigate({ to: "/", replace: true });
    return (
      <Centered>
        <p className="flex items-center justify-center gap-2 text-[13px] text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Redirecting to sign in…
        </p>
      </Centered>
    );
  }

  if (status === "unauthorized") {
    return (
      <Centered>
        <KijamiiMark tone="light" className="justify-center" />
        <div className="mt-6 rounded-xl border bg-surface p-6 shadow-card">
          <span className="mx-auto grid size-10 place-items-center rounded-full bg-destructive/10">
            <ShieldAlert className="size-5 text-destructive" />
          </span>
          <h1 className="mt-4 text-base font-bold">
            Your account is not authorized to access Kijamii Timesheets.
          </h1>
          <p className="mt-2 text-[13px] text-muted-foreground">
            Sign in with your Kijamii work account. If you believe this is a mistake, contact your
            manager or the operations team.
          </p>
          <Button
            variant="outline"
            size="sm"
            className="mt-5"
            onClick={() => void signOut().then(() => navigate({ to: "/", replace: true }))}
          >
            Sign out
          </Button>
        </div>
      </Centered>
    );
  }

  if (status === "onboarding" && employee) {
    return <Onboarding />;
  }

  // Somebody who already has a profile still confirms their markets once per
  // session, because people move between markets and the answer goes stale.
  if (status === "ready" && !confirmed) {
    return <Onboarding onDone={markConfirmed} />;
  }

  return <>{children}</>;
}
