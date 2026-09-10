import { describe, expect, it } from "vitest";

import {
  clientStaffingView,
  clientsIn,
  fullDetailView,
  perBusinessUnitView,
  perClientByDayView,
  perClientView,
  perFunctionView,
  perDayView,
  perMonthView,
  perPositionView,
  perProjectTypeView,
  perSubUnitView,
  perWeekView,
  summaryView,
  type DetailEmployee,
  type DetailRow,
} from "@/lib/export/employee-detail";

function row(overrides: Partial<DetailRow> = {}): DetailRow {
  return {
    employeeId: "e1",
    employeeName: "Noor Hussam",
    title: "Strategy Director",
    jobFunction: "Strategy",
    department: "Strategy",
    businessUnit: "Strategy",
    subUnit: "Strategy & Planning",
    market: "EG",
    workDate: "2026-09-01",
    clientCode: "CLI-001",
    clientName: "Bioderma",
    projectType: "Reels",
    scope: "in_scope",
    billable: true,
    hours: 4,
    ...overrides,
  };
}

function person(overrides: Partial<DetailEmployee> = {}): DetailEmployee {
  return {
    id: "e1",
    name: "Noor Hussam",
    email: "noor@kijamii.com",
    title: "Strategy Director",
    jobFunction: "Strategy",
    department: "Strategy",
    businessUnit: "Strategy",
    subUnit: "Strategy & Planning",
    employeeCode: null,
    primaryMarket: "EG",
    ...overrides,
  };
}

describe("summaryView", () => {
  it("totals hours, distinct days and distinct accounts", () => {
    const shaped = summaryView(
      [
        row({ hours: 4 }),
        row({ hours: 2, clientName: "Visa" }),
        row({ hours: 3, workDate: "2026-09-02" }),
      ],
      [person()],
    );

    expect(shaped.rows).toHaveLength(1);
    const [name, title, dept, total, days, accounts, avg] = shaped.rows[0]!;
    expect(name).toBe("Noor Hussam");
    expect(title).toBe("Strategy Director");
    expect(dept).toBe("Strategy");
    expect(total).toBe(9);
    expect(days).toBe(2);
    expect(accounts).toBe(2);
    expect(avg).toBe(4.5);
  });

  it("keeps somebody who logged nothing, at zero", () => {
    const shaped = summaryView([], [person(), person({ id: "e2", name: "Bahy" })]);
    expect(shaped.rows.map((r) => [r[0], r[3], r[4]])).toEqual([
      ["Bahy", 0, 0],
      ["Noor Hussam", 0, 0],
    ]);
  });
});

describe("perDayView", () => {
  it("sums a day's rows into one line", () => {
    const shaped = perDayView([
      row({ hours: 4 }),
      row({ hours: 2.5, clientName: "Visa" }),
      row({ hours: 1, workDate: "2026-09-02" }),
    ]);

    expect(shaped.rows).toEqual([
      ["Noor Hussam", "2026-09-01", 6.5],
      ["Noor Hussam", "2026-09-02", 1],
    ]);
  });

  it("does not merge two people who worked the same day", () => {
    const shaped = perDayView([
      row({ hours: 4 }),
      row({ employeeId: "e2", employeeName: "Bahy Abo El Ezz", hours: 3 }),
    ]);
    expect(shaped.rows).toHaveLength(2);
  });
});

describe("perClientView", () => {
  it("reports each account's share of that person's time, biggest first", () => {
    const shaped = perClientView([
      row({ hours: 2, clientName: "Visa" }),
      row({ hours: 6, clientName: "Bioderma" }),
    ]);

    expect(shaped.rows).toEqual([
      ["Noor Hussam", "Bioderma", 6, "75%"],
      ["Noor Hussam", "Visa", 2, "25%"],
    ]);
  });

  it("keeps names and accounts whole when both contain spaces", () => {
    // The compound key is why this passes: splitting on a space would have
    // turned "Bahy Abo El Ezz" and "Orange Corners" into fragments.
    const shaped = perClientView([
      row({ employeeId: "e2", employeeName: "Bahy Abo El Ezz", clientName: "Orange Corners" }),
    ]);
    expect(shaped.rows[0]![0]).toBe("Bahy Abo El Ezz");
    expect(shaped.rows[0]![1]).toBe("Orange Corners");
  });
});

describe("perClientByDayView", () => {
  it("puts days across the top and totals each account's row", () => {
    const shaped = perClientByDayView([
      row({ hours: 4, workDate: "2026-09-01", clientName: "Bioderma" }),
      row({ hours: 3, workDate: "2026-09-02", clientName: "Bioderma" }),
      row({ hours: 1, workDate: "2026-09-02", clientName: "Visa" }),
    ]);

    expect(shaped.headers).toEqual(["employee", "client", "2026-09-01", "2026-09-02", "total"]);
    expect(shaped.rows).toEqual([
      ["Noor Hussam", "Bioderma", 4, 3, 7],
      ["Noor Hussam", "Visa", 0, 1, 1],
    ]);
  });

  it("agrees with the per-day view on the same rows", () => {
    const rows = [
      row({ hours: 4, clientName: "Bioderma" }),
      row({ hours: 2, clientName: "Visa" }),
      row({ hours: 3, workDate: "2026-09-02", clientName: "Visa" }),
    ];
    const gridTotal = perClientByDayView(rows).rows.reduce((sum, r) => sum + Number(r.at(-1)), 0);
    const dayTotal = perDayView(rows).rows.reduce((sum, r) => sum + Number(r[2]), 0);
    expect(gridTotal).toBe(dayTotal);
  });
});

