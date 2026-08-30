import { useEffect, useRef, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";

import { KijamiiMark } from "@/components/KijamiiMark";
import { Button } from "@/components/ui/button";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

export const Route = createFileRoute("/auth/callback")({
  head: () => ({ meta: [{ title: "Signing in — Kijamii Timesheets" }] }),
  component: AuthCallback,
});

/**
 * Completes the Google sign-in redirect.
 *
 * The PKCE code verifier lives in this browser, so the exchange has to happen
 * here rather than on the server. On success the session is written to cookies
 * and the router takes over; on failure the person gets a way back rather than
 * a blank screen.
 */
function AuthCallback() {
  const navigate = useNavigate();
  const [failed, setFailed] = useState(false);
  const exchangeStarted = useRef(false);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setFailed(true);
      return;
    }

    // Strict mode invokes effects twice; without this the second run would
    // consume the code a second time and race the first.
    if (exchangeStarted.current) return;
    exchangeStarted.current = true;

    let cancelled = false;

    void (async () => {
      const params = new URLSearchParams(window.location.search);

      // Google reports a refused consent as an error parameter, not an
      // exception -- treat it as a normal "back to sign in", not a crash.
      if (params.get("error")) {
        console.warn("[timesheets] oauth returned an error", {
          error: params.get("error"),
        });
        if (!cancelled) void navigate({ to: "/", replace: true });
        return;
      }

      const code = params.get("code");
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);

        if (error) {
          // An auth code is single-use, so a repeated exchange (a refresh, the
          // back button, an effect running twice) fails even though the first
          // one worked. Only report a failure if there is genuinely no session.
          const { data } = await supabase.auth.getSession();
          if (!data.session) {
            console.error("[timesheets] code exchange failed", { message: error.message });
            if (!cancelled) setFailed(true);
            return;
          }
        }
      }

      if (!cancelled) void navigate({ to: "/timesheet", replace: true });
    })();

    return () => {
      cancelled = true;
    };
  }, [navigate]);

  return (
    <div className="grid min-h-screen place-items-center bg-background px-4">
      <div className="w-full max-w-sm text-center">
        <div className="flex justify-center">
          <KijamiiMark tone="light" />
        </div>
        {failed ? (
          <>
            <h1 className="mt-6 text-base font-bold">Sign-in could not be completed</h1>
            <p className="mt-2 text-[13px] text-muted-foreground">
              The link may have expired. Please try signing in again.
            </p>
            <Button className="mt-5" size="sm" onClick={() => void navigate({ to: "/" })}>
              Back to sign in
            </Button>
          </>
        ) : (
          <p className="mt-6 flex items-center justify-center gap-2 text-[13px] text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Signing you in…
          </p>
        )}
      </div>
    </div>
  );
}
