/**
 * Minimal Google Sheets client.
 *
 * Deliberately not the `googleapis` package: this needs two API calls, and
 * that dependency is tens of megabytes. Authentication is a signed JWT
 * exchanged for an access token, using Web Crypto so it runs on any runtime
 * the app might be deployed to.
 *
 * The `.server.ts` suffix keeps this out of the browser bundle -- the private
 * key it handles must never be shipped to a client.
 */

const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const SHEETS_API = "https://sheets.googleapis.com/v4/spreadsheets";
const SCOPE = "https://www.googleapis.com/auth/spreadsheets";

export interface SheetsCredentials {
  clientEmail: string;
  privateKey: string;
  spreadsheetId: string;
  /** Which tab to append to. Any existing workbook can be targeted by
   *  pointing this at a tab of its own; other tabs are never touched. */
  tabName: string;
}

/** Reads credentials from the environment, or null when the export is off. */
export function readSheetsCredentials(): SheetsCredentials | null {
  const clientEmail = process.env["GOOGLE_SERVICE_ACCOUNT_EMAIL"];
  const spreadsheetId = process.env["GOOGLE_SHEETS_SPREADSHEET_ID"];
  const rawKey = process.env["GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY"];

  if (!clientEmail || !spreadsheetId || !rawKey) return null;

  return {
    clientEmail,
    spreadsheetId,
    tabName: process.env["GOOGLE_SHEETS_TAB_NAME"] || "Timesheet_Entries",
    // Environment variables cannot hold real newlines, so they are written
    // escaped and restored here.
    privateKey: rawKey.replace(/\\n/g, "\n"),
  };
}

function base64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function encodeJson(value: unknown): string {
  return base64Url(new TextEncoder().encode(JSON.stringify(value)));
}

/** Converts a PEM private key into a CryptoKey for RS256 signing. */
async function importPrivateKey(pem: string): Promise<CryptoKey> {
  const body = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s+/g, "");
  const der = Uint8Array.from(atob(body), (char) => char.charCodeAt(0));

  return crypto.subtle.importKey(
    "pkcs8",
    der,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
}

async function getAccessToken(credentials: SheetsCredentials): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const claims = {
    iss: credentials.clientEmail,
    scope: SCOPE,
    aud: TOKEN_ENDPOINT,
    iat: now,
    exp: now + 3600,
  };

  const unsigned = `${encodeJson({ alg: "RS256", typ: "JWT" })}.${encodeJson(claims)}`;
  const key = await importPrivateKey(credentials.privateKey);
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(unsigned),
  );

  const response = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${unsigned}.${base64Url(new Uint8Array(signature))}`,
    }),
  });

  if (!response.ok) {
    // The body can echo parts of the assertion, so it is not logged.
    throw new Error(`Google token request failed with status ${response.status}`);
  }

  const payload = (await response.json()) as { access_token?: string };
  if (!payload.access_token) throw new Error("Google token response contained no access token");
  return payload.access_token;
}

/** Appends rows to a tab, creating nothing and overwriting nothing. */
export async function appendRows(
  credentials: SheetsCredentials,
  tab: string,
  rows: string[][],
): Promise<number> {
  if (rows.length === 0) return 0;

  const token = await getAccessToken(credentials);
  const range = encodeURIComponent(`${tab}!A1`);
  const url =
    `${SHEETS_API}/${credentials.spreadsheetId}/values/${range}:append` +
    // RAW stops Sheets re-interpreting the escaped values we carefully quoted.
    `?valueInputOption=RAW&insertDataOption=INSERT_ROWS`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ values: rows }),
  });

  if (!response.ok) {
    throw new Error(`Google Sheets append failed with status ${response.status}`);
  }

  return rows.length;
}
