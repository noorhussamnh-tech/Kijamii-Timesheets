/**
 * Quick add: turn one line of text into a timesheet row.
 *
 * "myf copy 3h" should become MYF / Copywriting / 3 hours without opening a
 * single dropdown. The five selects still exist and still work -- this is a
 * faster path for people who know what they did, not a replacement.
 *
 * Matching is deliberately forgiving (case, punctuation, abbreviations) but
 * never guesses: a token that matches nothing is left in the description
 * rather than being forced onto the closest field.
 */
import type { ReferenceOption } from "./types";

export type QuickAddField = "clientId" | "serviceId" | "projectType" | "task";

export interface QuickAddSources {
  clients: ReferenceOption[];
  services: ReferenceOption[];
  projectTypes: ReferenceOption[];
  taskTypes: ReferenceOption[];
}

export interface QuickAddResult {
  clientId: string | null;
  serviceId: string | null;
  projectType: string | null;
  task: string | null;
  hours: number | null;
  /** Tokens that matched nothing, kept for the free-text note. */
  leftover: string;
  /** Which fields were filled, for showing the person what was understood. */
  matched: { field: QuickAddField; label: string }[];
}

/** Lowercases and replaces punctuation with spaces so "R&D" tokenises. */
function normalise(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9.]+/g, " ")
    .trim();
}

function tokenise(value: string): string[] {
  return normalise(value).split(" ").filter(Boolean);
}

/**
 * Pulls the hours out, accepting "3", "3h", "3.5h", "45m" or "1h30".
 * Returns the value and the token indexes it consumed.
 */
function extractHours(tokens: string[]): { hours: number | null; used: Set<number> } {
  const used = new Set<number>();

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]!;

    // "1h30" or "1h"
    const combined = /^(\d+(?:\.\d+)?)h(\d{1,2})?$/.exec(token);
    if (combined) {
      const whole = Number(combined[1]);
      const minutes = combined[2] ? Number(combined[2]) : 0;
      used.add(i);
      return { hours: whole + minutes / 60, used };
    }

    // "45m"
    const minutesOnly = /^(\d+)m$/.exec(token);
    if (minutesOnly) {
      used.add(i);
      return { hours: Number(minutesOnly[1]) / 60, used };
    }

    // A bare number, optionally followed by a separate "h" or "hrs".
    if (/^\d+(?:\.\d+)?$/.test(token)) {
      const next = tokens[i + 1];
      used.add(i);
      if (next && /^h(rs?|ours?)?$/.test(next)) used.add(i + 1);
      return { hours: Number(token), used };
    }
  }

  return { hours: null, used };
}

interface Candidate {
  field: QuickAddField;
  id: string;
  label: string;
  score: number;
  span: number[];
}

/**
 * Scores one reference option against the input tokens.
 *
 * A name matches when each of its words is present as a token or as a token's
 * prefix, so "copy" reaches "Copywriting" and "social" reaches "Monthly Social
 * Calendar". Longer, more complete matches score higher, which is what stops
 * "Copy" and "Copywriting" from being decided arbitrarily.
 */
function scoreOption(name: string, tokens: string[], taken: Set<number>): Candidate["span"] | null {
  const words = tokenise(name);
  if (words.length === 0) return null;

  const span: number[] = [];
  let cursor = 0;

  for (const word of words) {
    for (let i = cursor; i < tokens.length; i++) {
      if (taken.has(i) || span.includes(i)) continue;
      const token = tokens[i]!;
      const exact = token === word;
      // A prefix only counts from three characters, so a stray "a" or "of"
      // cannot drag in a name it has nothing to do with.
      const prefix = token.length >= 3 && (word.startsWith(token) || token.startsWith(word));
      if (exact || prefix) {
        span.push(i);
        cursor = i + 1;
        break;
      }
    }
  }

  // Half the name is enough: "castrol" should find "Castrol Oil", and
  // "baskin" should find "Baskin Robbins", without needing the full name.
  if (span.length === 0 || span.length / words.length < 0.5) return null;
  return span;
}

function candidatesFor(
  field: QuickAddField,
  options: ReferenceOption[],
  useNameAsValue: boolean,
  tokens: string[],
  taken: Set<number>,
): Candidate[] {
  const out: Candidate[] = [];
  for (const option of options) {
    const span = scoreOption(option.name, tokens, taken);
    if (!span) continue;

    const words = tokenise(option.name);
    const coverage = span.length / Math.max(words.length, 1);
    // A whole-name exact match is the strongest signal there is: it is what
    // settles "copy" in favour of the task over the Copywriting service.
    const exact = coverage === 1 && span.every((i, at) => tokens[i] === words[at]);
    const lengthBonus = span.reduce((sum, i) => sum + (tokens[i]?.length ?? 0), 0) / 100;

    out.push({
      field,
      id: useNameAsValue ? option.name : option.id,
      label: option.name,
      score: coverage + (exact ? 0.5 : 0) + lengthBonus,
      span,
    });
  }
  return out;
}

export function parseQuickAdd(input: string, sources: QuickAddSources): QuickAddResult {
  const tokens = tokenise(input);
  const { hours, used } = extractHours(tokens);
  const taken = new Set(used);

  const result: QuickAddResult = {
    clientId: null,
    serviceId: null,
    projectType: null,
    task: null,
    hours,
    leftover: "",
    matched: [],
  };

  const lists: [QuickAddField, ReferenceOption[], boolean][] = [
    ["clientId", sources.clients, false],
    ["serviceId", sources.services, false],
    ["projectType", sources.projectTypes, true],
    ["task", sources.taskTypes, true],
  ];

  // Assign one field at a time, strongest match first, recomputing after each
  // one. Recomputing is what lets "copywriting copy" fill both the service and
  // the task: once "copywriting" is claimed, the task re-matches against the
  // remaining "copy" instead of being dropped for colliding.
  for (let pass = 0; pass < lists.length; pass++) {
    let best: Candidate | null = null;

    for (const [field, options, useNameAsValue] of lists) {
      if (result[field] !== null) continue;
      for (const candidate of candidatesFor(field, options, useNameAsValue, tokens, taken)) {
        if (
          !best ||
          candidate.score > best.score ||
          (candidate.score === best.score && candidate.label.localeCompare(best.label) < 0)
        ) {
          best = candidate;
        }
      }
    }

    if (!best) break;
    result[best.field] = best.id;
    result.matched.push({ field: best.field, label: best.label });
    for (const i of best.span) taken.add(i);
  }

  result.leftover = tokens
    .map((token, i) => (taken.has(i) ? null : token))
    .filter((token): token is string => token !== null)
    .join(" ");

  return result;
}
