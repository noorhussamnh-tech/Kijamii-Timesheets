/**
 * One figure in the row above a table.
 *
 * Shared by the admin overview and the manager's own team page so the two
 * read as the same page at different scopes, which is what they are.
 */
export function Metric({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg border bg-surface p-3 shadow-card">
      <p className="label-xs">{label}</p>
      <p className="num mt-1 text-xl font-bold">{value}</p>
      {hint && <p className="truncate text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}