describe("perPositionView", () => {
  it("groups by position and counts the people behind each", () => {
    const shaped = perPositionView([
      row({ hours: 4 }),
      row({ hours: 2, employeeId: "e3", employeeName: "Someone", title: "Strategy Director" }),
      row({ hours: 6, employeeId: "e2", employeeName: "Bahy", title: "Creative Director" }),
    ]);

    expect(shaped.rows).toEqual([
      ["Creative Director", 1, 6, "50%"],
      ["Strategy Director", 2, 6, "50%"],
    ]);
  });

  it("shows people with no position rather than dropping their hours", () => {
    const shaped = perPositionView([row({ hours: 5, title: null })]);
    expect(shaped.rows[0]![0]).toBe("No position set");
    expect(shaped.rows[0]![2]).toBe(5);
  });
});

describe("fullDetailView", () => {
  it("emits one line per entry with the sheet's own column names", () => {
    const shaped = fullDetailView([
      row({ hours: 4, projectType: "Campaign", clientName: "BTC", market: "EG" }),
    ]);

    expect(shaped.headers).toEqual([
      "Name",
      "Day",
      "Market",
      "Department",
      "Title",
      "Account",
      "Project",
      "Hours",
    ]);
    expect(shaped.rows[0]).toEqual([
      "Noor Hussam",
      "2026-09-01",
      "EG",
      "Strategy",
      "Strategy Director",
      "BTC",
      "Campaign",
      4,
    ]);
  });

  it("does not aggregate: two entries on one day stay two lines", () => {
    const shaped = fullDetailView([
      row({ hours: 4, clientName: "BTC" }),
      row({ hours: 5, clientName: "Castrol Oil" }),
    ]);
    expect(shaped.rows).toHaveLength(2);
  });

  it("totals the same as the per-day view, since both fold the same rows", () => {
    const rows = [
      row({ hours: 4 }),
      row({ hours: 5, clientName: "Castrol Oil" }),
      row({ hours: 6, workDate: "2026-09-02", clientName: "Carrefour" }),
    ];
    const flat = fullDetailView(rows).rows.reduce((sum, r) => sum + Number(r[7]), 0);
    const daily = perDayView(rows).rows.reduce((sum, r) => sum + Number(r[2]), 0);
    expect(flat).toBe(daily);
  });

  it("leaves a blank rather than the word null where a title is unset", () => {
    const shaped = fullDetailView([row({ title: null, department: null })]);
    expect(shaped.rows[0]![4]).toBe("");
    expect(shaped.rows[0]![3]).toBe("");
  });
});

describe("perWeekView", () => {
  it("anchors a week to the Sunday it starts on, matching the timesheet", () => {
    // 9 and 10 Sep 2026 are the Wednesday and Thursday of the week beginning
    // Sunday 6 Sep; 13 Sep is the Sunday after, and belongs to the next week.
    const shaped = perWeekView([
      row({ hours: 4, workDate: "2026-09-09" }),
      row({ hours: 2, workDate: "2026-09-10" }),
      row({ hours: 3, workDate: "2026-09-13" }),
    ]);

    expect(shaped.rows).toEqual([
      ["Noor Hussam", "2026-09-06", "6 – 12 Sep 2026", 6],
      ["Noor Hussam", "2026-09-13", "13 – 19 Sep 2026", 3],
    ]);
  });

  it("totals the same as the per-day view, since both fold the same rows", () => {
    const rows = [
      row({ hours: 4, workDate: "2026-09-09" }),
      row({ hours: 2.5, workDate: "2026-09-10" }),
      row({ hours: 3, workDate: "2026-09-16" }),
    ];
    const weekly = perWeekView(rows).rows.reduce((sum, r) => sum + Number(r[3]), 0);
    const daily = perDayView(rows).rows.reduce((sum, r) => sum + Number(r[2]), 0);
    expect(weekly).toBe(daily);
  });
});

describe("perMonthView", () => {
  it("groups by calendar month, sortable as written", () => {
    const shaped = perMonthView([
      row({ hours: 4, workDate: "2026-08-31" }),
      row({ hours: 2, workDate: "2026-09-01" }),
      row({ hours: 1, workDate: "2026-09-30" }),
    ]);

    expect(shaped.rows).toEqual([
      ["Noor Hussam", "2026-08", 4],
      ["Noor Hussam", "2026-09", 3],
    ]);
  });

  it("does not merge two people who worked the same month", () => {
    const shaped = perMonthView([
      row({ hours: 4 }),
      row({ employeeId: "e2", employeeName: "Bahy Abo El Ezz", hours: 3 }),
    ]);
    expect(shaped.rows).toHaveLength(2);
  });
});

