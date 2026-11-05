#!/usr/bin/env python3
"""
Build the Kijamii timesheet report: adoption success, and capacity planning.

    python3 build.py people.json alloc.json > report.html

Two objectives in one page. The adoption half asks whether people are using the
tool; the capacity half asks where the hours went and how much of the available
time was ever written down. They are kept apart because they are read by
different people for different decisions, and mixing them is how "47% utilisation"
came to mean nothing.

Every capacity figure exists in three windows -- this week, this month so far,
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


VIEWS = [("week", "This week"), ("mtd", "Month so far"), ("launch", "Since launch")]


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
    def cell(p, view):
        if view == "week":
            return p["wk_hours"], p["week_days"], wk["days"] * 8, wk["days"]
        if view == "mtd":
            return p["mt_hours"], p["mt_days"], mo["days"] * 8, mo["days"]
        return p["lhours"], p["llogged"], p["ldays"] * 8, p["ldays"]

    # ---------------------------------------------------------------- adoption
    signed = sum(1 for p in avail if p["signed_in"])
    logged = sum(1 for p in avail if p["days"] > 0)
    active = sum(1 for p in avail if p["week_days"] > 0)
    hours_all = sum(float(p["hours"]) for p in people)
    draft_h = sum(float(p["draft_hours"]) for p in people)
    draft_r = sum(p["draft_rows"] for p in people)

    lcap = sum(p["ldays"] * 8 for p in people)
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
        return out[:12]

    def fn_rows(view):
        agg = {}
        for p in (people if view == "launch" else avail):
            got, dl, cap, dp = cell(p, view)
            a = agg.setdefault(p["function"], [0.0, 0, 0])
            a[0] += float(got); a[1] += cap; a[2] += 1
        rows = [(k, v[0], v[1], '<b>%s%%</b><span class="sub">%s h · %d people</span>'
                 % (pct(v[0], v[1]), h(v[0]), v[2]), False) for k, v in agg.items()]
        return sorted(rows, key=lambda r: -(r[1] / r[2] if r[2] else 0))

    panes = []
    for vk, vlabel in VIEWS:
        win = {"week": wk["label"], "mtd": mo["label"], "launch": "each team's own launch date"}[vk]
        capline = {"week": "%d finished working days, %d h per person" % (wk["days"], wk["days"] * 8),
                   "mtd": "%d finished working days, %d h per person" % (mo["days"], mo["days"] * 8),
                   "launch": "Ramy Kamel and Marina from 1 Oct (25 days); Emad Mutter and Nadia from 16 Oct (14 days)"}[vk]
        got = sum(float(cell(p, vk)[0]) for p in (people if vk == "launch" else avail))
        cap = sum(cell(p, vk)[2] for p in (people if vk == "launch" else avail))
        panes.append(
            '<div class="pane" data-view="%s"%s>'
            '<div class="winbar"><span class="winlabel">%s</span>'
            '<span class="winsub">%s</span></div>'
            '<div class="tiles3">'
            '<div class="tile hero"><div class="k">Captured</div><div class="v">%s<small> h</small></div>'
            '<div class="n">of %s h available</div></div>'
            '<div class="tile"><div class="k">Capture rate</div><div class="v">%d<small>%%</small></div>'
            '<div class="n">hours written down, not hours worked</div></div>'
            '<div class="tile warn"><div class="k">Unaccounted for</div><div class="v">%s<small> h</small></div>'
            '<div class="n">paid time with no record against it</div></div>'
            '</div>'
            '<div class="grid2">'
            '<section class="card"><h3>Per person</h3>%s</section>'
            '<section class="card"><h3>Per team</h3>%s</section>'
            '<section class="card"><h3>Per region</h3>%s</section>'
            '<section class="card"><h3>Per function</h3>%s</section>'
            '<section class="card"><h3>Per client</h3>%s</section>'
            '<section class="card"><h3>Per project type</h3>%s</section>'
            '</div></div>'
            % (vk, "" if vk == "week" else ' hidden', esc(win), esc(capline),
               h(got), h(cap), pct(got, cap), h(cap - got),
               bars(person_rows(vk), "The faint band behind each bar is that person's available hours. Past it is overtime."),
               bars(team_rows(vk)),
               bars(dim_rows(al["regions"], vk),
                    "Region comes from the market on each entry, not from where somebody sits."),
               bars(fn_rows(vk), "Function comes from the staff directory."),
               bars(dim_rows(al["clients"], vk)),
               bars(dim_rows(al["ptypes"], vk))))

    return panes, dict(
        people=people, avail=avail, away=away, order=order, teams=teams,
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
@media (prefers-reduced-motion:reduce){*{transition:none!important}}
@media (max-width:560px){.row{grid-template-columns:minmax(80px,1fr) minmax(50px,1.4fr) auto}}
"""


