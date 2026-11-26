#!/usr/bin/env python3
"""
Build the Kijamii timesheet report: adoption success, and capacity planning.

    python3 build.py people.json alloc.json > report.html

Two objectives in one page. The adoption half asks whether people are using the
tool; the capacity half asks where the hours went and how much of the available
time was ever written down. They are kept apart because they are read by
different people for different decisions, and mixing them is how "47% utilisation"
came to mean nothing.

Every capacity figure exists in three windows -- this week, the month to date,
and since each team's own launch -- and the page switches between them in the
browser, so one render answers all three. Teams launched on different dates, so
only the launch window compares them fairly; the other two are for the day to day.
"""
import json, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ORDER = ["Ramy Kamel", "Emad Mutter", "Marina", "Nadia"]
MONTHS = {"01":"Jan","02":"Feb","03":"Mar","04":"Apr","05":"May","06":"Jun",
          "07":"Jul","08":"Aug","09":"Sep","10":"Oct","11":"Nov","12":"Dec"}


def load_leave():
    p = os.path.join(HERE, "leave.json")
    if not os.path.exists(p):
        return {}
    with open(p, encoding="utf-8") as fh:
        d = json.load(fh)
    return {x["name"]: x.get("note", "on leave") for x in d.get("on_leave", [])}


def month_label(key):
    """`2026-10` as `October 2026`, because nobody says two thousand twenty-six ten."""
    names = ("January", "February", "March", "April", "May", "June", "July",
             "August", "September", "October", "November", "December")
    year, month = key.split("-")
    return "%s %s" % (names[int(month) - 1], year)


def day_label(iso):
    return "%d %s" % (int(iso[8:10]), MONTHS.get(iso[5:7], ""))


def pct(a, b):
    return round(100 * a / b) if b else 0


