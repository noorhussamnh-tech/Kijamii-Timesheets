// Hourly Talkwalker counts for the dashboard's live strip.
// Uses the Histogram API (10 credits per call). Writes data/live.json.
// The token comes from the TALKWALKER_TOKEN secret and is never printed.
import { writeFileSync, mkdirSync } from "node:fs";

const TOKEN = process.env.TALKWALKER_TOKEN;
const PROJECT = process.env.TW_PROJECT;
const TOPIC = process.env.TW_TOPIC;
const DAYS_BACK = Number(process.env.TW_DAYS_BACK || 14);

if (!TOKEN) {
  console.log("No TALKWALKER_TOKEN secret yet: skipping the live counts.");
  process.exit(0);
}

const max = Date.now();
const min = max - DAYS_BACK * 24 * 3600e3;

async function histogram(breakdown) {
  const q = new URLSearchParams({
    access_token: TOKEN, timezone: "Asia/Riyadh", interval: "hour",
    min: String(min), max: String(max), breakdown, topic: TOPIC,
  });
  const res = await fetch(`https://api.talkwalker.com/api/v1/search/p/${PROJECT}/histogram/published?${q}`);
  const body = await res.json().catch(() => ({}));
  if (!res.ok || String(body.status_code) !== "0") {
    throw new Error(`Talkwalker ${breakdown}: HTTP ${res.status}, ${body.status_code} ${body.status_message || ""}`);
  }
  return body.result_histogram || {};
}

try {
  const sent = await histogram("sentiment");
  const src = await histogram("sourcetype");
  const out = {
    updated: new Date().toISOString(),
    note: "All matches for the Talkwalker topic, before the dashboard's cleaning.",
    sentiment: { header: sent.header || sent.headers || null, data: sent.data || [] },
    sources: { header: src.header || src.headers || null, data: src.data || [] },
  };
  mkdirSync("data", { recursive: true });
  writeFileSync("data/live.json", JSON.stringify(out));
  const total = out.sentiment.data.reduce((a, d) => a + (Array.isArray(d.v) ? d.v.reduce((x, y) => x + y, 0) : Number(d.v || 0)), 0);
  console.log(`Live counts written: ${out.sentiment.data.length} hours, ${total} matches.`);
  console.log("Response keys:", Object.keys(sent).join(", "), "| header:", JSON.stringify(out.sentiment.header));
} catch (e) {
  // Keep the site publishing even if Talkwalker fails; the page shows the last good time.
  console.log("::warning::" + e.message);
}
