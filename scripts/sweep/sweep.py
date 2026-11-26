#!/usr/bin/env python3
"""
The daily sweep: read the checks, cross-check the report, decide whether to shout.

    python3 sweep.py findings.json report-payload.json [--weekday 0-6]

findings.json is what checks.sql returns. report-payload.json is what
query.sql returns -- the same payload the page is built from, so the invariants
below test the figures the report actually renders rather than a reimplementation
of them.

Prints a VERDICT line, then the body of the mail. Silence is the normal result:
a sweep that mails every morning is a sweep nobody reads by the second week. It
mails when something is wrong, when it has fixed something, and once a week
whatever happens, so an absence of mail can be told apart from a routine that
quietly stopped running.
"""
import datetime as dt
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
LEAVE = os.path.join(HERE, "..", "adoption-report", "leave.json")
# A name on the leave list that has logged within this many days is stale. Short
# enough to catch somebody back at their desk, long enough not to trip on a
# backfill they filed on their way out.
LEAVE_STALE_DAYS = 10


def h(x):
    """Hours as a bare number. The unit is added by the caller, once."""
    if x is None:
        return ""
    return ("%.2f" % float(x)).rstrip("0").rstrip(".") or "0"


def near(a, b, tol=0.005):
    return abs(float(a or 0) - float(b or 0)) <= tol


def invariants(pp):
    """What must be true of the payload, whatever the data says.

    These exist because the page spent three days quietly disagreeing with
    itself: the month-to-date pane summed hours over working days while the
    month-over-month table summed the same month over the calendar, and nothing
    compared the two. Any future edit that reintroduces that kind of split
    fails here on the morning it ships, not whenever somebody happens to notice.
    """
    out = []
    people = pp.get("people") or []
    mo, months = pp.get("month") or {}, pp.get("months") or []

    if not people:
        out.append(("alarm", "The report has no people in it",
                    "the cohort query returned nothing", None, None))
        return out

    cur = next((m for m in months if m.get("key") == mo.get("key")), None)
    if cur is None:
        out.append(("alarm", "The current month is missing from month-over-month",
                    "month.key is %s; months[] has %s"
                    % (mo.get("key"), ", ".join(m.get("key", "?") for m in months)), None, None))
    else:
        mtd = sum(float(p.get("mt_hours") or 0) for p in people)
        if not near(mtd, cur.get("hours")):
            out.append(("alarm", "Month to date and month-over-month disagree",
                        "the panes sum %s h for %s, the month row says %s h -- the same month, "
                        "two different answers" % (h(mtd), mo.get("label"), h(cur.get("hours"))),
                        None, abs(float(mtd) - float(cur.get("hours") or 0))))
        cap = float(mo.get("cap") or 0) * len(people)
        if not near(cap, cur.get("cap")):
            out.append(("alarm", "Month to date and month-over-month assume different capacity",
                        "%s h against %s h" % (h(cap), h(cur.get("cap"))),
                        None, abs(cap - float(cur.get("cap") or 0))))

    alltime = sum(float(p.get("hours") or 0) for p in people)
    inmonths = sum(float(m.get("hours") or 0) for m in months)
    if inmonths - alltime > 0.005:
        out.append(("alarm", "The months hold more hours than exist",
                    "%s h across the months, %s h in total" % (h(inmonths), h(alltime)),
                    None, inmonths - alltime))

    pv = pp.get("prev_pace") or {}
    if pv and mo.get("days") and pv.get("days") and int(pv["days"]) != int(mo["days"]):
        out.append(("alarm", "The like-for-like comparison is not like for like",
                    "this month has %s elapsed working days, the comparison window has %s"
                    % (mo["days"], pv["days"]), None, None))

    for p in people:
        if not p.get("name") or not p.get("team"):
            out.append(("alarm", "A person in the cohort has no name or no team",
                        json.dumps({k: p.get(k) for k in ("name", "team", "seat")}), None, None))
        if float(p.get("lcap") or 0) <= 0:
            out.append(("alarm", "A person has no capacity since launch",
                        "%s, launched %s" % (p.get("name"), p.get("launch")), None, None))
    return out