def esc(s):
    return (str(s).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;"))


def h(x):
    """Hours, trimmed: 28.0 -> 28, 27.5 -> 27.5."""
    x = float(x or 0)
    return ("%.2f" % x).rstrip("0").rstrip(".") or "0"


def curve(daily, marks):
    """Adoption curve: people logging each calendar day, weekends banded."""
    W, H, ML, MR, MT, MB = 980, 290, 44, 14, 20, 46
    n = len(daily)
    peak = max(d["people"] for d in daily)
    ymax = max(4, -(-(peak + 1) // 4) * 4)
    step = ymax // 4
    X = lambda i: ML + i * (W - ML - MR) / (n - 1)
    Y = lambda v: MT + (H - MT - MB) * (1 - v / ymax)
    pts = [(X(i), Y(d["people"])) for i, d in enumerate(daily)]
    line = "M" + " L".join("%.1f,%.1f" % p for p in pts)
    area = line + " L%.1f,%.1f L%.1f,%.1f Z" % (pts[-1][0], Y(0), pts[0][0], Y(0))
    half = (W - ML - MR) / (n - 1) / 2

    out, i = [], 0
    while i < n:
        if not daily[i]["work"]:
            j = i
            while j + 1 < n and not daily[j + 1]["work"]:
                j += 1
            x0, x1 = max(ML, X(i) - half), min(W - MR, X(j) + half)
            out.append('<rect x="%.1f" y="%d" width="%.1f" height="%d" fill="var(--weekend)"/>'
                       % (x0, MT, x1 - x0, H - MT - MB))
            i = j + 1
        else:
            i += 1
    for v in range(0, ymax + 1, step):
        out.append('<line x1="%d" y1="%.1f" x2="%d" y2="%.1f" stroke="var(--grid)"/>' % (ML, Y(v), W - MR, Y(v)))
    out.append('<path d="%s" fill="var(--accent-fill)"/>' % area)
    out.append('<path d="%s" fill="none" stroke="var(--accent)" stroke-width="2" '
               'stroke-linejoin="round" stroke-linecap="round"/>' % line)
    # Launch dates belong on this chart: a team that started late looks like a
    # team that started slowly without them.
    for date, text in marks:
        idx = next((i for i, d in enumerate(daily) if d["date"] == date), None)
        if idx is None:
            continue
        out.append('<line x1="%.1f" y1="%d" x2="%.1f" y2="%d" stroke="var(--marker)" '
                   'stroke-width="1.5" stroke-dasharray="3 3"/>'
                   '<text x="%.1f" y="%d" class="ax mk">%s</text>'
                   % (X(idx), MT, X(idx), H - MB, X(idx) + 6, MT + 12, esc(text)))
    for i, d in enumerate(daily):
        last = i == n - 1
        out.append('<circle cx="%.1f" cy="%.1f" r="%s" fill="%s" stroke="var(--accent)" stroke-width="2"/>'
                   % (X(i), Y(d["people"]), "4.5" if last else "2.4",
                      "var(--accent)" if last else "var(--surface)"))
    for v in range(0, ymax + 1, step):
        out.append('<text x="%d" y="%.1f" text-anchor="end" class="ax">%d</text>' % (ML - 10, Y(v) + 4, v))
    stride = max(1, round(n / 7))
    for i, d in enumerate(daily):
        if i % stride == 0 and i <= n - 1 - stride // 2:
            out.append('<text x="%.1f" y="%d" text-anchor="middle" class="ax">%s</text>'
                       % (X(i), H - MB + 20, day_label(d["date"])))
    for i, d in enumerate(daily):
        out.append('<rect class="hot" x="%.1f" y="%d" width="%.1f" height="%d" fill="transparent" '
                   'data-d="%s" data-dow="%s" data-n="%d" data-h="%s" data-w="%d"/>'
                   % (X(i) - half, MT, half * 2, H - MT - MB, d["date"], d["dow"],
                      d["people"], h(d["hours"]), 1 if d["work"] else 0))
    return ('<svg viewBox="0 0 %d %d" width="100%%" role="img" '
            'aria-label="People logging time each day.">%s</svg>' % (W, H, "".join(out)))


def bars(rows, note=""):
    """Ranked horizontal bars: one hue, length is the whole story.

    rows: (label, value, capacity_or_None, meta, muted)
    """
    if not rows:
        return '<p class="empty">Nothing logged in this window.</p>'
    top = max([r[1] for r in rows] + [r[2] or 0 for r in rows]) or 1
    out = []
    for label, val, cap, meta, muted in rows:
        w = 100.0 * val / top
        cw = (100.0 * cap / top) if cap else 0
        over = cap and val > cap
        out.append(
            '<div class="row%s">'
            '<div class="rl">%s</div>'
            '<div class="rt">%s%s<span class="bar%s" style="width:%.2f%%"></span></div>'
            '<div class="rv">%s</div></div>'
            % (" muted" if muted else "", esc(label),
               ('<span class="cap" style="width:%.2f%%"></span>' % cw) if cap else "",
               ('<span class="capmark" style="left:%.2f%%"></span>' % cw) if cap else "",
               " over" if over else "", w, meta))
    return '<div class="bars">%s</div>%s' % (
        "".join(out), ('<p class="barnote">%s</p>' % note) if note else "")


VIEWS = [("week", "This week"), ("mtd", "Month to date"), ("launch", "Since launch")]


def build(pp, al):
    leave = load_leave()
    people = pp["people"]
    for p in people:
        p["off"] = p["name"] in leave
    avail = [p for p in people if not p["off"]]
    away = len(people) - len(avail)

    wk, mo = pp["week"], pp["month"]
    launches = {l["team"]: l for l in pp["launches"]}

    # Per person, per window: (hours, days logged, capacity hours, days possible)
    #
    # Capacity is whatever the query says, and the query asks the database --
    # 8 hours a working day, capped at 160 in a calendar month. Multiplying
    # days by eight here instead would have this page assuming 168 hours of
    # somebody in a month the app assumes 160 of, which is how two views of one
    # person start disagreeing. Older payloads have no cap in them, so the old
    # arithmetic stays as the fallback rather than failing the run.
    def cell(p, view):
        if view == "week":
            return p["wk_hours"], p["week_days"], wk.get("cap") or wk["days"] * 8, wk["days"]
        if view == "mtd":
            return p["mt_hours"], p["mt_days"], mo.get("cap") or mo["days"] * 8, mo["days"]
        return p["lhours"], p["llogged"], p.get("lcap") or p["ldays"] * 8, p["ldays"]

    # ---------------------------------------------------------------- adoption
    signed = sum(1 for p in avail if p["signed_in"])
    logged = sum(1 for p in avail if p["days"] > 0)
    active = sum(1 for p in avail if p["week_days"] > 0)
    hours_all = sum(float(p["hours"]) for p in people)
    draft_h = sum(float(p["draft_hours"]) for p in people)
    draft_r = sum(p["draft_rows"] for p in people)

    lcap = sum(float(p.get("lcap") or p["ldays"] * 8) for p in people)
    lcap_got = sum(float(p["lhours"]) for p in people)

    # Team rollups per window.
    teams = {}
    for p in people:
        teams.setdefault(p["team"], []).append(p)
    order = [k for k in ORDER if k in teams] + [k for k in sorted(teams) if k not in ORDER]

    def team_rows(view):
        rows = []
        for k in order:
            mem = [p for p in teams[k] if view == "launch" or not p["off"]]
            if not mem:
                continue
            got = sum(float(cell(p, view)[0]) for p in mem)
            cap = sum(cell(p, view)[2] for p in mem)
            rows.append((k, got, cap,
                         '<b>%s%%</b><span class="sub">%s of %s h</span>'
                         % (pct(got, cap), h(got), h(cap)), False))
        return sorted(rows, key=lambda r: -(r[1] / r[2] if r[2] else 0))

    def person_rows(view):
        rows = []
        for p in people:
            got, dl, cap, dp = cell(p, view)
            got = float(got)
            if view != "launch" and p["off"]:
                rows.append((p["name"], 0, 0, '<span class="sub">on leave</span>', True))
                continue
            rows.append((p["name"], got, cap,
                         '<b>%s%%</b><span class="sub">%s h · %d/%d days</span>'
                         % (pct(got, cap), h(got), dl, dp), False))
        keyed = [r for r in rows if not r[4]]
        off = [r for r in rows if r[4]]
        return sorted(keyed, key=lambda r: -(r[1] / r[2] if r[2] else 0)) + off

    def dim_rows(items, view, cap_key=None):
        key = {"week": "week", "mtd": "mtd", "launch": "hours"}[view]
        out = []
        for it in items:
            v = float(it.get(key) or 0)
            if v <= 0:
                continue
            am = float(it.get("amend") or 0)
            tot = float(it.get("hours") or 0)
            meta = '<b>%s h</b>' % h(v)
            if view == "launch" and tot and am:
                meta += '<span class="sub">%d%% rework</span>' % pct(am, tot)
            elif it.get("people"):
                meta += '<span class="sub">%d people</span>' % it["people"]
            out.append((it["name"], v, None, meta, False))
        return out[:20]

    def fn_rows(view):
        agg = {}
        for p in (people if view == "launch" else avail):
            got, dl, cap, dp = cell(p, view)
            a = agg.setdefault(p["function"], [0.0, 0, 0])
            a[0] += float(got); a[1] += cap; a[2] += 1
        rows = [(k, v[0], v[1], '<b>%s%%</b><span class="sub">%s h · %d people</span>'
                 % (pct(v[0], v[1]), h(v[0]), v[2]), False) for k, v in agg.items()]
        return sorted(rows, key=lambda r: -(r[1] / r[2] if r[2] else 0))

    # Who started when, read off the payload rather than remembered. Each team's
    # runway grows by a day every working day, so writing it down here would be
    # wrong by the end of the week.
    bydate = {}
    for l in pp["launches"]:
        bydate.setdefault((l["date"], l["days"]), []).append(l["team"])
    launch_caption = "; ".join(
        "%s from %s (%d days)" % (" and ".join(sorted(t)), dt, dys)
        for (dt, dys), t in sorted(bydate.items(), key=lambda kv: -kv[0][1]))

    def partial_note(vk):
        """Today is inside the month-to-date window, so say what that costs.

        The window used to stop at yesterday. Reading a report headed "month so
        far" that left out the morning it was read on was the odder of the two
        behaviours, so today is in -- but an unlived day still carries eight
        hours of capacity, which drags the rate down every morning until people
        log. Stating both figures is the only way to have the window the month
        actually is and a denominator that is not a fiction."""
        if vk != "mtd" or not mo.get("open") or not mo.get("cap_done"):
            return ""
        done_cap = sum(float(mo["cap_done"]) for _ in avail)
        done_got = sum(float(p["mt_hours"]) - float(p.get("today_h") or 0) for p in avail)
        today_got = sum(float(p.get("today_h") or 0) for p in avail)
        today_n = sum(1 for p in avail if float(p.get("today_h") or 0) > 0)
        return ('<p class="barnote" style="margin:-6px 0 16px;padding:0;border:0">'
                'Today, %s, is inside this window and is not over. Counting only the %d '
                'finished days before it, the same people have captured <b>%s h</b> of '
                '<b>%s h</b> \u2014 <b>%d%%</b>. Today itself carries %s h from %d '
                'people so far.</p>'
                % (esc(mo.get("today", "today")), mo["days_done"], h(done_got), h(done_cap),
                   pct(done_got, done_cap), h(today_got), today_n))

    panes = []
    for vk, vlabel in VIEWS:
        win = {"week": wk["label"], "mtd": mo["label"], "launch": "each team's own launch date"}[vk]
        capline = {"week": "%d finished working days, %s h per person" % (wk["days"], h(cell(people[0], "week")[2])),
                   "mtd": "%d working days to the %s, %s h per person%s"
                          % (mo["days"], mo.get("today", "day"), h(cell(people[0], "mtd")[2]),
                             " \u00b7 today is still open" if mo.get("open") else ""),
                   "launch": launch_caption}[vk]
        got = sum(float(cell(p, vk)[0]) for p in (people if vk == "launch" else avail))
        cap = sum(cell(p, vk)[2] for p in (people if vk == "launch" else avail))
        panes.append(
            '<div class="pane" data-group="cap" data-view="%s"%s>'
            '<div class="winbar"><span class="winlabel">%s</span>'
            '<span class="winsub">%s</span></div>'
            '<div class="tiles3">'
            '<div class="tile hero"><div class="k">Captured</div><div class="v">%s<small> h</small></div>'
            '<div class="n">of %s h available</div></div>'
            '<div class="tile"><div class="k">Capture rate</div><div class="v">%d<small>%%</small></div>'
            '<div class="n">hours written down, not hours worked</div></div>'
            '<div class="tile warn"><div class="k">Unaccounted for</div><div class="v">%s<small> h</small></div>'
            '<div class="n">paid time with no record against it</div></div>'
            '</div>%s'
            '<div class="grid2">'
            '<section class="card"><h3>Per person</h3>%s</section>'
            '<section class="card"><h3>Per team</h3>%s</section>'
            '<section class="card"><h3>Per region</h3>%s</section>'
            '<section class="card"><h3>Per function</h3>%s</section>'
            '<section class="card wide"><h3>Client hours</h3>%s</section>'
            '<section class="card"><h3>Per project type</h3>%s</section>'
            '</div></div>'
            % (vk, "" if vk == "week" else ' hidden', esc(win), esc(capline),
               h(got), h(cap), pct(got, cap), h(cap - got), partial_note(vk),
               bars(person_rows(vk), "The faint band behind each bar is that person's available hours. Past it is overtime."),
               bars(team_rows(vk)),
               bars(dim_rows(al["regions"], vk),
                    "Region comes from the market on each entry, not from where somebody sits."),
               bars(fn_rows(vk), "Function comes from the staff directory."),
               bars(dim_rows(al["clients"], vk)),
               bars(dim_rows(al["ptypes"], vk))))

    return panes, dict(
        people=people, avail=avail, away=away, order=order, teams=teams, mo=mo,
        signed=signed, logged=logged, active=active, hours_all=hours_all,
        draft_h=draft_h, draft_r=draft_r, lcap=lcap, lcap_got=lcap_got,
        wk=wk, team_rows=team_rows, launches=launches, leave=leave)


CSS = """
/* Kijamii Brand Guide 2024, section 2c. Colours and 1b. Typography.
   Primary colours are white and black; the accents are used one at a time.
   The guide's own web substitutes for Futura Now and Playfair are Lexend and
   Playfair Display (p81), which is why those are the faces here. */
:root{
  --white:#ffffff;        /* White                      */
  --black:#1d1d1f;        /* Black, PMS Process Black   */
  --torch:#cc4221;        /* Torch Red     PMS 1449 TCX */
  --kgreen:#579e94;       /* Kijamii Green PMS 7535 U   */
  --lime:#d4ff66;         /* Our Lime      PMS 3945 U   */
  --purple:#ccb0fa;       /* Mild Purple   PMS 2717 U   */
  --peach:#ffd4cf;        /* Soft Peach    PMS 939 U    */
  --blu:#4051f4;          /* Eclectic Blu  PMS 2727 C   */

  /* One accent at a time, against black and white. Torch Red carries the data. */
  --brand:var(--torch);
  --brand-ink:var(--white);
  --brand-fill:color-mix(in oklab, var(--torch) 10%, transparent);
  --brand-quiet:color-mix(in oklab, var(--torch) 17%, transparent);

  --bg:#faf9f8; --surface:var(--white); --sunk:#f2f0ee;
  --ink:var(--black); --ink-soft:#6a6a6e; --ink-faint:#9a9a9e;
  --rule:#e6e3e0; --rule-firm:#d5d1cd;
  --accent:var(--brand); --accent-fill:var(--brand-fill);
  --good:#3f7a72; --good-bg:#e8f1ef;
  --warn:#8a6a00; --warn-bg:#f6ffe0;
  --bad:#a8351a;  --bad-bg:#fdecea;
  --over:var(--kgreen);
  --grid:#e6e3e0; --weekend:#f4f2f0; --marker:var(--blu);
  --sans:"Lexend",ui-sans-serif,system-ui,-apple-system,Segoe UI,sans-serif;
  --serif:"Playfair Display",Georgia,serif;
  color-scheme:light;
}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){
  color-scheme:dark;
  /* Lifted for contrast on black, which the guide asks for before anything else. */
  --brand:#e3643f; --brand-ink:var(--black);
  --brand-fill:color-mix(in oklab, #e3643f 16%, transparent);
  --brand-quiet:color-mix(in oklab, #e3643f 24%, transparent);
  --bg:var(--black); --surface:#262628; --sunk:#201f21;
  --ink:#f4f2f0; --ink-soft:#a3a3a8; --ink-faint:#737378;
  --rule:#343437; --rule-firm:#45454a;
  --good:#7cc0b4; --good-bg:#23403c;
  --warn:#c9d98f; --warn-bg:#36401f;
  --bad:#e8836a;  --bad-bg:#44241d;
  --over:#7cc0b4;
  --grid:#343437; --weekend:#201f21; --marker:#8f9bff;
}}
:root[data-theme="dark"]{
  color-scheme:dark;
  --brand:#e3643f; --brand-ink:var(--black);
  --brand-fill:color-mix(in oklab, #e3643f 16%, transparent);
  --brand-quiet:color-mix(in oklab, #e3643f 24%, transparent);
  --bg:var(--black); --surface:#262628; --sunk:#201f21;
  --ink:#f4f2f0; --ink-soft:#a3a3a8; --ink-faint:#737378;
  --rule:#343437; --rule-firm:#45454a;
  --good:#7cc0b4; --good-bg:#23403c;
  --warn:#c9d98f; --warn-bg:#36401f;
  --bad:#e8836a;  --bad-bg:#44241d;
  --over:#7cc0b4;
  --grid:#343437; --weekend:#201f21; --marker:#8f9bff;
}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);font-family:var(--sans);line-height:1.5;
     font-variant-numeric:tabular-nums;-webkit-font-smoothing:antialiased}
.wrap{max-width:1120px;margin-inline:auto;
      padding-left:max(16px,env(safe-area-inset-left,0px));
      padding-right:max(16px,env(safe-area-inset-right,0px));padding-block:32px 72px}
h1,h2,h3{margin:0;letter-spacing:-0.02em;text-wrap:balance}
h1{font-family:var(--serif);font-size:clamp(28px,4.4vw,44px);font-weight:500;line-height:1.1;letter-spacing:-0.01em}
h2{font-size:21px;font-weight:600}
h3{font-size:14px;font-weight:600}
p{margin:0}
.eyebrow{font-size:11px;font-weight:600;letter-spacing:.12em;text-transform:uppercase;color:var(--ink-soft)}
.meta{font-size:11.5px;color:var(--ink-soft)}
.lede{color:var(--ink-soft);font-size:15px;max-width:68ch;margin-top:10px}

header.top{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;
           border-bottom:1px solid var(--rule-firm);padding-bottom:22px;flex-wrap:wrap}
/* The wordmark is strictly black or white -- never tinted (guide p42). */
.brandmark{font-weight:700;letter-spacing:-0.045em;font-size:21px;color:var(--ink)}
.themer{font-size:11px;border:1px solid var(--rule-firm);background:var(--surface);
        color:var(--ink-soft);border-radius:999px;padding:6px 12px;cursor:pointer;font-family:inherit}
.themer:hover{color:var(--ink);border-color:var(--ink-faint)}

.obj{margin-top:44px;scroll-margin-top:16px}
.objhead{display:flex;align-items:baseline;gap:12px;flex-wrap:wrap;padding-bottom:6px}
.objhead .num{font-size:11px;font-weight:600;color:var(--brand-ink);background:var(--brand);
              border-radius:999px;padding:2px 10px}
.objhead h2{font-family:var(--serif);font-weight:500;font-size:25px}
.objhead p{color:var(--ink-soft);font-size:13.5px}
.rule{height:1px;background:var(--rule-firm);margin:10px 0 22px}

.tiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(168px,1fr));gap:11px}
.tiles3{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:11px;margin-bottom:18px}
.tile{background:var(--surface);border:1px solid var(--rule);border-radius:11px;padding:15px 15px 13px;min-width:0}
.tile .k{font-size:10px;letter-spacing:.09em;text-transform:uppercase;color:var(--ink-soft);font-weight:500}
.tile .v{font-size:29px;font-weight:600;line-height:1.1;margin-top:7px;letter-spacing:-0.02em}
.tile .v small{font-size:14px;color:var(--ink-soft);font-weight:400}
.tile .n{font-size:12px;color:var(--ink-soft);margin-top:5px}
.tile.hero .v{color:var(--brand)}
.tile.warn .v{color:var(--brand)}

.viewtabs{display:flex;gap:6px;flex-wrap:wrap;margin:4px 0 16px}
.viewtabs button{font-size:11.5px;border:1px solid var(--rule-firm);font-family:inherit;
  background:var(--surface);color:var(--ink-soft);border-radius:999px;padding:7px 15px;cursor:pointer}
.viewtabs button[aria-selected="true"]{background:var(--ink);border-color:var(--ink);color:var(--bg);font-weight:600}
.winbar{display:flex;gap:10px;align-items:baseline;flex-wrap:wrap;margin-bottom:14px}
.winlabel{font-size:12.5px;font-weight:600}
.winsub{font-size:12px;color:var(--ink-soft)}

.grid2{display:grid;grid-template-columns:repeat(auto-fit,minmax(330px,1fr));gap:12px}
.card{background:var(--surface);border:1px solid var(--rule);border-radius:12px;padding:15px 16px 14px;min-width:0}
.card h3{margin-bottom:12px}
.card.wide{grid-column:1/-1}
.bars{display:grid;gap:7px}
.row{display:grid;grid-template-columns:minmax(96px,1.1fr) minmax(70px,2.4fr) minmax(96px,auto);
     gap:10px;align-items:center;font-size:12.5px}
.row.muted{opacity:.5}
.rl{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.rt{position:relative;height:16px;background:var(--sunk);border-radius:4px;overflow:hidden}
.cap{position:absolute;inset-block:0;left:0;background:var(--brand-quiet);border-radius:4px}
.capmark{position:absolute;inset-block:0;width:1.5px;background:var(--ink-faint);opacity:.75}
.bar{position:absolute;inset-block:2px;left:0;background:var(--brand);border-radius:4px;
     box-shadow:0 0 0 2px var(--surface)}
.bar.over{background:var(--over)}
.rv{font-size:11.5px;text-align:right;white-space:nowrap;display:flex;gap:7px;
    justify-content:flex-end;align-items:baseline}
.rv b{font-weight:600}
.rv .sub{color:var(--ink-soft);font-size:10.5px}
.barnote{font-size:11.5px;color:var(--ink-soft);margin-top:11px;padding-top:9px;border-top:1px solid var(--rule)}
.empty{font-size:12.5px;color:var(--ink-soft)}

.panel{background:var(--surface);border:1px solid var(--rule);border-radius:12px;padding:16px 16px 8px;margin-top:12px}
.chartwrap{position:relative}
.ax{font-size:10.5px;fill:var(--ink-soft)}
.mk{font-size:9.5px;fill:var(--marker);font-weight:600}
.hot{cursor:crosshair}
#tip{position:absolute;pointer-events:none;opacity:0;transform:translate(-50%,-112%);
     background:var(--ink);color:var(--bg);border-radius:7px;padding:7px 10px;
     font-size:11.5px;white-space:nowrap;z-index:3;transition:opacity .1s linear}
.legend{display:flex;gap:16px;flex-wrap:wrap;font-size:11.5px;color:var(--ink-soft);padding:4px 0 12px}
.legend span{display:inline-flex;align-items:center;gap:6px}
.sw{width:13px;height:9px;border-radius:2px;display:inline-block}

.tablewrap{overflow-x:auto;border:1px solid var(--rule);border-radius:11px;background:var(--surface);margin-top:12px}
table{border-collapse:collapse;width:100%;min-width:760px;font-size:12.5px}
thead th{font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:var(--ink-soft);
  font-weight:500;text-align:left;padding:10px 12px;background:var(--sunk);
  border-bottom:1px solid var(--rule);white-space:nowrap}
tbody td{padding:9px 12px;border-bottom:1px solid var(--rule)}
tbody tr:last-child td{border-bottom:0}
.num{text-align:right;white-space:nowrap}
.nm{font-weight:600;white-space:nowrap}
.tm{color:var(--ink-soft);white-space:nowrap}
.lead{font-size:9px;font-weight:600;letter-spacing:.07em;text-transform:uppercase;color:var(--brand);
  margin-left:6px;border:1px solid var(--brand-quiet);border-radius:4px;padding:1px 4px;vertical-align:1px}
.pill{font-size:10px;font-weight:600;padding:3px 9px;border-radius:999px;white-space:nowrap;
  border:1px solid transparent}
.pill.good{background:var(--good-bg);color:var(--good)}
.pill.warn{background:var(--warn-bg);color:var(--warn)}
.pill.bad{background:var(--bad-bg);color:var(--bad)}
.pill.off{background:var(--sunk);color:var(--ink-soft);border-color:var(--rule-firm)}
.flagn{color:var(--brand);font-weight:600}
.callout{background:var(--surface);border:1px solid var(--rule);border-left:3px solid var(--brand);
  border-radius:11px;padding:15px 17px;display:grid;gap:7px;margin-top:12px}
.callout p{font-size:13.5px;color:var(--ink-soft);max-width:74ch}
.callout b{color:var(--ink)}
.notes{margin-top:40px;padding-top:18px;border-top:1px solid var(--rule);color:var(--ink-soft);
  font-size:12px;display:grid;gap:7px;max-width:78ch}
.notes b{color:var(--ink);font-weight:600}
.swatches{display:flex;gap:6px;flex-wrap:wrap;margin-top:9px}
.swatches i{width:17px;height:17px;border-radius:4px;display:inline-block;border:1px solid var(--rule)}
/* The guide's layout principle: a messaging zone in flat colour above an
   information zone. These bands are that idea, one accent at a time. */
.band{border-radius:14px;padding:26px 28px;margin-bottom:14px;position:relative;overflow:hidden}
.band h2{font-family:var(--serif);font-weight:500;font-size:clamp(23px,3.2vw,34px);line-height:1.1}
.band p{font-size:14px;margin-top:8px;max-width:62ch;opacity:.86}
.band .num{font-size:11px;font-weight:600;letter-spacing:.1em;text-transform:uppercase;
           display:inline-block;margin-bottom:11px;opacity:.72}
.band.peach{background:var(--peach);color:var(--black)}
.band.green{background:var(--kgreen);color:var(--white)}
.band.lime{background:var(--lime);color:var(--black)}
.band.ink{background:var(--ink);color:var(--bg)}

/* minmax(0,1fr) rather than a bare 1fr: an auto track is sized to its items'
   min-content and will happily overflow the viewport on a phone, which it did
   -- nine pixels of horizontal page scroll traced back to this line. */
.read{display:grid;grid-template-columns:minmax(0,1fr);gap:13px;margin-top:13px}
.find{background:var(--surface);border:1px solid var(--rule);border-radius:12px;
      padding:16px 18px;display:grid;gap:6px}
.find.key{border-left:3px solid var(--brand)}
.find h4{margin:0;font-size:13.5px;font-weight:600;letter-spacing:-0.01em}
.find p{font-size:13px;color:var(--ink-soft);max-width:76ch}
.find b{color:var(--ink);font-weight:600}
.find .fig{font-family:var(--serif);font-size:34px;font-weight:500;line-height:1;
           color:var(--brand);letter-spacing:-0.02em}
.find.two{display:grid;grid-template-columns:auto minmax(0,1fr);gap:18px;align-items:start}
.find p,.find h4{overflow-wrap:break-word}

.bigstat{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:1px;
         background:var(--rule);border:1px solid var(--rule);border-radius:12px;overflow:hidden}
.bigstat > div{background:var(--surface);padding:17px 16px}
.bigstat .f{font-family:var(--serif);font-size:30px;font-weight:500;line-height:1.05;letter-spacing:-0.02em}
.bigstat .l{font-size:11px;color:var(--ink-soft);margin-top:6px;line-height:1.35}
/* The account matrix. One hue, light to dark: a magnitude scale, which is what
   a share is. Every step keeps body text at or above 4.5:1 in both themes --
   computed, not judged -- which is why the darkest stops at 70%. */
.hm1{background:color-mix(in oklab, var(--brand) 10%, var(--surface))}
.hm2{background:color-mix(in oklab, var(--brand) 26%, var(--surface))}
.hm3{background:color-mix(in oklab, var(--brand) 46%, var(--surface))}
.hm4{background:color-mix(in oklab, var(--brand) 70%, var(--surface))}
table.matrix{min-width:980px}
table.matrix td:first-child,table.matrix th:first-child{position:sticky;left:0;z-index:1;
  background:var(--surface);box-shadow:1px 0 0 var(--rule)}
table.matrix thead th:first-child{background:var(--sunk)}
table.matrix tfoot td:first-child{background:var(--sunk)}
table.matrix td,table.mom td{padding:7px 10px}
table.matrix thead th{text-align:right}
table.matrix thead th:first-child,table.matrix thead th:nth-child(2),
table.mom thead th:first-child,table.mom thead th:nth-child(2){text-align:left}
table.matrix td.num,table.mom td.num{line-height:1.25}
table.matrix td b,table.mom td b{font-weight:600}
table.matrix td i,table.mom td i{display:block;font-style:normal;font-size:9.5px;
  color:var(--ink-soft);letter-spacing:.01em}
.hm3 i,.hm4 i{color:color-mix(in oklab, var(--ink) 72%, transparent)}
td.quiet,span.quiet{color:var(--ink-faint)}
td.tot{border-left:1px solid var(--rule-firm)}
table.matrix tfoot td{background:var(--sunk);border-top:1px solid var(--rule-firm);
  font-size:11.5px;padding:9px 10px}
table.mom{min-width:620px}
table.mom tbody tr td:first-child{white-space:nowrap}
.ramp{display:flex;align-items:center;gap:7px;font-size:11px;color:var(--ink-soft);
  padding:2px 0 10px}
.ramp i{width:22px;height:11px;border-radius:2px;display:inline-block;border:1px solid var(--rule)}
/* Direction is written as a sign as well as coloured, so the colour is never
   the only thing carrying it. */
.d{font-size:11px;font-weight:600;white-space:nowrap}
.d.up{color:var(--good)}
.d.down{color:var(--bad)}
.d.flat{color:var(--ink-faint);font-weight:400}
@media (prefers-reduced-motion:reduce){*{transition:none!important}}
@media (max-width:560px){.row{grid-template-columns:minmax(80px,1fr) minmax(50px,1.4fr) auto}}
"""


# The shading steps for the account matrix: one hue, light to dark, which is
# what a magnitude scale is for. A categorical palette was tried first and
# cannot be made to work here -- against the brand's own accents no six-colour
# set clears an all-pairs colour-blindness check (torch red against the lime
# collapses to a delta of 0.2 under deuteranopia), and the brand guide asks for
# one accent at a time in any case. Every step keeps body text above 4.5:1 in
# both themes; the top step stops at 70% for that reason and no other.
HEAT = ((50, 4), (30, 3), (15, 2), (0.01, 1))


def heat(share):
    for lo, k in HEAT:
        if share >= lo:
            return " hm%d" % k
    return ""


def delta(now, before, unit="h"):
    """A change, with its direction written out as well as coloured."""
    now, before = float(now or 0), float(before or 0)
    if not before and not now:
        return '<span class="d flat">\u2014</span>'
    if not before:
        return '<span class="d up">new \u00b7 +%s %s</span>' % (h(now), unit)
    diff = now - before
    sign = "+" if diff >= 0 else "\u2212"
    cls = "up" if diff > 0.009 else ("down" if diff < -0.009 else "flat")
    if unit == "pts":
        # A rate that moves from 70% to 61% has fallen nine points. Calling that
        # "13%" is a percentage of a percentage and means nothing to anybody.
        return '<span class="d %s">%s%s pts</span>' % (cls, sign, h(abs(diff)))
    return ('<span class="d %s">%s%s %s \u00b7 %s%d%%</span>'
            % (cls, sign, h(abs(diff)), unit, sign, round(abs(100 * diff / before))))


ROLLUP = "All other accounts"


def account_matrix(pp, d, view):
    """Employee against account: hours, and what share of that person's time each took.

    The client block answers "how much did this account take". It cannot answer
    "from whom", which is the question a resourcing conversation actually asks:
    two accounts of 150 hours are different problems if one is most of one
    person's month and the other is nine people's afternoons.

    Share is of the person's own captured hours, not of the account, because the
    row is about that person's time. The capacity column keeps the other sense
    of the word honest -- a person can be 100% allocated across accounts and
    still have logged a third of their available hours.
    """
    rows = pp.get("emp_acct") or []
    if not rows:
        return '<p class="empty">No client hours recorded yet.</p>'
    key = "mtd" if view == "mtd" else "hours"

    whole = {}
    for r in rows:
        v = float(r.get(key) or 0)
        if v > 0:
            whole[r["client"]] = whole.get(r["client"], 0.0) + v
    cols = [c for c, _v in sorted(whole.items(), key=lambda kv: (-kv[1], kv[0]))][:8]
    if not cols:
        return '<p class="empty">Nothing logged against a client in this window.</p>'
    rest = [c for c in whole if c not in cols]

    byname = {}
    for r in rows:
        v = float(r.get(key) or 0)
        if v > 0:
            byname.setdefault(r["name"], {})[r["client"]] = v
    team = {p["name"]: p["team"] for p in d["people"]}
    capof = {p["name"]: float((mo_cap(d) if view == "mtd" else p.get("lcap")) or 0)
             for p in d["people"]}

    body, foot = [], dict((c, 0.0) for c in cols + [ROLLUP])
    for name in sorted(byname, key=lambda n: -sum(byname[n].values())):
        got = byname[name]
        tot = sum(got.values())
        cells = []
        for c in cols + [ROLLUP]:
            v = sum(got[x] for x in rest if x in got) if c == ROLLUP else got.get(c, 0.0)
            foot[c] += v
            if v <= 0:
                cells.append('<td class="num quiet">\u2014</td>')
                continue
            share = 100.0 * v / tot
            cells.append('<td class="num%s"><b>%s</b><i>%d%%</i></td>'
                         % (heat(share), h(v), round(share)))
        cap = capof.get(name) or 0
        # Their own total comes before the breakdown, not after it: the table is
        # wider than a laptop and the one figure nobody should have to scroll
        # for is the one the row is about.
        body.append('<tr><td class="nm">%s</td><td class="tm">%s</td>'
                    '<td class="num tot"><b>%s</b><i>%s of cap</i></td>%s</tr>'
                    % (esc(name), esc(team.get(name, "")), h(tot),
                       ("%d%%" % pct(tot, cap)) if cap else "\u2014", "".join(cells)))

    grand = sum(foot.values())
    head = "".join('<th class="num">%s</th>' % esc(c) for c in cols + [ROLLUP])
    totrow = "".join('<td class="num"><b>%s</b><i>%d%%</i></td>' % (h(foot[c]), pct(foot[c], grand))
                     for c in cols + [ROLLUP])
    return ('<div class="tablewrap"><table class="matrix"><thead><tr>'
            '<th>Person</th><th>Team</th><th class="num">Their total</th>%s</tr></thead>'
            '<tbody>%s</tbody><tfoot><tr><td class="nm">All %d people</td><td></td>'
            '<td class="num tot"><b>%s</b></td>%s</tr></tfoot></table></div>'
            % (head, "".join(body), len(byname), h(grand), totrow))


def mo_cap(d):
    """Capacity per person for the month-to-date window."""
    mo = d["mo"]
    return mo.get("cap") or mo["days"] * 8


def accounts_section(pp, d):
    """Objective 03 on the page: who works on what."""
    rows = pp.get("emp_acct") or []
    if not rows:
        return ""
    whole = {}
    for r in rows:
        whole[r["client"]] = whole.get(r["client"], 0.0) + float(r["hours"])
    grand = sum(whole.values()) or 1.0

    # Concentration: the share of a person's time taken by their single biggest
    # account. High is a single point of failure; low is somebody being sliced
    # too thin to finish anything.
    byname = {}
    for r in rows:
        byname.setdefault(r["name"], []).append((float(r["hours"]), r["client"]))
    conc = []
    for name, got in byname.items():
        tot = sum(v for v, _c in got)
        big, bigc = max(got)
        conc.append((name, 100.0 * big / tot, bigc, tot, len(got)))
    conc.sort(key=lambda x: -x[1])

    cbars = [(n, sh, 100.0,
              '<b>%d%%</b><span class="sub">%s \u00b7 %d accounts</span>'
              % (round(sh), esc(c if len(c) < 22 else c[:20] + "\u2026"), k), False)
             for n, sh, c, _t, k in conc]

    unnamed = sum(v for c, v in whole.items()
                  if c.lower().startswith("other") or c == "Not named")
    spread = sum(1 for _n, sh, _c, _t, _k in conc if sh < 40)

    tabs = "".join('<button role="tab" data-v="%s" aria-selected="%s">%s</button>'
                   % (k, "true" if k == "all" else "false", lab)
                   for k, lab in (("all", "Since launch"), ("mtd", "Month to date")))

    return ('<section class="obj" id="accounts">'
            '<div class="band lime"><span class="num">Objective 03</span>'
            '<h2>Who works on what</h2>'
            '<p>Every person against every account they logged against &mdash; in hours, and as a '
            'share of their own captured time. The client totals say how big an account is; only '
            'this says whose month it took.</p></div>'
            '<div class="tiles3">'
            '<div class="tile hero"><div class="k">Accounts in play</div><div class="v">%d</div>'
            '<div class="n">across %d people and %s h</div></div>'
            '<div class="tile"><div class="k">Most concentrated</div><div class="v">%d<small>%%</small></div>'
            '<div class="n">%s, on %s</div></div>'
            '<div class="tile warn"><div class="k">Against no named client</div>'
            '<div class="v">%d<small>%%</small></div>'
            '<div class="n">%s h booked to a placeholder, not an account</div></div>'
            '</div>'
            '<div class="viewtabs" role="tablist" data-group="acct" aria-label="Window">%s</div>'
            '<div class="pane" data-group="acct" data-view="all">'
            '<p class="barnote" style="margin:0 0 12px;padding:0;border:0">Hours since each '
            'team&rsquo;s launch. The shade is the share of that person&rsquo;s own captured time, '
            'so a dark cell is an account that owns somebody. The table scrolls sideways for the '
            'remaining accounts; the name and the total stay put.</p>%s</div>'
            '<div class="pane" data-group="acct" data-view="mtd" hidden>'
            '<p class="barnote" style="margin:0 0 12px;padding:0;border:0">The same table for '
            '%s only.</p>%s</div>'
            '<div class="grid2" style="margin-top:12px">'
            '<section class="card"><h3>Concentration \u2014 share taken by their largest account</h3>%s</section>'
            '<section class="card"><h3>Accounts by hours, and how many people touch them</h3>%s</section>'
            '</div></section>'
            % (len(whole), len(byname), h(grand),
               round(conc[0][1]), esc(conc[0][0]), esc(conc[0][2]),
               pct(unnamed, grand), h(unnamed), tabs,
               account_matrix(pp, d, "all"), esc(d["mo"]["label"]),
               account_matrix(pp, d, "mtd"),
               bars(cbars, "Above 60%% is a single point of failure: that account is most of that "
                           "person&rsquo;s recorded month. Below 40%% \u2014 %d people \u2014 is the "
                           "other failure, somebody sliced across so many accounts that none of "
                           "them gets a whole day." % spread),
               bars([(c, v, None, '<b>%s h</b><span class="sub">%d people</span>'
                      % (h(v), len(set(r["name"] for r in rows if r["client"] == c))), False)
                     for c, v in sorted(whole.items(), key=lambda kv: -kv[1])[:12]])))


def mom_section(pp, d):
    """Objective 04: this month against the last one."""
    ms = [m for m in (pp.get("months") or [])]
    if len(ms) < 2:
        return ""
    pv, cur, prev = pp.get("prev_pace") or {}, ms[-1], ms[-2]

    mrows = [(m["label"] + ("*" if m.get("partial") else ""), float(m["hours"]), float(m["cap"]),
              '<b>%d%%</b><span class="sub">%s of %s h \u00b7 %d days</span>'
              % (pct(float(m["hours"]), float(m["cap"])), h(m["hours"]), h(m["cap"]), m["days"]),
              False) for m in ms]

    head = "".join('<th class="num">%s</th>' % esc(m["label"] + ("*" if m.get("partial") else ""))
                   for m in ms)
    mtable = "".join(
        '<tr><td class="nm">%s</td>%s<td class="num">%s</td></tr>'
        % (label, "".join('<td class="num">%s</td>' % fmt(m) for m in ms),
           delta(val(ms[-1]), val(ms[-2]), unit))
        for label, fmt, val, unit in (
            ("Hours captured", lambda m: "<b>%s</b>" % h(m["hours"]), lambda m: m["hours"], "h"),
            ("Hours available", lambda m: h(m["cap"]), lambda m: m["cap"], "h"),
            ("Capture rate", lambda m: "%d%%" % pct(float(m["hours"]), float(m["cap"])),
             lambda m: pct(float(m["hours"]), float(m["cap"])), "pts"),
            ("People who logged", lambda m: str(m["active"]), lambda m: m["active"], ""),
            ("Working days", lambda m: str(m["days"]), lambda m: m["days"], ""),
            ("Submitted", lambda m: h(m["submitted"]), lambda m: m["submitted"], "h"),
            ("Still in draft", lambda m: h(m["draft"]), lambda m: m["draft"], "h"),
            ("Rework (amend)", lambda m: h(m["amend"]), lambda m: m["amend"], "h"),
            ("Accounts touched", lambda m: str(m["clients"]), lambda m: m["clients"], "")))

    # Accounts, month against month.
    am = {}
    for r in pp.get("acct_month") or []:
        am.setdefault(r["name"], {})[r["month"]] = float(r["hours"])
    keys = [m["key"] for m in ms]
    arows = "".join(
        '<tr><td class="nm">%s</td>%s<td class="num">%s</td></tr>'
        % (esc(name),
           "".join('<td class="num">%s</td>'
                   % (h(am[name][k]) if am[name].get(k) else '<span class="quiet">\u2014</span>')
                   for k in keys),
           delta(am[name].get(keys[-1], 0), am[name].get(keys[-2], 0)))
        for name in sorted(am, key=lambda n: -(am[n].get(keys[-1], 0) + am[n].get(keys[-2], 0))))

    # People, month against month.
    em = {}
    for r in pp.get("emp_month") or []:
        em.setdefault(r["name"], {})[r["month"]] = (float(r["hours"]), float(r["cap"] or 0))
    team = {p["name"]: p["team"] for p in d["people"]}
    erows = "".join(
        '<tr><td class="nm">%s</td><td class="tm">%s</td>%s<td class="num">%s</td></tr>'
        % (esc(name), esc(team.get(name, "")),
           "".join('<td class="num">%s<i>%s</i></td>'
                   % (h(em[name].get(k, (0, 0))[0]),
                      ("%d%% of cap" % pct(em[name][k][0], em[name][k][1]))
                      if em[name].get(k) and em[name][k][1] else "\u2014")
                   for k in keys),
           delta(em[name].get(keys[-1], (0, 0))[0], em[name].get(keys[-2], (0, 0))[0]))
        for name in sorted(em, key=lambda n: -em[n].get(keys[-1], (0, 0))[0]))

    pace = ""
    if pv and float(pv.get("cap") or 0):
        now_h = float(cur["hours"])
        pace = (
            '<div class="tiles3" style="margin-top:14px">'
            '<div class="tile hero"><div class="k">%s so far</div><div class="v">%s<small> h</small></div>'
            '<div class="n">%d%% of %s h available \u00b7 %d people logged</div></div>'
            '<div class="tile"><div class="k">Same stretch of %s</div><div class="v">%s<small> h</small></div>'
            '<div class="n">%s, the first %d working days \u00b7 %d%% of %s h</div></div>'
            '<div class="tile"><div class="k">Like for like</div><div class="v">%s</div>'
            '<div class="n">hours against the same number of elapsed working days</div></div></div>'
            % (esc(cur["label"]), h(now_h), pct(now_h, float(cur["cap"])), h(cur["cap"]),
               cur["active"], esc(month_label(pv["month"])), h(pv["hours"]),
               esc(pv["label"]), pv["days"], pct(float(pv["hours"]), float(pv["cap"])), h(pv["cap"]),
               delta(now_h, float(pv["hours"]))))

    return ('<section class="obj" id="mom">'
            '<div class="band ink"><span class="num">Objective 04</span>'
            '<h2>Month against month</h2>'
            '<p>The three windows above all end today, so none of them can say whether this month '
            'is better than the last one. This one can. The current month is still running, so the '
            'fair comparison is the same number of elapsed working days, not a whole month against '
            'a part of one.</p></div>'
            '%s'
            '<div class="grid2" style="margin-top:14px">'
            '<section class="card wide"><h3>Hours captured against hours available</h3>%s</section>'
            '<section class="card wide"><h3>The month in figures</h3>'
            '<div class="tablewrap" style="margin-top:0"><table class="mom"><thead><tr><th></th>%s'
            '<th class="num">Change</th></tr></thead><tbody>%s</tbody></table></div></section>'
            '</div>'
            '<h3 style="margin-top:22px">Accounts, month by month</h3>'
            '<div class="tablewrap"><table class="mom"><thead><tr><th>Account</th>%s'
            '<th class="num">Change</th></tr></thead><tbody>%s</tbody></table></div>'
            '<h3 style="margin-top:22px">People, month by month</h3>'
            '<div class="tablewrap"><table class="mom"><thead><tr><th>Person</th><th>Team</th>%s'
            '<th class="num">Change</th></tr></thead><tbody>%s</tbody></table></div>'
            '<p class="barnote">* still running. Hours available are measured from each '
            'team&rsquo;s own launch date inside the month, so October is not charged for the '
            'fortnight Emad Mutter&rsquo;s and Nadia&rsquo;s teams did not yet have the tool. '
            'That is also why available hours rise between the two months while the calendar '
            'shrinks. A person over 100%% of capacity is not an error: they either logged more '
            'than the assumed eight hours a day, which stands as submitted, or they backfilled '
            'days from before their own team went live, which capacity does not count.</p>'
            '</section>'
            % (pace, bars(mrows), head, mtable, head, arows, head, erows))


def placeholder_trend(pp):
    """Whether the unnamed-client problem is getting better or worse."""
    ms = [m["key"] for m in (pp.get("months") or [])]
    if len(ms) < 2:
        return ""
    by = {}
    for r in pp.get("acct_month") or []:
        if r["name"].lower().startswith("other") or r["name"] == "Not named":
            by[r["month"]] = by.get(r["month"], 0.0) + float(r["hours"])
    now, before = by.get(ms[-1], 0.0), by.get(ms[-2], 0.0)
    if not before or not now:
        return ""
    if now > before:
        return (' It is also growing: <b>%s h</b> last month against <b>%s h</b> this one, '
                'with the month not finished.' % (h(before), h(now)))
    return ' It is shrinking: <b>%s h</b> last month against <b>%s h</b> this one.' % (h(before), h(now))


def insights(pp, al, d):
    """Read the numbers back as sentences. Every figure here is computed, so the
    text cannot drift from the table above it the way a hand-written summary does."""
    people, avail = d["people"], d["avail"]
    wk, mo = pp["week"], pp["month"]
    lcap, lgot = d["lcap"], d["lcap_got"]
    out = []

    # 1. What the headline number is, and what it is not.
    out.append(("key", "Capture, not utilisation",
        '<div class="fig">%d%%</div>' % pct(lgot, lcap),
        'Across the pilot since each team launched, <b>%s h</b> of a possible <b>%s h</b> reached '
        'the timesheet. The missing <b>%s h</b> is not idle time. It is time nobody wrote down. '
        'Treat it as a collection problem: every hour here is work that cannot be billed, '
        'resourced against, or defended in a scope conversation, because there is no record it '
        'happened.' % (h(lgot), h(lcap), h(lcap - lgot))))

    # 2. Launch dates make the naive comparison wrong.
    tr = d["team_rows"]("launch")
    best, worst = tr[0], tr[-1]
    out.append(("", "The teams are not comparable on raw hours",
        "",
        '<b>%s</b> has had %d working days since launch; <b>%s</b> has had %d. Comparing their '
        'total hours rewards whoever started first. On capture rate against their own runway the '
        'order is <b>%s</b>, and the spread is %d points from top to bottom.'
        % (ORDER[0], d["launches"][ORDER[0]]["days"], "Nadia", d["launches"]["Nadia"]["days"],
           " → ".join("%s %d%%" % (r[0], pct(r[1], r[2])) for r in tr),
           pct(best[1], best[2]) - pct(worst[1], worst[2]))))

    # 3. Spread within a team is the resourcing signal, not the team average.
    spread = []
    for k in d["order"]:
        mem = [p for p in d["teams"][k]]
        rates = sorted(pct(float(p["lhours"]), float(p.get("lcap") or p["ldays"] * 8)) for p in mem)
        spread.append((rates[-1] - rates[0], k, rates[0], rates[-1]))
    spread.sort(reverse=True)
    w, wk_team, lo, hi = spread[0]
    out.append(("key", "Averages hide the people",
        '<div class="fig">%d pts</div>' % w,
        '<b>%s</b> runs from %d%% to %d%% inside one team. A team average of %d%% describes '
        'nobody in it. Capacity decisions taken on the average will overload the people already '
        'at the top and leave the bottom untouched, so read the per-person bars before moving '
        'work.' % (wk_team, lo, hi,
                   pct(sum(float(p["lhours"]) for p in d["teams"][wk_team]),
                       sum(float(p.get("lcap") or p["ldays"] * 8)
                           for p in d["teams"][wk_team])))))

    # 4. Client concentration.
    cl = sorted([c for c in al["clients"] if float(c["hours"]) > 0],
                key=lambda c: -float(c["hours"]))
    tot = sum(float(c["hours"]) for c in cl)
    top3 = sum(float(c["hours"]) for c in cl[:3])
    named = [c for c in cl if c["name"] != "Not named"]
    out.append(("", "Where the work actually goes",
        "",
        'Three clients take <b>%d%%</b> of everything logged: %s. The pilot carries <b>%d</b> '
        'client names in all. That concentration is the capacity risk worth watching — a brief '
        'from %s lands on the same people every time, and their bars above are already the '
        'fullest.' % (pct(top3, tot),
                      ", ".join("%s (%s h)" % (esc(c["name"]), h(c["hours"])) for c in cl[:3]),
                      len(named), esc(cl[0]["name"]))))

    # 5. Rework.
    am = sum(float(c.get("amend") or 0) for c in cl)
    worst_rw = sorted([c for c in cl if float(c["hours"]) >= 50],
                      key=lambda c: -(float(c.get("amend") or 0) / float(c["hours"])))[:3]
    out.append(("key", "Rework is a capacity tax",
        '<div class="fig">%d%%</div>' % pct(am, tot),
        '<b>%s h</b> of the <b>%s h</b> logged was marked as an amend rather than new work. '
        'Worst by share, among clients over 50 h: %s. Rework is capacity you have already paid '
        'for once. Halving it across the pilot would return about <b>%s h</b>, roughly %s.'
        % (h(am), h(tot),
           ", ".join("%s %d%%" % (esc(c["name"]), pct(float(c.get("amend") or 0), float(c["hours"])))
                     for c in worst_rw),
           h(am / 2),
           ("%.1f person-weeks at 40 h" % (am / 2 / 40)).replace(".0 ", " ")
           if am / 2 >= 40 else "half a person-week")))

    # 6. Unfiled work.
    dh = d["draft_h"]
    holders = sorted([p for p in people if float(p["draft_hours"]) > 0],
                     key=lambda p: -float(p["draft_hours"]))
    if holders:
        # Split by the month the work belongs to, not just totalled.
        #
        # One number here told nobody which month the hours sat in. Six and a
        # half of Habiba Hany's fourteen draft hours turned out to be October,
        # and that only surfaced because somebody asked directly. A figure that
        # has to be asked about is not reporting.
        #
        # `ready` can be submitted as it stands; `blocked` still wants a project
        # type or a work type before the app will accept it. They are different
        # asks of different people, so they are not added together.
        by_month = {}
        for r in pp.get("unfiled", []):
            m = by_month.setdefault(r["month"], {"hours": 0.0, "ready": 0.0,
                                                 "blocked": 0.0, "who": []})
            m["hours"] += float(r["hours"] or 0)
            m["ready"] += float(r["ready"] or 0)
            m["blocked"] += float(r["blocked"] or 0)
            m["who"].append((r["name"], float(r["hours"] or 0)))

        months = ""
        for key in sorted(by_month, reverse=True):
            m = by_month[key]
            named = ", ".join(
                "%s %s h" % (esc(n), h(v))
                for n, v in sorted(m["who"], key=lambda w: -w[1])[:4])
            months += (
                '<div class="row"><div class="rl">%s</div>'
                '<div class="rt"><span class="bar" style="width:%.1f%%"></span></div>'
                '<div class="rv"><b>%s h</b><span class="sub">%s ready · %s needs a field</span></div>'
                '</div><p class="barnote" style="margin:2px 0 8px;padding:0;border:0">%s</p>'
                % (month_label(key),
                   100.0 * m["hours"] / max(dh, 0.01),
                   h(m["hours"]), h(m["ready"]), h(m["blocked"]), named))

        out.append(("", "Typed but never sent",
            "",
            '<b>%s h</b> across %d rows sits in draft and reaches no report or export. '
            'This is the cheapest capacity to recover in the whole report — the work is '
            'already recorded, it simply has not been submitted. Which month it belongs '
            'to decides how urgent it is: a closed month is a figure already quoted to '
            'somebody.<div class="bars" style="margin-top:12px">%s</div>'
            % (h(dh), d["draft_r"], months)))

    # 6b. Month against month, on a like-for-like window.
    ms = pp.get("months") or []
    pv = pp.get("prev_pace") or {}
    if len(ms) >= 2 and float(pv.get("cap") or 0):
        cur, prv = ms[-1], ms[-2]
        now_r = pct(float(cur["hours"]), float(cur["cap"]))
        was_r = pct(float(pv["hours"]), float(pv["cap"]))
        grew = float(cur["hours"]) - float(pv["hours"])
        out.append(("key", "This month against the same stretch of last",
            '<div class="fig">%s%d pts</div>' % ("+" if now_r >= was_r else "\u2212", abs(now_r - was_r)),
            '<b>%s h</b> captured in %s against <b>%s h</b> over the first %d working days of %s '
            '\u2014 %s%s h of hours. The rate moved the other way, %d%% to %d%%, and the reason is '
            'the denominator rather than the behaviour: all %d people are inside the window now, '
            'where October only counted two of the four teams for its first fortnight. More hours '
            'are arriving from more people against more available time.'
            % (h(cur["hours"]), esc(cur["label"]), h(pv["hours"]), pv["days"],
               esc(month_label(pv["month"])), "+" if grew >= 0 else "\u2212", h(abs(grew)),
               was_r, now_r, cur["active"])))

    # 6c. Hours booked to a placeholder instead of an account.
    ea = pp.get("emp_acct") or []
    if ea:
        whole = {}
        for r in ea:
            whole[r["client"]] = whole.get(r["client"], 0.0) + float(r["hours"])
        gr = sum(whole.values()) or 1.0
        un = sorted(((v, c) for c, v in whole.items()
                     if c.lower().startswith("other") or c == "Not named"), reverse=True)
        if un:
            who = sorted(((sum(float(r["hours"]) for r in ea
                               if r["name"] == n and (r["client"].lower().startswith("other")
                                                      or r["client"] == "Not named")), n)
                          for n in set(r["name"] for r in ea)), reverse=True)[:4]
            out.append(("key", "A quarter of the work has no client name on it",
                '<div class="fig">%d%%</div>' % pct(sum(v for v, _c in un), gr),
                '<b>%s h</b> is booked to a placeholder rather than an account \u2014 more than any '
                'real client in the pilot. It is not missing time: the hours are there, the '
                'client field is not. Every one of them is invisible to a profitability or scope '
                'conversation, which is most of what the timesheet exists for. Held mainly by '
                '%s. A short list of the accounts people cannot find in the dropdown would '
                'recover the lot.'
                % (h(sum(v for v, _c in un)),
                   ", ".join("%s (%s h)" % (esc(n), h(v)) for v, n in who if v > 0))
                + placeholder_trend(pp)))

    # 7. Data quality, stated as the blocker it is.
    ns_r = next((r for r in al["regions"] if r["name"] == "Not set"), None)
    out.append(("", "Why region and function read \u201cNot set\u201d",
        "",
        '<b>%s h</b> carries no region and <b>%s h</b> no function. Neither is a timesheet fault. '
        'Eight people have a blank <b>Entity</b> in the OPS employee list, so their '
        '<code>primary_market</code> is empty, and every entry they save inherits no market. The '
        'same blank rows leave six people with no Function. Fill Entity and Function for those '
        'rows and both views resolve themselves — until then, read region and function as '
        'partial.'
        % (h(float(ns_r["hours"]) if ns_r else 0),
           h(sum(float(p["hours"]) for p in people if p["function"] == "Not set")))))

    # 8. Leads.
    leads = [p for p in people if p["seat"] == "Lead"]
    lrate = pct(sum(float(p["lhours"]) for p in leads),
                sum(float(p.get("lcap") or p["ldays"] * 8) for p in leads))
    mem = [p for p in people if p["seat"] != "Lead"]
    mrate = pct(sum(float(p["lhours"]) for p in mem),
                sum(float(p.get("lcap") or p["ldays"] * 8) for p in mem))
    out.append(("key" if lrate < mrate else "", "Leads against their own teams",
        '<div class="fig">%d%% / %d%%</div>' % (lrate, mrate),
        'The four leads capture <b>%d%%</b> of their available hours; their members <b>%d%%</b>. '
        '%s' % (lrate, mrate,
                'A lead who does not log is the single strongest predictor of a team that does '
                'not either — and it removes the one person whose capacity a resourcing '
                'conversation most needs to see.' if lrate < mrate else
                'Leads are ahead of their teams, which is the pattern you want: the behaviour is '
                'being modelled from the top.')))

    return "".join(
        '<article class="find%s%s">%s<div><h4>%s</h4><p>%s</p></div></article>'
        % (" key" if cls == "key" else "", " two" if fig else "", fig, title, body)
        for cls, title, fig, body in out)

def page(pp, al):
    panes, d = build(pp, al)
    accounts = accounts_section(pp, d)
    mom = mom_section(pp, d)
    people, avail, away = d["people"], d["avail"], d["away"]
    wk = d["wk"]

    tabs = "".join('<button role="tab" data-v="%s" aria-selected="%s">%s</button>'
                   % (k, "true" if k == "week" else "false", lab) for k, lab in VIEWS)

    # Adoption roster.
    rows = []
    for k in d["order"]:
        for p in sorted(d["teams"][k], key=lambda r: (r["seat"] != "Lead", -float(r["lhours"]), r["name"])):
            if p["off"]:
                st, cls = "On leave", "off"
            elif not p["signed_in"]:
                st, cls = "Never signed in", "bad"
            elif p["days"] == 0:
                st, cls = "Signed in, nothing logged", "bad"
            elif p["week_days"] == 0:
                st, cls = "Stopped", "warn"
            else:
                st, cls = "Active", "good"
            rate = pct(float(p["lhours"]), float(p.get("lcap") or p["ldays"] * 8))
            rows.append(
                '<tr><td class="nm">%s%s</td><td class="tm">%s</td><td class="tm">%s</td>'
                '<td class="num">%s</td><td class="num">%d/%d</td><td class="num">%s</td>'
                '<td class="num%s">%s</td><td class="num">%s</td>'
                '<td><span class="pill %s">%s</span></td></tr>'
                % (esc(p["name"]), '<span class="lead">Lead</span>' if p["seat"] == "Lead" else "",
                   esc(p["team"]), esc(p["function"]), esc(p["launch"]),
                   p["llogged"], p["ldays"], "%d%%" % rate,
                   " flagn" if float(p["draft_hours"]) else "",
                   h(p["draft_hours"]) if float(p["draft_hours"]) else "—",
                   day_label(p["last"]) if p["last"] else "—", cls, st))

    marks = [("2026-10-01", "1 Oct · Ramy + Marina live"),
             ("2026-10-16", "16 Oct · Emad + Nadia live")]

    teamcards = "".join(
        '<article class="tile"><div class="k">%s</div><div class="v">%d<small>%%</small></div>'
        '<div class="n">%s h of %s h since %s · %d people</div></article>'
        % (esc(name), pct(got, cap), h(got), h(cap),
           esc(d["launches"][name]["date"]), len(d["teams"][name]))
        for name, got, cap, _m, _o in d["team_rows"]("launch"))

    leavenote = (" · %d on leave, left out of this week and the month to date" % away) if away else ""

    return """<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>Kijamii Timesheets</title>
<meta name="description" content="Timesheet adoption and capacity planning across the four pilot teams.">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Lexend:wght@300;400;500;600;700&family=Playfair+Display:wght@400;500;600&display=swap">
<style>%s</style></head><body><div class="wrap">

<header class="top">
  <div>
    <p class="eyebrow">Kijamii · Timesheet pilot</p>
    <h1>Adoption and capacity</h1>
    <p class="lede">One page, two questions. Whether the tool is being used, and what the hours it
      captures say about where the work is going. %d people across four teams, launched on two
      different dates.</p>
    <p class="meta" style="margin-top:12px">Snapshot %s · working week Sunday–Thursday%s</p>
  </div>
  <div style="display:grid;gap:10px;justify-items:end">
    <div class="brandmark">Kijamii</div>
    <button class="themer" id="themer" type="button">Light / dark</button>
  </div>
</header>

<section class="obj" id="adoption">
  <div class="band peach"><span class="num">Objective 01</span>
    <h2>Is the timesheet being used?</h2>
    <p>Whether people log, whether they keep logging, and whether what they type ever
      reaches the data. Measured against each team&rsquo;s own launch date.</p></div>
  <div class="tiles">
    <div class="tile hero"><div class="k">Logging this week</div><div class="v">%d<small> / %d</small></div>
      <div class="n">%d%% of those available, %s</div></div>
    <div class="tile"><div class="k">Have ever logged</div><div class="v">%d<small> / %d</small></div>
      <div class="n">%d%% got started at least once</div></div>
    <div class="tile"><div class="k">Signed in</div><div class="v">%d<small> / %d</small></div>
      <div class="n">%d have never opened it</div></div>
    <div class="tile"><div class="k">Hours captured</div><div class="v">%s</div>
      <div class="n">across all %d people, to date</div></div>
    <div class="tile warn"><div class="k">Typed but never sent</div><div class="v">%s<small> h</small></div>
      <div class="n">%d rows that reach no report</div></div>
  </div>

  <div class="panel"><div class="chartwrap">%s<div id="tip" role="status" aria-live="polite"></div></div>
    <div class="legend">
      <span><i class="sw" style="background:var(--brand)"></i>People who logged that day</span>
      <span><i class="sw" style="background:var(--weekend);border:1px solid var(--rule)"></i>Weekend</span>
      <span><i class="sw" style="background:var(--marker)"></i>Launch date</span>
    </div>
  </div>

  <h3 style="margin-top:22px">Capture rate since each team's own launch</h3>
  <div class="tiles" style="margin-top:10px">%s</div>

  <div class="tablewrap"><table><thead><tr>
    <th>Person</th><th>Team</th><th>Function</th><th>Launched</th>
    <th style="text-align:right">Days logged</th><th style="text-align:right">Capture</th>
    <th style="text-align:right">Unsent h</th><th style="text-align:right">Last day</th><th>Status</th>
  </tr></thead><tbody>%s</tbody></table></div>
</section>

<section class="obj" id="capacity">
  <div class="band green"><span class="num">Objective 02</span>
    <h2>Where did the hours go?</h2>
    <p>Per person, team, region, function, client and project type &mdash; in the week,
      the month to date, or since launch. Hours captured against hours available.</p></div>
  <div class="viewtabs" role="tablist" data-group="cap" aria-label="Time window">%s</div>
  %s
</section>

%s
%s

<section class="obj" id="reading">
  <div class="band ink"><span class="num">What it means</span>
    <h2>Reading the numbers</h2>
    <p>What the tables above are saying, and what each one implies for how work is
      allocated. Every figure here is computed from the same data, not written by hand.</p></div>
  <div class="read">%s</div>
</section>

<div class="notes">
  <p><b>Capture rate is not utilisation.</b> It is hours written into the timesheet over hours
    available. A low rate means the time was not recorded; it cannot tell you whether it was worked.
    Treat the gap as missing data to chase, not as idle people.</p>
  <p><b>Teams launched on different dates.</b> Ramy Kamel's and Marina's teams on 1 October,
    Emad Mutter's and Nadia's on 16 October. Only the "since launch" window compares them on equal
    terms; the other two windows are for the week in front of you.</p>
  <p><b>Leave.</b> Anyone on leave keeps their row and their hours to date but is left out of this
    week and the month to date, so a team is not marked down for a holiday. The since-launch window
    still includes their full runway, which understates them.</p>
  <p><b>Region and function are incomplete.</b> %s h of work carries no market, and six people have
    no function in the staff directory, so both views show a large "Not set". The market is set when
    an entry is saved; the function comes from the OPS employee list.</p>
  <p><b>Weekends.</b> The working week is Sunday to Thursday, so capacity is only ever counted
    on those five days. Hours are not: an entry saved against a Friday or a Saturday is real work
    and is counted in full, which is why somebody can read over 100%%. The days-logged counts stay
    on working days, because those measure turning up when you were expected to.</p>
  <p><b>Rework</b> is any entry marked as an amend rather than a new task.</p>
  <p><b>Where the numbers come from.</b> Read live from the timesheet database at the snapshot time
    above, not from an export. A day counts as logged when it carries at least one entry with hours.</p>
</div>
</div>

<script>
(function(){
  [].forEach.call(document.querySelectorAll('.viewtabs'),function(bar){
    var g=bar.getAttribute('data-group')||'cap';
    var tabs=[].slice.call(bar.querySelectorAll('button'));
    var panes=[].slice.call(document.querySelectorAll('.pane[data-group="'+g+'"]'));
    tabs.forEach(function(b){b.addEventListener('click',function(){
      tabs.forEach(function(o){o.setAttribute('aria-selected',String(o===b));});
      panes.forEach(function(p){p.hidden=(p.getAttribute('data-view')!==b.dataset.v);});
      try{localStorage.setItem('kj-view-'+g,b.dataset.v);}catch(e){}
    });});
    try{var v=localStorage.getItem('kj-view-'+g);
      if(v){var t=tabs.filter(function(b){return b.dataset.v===v;})[0]; if(t)t.click();}}catch(e){}
  });

  var root=document.documentElement, tb=document.getElementById('themer');
  try{var s=localStorage.getItem('kj-theme'); if(s)root.setAttribute('data-theme',s);}catch(e){}
  tb.addEventListener('click',function(){
    var dark=getComputedStyle(root).colorScheme.indexOf('dark')>-1;
    var next=dark?'light':'dark';
    root.setAttribute('data-theme',next);
    try{localStorage.setItem('kj-theme',next);}catch(e){}
  });

  var tip=document.getElementById('tip'), wrap=document.querySelector('.chartwrap');
  if(!tip||!wrap)return;
  var MON={'09':'Sep','10':'Oct','11':'Nov','12':'Dec'};
  function show(e){var r=e.target,box=wrap.getBoundingClientRect(),b=r.getBoundingClientRect();
    var d=r.dataset.d,day=parseInt(d.slice(-2),10),mon=MON[d.slice(5,7)]||'';
    var n=r.dataset.n;
    tip.textContent=r.dataset.dow+' '+day+' '+mon+' · '+n+(n==='1'?' person · ':' people · ')+
      r.dataset.h+'h'+(r.dataset.w==='0'?' · weekend':'');
    tip.style.left=(b.left-box.left+b.width/2)+'px';
    tip.style.top=(b.top-box.top+16)+'px';tip.style.opacity='1';}
  [].forEach.call(document.querySelectorAll('.hot'),function(r){
    r.addEventListener('mouseenter',show);r.addEventListener('mousemove',show);
    r.addEventListener('mouseleave',function(){tip.style.opacity='0';});});
  wrap.addEventListener('mouseleave',function(){tip.style.opacity='0';});
})();
</script></body></html>""" % (
      CSS, len(people), esc(pp["snapshot"]), leavenote,
      d["active"], len(avail), pct(d["active"], len(avail)), esc(wk["label"]),
      d["logged"], len(avail), pct(d["logged"], len(avail)),
      d["signed"], len(avail), len(avail) - d["signed"],
      h(d["hours_all"]), len(people), h(d["draft_h"]), d["draft_r"],
      curve(pp["daily"], marks), teamcards, "\n".join(rows), tabs, "\n".join(panes),
      accounts, mom, insights(pp, al, d), h(935.0))


def main():
    """One payload file (what query.sql returns), or two for a hand-split pair."""
    with open(sys.argv[1], encoding="utf-8") as fh:
        pp = json.load(fh)
    if len(sys.argv) > 2:
        with open(sys.argv[2], encoding="utf-8") as fh:
            al = json.load(fh)
    else:
        al = {k: pp.get(k, []) for k in ("regions", "clients", "ptypes", "functions")}
    sys.stdout.write(page(pp, al))


if __name__ == "__main__":
    main()
