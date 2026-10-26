#!/usr/bin/env python3
"""
Build the pilot adoption report from a payload of live timesheet figures.

    psql/mcp -f query.sql   ->  payload.json
    python3 render.py < payload.json > report.html

The payload is whatever query.sql returns: one JSON object with `snapshot`,
`week`, `people` and `daily`. Nothing here talks to the database, so the script
carries no credentials and can run anywhere; the caller supplies the numbers.

Every figure on the page is derived here rather than written by hand, so a
scheduled run produces the same page as a manual one.
"""
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))

# Teams in the order they are shown: busiest first, so the page opens on the
# teams that have taken to it and ends on the one that has not.
ORDER = ["Ramy Kamel", "Emad Mutter", "Marina", "Nadia"]

MONTHS = {"01": "Jan", "02": "Feb", "03": "Mar", "04": "Apr", "05": "May", "06": "Jun",
          "07": "Jul", "08": "Aug", "09": "Sep", "10": "Oct", "11": "Nov", "12": "Dec"}


def day_label(iso):
    """2026-10-21 -> '21 Oct'."""
    return "%d %s" % (int(iso[8:10]), MONTHS.get(iso[5:7], ""))


def pct(a, b):
    return round(100 * a / b) if b else 0


def chart(daily, fixed_on=None):
    """The adoption curve: one point per calendar day, weekends banded."""
    W, H, ML, MR, MT, MB = 980, 300, 46, 14, 18, 46
    n = len(daily)
    if n < 2:
        return "<p>Not enough days yet to draw a curve.</p>"

    peak = max(d["people"] for d in daily)
    ymax = max(4, -(-(peak + 1) // 4) * 4)          # round up to a multiple of 4
    step = ymax // 4

    def X(i):
        return ML + i * (W - ML - MR) / (n - 1)

    def Y(v):
        return MT + (H - MT - MB) * (1 - v / ymax)

    pts = [(X(i), Y(d["people"])) for i, d in enumerate(daily)]
    line = "M" + " L".join("%.1f,%.1f" % p for p in pts)
    area = line + " L%.1f,%.1f L%.1f,%.1f Z" % (pts[-1][0], Y(0), pts[0][0], Y(0))
    half = (W - ML - MR) / (n - 1) / 2

    bands, i = [], 0
    while i < n:
        if not daily[i]["work"]:
            j = i
            while j + 1 < n and not daily[j + 1]["work"]:
                j += 1
            x0, x1 = max(ML, X(i) - half), min(W - MR, X(j) + half)
            bands.append('<rect x="%.1f" y="%d" width="%.1f" height="%d" fill="var(--weekend)"/>'
                         % (x0, MT, x1 - x0, H - MT - MB))
            i = j + 1
        else:
            i += 1

    grid, ylab = [], []
    for v in range(0, ymax + 1, step):
        grid.append('<line x1="%d" y1="%.1f" x2="%d" y2="%.1f" stroke="var(--grid)" stroke-width="1"/>'
                    % (ML, Y(v), W - MR, Y(v)))
        ylab.append('<text x="%d" y="%.1f" text-anchor="end" class="ax">%d</text>'
                    % (ML - 10, Y(v) + 4, v))

    # Label roughly every fourth day, and never so close to the right edge that
    # the last two labels collide.
    xlab = []
    stride = max(1, round(n / 7))
    for i, d in enumerate(daily):
        if i % stride == 0 and i <= n - 1 - stride // 2:
            xlab.append('<text x="%.1f" y="%d" text-anchor="middle" class="ax">%s</text>'
                        % (X(i), H - MB + 20, day_label(d["date"])))

    dots, hot = [], []
    for i, d in enumerate(daily):
        last = i == n - 1
        dots.append('<circle cx="%.1f" cy="%.1f" r="%s" fill="%s" stroke="var(--accent)" stroke-width="2"/>'
                    % (X(i), Y(d["people"]), "4.5" if last else "2.6",
                       "var(--accent)" if last else "var(--surface)"))
        hot.append('<rect class="hot" x="%.1f" y="%d" width="%.1f" height="%d" fill="transparent" '
                   'data-d="%s" data-dow="%s" data-n="%d" data-h="%s" data-w="%d"/>'
                   % (X(i) - half, MT, half * 2, H - MT - MB, d["date"], d["dow"],
                      d["people"], ("%g" % float(d["hours"])), 1 if d["work"] else 0))

    marker = ""
    if fixed_on:
        idx = next((i for i, d in enumerate(daily) if d["date"] == fixed_on), None)
        if idx is not None:
            marker = ('<line x1="%.1f" y1="%d" x2="%.1f" y2="%d" stroke="var(--marker)" '
                      'stroke-width="1.5" stroke-dasharray="3 3"/>'
                      '<text x="%.1f" y="%d" class="ax mk">%s · save bug fixed</text>'
                      % (X(idx), MT, X(idx), H - MB, X(idx) + 6, MT + 13, day_label(fixed_on)))

    return ('<svg viewBox="0 0 %d %d" width="100%%" role="img" aria-label="People logging time each day.">'
            '%s%s<path d="%s" fill="var(--accent-fill)"/>'
            '<path d="%s" fill="none" stroke="var(--accent)" stroke-width="2" '
            'stroke-linejoin="round" stroke-linecap="round"/>%s%s%s%s%s</svg>'
            % (W, H, "".join(bands), "".join(grid), area, line, marker,
               "".join(dots), "".join(ylab), "".join(xlab), "".join(hot)))


def build(payload, template):
    people = payload["people"]
    daily = payload["daily"]
    week = payload["week"]
    cap = 8 * int(week["days"])

    for p in people:
        p["hours"] = float(p["hours"] or 0)
        p["wk_hours"] = float(p["wk_hours"] or 0)
        p["draft_hours"] = float(p["draft_hours"] or 0)
        p["util"] = pct(p["wk_hours"], cap)

    cohort = len(people)
    signed = sum(1 for p in people if p["signed_in"])
    logged = sum(1 for p in people if p["days"] > 0)
    active = sum(1 for p in people if p["week_days"] > 0)
    hours = sum(p["hours"] for p in people)
    draft_h = sum(p["draft_hours"] for p in people)
    draft_r = sum(p["draft_rows"] for p in people)

    teams = {}
    for p in people:
        t = teams.setdefault(p["team"], dict(n=0, si=0, log=0, wk=0, h=0.0,
                                             days=0, draft=0.0, wkh=0.0, rows=[]))
        t["n"] += 1
        t["si"] += bool(p["signed_in"])
        t["log"] += p["days"] > 0
        t["wk"] += p["week_days"] > 0
        t["h"] += p["hours"]
        t["days"] += p["days"]
        t["draft"] += p["draft_hours"]
        t["wkh"] += p["wk_hours"]
        t["rows"].append(p)

    order = [k for k in ORDER if k in teams] + [k for k in sorted(teams) if k not in ORDER]

    cards = []
    for k in order:
        t = teams[k]
        share = pct(t["wk"], t["n"])
        tone = "good" if share >= 80 else ("warn" if share >= 40 else "bad")
        unsent = ('<div class="flag"><dt>Unsubmitted</dt><dd>%s h</dd></div>'
                  % format(t["draft"], ",.1f")) if t["draft"] else ""
        cards.append(
            '<article class="team"><header><h3>%s</h3><span class="pill %s">%d%% active</span></header>'
            '<div class="bar"><span style="width:%d%%"></span></div><dl>'
            '<div><dt>Logging this week</dt><dd><b>%d</b> of %d</dd></div>'
            '<div><dt>Days logged</dt><dd>%d</dd></div>'
            '<div><dt>Hours</dt><dd>%s</dd></div>'
            '<div><dt>Utilisation this week</dt><dd><b>%d%%</b></dd></div>'
            '%s</dl></article>'
            % (k, tone, share, share, t["wk"], t["n"], t["days"],
               format(t["h"], ",.1f"), pct(t["wkh"], cap * t["n"]), unsent))

    rows = []
    for k in order:
        for p in sorted(teams[k]["rows"], key=lambda r: (r["seat"] != "Lead", -r["days"], r["name"])):
            if not p["signed_in"]:
                status, cls = "Never signed in", "bad"
            elif p["days"] == 0:
                status, cls = "Signed in, nothing logged", "bad"
            elif p["week_days"] == 0:
                status, cls = "Stopped", "warn"
            else:
                status, cls = "Active", "good"
            u = p["util"]
            utone = ("u-good" if u >= 90 else "u-mid" if u >= 60 else "u-low" if u > 0 else "u-zero")
            parts = p["name"].split()
            short = p["name"] if len(parts) <= 3 else " ".join(parts[:2])
            rows.append(
                '<tr><td class="nm">%s%s</td><td class="tm">%s</td>'
                '<td class="num">%s</td><td class="num">%s</td><td class="num">%s</td>'
                '<td class="num%s">%s</td><td class="num">%s</td>'
                '<td class="num util %s">%d%%</td><td><span class="pill %s">%s</span></td></tr>'
                % (short, '<span class="lead">Lead</span>' if p["seat"] == "Lead" else "",
                   p["team"], p["days"] or "—", format(p["hours"], ",.2f"),
                   p["week_days"] or "—",
                   " flagn" if p["draft_hours"] else "",
                   format(p["draft_hours"], ",.1f") if p["draft_hours"] else "—",
                   day_label(p["last"]) if p["last"] else "—",
                   utone, u, cls, status))

    today = daily[-1]
    days = int(week["days"])
    # A one-day window should read "25 Oct", not "25 Oct - 25 Oct".
    if week["start"] == week["end"]:
        week["label"] = day_label(week["start"])
    over = any(p["util"] > 100 for p in people)

    # Early in the week the window is one or two days long, so a low utilisation
    # figure is mostly reporting lag: Sunday's hours are typed in on Monday. Say
    # so on the page, rather than leaving a management reader to work it out.
    caveat = ""
    if days <= 2:
        caveat = (
            '\n  <section><div class="callout"><h3>Utilisation here covers %s only</h3>'
            '<p>The week has %d finished working day%s so far, so the denominator is %d hours '
            'per person instead of a full 40, and anyone who has not yet typed up %s reads as '
            'zero. Early-week utilisation tracks how fast people write time up, not how much '
            'they worked \u2014 the figure is worth reading from Tuesday on.</p></div></section>'
            % (week["label"], days, "" if days == 1 else "s", cap,
               day_label(week["end"]) if days == 1 else "those days"))

    todaynote = (
        '<p><b>Today is still running.</b> %s is a %s, so its point on the curve will keep '
        'climbing.</p>' % (day_label(today["date"]),
                           "working day in progress" if today["work"] else "weekend day"))

    swap = {
        "{{SNAP}}": payload["snapshot"],
        "{{COHORT}}": str(cohort),
        "{{SIGNED}}": str(signed),
        "{{LOGGED}}": str(logged),
        "{{ACTIVE}}": str(active),
        "{{ACTIVEPCT}}": str(pct(active, cohort)),
        "{{LOGGEDPCT}}": str(pct(logged, cohort)),
        "{{HOURS}}": format(hours, ",.0f"),
        "{{DRAFTH}}": format(draft_h, ",.0f"),
        "{{DRAFTR}}": str(draft_r),
        "{{UTIL}}": str(pct(sum(p["wk_hours"] for p in people), cap * cohort)),
        "{{WEEKLABEL}}": week["label"],
        "{{CAP}}": str(cap),
        "{{WDAYS}}": str(days),
        "{{WDAYSS}}": "" if days == 1 else "s",
        "{{CAVEAT}}": caveat,
        "{{TODAYNOTE}}": todaynote,
        "{{OVERNOTE}}": (" Anyone over 100% logged more than eight hours on some of them."
                         if over else ""),
        "{{NEVER}}": str(cohort - signed),
        "{{CHART}}": chart(daily, fixed_on="2026-10-14"),
        "{{CARDS}}": "\n".join(cards),
        "{{ROWS}}": "\n".join(rows),
    }
    out = template
    for k, v in swap.items():
        out = out.replace(k, v)
    if "{{" in out:
        raise SystemExit("unreplaced placeholder in template: %s" % out[out.index("{{"):][:40])

    headline = dict(cohort=cohort, signed=signed, logged=logged, active=active,
                    util=pct(sum(p["wk_hours"] for p in people), cap * cohort),
                    hours=round(hours, 2), draft_hours=round(draft_h, 2),
                    week=week["label"], week_days=days, cap=cap,
                    snapshot=payload["snapshot"],
                    teams={k: dict(active=teams[k]["wk"], of=teams[k]["n"],
                                   util=pct(teams[k]["wkh"], cap * teams[k]["n"]))
                           for k in order})
    return out, headline


def main():
    payload = json.load(sys.stdin)
    with open(os.path.join(HERE, "template.html"), encoding="utf-8") as fh:
        template = fh.read()
    html, headline = build(payload, template)
    sys.stdout.write(html)
    # The caller writes the email from this, so it never has to re-read the page.
    with open(os.path.join(os.getcwd(), "headline.json"), "w", encoding="utf-8") as fh:
        json.dump(headline, fh, indent=1)


if __name__ == "__main__":
    main()
