import { MARKS } from "@/components/fill-marks";
import type { FillLevel } from "@/lib/domain/totals";
import { cn } from "@/lib/utils";

/** The icon for how filled a period is. See `fill-marks` for what it means. */
export function FillMark({ level, className }: { level: FillLevel; className?: string }) {
  const mark = MARKS[level];
  const Icon = mark.icon;
  return (
    <Icon
      aria-label={mark.label}
      role="img"
      className={cn("size-3.5 shrink-0", mark.text, className)}
    />
  );
}