describe("the views that group by one attribute", () => {
  /*
   * All five are the same fold over a different field, so these test the
   * shared behaviour once and then check each view reads the field it says it
   * does. The property that matters is that none of them lose hours: a row
   * with nothing in the field is grouped under a name rather than dropped, so
   * every view still totals the same as every other.
   */
  const rows = [
    row({
      hours: 4,
      title: "Art Director",
      jobFunction: "Art",
      businessUnit: "Creative",
      subUnit: "Sports",
      projectType: "Campaign",
    }),
    row({
      employeeId: "e2",
      employeeName: "Bahy",
      hours: 6,
      title: "Copywriter",
      jobFunction: "Copywriting",
      businessUnit: "Creative",
      subUnit: "REG 1",
      projectType: "Reels",
    }),
  ];

  it("reads the field each one names", () => {
    expect(
      perPositionView(rows)
        .rows.map((r) => r[0])
        .sort(),
    ).toEqual(["Art Director", "Copywriter"]);
    expect(
      perFunctionView(rows)
        .rows.map((r) => r[0])
        .sort(),
    ).toEqual(["Art", "Copywriting"]);
    expect(
      perSubUnitView(rows)
        .rows.map((r) => r[0])
        .sort(),
    ).toEqual(["REG 1", "Sports"]);
    expect(
      perProjectTypeView(rows)
        .rows.map((r) => r[0])
        .sort(),
    ).toEqual(["Campaign", "Reels"]);
  });

  it("collapses two people who share a business unit, and counts both", () => {
    const shaped = perBusinessUnitView(rows);
    expect(shaped.rows).toEqual([["Creative", 2, 10, "100%"]]);
  });

  it("keeps hours whose field is empty rather than dropping them", () => {
    const shaped = perFunctionView([
      ...rows,
      row({ employeeId: "e3", hours: 5, jobFunction: null }),
    ]);
    expect(shaped.rows.find((r) => r[0] === "No function set")?.[2]).toBe(5);
    expect(shaped.rows.reduce((sum, r) => sum + Number(r[2]), 0)).toBe(15);
  });

  it("totals the same as the per-day view, whichever field it groups by", () => {
    const daily = perDayView(rows).rows.reduce((sum, r) => sum + Number(r[2]), 0);
    for (const view of [
      perPositionView,
      perFunctionView,
      perBusinessUnitView,
      perSubUnitView,
      perProjectTypeView,
    ]) {
      expect(view(rows).rows.reduce((sum, r) => sum + Number(r[2]), 0)).toBe(daily);
    }
  });
});

describe("clientStaffingView", () => {
  const roster = [
    person(),
    person({
      id: "e2",
      name: "Bahy Abo El Ezz",
      title: "Art Director",
      jobFunction: "Art",
      businessUnit: "Creative",
      subUnit: "Sports",
      primaryMarket: "KSA",
    }),
  ];

  it("lists everybody on the account, heaviest first, described by the roster", () => {
    const shaped = clientStaffingView(
      [
        row({ hours: 2, clientName: "Castrol Oil" }),
        row({
          hours: 6,
          clientName: "Castrol Oil",
          employeeId: "e2",
          employeeName: "Bahy Abo El Ezz",
        }),
        row({ hours: 9, clientName: "Carrefour" }),
      ],
      roster,
      "Castrol Oil",
    );

    expect(shaped.headers).toEqual([
      "employee",
      "entity",
      "business_unit",
      "sub_unit",
      "function",
      "title",
      "hours",
    ]);
    expect(shaped.rows).toEqual([
      ["Bahy Abo El Ezz", "KSA", "Creative", "Sports", "Art", "Art Director", 6],
      ["Noor Hussam", "EG", "Strategy", "Strategy & Planning", "Strategy", "Strategy Director", 2],
    ]);
  });

  it("describes the person from the roster, not from the entry they logged", () => {
    /*
     * The entry's market is the client's, and the two disagree on purpose:
     * the employee list has Egypt-entity staff on KSA business. Reading the
     * entity off the row would file an Egyptian employee under KSA because
     * that is where the account sits.
     */
    const shaped = clientStaffingView(
      [row({ hours: 4, clientName: "Castrol Oil", market: "KSA" })],
      roster,
      "Castrol Oil",
    );
    expect(shaped.rows[0]![1]).toBe("EG");
  });

  it("counts only the account asked for", () => {
    const shaped = clientStaffingView(
      [row({ hours: 3, clientName: "Castrol Oil" }), row({ hours: 5, clientName: "Carrefour" })],
      roster,
      "Castrol Oil",
    );
    expect(shaped.rows).toHaveLength(1);
    expect(shaped.rows[0]![6]).toBe(3);
  });

  it("offers every client that has hours, in name order", () => {
    expect(
      clientsIn([
        row({ clientName: "Carrefour" }),
        row({ clientName: "Castrol Oil" }),
        row({ clientName: "Carrefour" }),
      ]),
    ).toEqual(["Carrefour", "Castrol Oil"]);
  });
});
