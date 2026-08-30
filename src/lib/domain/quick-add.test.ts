import { describe, expect, it } from "vitest";

import { parseQuickAdd, type QuickAddSources } from "./quick-add";

/** Mirrors the real seeded reference data, including the awkward overlaps. */
const sources: QuickAddSources = {
  clients: [
    { id: "c-myf", name: "MYF" },
    { id: "c-baskin", name: "Baskin Robbins" },
    { id: "c-tim", name: "Tim Hortons" },
    { id: "c-castrol", name: "Castrol Oil" },
    { id: "c-keeta", name: "Keeta" },
  ],
  services: [
    { id: "s-copy", name: "Copywriting" },
    { id: "s-art", name: "Art & Design" },
    { id: "s-community", name: "Community Management" },
    { id: "s-media", name: "Media Buying" },
  ],
  projectTypes: [
    { id: "p1", name: "Monthly Social Calendar" },
    { id: "p2", name: "Campaign" },
    { id: "p3", name: "Amend" },
  ],
  taskTypes: [
    { id: "t1", name: "Copy" },
    { id: "t2", name: "Key Visual" },
    { id: "t3", name: "Briefing" },
    { id: "t4", name: "Attending Shoot" },
  ],
};

const parse = (input: string) => parseQuickAdd(input, sources);

describe("hours", () => {
  it("reads a bare number", () => {
    expect(parse("myf 3").hours).toBe(3);
  });

  it("reads an h suffix and decimals", () => {
    expect(parse("myf 3h").hours).toBe(3);
    expect(parse("myf 3.5h").hours).toBe(3.5);
    expect(parse("myf 3 hrs").hours).toBe(3);
    expect(parse("myf 2 hours").hours).toBe(2);
  });

  it("reads hours and minutes together", () => {
    expect(parse("myf 1h30").hours).toBe(1.5);
    expect(parse("myf 45m").hours).toBe(0.75);
  });

  it("returns null when no quantity is given", () => {
    expect(parse("myf copy").hours).toBeNull();
  });

  it("does not mistake a number inside a name for hours", () => {
    // Nothing numeric here at all.
    expect(parse("baskin robbins key visual").hours).toBeNull();
  });
});

describe("matching", () => {
  it("matches a client by exact name", () => {
    expect(parse("myf 3h").clientId).toBe("c-myf");
  });

  it("matches a multi-word client", () => {
    expect(parse("baskin robbins 4h").clientId).toBe("c-baskin");
  });

  it("matches on a prefix", () => {
    expect(parse("castrol 2h").clientId).toBe("c-castrol");
    expect(parse("tim hortons 2h").clientId).toBe("c-tim");
  });

  it("resolves the Copy versus Copywriting overlap in favour of the exact word", () => {
    // "copy" exactly equals the task, so the task should win it, leaving the
    // service unset rather than both fields fighting over one token.
    const result = parse("myf copy 3h");
    expect(result.task).toBe("Copy");
    expect(result.clientId).toBe("c-myf");
  });

  it("fills service and task when both are named", () => {
    const result = parse("myf copywriting copy 3h");
    expect(result.serviceId).toBe("s-copy");
    expect(result.task).toBe("Copy");
  });

  it("is order independent", () => {
    const a = parse("3h myf campaign key visual");
    const b = parse("key visual campaign myf 3h");
    expect(a.clientId).toBe(b.clientId);
    expect(a.projectType).toBe(b.projectType);
    expect(a.task).toBe(b.task);
    expect(a.hours).toBe(b.hours);
  });

  it("ignores case and punctuation", () => {
    const result = parse("MYF, Art & Design — 2.5h");
    expect(result.clientId).toBe("c-myf");
    expect(result.serviceId).toBe("s-art");
    expect(result.hours).toBe(2.5);
  });

  it("stores project type and task by name, and client and service by id", () => {
    const result = parse("keeta campaign briefing 1h");
    expect(result.clientId).toBe("c-keeta");
    expect(result.projectType).toBe("Campaign");
    expect(result.task).toBe("Briefing");
  });

  it("reports what it understood", () => {
    const result = parse("myf campaign 3h");
    const fields = result.matched.map((m) => m.field);
    expect(fields).toContain("clientId");
    expect(fields).toContain("projectType");
  });
});

describe("leftovers", () => {
  it("keeps words it could not place", () => {
    const result = parse("myf 3h ramadan teaser");
    expect(result.clientId).toBe("c-myf");
    expect(result.leftover).toBe("ramadan teaser");
  });

  it("leaves everything over when nothing matches", () => {
    const result = parse("something entirely unrelated");
    expect(result.clientId).toBeNull();
    expect(result.serviceId).toBeNull();
    expect(result.leftover).toBe("something entirely unrelated");
  });

  it("consumes the hours token rather than leaving it in the note", () => {
    expect(parse("myf 3h").leftover).toBe("");
    expect(parse("myf 3 hrs").leftover).toBe("");
  });

  it("handles an empty input without throwing", () => {
    const result = parse("");
    expect(result.hours).toBeNull();
    expect(result.leftover).toBe("");
    expect(result.matched).toEqual([]);
  });

  it("never assigns one word to two fields", () => {
    const result = parse("copy");
    const used = [result.clientId, result.serviceId, result.projectType, result.task].filter(
      Boolean,
    );
    expect(used).toHaveLength(1);
  });
});
