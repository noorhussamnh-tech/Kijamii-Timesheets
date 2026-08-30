import { cn } from "@/lib/utils";

/**
 * The Kijamii lockup.
 *
 * Rendered as type rather than an image on purpose: the prototype pointed at
 * an asset hosted by the Lovable editor, which 404s anywhere else and would
 * have shipped a broken image to production. This uses the design system's own
 * type and colour, so it is correct in both themes and needs no network.
 *
 * To use the real artwork instead, drop the file in `public/` and swap the
 * wordmark span for an <img> — nothing else needs to change.
 */
export function KijamiiMark({
  className,
  showWordmark = true,
  productName = "Timesheets",
  tone = "dark",
}: {
  className?: string | undefined;
  showWordmark?: boolean | undefined;
  productName?: string | null | undefined;
  /** `dark` sits on the dark sidebar; `light` sits on the page background. */
  tone?: "dark" | "light" | undefined;
}) {
  return (
    <div className={cn("flex min-w-0 items-center gap-2.5", className)}>
      <span
        className={cn(
          "text-[15px] leading-none font-extrabold tracking-tight",
          tone === "dark" ? "text-sidebar-accent-foreground" : "text-foreground",
        )}
      >
        kijamii
        <span className="text-brand">.</span>
      </span>
      {showWordmark && productName && (
        <span
          className={cn(
            "min-w-0 border-l pl-2.5 text-sm font-medium",
            tone === "dark"
              ? "border-sidebar-border text-sidebar-foreground/70"
              : "text-muted-foreground",
          )}
        >
          <span className="truncate">{productName}</span>
        </span>
      )}
    </div>
  );
}
