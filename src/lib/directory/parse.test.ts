import { describe, expect, it } from "vitest";

import { parseDirectoryCsv, readCsv } from "./parse";

const HEAD = "x,Email,Entity,Business Unit,Sub-Unit,Function,Manager,Team,Dedication %";

describe("readCsv", () => {
  it("keeps commas and newlines that live inside quotes", () => {
    const rows = readCsv('a,"b,c","d\ne",f');
    expect(rows).toEqual([["a", "b,c", "d\ne", "f"]]);
  });

  it("reads a doubled quote as one quote", () => {
    expect(readCsv('"she said ""no"""')).toEqual([['she said "no"']]);
  });

  it("treats CRLF as one line break", () => {
    expect(readCsv("a,b\r\nc,d")).toEqual([
      ["a", "b"],
      ["c", "d"],
    ]);
  });

  it("drops a byte-order mark so the first heading still matches", () => {
    expect(readCsv("﻿Email,Team")[0]![0]).toBe("Email");
  });
});

describe("parseDirectoryCsv", () => {
  it("folds a person's several team rows into one record", () => {
    const csv = [
      HEAD,
      "Eman Lotfy,eman.lotfy@kijamii.com,,Creative,REG 1,Art,Ramy Kamel,AMCC REG EG,23%",
      "Eman Lotfy,eman.lotfy@kijamii.com,,Creative,REG 1,Art,Ramy Kamel,AMCC REG UAE,77%",
    ].join("\n");

    const out = parseDirectoryCsv(csv);
    expect(out.problems).toEqual([]);
    expect(out.people).toHaveLength(1);
    expect(out.people[0]!.sub_unit).toBe("REG 1");
    expect(out.dedication).toEqual([
      { email: "eman.lotfy@kijamii.com", team: "AMCC REG EG", pct: 23 },
      { email: "eman.lotfy@kijamii.com", team: "AMCC REG UAE", pct: 77 },
    ]);
  });

  it("lets a later row fill a gap but never overwrite an answer", () => {
    const csv = [
      HEAD,
      "Abdulrahman,abdulrahman@kijamii.com,,Creative,REG 1,Art,Ramy,AMCC REG EG,23%",
      "Abdulrahman,abdulrahman@kijamii.com,UAE,Creative,REG 1,Art,Ramy,AMCC REG UAE,77%",
    ].join("\n");

    expect(parseDirectoryCsv(csv).people[0]!.entity).toBe("UAE");
  });

  it("reports one address given two names instead of picking", () => {
    const csv = [
      HEAD,
      "Mariam Taher Ali,mariam.taher@kijamii.com,,Client Servicing,AMCC KSA,AM,Shahira,AMCC KSA,100%",
      "Mariam Danina,mariam.taher@kijamii.com,,Client Servicing,AMCC KSA,AM,Dalia,AMCC KSA,100%",
    ].join("\n");

    const out = parseDirectoryCsv(csv);
    expect(out.problems.some((p) => p.detail.includes("is given as both"))).toBe(true);
    expect(out.problems.some((p) => p.line === 3)).toBe(true);
  });

  it("reports a person staffed past 100%", () => {
    const csv = [
      HEAD,
      "Shorouk,shorouk@kijamii.com,,MPB,MPB,Media,Bahy,MPB EGY,61%",
      "Shorouk,shorouk@kijamii.com,,MPB,MPB,Media,Bahy,MPB KSA,34%",
      "Shorouk,shorouk@kijamii.com,,MPB,MPB,Media,Bahy,MPB UAE,6%",
    ].join("\n");

    expect(parseDirectoryCsv(csv).problems.some((p) => p.detail.includes("101%"))).toBe(true);
  });

  it("accepts exactly 100% without complaint", () => {
    const csv = [
      HEAD,
      "Ok Person,ok@kijamii.com,UAE,Creative,REG 1,Art,Ramy,AMCC REG EG,40%",
      "Ok Person,ok@kijamii.com,UAE,Creative,REG 1,Art,Ramy,AMCC REG UAE,60%",
    ].join("\n");

    expect(parseDirectoryCsv(csv).problems).toEqual([]);
  });

  it("reads a percentage however the sheet formatted it", () => {
    const csv = [
      HEAD,
      "A,a@kijamii.com,UAE,C,R,Art,M,Team One,0.77",
      "B,b@kijamii.com,UAE,C,R,Art,M,Team Two,23",
    ].join("\n");

    const out = parseDirectoryCsv(csv);
    expect(out.dedication[0]!.pct).toBe(77);
    expect(out.dedication[1]!.pct).toBe(23);
  });

  it("names the line of a row with no usable email", () => {
    const csv = [HEAD, "Hassan Kamal,n/a,,Finance,Admin,Security,Yusr,,"].join("\n");

    const out = parseDirectoryCsv(csv);
    expect(out.people).toEqual([]);
    expect(out.problems[0]!.line).toBe(2);
    expect(out.problems[0]!.detail).toContain("Hassan Kamal");
  });

  it("finds the columns when they have been reordered or renamed", () => {
    const csv = [
      "Email,Full Name,Reports To,Team,Dedication",
      "z@kijamii.com,Zed Zee,Ramy,AMCC REG EG,100%",
    ].join("\n");

    const out = parseDirectoryCsv(csv);
    expect(out.people[0]).toMatchObject({ full_name: "Zed Zee", manager: "Ramy" });
    expect(out.dedication[0]!.pct).toBe(100);
  });

  it("skips the blank rows a spreadsheet pads its grid with", () => {
    const csv = [HEAD, "A,a@kijamii.com,UAE,C,R,Art,M,T,100%", ",,,,,,,,", ",,,,,,,,"].join("\n");

    const out = parseDirectoryCsv(csv);
    expect(out.rowsRead).toBe(1);
    expect(out.problems).toEqual([]);
  });

  it("says so plainly when there is no heading at all", () => {
    const out = parseDirectoryCsv("just,some,text\n1,2,3");
    expect(out.people).toEqual([]);
    expect(out.problems[0]!.detail).toContain("No heading row");
  });
});
