# Workflow audit: KSA Festival '26 Social Pulse

**Scope:** the hourly process from Talkwalker to the live dashboard, 27 Sep – 6 Oct 2026.
**Constraint:** no extra cost.

## 1. The workflow as proposed

```
Talkwalker ──export──▶ Analyst ──sends file──▶ Claude ──edits site──▶ Git push ──▶ Host redeploys ──▶ Viewers
   (hourly)                                    (hourly)
```

About 70 cycles over the three festival days (more if the build-up runs hourly).
Every cycle has two people or agents in series, and nobody owns the overnight hours.

## 2. Findings

| # | Finding | Impact | Severity |
|---|---|---|---|
| 1 | **Claude sits in the hourly loop.** Each update waits for a session to process the file. This adds latency and a single point of failure, and uses session quota for work with no judgement in it. | A missed or slow hour shows on a live screen | High |
| 2 | **No named owner per shift.** "Hourly" is not assigned to a person for each hour, especially 23:00–09:00 and during sessions, when the team is on the floor. | Gaps exactly when the conversation peaks | High |
| 3 | **Export not standardised.** Column sets, timezone and date formats change if each person exports by hand. | Wrong hours on the chart, missing sentiment or reach | High |
| 4 | **Talkwalker export size caps.** A cumulative export can reach the row limit on Day 2 or 3. | Silent loss of older posts, so totals drop | Medium |
| 5 | **Sentiment accuracy in Arabic and Saudi dialect.** Automated sentiment misreads sarcasm and dialect. The public dashboard shows it without review. | Misleading net sentiment. Reputational risk if a negative spike is wrong, or real and missed | Medium |
| 6 | **Speaker and session matching depends on keywords.** The Arabic spellings in `config.js` for English-listed speakers are transliterations that need checking. Common names (e.g. "Ahmed Hussein") will over-count. Handles are missing. | Wrong ranking in "Most discussed speakers" | Medium |
| 7 | **Official hashtags not confirmed.** `#KSAFestival26`, `#CIS26`, `#CreativeIndustrySummit` and `#قمة_الإبداع` are assumptions. | Wrong highlight and missed tracking | Medium |
| 8 | **Public display of individual posts and usernames** with no approval step. | Client and privacy exposure, e.g. a complaint shown on the big screen | Medium |
| 9 | **The site lives in the Kijamii Timesheets repository.** Hourly data commits would fill that app's history, which syncs to Lovable. | Noise and risk for an unrelated production app | Medium |
| 10 | **No escalation path.** Nobody is told to act when negative conversation spikes. | Insight without action | Medium |

## 3. Recommended workflow (zero cost)

```
Talkwalker saved export ──▶ Shift owner uploads mentions.csv on GitHub ──▶ Cloudflare Pages redeploys ──▶ Dashboard refreshes itself
                               (2 min, no code)                               (~1 min)                      (every 5 min)
                                        │
                                        └──▶ QA: spot-check 10 posts' sentiment, 3×/day
Claude: only for changes to config, layout or the daily insight summary
```

### What changed and why

| Action | Type | Addresses |
|---|---|---|
| The dashboard parses the raw Talkwalker file in the browser, so no conversion step is needed | **Automated** (built) | 1 |
| Analyst uploads directly on GitHub (Add file → Upload files) | **Eliminated** the relay through Claude | 1 |
| Saved Talkwalker export template, project timezone set to Riyadh | **Standardised** | 3 |
| Column check under "Preview a Talkwalker export" names any missing fields | **Built** | 3 |
| One export per day, listed in `data/index.json`; posts are de-duplicated by URL | **Documented and built** | 4 |
| "Data is over 2 hours old" badge in the header during the festival | **Built** | 2 |
| `show.feed` / `show.topVoices` switches for the public screen | **Built** | 8 |
| Move `cis-pulse/` to its own repository before 3 Oct | **To do** (5 min) | 9 |

## 4. Operating cadence and ownership

| Window | Cadence | Owner (R) | Backup |
|---|---|---|---|
| Build-up, 27 Sep – 2 Oct | Every 3 hours, 09:00–00:00 | Analyst A | Analyst B |
| Festival days, 09:00–17:00 | Hourly | Analyst A | Analyst B |
| Festival days, 17:00–23:00 (sessions, peak) | Hourly; upload by :10 past | Analyst B (off-floor) | Analyst A |
| 23:00–09:00 | One catch-up upload at 09:00 | Morning shift | — |
| Wrap-up, 6 Oct | Final full export and a frozen snapshot | Analyst A | — |

**RACI:**

| Task | Responsible | Accountable | Consulted | Informed |
|---|---|---|---|---|
| Upload | Shift analyst | Account lead | — | — |
| Config (speakers, hashtags) | Analyst | Account lead | Organiser | — |
| Sentiment QA | Analyst | Account lead | — | — |
| Public-screen approval | Account lead | Client | — | Organiser |

## 5. Leading indicators and escalation

Watch these on the dashboard every hour:

- **Last full hour ▲ over 100%** outside session hours: something is trending. Read the feed.
- **Net sentiment falls 15+ points** in the Day filter compared with the previous day.
- **A negative bar dominates** a speaker or session in the ranked charts.
- **"Data is over 2 hours old"** badge: an upload was missed.

Escalation: the shift analyst checks 10 posts. If the issue is real, message the account
lead within 15 minutes with the screenshot, the top 3 posts and a suggested response.
The account lead decides whether to tell the organiser's comms team.

## 6. Actions before 3 October

| # | Action | Owner | Due | Effort |
|---|---|---|---|---|
| 1 | Confirm official hashtags and speakers' social handles with the organiser; update `config.js` | Account lead | 29 Sep | 30 min |
| 2 | Have an Arabic speaker check the Arabic name spellings in `config.js` | Analyst | 29 Sep | 30 min |
| 3 | Create the Talkwalker export template and set the project timezone to Riyadh | Analyst | 28 Sep | 20 min |
| 4 | Move `cis-pulse/` to a dedicated repository and connect Cloudflare Pages | Account lead or dev | 28 Sep | 15 min |
| 5 | Dry run: 3 uploads by different people; confirm the timestamps in the header | Both analysts | 30 Sep | 30 min |
| 6 | Get client sign-off on showing the feed and top voices on public screens | Account lead | 1 Oct | — |
| 7 | Publish the shift rota (section 4) | Account lead | 1 Oct | 10 min |

## 7. Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| Talkwalker login shared or unavailable during a shift | Medium | Two named analysts with access. Backup export saved to the shared drive |
| Free-plan limits on the host | Low | Cloudflare Pages free plan: 500 builds a month; the plan above needs about 100 |
| CDN outage for chart libraries | Low | Libraries come from two CDNs (cdnjs and jsDelivr). If needed, copy them into `assets/` |
| A negative post shown on the venue screen | Medium | `show.feed: false` on the public screen, full view for the internal team |

## 8. Optional next step, only if already licensed

If Kijamii's Talkwalker contract **already includes API access**, a scheduled GitHub
Action can pull the data hourly and commit `mentions.csv`. The page needs no changes.
This removes finding 2 entirely and costs nothing on a public repository or within
GitHub's free Actions minutes. Check the contract before building it. Do not buy API access for this.
