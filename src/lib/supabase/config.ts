/**
 * Supabase connection settings.
 *
 * Both values are public by design: they are compiled into the browser bundle,
 * and every table they reach is guarded by row-level security. The service
 * role key is deliberately absent from this file so it can never be imported
 * from client code.
 */

const url = import.meta.env["VITE_SUPABASE_URL"];
const publishableKey = import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"];

export const SUPABASE_CONFIGURED = Boolean(url && publishableKey);

export const SUPABASE_URL = url ?? "";
export const SUPABASE_PUBLISHABLE_KEY = publishableKey ?? "";

/** Where Google should send the user back to after sign-in. */
export function authRedirectUrl(): string {
  if (typeof window !== "undefined") {
    return `${window.location.origin}/auth/callback`;
  }
  const site = import.meta.env["VITE_SITE_URL"] ?? "http://localhost:8080";
  return `${site.replace(/\/$/, "")}/auth/callback`;
}
