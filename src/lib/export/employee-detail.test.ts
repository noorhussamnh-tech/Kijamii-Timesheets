import { describe, expect, it } from "vitest";

import {
  perAccountByDayView,
  perAccountView,
  perDayView,
  perTitleView,
  summaryView,
  type DetailEmployee,
  type DetailRow,
} from "@/lib/export/employee-detail";

function row(overrides: Partial<DetailRow> = {}): DetailRow {
  return {
    employeeId: "e1",
    employeeName: "Noor Hussam",
    title: "Strategy Director",
    department: "Strategy",
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
    department: "Strategy",
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

describe("perAccountView", () => {
  it("reports each account's share of that person's time, biggest first", () => {
    const shaped = perAccountView([
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
    const shaped = perAccountView([
      row({ employeeId: "e2", employeeName: "Bahy Abo El Ezz", clientName: "Orange Corners" }),
    ]);
    expect(shaped.rows[0]![0]).toBe("Bahy Abo El Ezz");
    expect(shaped.rows[0]![1]).toBe("Orange Corners");
  });
});

describe("perAccountByDayView", () => {
  it("puts days across the top and totals each account's row", () => {
    const shaped = perAccountByDayView([
      row({ hours: 4, workDate: "2026-09-01", clientName: "Bioderma" }),
      row({ hours: 3, workDate: "2026-09-02", clientName: "Bioderma" }),
      row({ hours: 1, workDate: "2026-09-02", clientName: "Visa" }),
    ]);

    expect(shaped.headers).toEqual(["employee", "account", "2026-09-01", "2026-09-02", "total"]);
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
    const gridTotal = perAccountByDayView(rows).rows.reduce((sum, r) => sum + Number(r.at(-1)), 0);
    const dayTotal = perDayView(rows).rows.reduce((sum, r) => sum + Number(r[2]), 0);
    expect(gridTotal).toBe(dayTotal);
  });
});

describe("perTitleView", () => {
  it("groups by title and counts the people behind each", () => {
    const shaped = perTitleView([
      row({ hours: 4 }),
      row({ hours: 2, employeeId: "e3", employeeName: "Someone", title: "Strategy Director" }),
      row({ hours: 6, employeeId: "e2", employeeName: "Bahy", title: "Creative Director" }),
    ]);

    expect(shaped.rows).toEqual([
      ["Creative Director", 1, 6, "50%"],
      ["Strategy Director", 2, 6, "50%"],
    ]);
  });

  it("shows people with no title rather than dropping their hours", () => {
    const shaped = perTitleView([row({ hours: 5, title: null })]);
    expect(shaped.rows[0]![0]).toBe("No title set");
    expect(shaped.rows[0]![2]).toBe(5);
  });
});
