import type { SubmissionStatus } from "@/data/weeks";
import { cn } from "@/lib/utils";

const map: Record<SubmissionStatus, { label: string; className: string }> = {
  draft: { label: "Draft", className: "bg-warning-soft text-warning border-warning/30" },
  submitted: { label: "Submitted", className: "bg-success-soft text-success border-success/30" },
  missing: { label: "Missing", className: "bg-muted text-muted-foreground border-border-strong" },
};

export function StatusBadge({
  status,
  className,
}: {
  status: SubmissionStatus;
  className?: string | undefined;
}) {
  const s = map[status];
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold",
        s.className,
        className,
      )}
    >
      <span className="size-1.5 rounded-full bg-current" />
      {s.label}
    </span>
  );
}
