import { useEffect, useState } from "react";
import { AlertCircle, Check, Loader2 } from "lucide-react";

import { KijamiiMark } from "@/components/KijamiiMark";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/lib/auth";
import { completeOnboarding, fetchReferenceData } from "@/lib/data/api";
import { MARKETS, MARKET_LABELS, type Market, type ReferenceOption } from "@/lib/domain/types";
import { cn } from "@/lib/utils";

/**
 * Shown once, on a person's first sign-in.
 *
 * They choose the markets they work across and their department. After this
 * the fields are locked -- only an admin can change them -- which is what
 * keeps someone from switching market to get a different configuration.
 */
export function Onboarding() {
  const { employee, refreshEmployee, signOut } = useAuth();
  const [markets, setMarkets] = useState<Market[]>([]);
  const [primaryMarket, setPrimaryMarket] = useState<Market | null>(null);
  const [department, setDepartment] = useState<string>("");
  const [departments, setDepartments] = useState<ReferenceOption[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetchReferenceData()
      .then((data) => {
        if (!cancelled) setDepartments(data.departments);
      })
      .catch(() => {
        // A missing department list should not block onboarding.
        if (!cancelled) setDepartments([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // With a single market there is nothing to choose, so pick it automatically.
  useEffect(() => {
    if (markets.length === 1) setPrimaryMarket(markets[0]!);
    else if (primaryMarket && !markets.includes(primaryMarket)) setPrimaryMarket(null);
  }, [markets, primaryMarket]);

  const toggleMarket = (market: Market) => {
    setMarkets((current) =>
      current.includes(market) ? current.filter((m) => m !== market) : [...current, market],
    );
  };

  const canSubmit = markets.length > 0 && primaryMarket !== null && !saving;

  const submit = async () => {
    if (!canSubmit || !primaryMarket) return;
    setSaving(true);
    setError(null);
    try {
      await completeOnboarding({
        markets,
        primaryMarket,
        department: department || null,
        expectedWeeklyHours: employee?.expectedWeeklyHours ?? 40,
      });
      await refreshEmployee();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save your details.");
      setSaving(false);
    }
  };

  return (
    <div className="grid min-h-screen place-items-center bg-background px-4 py-10">
      <div className="w-full max-w-md">
        <KijamiiMark tone="light" />
        <div className="mt-6 rounded-xl border bg-surface p-6 shadow-card">
          <h1 className="text-lg font-bold">Welcome, {employee?.fullName?.split(" ")[0]}</h1>
          <p className="mt-1 text-[13px] text-muted-foreground">
            Two quick questions and you are set up. These decide which clients you see and which
            timesheet you get, so an admin has to change them later.
          </p>

          <fieldset className="mt-6">
            <legend className="label-xs mb-2">
              Which markets do you work across?<span className="ml-0.5 text-brand">*</span>
            </legend>
            <div className="grid grid-cols-3 gap-1.5">
              {MARKETS.map((market) => {
                const selected = markets.includes(market);
                return (
                  <button
                    key={market}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => toggleMarket(market)}
                    className={cn(
                      "flex items-center justify-center gap-1.5 rounded-md border px-2 py-2.5 text-xs font-semibold transition-colors",
                      selected
                        ? "border-brand bg-brand-soft text-brand"
                        : "text-muted-foreground hover:border-border-strong",
                    )}
                  >
                    {selected && <Check className="size-3" />}
                    {MARKET_LABELS[market]}
                  </button>
                );
              })}
            </div>
          </fieldset>

          {markets.length > 1 && (
            <div className="mt-4">
              <label className="label-xs mb-1.5 block" htmlFor="primary-market">
                Which is your main market?<span className="ml-0.5 text-brand">*</span>
              </label>
              <Select
                value={primaryMarket ?? ""}
                onValueChange={(value) => setPrimaryMarket(value as Market)}
              >
                <SelectTrigger id="primary-market" className="h-9 w-full text-[13px]">
                  <SelectValue placeholder="Select your main market" />
                </SelectTrigger>
                <SelectContent>
                  {markets.map((market) => (
                    <SelectItem key={market} value={market}>
                      {MARKET_LABELS[market]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="mt-1 text-[11px] text-muted-foreground">
                This decides your working week and which timesheet layout you get.
              </p>
            </div>
          )}

          <div className="mt-4">
            <label className="label-xs mb-1.5 block" htmlFor="department">
              Department
            </label>
            <Select value={department} onValueChange={setDepartment}>
              <SelectTrigger id="department" className="h-9 w-full text-[13px]">
                <SelectValue placeholder="Select your department" />
              </SelectTrigger>
              <SelectContent>
                {departments.map((option) => (
                  <SelectItem key={option.id} value={option.name}>
                    {option.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {error && (
            <p className="mt-4 flex items-start gap-2 text-[12px] font-medium text-destructive">
              <AlertCircle className="mt-0.5 size-3.5 shrink-0" /> {error}
            </p>
          )}

          <Button className="mt-6 w-full" disabled={!canSubmit} onClick={() => void submit()}>
            {saving && <Loader2 className="size-4 animate-spin" />}
            {saving ? "Setting up…" : "Continue to my timesheet"}
          </Button>

          <button
            type="button"
            onClick={() => void signOut()}
            className="mt-3 w-full text-center text-[12px] text-muted-foreground hover:text-foreground"
          >
            Sign out
          </button>
        </div>
        <p className="mt-4 text-center text-[11px] text-muted-foreground">
          Signed in as {employee?.email}
        </p>
      </div>
    </div>
  );
}
