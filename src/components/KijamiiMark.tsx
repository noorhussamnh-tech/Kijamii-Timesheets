import { cn } from "@/lib/utils";

/**
 * The Kijamii lockup.
 *
 * The wordmark is the real artwork, `public/kijamii-wordmark.png`, and not an
 * <img>: the file is off-white letterforms on transparency, so an <img> would
 * vanish on the light page and only ever look right on the dark sidebar.
 * Painting it as a mask filled with `currentColor` (see the
 * `kijamii-wordmark` utility) means the one file is correct on the sidebar, on
 * the page, and in both themes, and still needs no network beyond our own.
 *
 * The height is set here and the width follows from the file's aspect ratio,
 * so nothing has to be kept in sync if the artwork is ever re-cut.
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
        role="img"
        aria-label="Kijamii"
        className={cn(
          "kijamii-wordmark h-[18px] shrink-0",
          tone === "dark" ? "text-sidebar-accent-foreground" : "text-foreground",
        )}
      />
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
