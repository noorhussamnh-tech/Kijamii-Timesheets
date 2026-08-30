/**
 * The browser Supabase client.
 *
 * Sessions are kept in cookies rather than localStorage so the server can read
 * them during SSR, and so a cross-site script cannot read the token out of
 * storage. Created lazily and cached, because instantiating two clients in one
 * tab makes them fight over token refresh.
 */
import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

import { SUPABASE_CONFIGURED, SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "./config";

let cached: SupabaseClient | null = null;

export function getSupabaseBrowserClient(): SupabaseClient | null {
  if (!SUPABASE_CONFIGURED) return null;
  if (!cached) {
    cached = createBrowserClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
  }
  return cached;
}

/**
 * Thrown when the app is running without Supabase credentials. Surfaced as a
 * setup message rather than a crash, so a misconfigured deploy is diagnosable.
 */
export class SupabaseNotConfiguredError extends Error {
  constructor() {
    super("Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY.");
    this.name = "SupabaseNotConfiguredError";
  }
}

export function requireSupabaseBrowserClient(): SupabaseClient {
  const client = getSupabaseBrowserClient();
  if (!client) throw new SupabaseNotConfiguredError();
  return client;
}
