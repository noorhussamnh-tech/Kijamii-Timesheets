import { formatHours } from "@/lib/domain/totals";
import { cn } from "@/lib/utils";

const SIZE = 52;
const STROKE = 5;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/**
 * Progress toward the weekly target.
 *
 * A ring rather than a number because a part-filled shape invites completing
 * it. It turns green on reaching the target and amber past it -- over-logging
 * is worth noticing too, not a prize.
 */
export function ProgressRing({
  value,
  target,
  className,
}: {
  value: number;
  target: number;
  className?: string | undefined;
}) {
  const ratio = target > 0 ? value / target : 0;
  const clamped = Math.min(Math.max(ratio, 0), 1);
  const met = ratio >= 1;
  const over = ratio > 1.1;

  return (
    <div
      className={cn("flex items-center gap-2.5", className)}
      role="img"
      aria-label={`${formatHours(value)} logged of ${formatHours(target)} expected`}
    >
      <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} className="shrink-0">
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          fill="none"
          strokeWidth={STROKE}
          className="stroke-border"
        />
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          fill="none"
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={CIRCUMFERENCE * (1 - clamped)}
          // Rotated so the ring fills clockwise from the top.
          transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
          className={cn(
            "transition-[stroke-dashoffset] duration-500 ease-out",
            over ? "stroke-warning" : met ? "stroke-success" : "stroke-brand",
          )}
        />
      </svg>
      <div className="min-w-0 leading-tight">
        <p className="num text-[15px] font-bold">{formatHours(value)}</p>
        <p className="text-[11px] text-muted-foreground">of {formatHours(target)}</p>
      </div>
    </div>
  );
}