def page(pp, al):
    panes, d = build(pp, al)
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
            rate = pct(float(p["lhours"]), p["ldays"] * 8)
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

    leavenote = (" · %d on leave, left out of this week and the month so far" % away) if away else ""

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
  <div class="objhead"><span class="num">01</span><h2>Timesheet adoption</h2>
    <p>Is everyone using it, and is what they type reaching the data?</p></div>
  <div class="rule"></div>
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
  <div class="objhead"><span class="num">02</span><h2>Capacity planning</h2>
    <p>Where the hours went, per person, team, region and function.</p></div>
  <div class="rule"></div>
  <div class="viewtabs" role="tablist" aria-label="Time window">%s</div>
  %s
</section>

<div class="notes">
  <p><b>Capture rate is not utilisation.</b> It is hours written into the timesheet over hours
    available. A low rate means the time was not recorded; it cannot tell you whether it was worked.
    Treat the gap as missing data to chase, not as idle people.</p>
  <p><b>Teams launched on different dates.</b> Ramy Kamel's and Marina's teams on 1 October,
    Emad Mutter's and Nadia's on 16 October. Only the "since launch" window compares them on equal
    terms; the other two windows are for the week in front of you.</p>
  <p><b>Leave.</b> Anyone on leave keeps their row and their hours to date but is left out of this
    week and the month so far, so a team is not marked down for a holiday. The since-launch window
    still includes their full runway, which understates them.</p>
  <p><b>Region and function are incomplete.</b> %s h of work carries no market, and six people have
    no function in the staff directory, so both views show a large "Not set". The market is set when
    an entry is saved; the function comes from the OPS employee list.</p>
  <p><b>Rework</b> is any entry marked as an amend rather than a new task.</p>
  <p><b>Where the numbers come from.</b> Read live from the timesheet database at the snapshot time
    above, not from an export. A day counts as logged when it carries at least one entry with hours.</p>
</div>
</div>

<script>
(function(){
  var tabs=[].slice.call(document.querySelectorAll('.viewtabs button'));
  var panes=[].slice.call(document.querySelectorAll('.pane'));
  tabs.forEach(function(b){b.addEventListener('click',function(){
    tabs.forEach(function(o){o.setAttribute('aria-selected',String(o===b));});
    panes.forEach(function(p){p.hidden=(p.dataset.view!==b.dataset.v);});
    try{localStorage.setItem('kj-view',b.dataset.v);}catch(e){}
  });});
  try{var v=localStorage.getItem('kj-view');
    if(v){var t=tabs.filter(function(b){return b.dataset.v===v;})[0]; if(t)t.click();}}catch(e){}

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
      h(935.0))


def main():
    with open(sys.argv[1], encoding="utf-8") as fh:
        pp = json.load(fh)
    with open(sys.argv[2], encoding="utf-8") as fh:
        al = json.load(fh)
    sys.stdout.write(page(pp, al))


if __name__ == "__main__":
    main()
