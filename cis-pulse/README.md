# KSA Festival '26 Social Pulse

A live social listening dashboard for Creative Industry Summit KSA Festival '26
(3–5 October 2026, JAX District, Riyadh). It reads the Talkwalker export directly in
the browser, so there is no server, no database and no build step. Hosting is free.

## What it shows

| Section | What it answers |
|---|---|
| Headline numbers | Conversations, last full hour vs the hour before, net sentiment, engagement, potential reach, unique voices |
| Conversation volume by hour | Line area chart in Riyadh time. Session hours are shaded and the peak hour is labelled. Switch to a sentiment split |
| Sentiment, Sentiment by day | Overall share and how it moves day to day |
| Most discussed speakers | Top 10 speakers, split by sentiment |
| Most discussed talks & workshops | Top 10 sessions, split by sentiment |
| Hashtag cloud, Top hashtags | Official hashtags are highlighted |
| Channel mix | X, Instagram, TikTok, LinkedIn, news & web and others |
| When people post | Day × hour heatmap |
| Top voices | Authors ranked by engagement |
| Conversation feed | Latest or most engaging posts, with links |

Filters: Build-up / Day 1 / Day 2 / Day 3 / Last 24h, and channel.
The page checks for new data every 5 minutes. It flags data that is more than 2 hours old during the festival.

## Hourly update (about 2 minutes, no code)

1. In Talkwalker, run the saved export template (see *Export template* below) for
   the full period, from the start of the build-up to now. Download it as CSV or XLSX.
2. Optional check: open the dashboard, drop the file on **Preview a Talkwalker
   export** and confirm the numbers look right. The preview stays in your browser.
3. On GitHub, open `cis-pulse/data/`, choose **Add file → Upload files**, drop the
   file named `mentions.csv`, and commit. It replaces the previous file.
4. The host redeploys in about a minute. The dashboard picks up the new data on its
   next check, and the "Data through" time in the header moves forward.

## Export template (set up once in Talkwalker)

- Project timezone: **Riyadh (UTC+3)**. If you can't change it, set
  `sourceUtcOffsetHours` in `config.js` to match.
- Columns: Published date, Title, Content, URL, Author name, Media type, Sentiment,
  Engagement, Reach, Language, Country. Column names can vary; the page matches
  Talkwalker's usual names in CSV, Excel and API exports.
- The bottom of the dashboard lists which columns it used and names any that are missing.

## Editing speakers, sessions and hashtags

Everything lives in `config.js`: official hashtags, the speaker list with English and
Arabic spellings and handles, and each session's keywords. Matching ignores case and
Arabic diacritics, and treats hamza, alef, yaa and taa marbuta variants as the same letter.
To hide the post feed or the author table on a public screen, set
`show: { feed: false, topVoices: false }`.

## Hosting for free

The folder is a plain static site. Any of these work at no cost:

- **Cloudflare Pages** (recommended): connect the GitHub repo, set the root
  directory to `cis-pulse`, leave the build command empty. Private repos are
  supported and commercial use is allowed on the free plan.
- **GitHub Pages**: free for public repositories.
- **Netlify** free plan: drag the `cis-pulse` folder onto app.netlify.com/drop.
  Each hourly update then means dragging the folder again.

To run it locally: `python3 -m http.server` inside `cis-pulse/`, then open
http://localhost:8000. Opening `index.html` directly from disk will not load data,
because browsers block file reads from `file://` pages.

## Libraries

ECharts 5.5, echarts-wordcloud 2.1, PapaParse 5.4. SheetJS loads only when an XLSX
file is used. All are loaded from public CDNs, so there is nothing to install.
