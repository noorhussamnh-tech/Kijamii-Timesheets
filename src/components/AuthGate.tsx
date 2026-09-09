import { type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Loader2, RefreshCw, ShieldAlert, UserSearch, WifiOff } from "lucide-react";

import { KijamiiMark } from "@/components/KijamiiMark";
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
 * There is no questionnaire any more.
 *
 * Department, title, function and region used to be asked for at every
 * sign-in, which put the two fields every report is grouped by in the hands of
 * whoever was in a hurry. They now come from the company directory, which the
 * database re-reads on each sign-in, so the only thing left for this component
 * to do is say what is happening when somebody is not in it.
 */
export function AuthGate({ children }: { children: ReactNode }) {
  const { status, employee, signOut, refreshEmployee } = useAuth();
  const navigate = useNavigate();

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

  // The lookup never came back. Say that, rather than passing it off as a
  // decision about this person -- and give them the one action that helps.
  if (status === "error") {
    return (
      <Centered>
        <KijamiiMark tone="light" className="justify-center" />
        <div className="mt-6 rounded-xl border bg-surface p-6 shadow-card">
          <span className="mx-auto grid size-10 place-items-center rounded-full bg-warning-soft">
            <WifiOff className="size-5 text-warning" />
          </span>
          <h1 className="mt-4 text-base font-bold">We could not load your profile</h1>
          <p className="mt-2 text-[13px] text-muted-foreground">
            You are signed in. Something went wrong reaching Timesheets — usually a dropped
            connection. Your work is safe.
          </p>
          <div className="mt-5 flex items-center justify-center gap-2">
            <Button size="sm" onClick={() => void refreshEmployee()}>
              <RefreshCw className="size-3.5" /> Try again
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void signOut().then(() => navigate({ to: "/", replace: true }))}
            >
              Sign out
            </Button>
          </div>
        </div>
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
          <h1 className="mt-4 text-base font-bold">We could not find you on the roster</h1>
          <p className="mt-2 text-[13px] text-muted-foreground">
            Timesheets takes its list of people straight from the company employee list, and{" "}
            {employee?.email ?? "this address"} is not on it. Nothing is wrong with your account --
            ask People &amp; Culture to add you, and you will be in the next time you sign in.
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

  // On the roster, but the directory did not say enough to build a timesheet.
  // Nobody in the sheet should reach this; it exists so that an unreadable
  // record says so plainly rather than quietly guessing somebody a region.
  if (status === "incomplete") {
    return (
      <Centered>
        <KijamiiMark tone="light" className="justify-center" />
        <div className="mt-6 rounded-xl border bg-surface p-6 shadow-card">
          <span className="mx-auto grid size-10 place-items-center rounded-full bg-warning-soft">
            <UserSearch className="size-5 text-warning" />
          </span>
          <h1 className="mt-4 text-base font-bold">Your record is missing a region</h1>
          <p className="mt-2 text-[13px] text-muted-foreground">
            We found {employee?.fullName ?? "you"} on the company employee list, but not which
            entity you sit in -- and that is what decides your working week. Ask People &amp;
            Culture to fill it in, then try again.
          </p>
          <div className="mt-5 flex items-center justify-center gap-2">
            <Button size="sm" onClick={() => void refreshEmployee()}>
              <RefreshCw className="size-3.5" /> Try again
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void signOut().then(() => navigate({ to: "/", replace: true }))}
            >
              Sign out
            </Button>
          </div>
        </div>
      </Centered>
    );
  }

  return <>{children}</>;
}
