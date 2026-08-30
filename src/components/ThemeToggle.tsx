import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";

export function ThemeToggle({ className }: { className?: string | undefined }) {
  const { theme, setTheme } = useTheme();
  const isDark = theme === "dark";

  return (
    <div
      role="group"
      aria-label="Color theme"
      className={cn(
        "flex items-center gap-0.5 rounded-md border bg-surface-muted p-0.5",
        className,
      )}
    >
      <button
        type="button"
        aria-pressed={!isDark}
        title="Light mode"
        onClick={() => setTheme("light")}
        className={cn(
          "grid size-7 place-items-center rounded transition-colors",
          !isDark
            ? "bg-surface text-foreground shadow-card"
            : "text-muted-foreground hover:text-foreground",
        )}
      >
        <Sun className="size-3.5" />
      </button>
      <button
        type="button"
        aria-pressed={isDark}
        title="Dark mode"
        onClick={() => setTheme("dark")}
        className={cn(
          "grid size-7 place-items-center rounded transition-colors",
          isDark
            ? "bg-surface text-foreground shadow-card"
            : "text-muted-foreground hover:text-foreground",
        )}
      >
        <Moon className="size-3.5" />
      </button>
    </div>
  );
}
