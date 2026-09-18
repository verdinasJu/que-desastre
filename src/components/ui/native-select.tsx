import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export type NativeSelectProps = React.SelectHTMLAttributes<HTMLSelectElement>;

const NativeSelect = React.forwardRef<HTMLSelectElement, NativeSelectProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <div className="relative min-w-0">
        <select
          ref={ref}
          className={cn(
            "flex h-11 w-full min-w-0 appearance-none rounded-xl border border-line bg-surface px-4 py-2 pr-10 text-sm text-ink shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/35 disabled:cursor-not-allowed disabled:opacity-50",
            className
          )}
          {...props}
        >
          {children}
        </select>
        <ChevronDown
          className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted"
          aria-hidden
        />
      </div>
    );
  }
);
NativeSelect.displayName = "NativeSelect";

export { NativeSelect };
