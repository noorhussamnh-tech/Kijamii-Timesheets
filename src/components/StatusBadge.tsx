import type { WeekStatus } from "@/lib/domain/types";
import { cn } from "@/lib/utils";

/**
 * `returned` and `approved` are carried here so the review workflow can be
 * switched on later without touching every screen that shows a status.
 */
const STYLES: Record<WeekStatus, { label: string; className: string }> = {
  draft: { label: "Draft", className: "bg-warning-soft text-warning border-warning/30" },
  submitted: { label: "Submitted", className: "bg-success-soft text-success border-success/30" },
  returned: {
    label: "Returned",
    className: "bg-destructive/10 text-destructive border-destructive/30",
  },
  approved: { label: "Approved", className: "bg-brand-soft text-brand border-brand/30" },
  missing: { label: "Missing", className: "bg-muted text-muted-foreground border-border-strong" },
};

export function StatusBadge({
  status,
  className,
}: {
  status: WeekStatus;
  className?: string | undefined;
}) {
  const style = STYLES[status] ?? STYLES.draft;
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold",
        style.className,
        className,
      )}
    >
      <span className="size-1.5 rounded-full bg-current" />
      {style.label}
    </span>
  );
}