def leave_check(pp, today):
    """Anyone on the leave list who is demonstrably not on leave.

    This is the one finding the sweep is expected to fix by itself. A stale name
    does not merely mislabel somebody: it removes them and their whole capacity
    from the week and the month, so the headline is computed over the wrong
    number of people and reads better than the truth.
    """
    try:
        with open(os.path.normpath(LEAVE), encoding="utf-8") as fh:
            names = [x["name"] for x in json.load(fh).get("on_leave", [])]
    except (OSError, ValueError, KeyError):
        return [("alarm", "leave.json could not be read", LEAVE, None, None)]

    last = {p.get("name"): p.get("last") for p in (pp.get("people") or [])}
    out = []
    for n in names:
        d = last.get(n)
        if not d:
            continue
        try:
            gap = (today - dt.date.fromisoformat(d)).days
        except ValueError:
            continue
        if gap <= LEAVE_STALE_DAYS:
            out.append(("fix", "On the leave list but still logging",
                        "%s last logged %s, %d day%s ago. Take them off leave.json, commit, and "
                        "fast-forward main." % (n, d, gap, "" if gap == 1 else "s"), None, None))
    return out


def main():
    findings = json.load(open(sys.argv[1], encoding="utf-8"))
    pp = json.load(open(sys.argv[2], encoding="utf-8"))
    today = dt.date.today()

    rows = [(f.get("sev"), f.get("title"), f.get("detail"), f.get("n"), f.get("hours"))
            for f in findings]
    rows = leave_check(pp, today) + invariants(pp) + rows

    by = {"fix": [], "alarm": [], "watch": []}
    for r in rows:
        by.get(r[0], by["watch"]).append(r)

    # Sunday is the start of the working week here, and the day a silent routine
    # should prove it is still alive.
    weekly = today.weekday() == 6
    send = bool(by["alarm"] or by["fix"]) or weekly
    print("VERDICT alarm=%d fix=%d watch=%d send=%s"
          % (len(by["alarm"]), len(by["fix"]), len(by["watch"]), "yes" if send else "no"))
    if not send:
        return

    L = []
    if by["alarm"] or by["fix"]:
        L.append("The timesheet sweep found something.")
    else:
        L.append("The timesheet sweep found nothing wrong. This is the weekly note that it ran.")
    L.append("")
    L.append("Snapshot %s. %d people in the pilot, %s h captured to date."
             % (pp.get("snapshot", "?"), len(pp.get("people") or []),
                h(sum(float(p.get("hours") or 0) for p in (pp.get("people") or [])))))
    L.append("Page: https://claude.ai/artifact/QGTx6up2jsFBTcwt92yNKv")

    for key, head, note in (
        ("fix", "FIXED, OR NEEDS FIXING NOW",
         "Each of these is an instruction, not an observation."),
        ("alarm", "WRONG, AND SOMEBODY'S WORK IS AFFECTED",
         "Either hours are invisible to the report, or two parts of it disagree."),
        ("watch", "WORTH KNOWING",
         "Nothing here is broken. It is the data people have not finished filling in."),
    ):
        if not by[key]:
            continue
        L += ["", head, "-" * len(head), note, ""]
        last_title = None
        for _sev, title, detail, n, hrs in by[key]:
            if title != last_title:
                L.append("* " + title)
                last_title = title
            bits = [b for b in ("    " + (detail or ""),
                                ("%d row%s" % (n, "" if n == 1 else "s")) if n else "",
                                (h(hrs) + " h") if hrs is not None else "") if b and b.strip()]
            L.append("    ".join(bits) if len(bits) > 1 else bits[0])

    L += ["", "What this is. A query over the live timesheet database, run every morning before "
              "the adoption report, looking for the ways this data has gone wrong before: work "
              "logged by somebody the report cannot see, a stale leave entry that drops a working "
              "person out of the headline, two parts of the page disagreeing about the same month, "
              "and entries that cannot be submitted as they stand. It changes nothing in the app "
              "and never touches anybody's timesheet.",
          "", "Checks live in scripts/sweep/checks.sql; the cross-checks against the report in "
              "scripts/sweep/sweep.py."]
    print("\n".join(L))


if __name__ == "__main__":
    main()
