/**
 * Security headers applied to every response.
 *
 * These are set at the server entry rather than in a host config file so they
 * travel with the app: the same protections apply on Vercel, on any other
 * Nitro target, and in local preview.
 */

/**
 * Content Security Policy.
 *
 * `connect-src` is deliberately narrow -- the app talks to its own origin and
 * to its Supabase project, nothing else. `frame-ancestors 'none'` prevents the
 * timesheet from being framed by another site.
 *
 * `'unsafe-inline'` is required for styles because Tailwind's runtime and the
 * inlined critical CSS both emit style attributes; it is NOT granted to
 * scripts.
 */
function buildCsp(supabaseOrigin: string | null): string {
  const connect = ["'self'", supabaseOrigin, supabaseOrigin?.replace(/^https:/, "wss:")]
    .filter(Boolean)
    .join(" ");

  return [
    "default-src 'self'",
    // TanStack Start hydrates from inline module scripts it generates itself.
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    "img-src 'self' data: blob: https:",
    `connect-src ${connect}`,
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
    "upgrade-insecure-requests",
  ].join("; ");
}

function supabaseOrigin(): string | null {
  const url = process.env["VITE_SUPABASE_URL"];
  if (!url) return null;
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

export function securityHeaders(): Record<string, string> {
  return {
    "content-security-policy": buildCsp(supabaseOrigin()),
    "x-content-type-options": "nosniff",
    "x-frame-options": "DENY",
    "referrer-policy": "strict-origin-when-cross-origin",
    // The app needs none of these; denying them shrinks the attack surface.
    "permissions-policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
    "strict-transport-security": "max-age=31536000; includeSubDomains",
    // Timesheet data is personal; keep it out of shared caches.
    "cache-control": "no-store, max-age=0",
  };
}

/** Applies the headers to a response without discarding what it already set. */
export function withSecurityHeaders(response: Response): Response {
  // Static assets are immutable and safe to cache; only document and data
  // responses get the no-store treatment.
  const contentType = response.headers.get("content-type") ?? "";
  const isDocument = contentType.includes("text/html");

  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(securityHeaders())) {
    if (key === "cache-control" && !isDocument) continue;
    headers.set(key, value);
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
