import { useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export interface SearchOption {
  id: string;
  name: string;
  meta?: string;
}

export function SearchSelect({
  value,
  options,
  placeholder,
  onChange,
  disabled,
  invalid,
  emptyText = "No matches found",
  className,
}: {
  value: string;
  options: SearchOption[];
  placeholder: string;
  onChange: (id: string) => void;
  disabled?: boolean | undefined;
  invalid?: boolean | undefined;
  emptyText?: string | undefined;
  className?: string | undefined;
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.id === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          aria-invalid={invalid}
          className={cn(
            "flex w-full min-w-[92px] items-center justify-between gap-1 rounded-md border border-transparent px-2 py-1.5 text-left text-[13px] transition-colors",
            "hover:border-border-strong hover:bg-surface-muted focus:outline-2 focus:outline-ring focus:-outline-offset-1",
            disabled && "pointer-events-none opacity-70 hover:bg-transparent",
            invalid && "border-destructive/50 bg-destructive/5",
            className,
          )}
        >
          <span className={cn("truncate", !selected && !value && "text-muted-foreground")}>
            {selected?.name || value || placeholder}
          </span>
          {!disabled && <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[260px] p-0" align="start">
        <Command>
          <CommandInput placeholder={`Search ${placeholder.toLowerCase()}…`} className="h-9" />
          <CommandList>
            <CommandEmpty className="py-4 text-center text-sm text-muted-foreground">
              {emptyText}
            </CommandEmpty>
            <CommandGroup>
              {options.map((o) => (
                <CommandItem
                  key={o.id}
                  value={`${o.name} ${o.meta ?? ""}`}
                  onSelect={() => {
                    onChange(o.id);
                    setOpen(false);
                  }}
                  className="gap-2 text-[13px]"
                >
                  <Check className={cn("size-3.5", o.id === value ? "opacity-100" : "opacity-0")} />
                  <span className="truncate">{o.name}</span>
                  {o.meta && (
                    <span className="num ml-auto text-[11px] text-muted-foreground">{o.meta}</span>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
