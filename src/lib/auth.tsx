/**
 * Session state.
 *
 * Holds the Supabase session and the employee record it resolves to. Those are
 * two separate things on purpose: somebody can be authenticated (Google
 * accepted them) but not authorized (no roster record), and the UI needs to
 * tell those apart to show the right message.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { Session } from "@supabase/supabase-js";

import { fetchCurrentEmployee } from "@/lib/data/api";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { authRedirectUrl, SUPABASE_CONFIGURED } from "@/lib/supabase/config";
import type { Employee } from "@/lib/domain/types";

export type AuthStatus =
  /** Still resolving the session on first paint. */
  | "loading"
  | "signedOut"
  /** Authenticated with Google but no active roster record. */
  | "unauthorized"
  /**
   * Signed in, but the profile lookup itself failed -- a dropped connection
   * rather than a verdict about the person. Kept separate from
   * "unauthorized" because telling somebody their account is barred when the
   * network merely blinked is both wrong and alarming.
   */
  | "error"
  /** Authorized, but has not chosen their markets yet. */
  | "onboarding"
  | "ready"
  /** Supabase credentials are missing from the environment. */
  | "misconfigured";

interface AuthContextValue {
  status: AuthStatus;
  session: Session | null;
  employee: Employee | null;
  error: string | null;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  refreshEmployee: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const supabase = getSupabaseBrowserClient();
  const [session, setSession] = useState<Session | null>(null);
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [resolved, setResolved] = useState(false);
  // True only when the lookup itself failed, as distinct from it having
  // returned "no such employee".
  const [lookupFailed, setLookupFailed] = useState(false);
  // Guards against a slow employee lookup landing after a sign-out.
  const loadToken = useRef(0);

  const loadEmployee = useCallback(async (active: boolean) => {
    const token = ++loadToken.current;
    if (!active) {
      setEmployee(null);
      setLookupFailed(false);
      return;
    }

    // A few attempts before concluding anything. A phone that loses its
    // connection for a moment during the redirect back from Google is the
    // common case, and the wrong conclusion to draw from it is that the
    // person is not allowed in.
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const record = await fetchCurrentEmployee();
        if (token !== loadToken.current) return;
        setEmployee(record);
        setLookupFailed(false);
        setError(null);
        return;
      } catch (cause) {
        if (token !== loadToken.current) return;
        if (attempt === 2) {
          // Note what failed, but do not claim to know whether they are
          // authorized -- we never got an answer either way.
          setEmployee(null);
          setLookupFailed(true);
          setError(cause instanceof Error ? cause.message : "Could not load your profile.");
          return;
        }
        await new Promise((resolve) => setTimeout(resolve, 400 * 2 ** attempt));
      }
    }
  }, []);

  useEffect(() => {
    if (!supabase) {
      setResolved(true);
      return;
    }
    let cancelled = false;

    void supabase.auth.getSession().then(async ({ data }) => {
      if (cancelled) return;
      setSession(data.session);
      await loadEmployee(Boolean(data.session));
      if (!cancelled) setResolved(true);
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((event, next) => {
      setSession(next);
      // TOKEN_REFRESHED fires often and changes nothing about who the user is.
      if (event !== "TOKEN_REFRESHED") void loadEmployee(Boolean(next));
    });

    return () => {
      cancelled = true;
      subscription.subscription.unsubscribe();
    };
  }, [supabase, loadEmployee]);

  const signIn = useCallback(async () => {
    if (!supabase) return;
    setError(null);
    const { error: signInError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: authRedirectUrl(),
        // Asks Google to show only Kijamii accounts. This is a convenience,
        // not a control -- the real domain check happens in the database.
        queryParams: { hd: "kijamii.com", prompt: "select_account" },
      },
    });
    if (signInError) {
      console.error("[timesheets] sign-in failed", { message: signInError.message });
      setError("Could not start sign-in. Please try again.");
    }
  }, [supabase]);

  const signOut = useCallback(async () => {
    if (!supabase) return;
    loadToken.current++;
    setEmployee(null);
    setLookupFailed(false);
    setSession(null);
    await supabase.auth.signOut();
  }, [supabase]);

  const refreshEmployee = useCallback(async () => {
    await loadEmployee(Boolean(session));
  }, [loadEmployee, session]);

  const status: AuthStatus = useMemo(() => {
    if (!SUPABASE_CONFIGURED) return "misconfigured";
    if (!resolved) return "loading";
    if (!session) return "signedOut";
    if (lookupFailed) return "error";
    if (!employee || !employee.active) return "unauthorized";
    if (!employee.onboarded) return "onboarding";
    return "ready";
  }, [resolved, session, employee, lookupFailed]);

  const value = useMemo<AuthContextValue>(
    () => ({ status, session, employee, error, signIn, signOut, refreshEmployee }),
    [status, session, employee, error, signIn, signOut, refreshEmployee],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
