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
  // Guards against a slow employee lookup landing after a sign-out.
  const loadToken = useRef(0);

  const loadEmployee = useCallback(async (active: boolean) => {
    const token = ++loadToken.current;
    if (!active) {
      setEmployee(null);
      return;
    }
    try {
      const record = await fetchCurrentEmployee();
      if (token === loadToken.current) setEmployee(record);
    } catch (cause) {
      if (token === loadToken.current) {
        setEmployee(null);
        setError(cause instanceof Error ? cause.message : "Could not load your profile.");
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
    if (!employee || !employee.active) return "unauthorized";
    if (!employee.onboarded) return "onboarding";
    return "ready";
  }, [resolved, session, employee]);

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
