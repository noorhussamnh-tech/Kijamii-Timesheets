import logoWhite from "@/assets/kijamii-logo-white.png.asset.json";
import { cn } from "@/lib/utils";

export function KijamiiMark({
  className,
  showWordmark = true,
  productName = "Timesheets",
  tone = "dark",
}: {
  className?: string | undefined;
  showWordmark?: boolean | undefined;
  productName?: string | null | undefined;
  tone?: "dark" | "light" | undefined;
}) {
  return (
    <div className={cn("flex min-w-0 items-center gap-2.5", className)}>
      <img
        src={logoWhite.url}
        alt="Kijamii"
        width={79}
        height={36}
        className={cn("h-6 w-auto shrink-0", tone === "light" && "dark:invert-0 invert")}
      />
      {showWordmark && productName && (
        <span className="min-w-0 border-l pl-2.5 text-sm font-medium text-muted-foreground">
          <span className="truncate">{productName}</span>
        </span>
      )}
    </div>
  );
}
