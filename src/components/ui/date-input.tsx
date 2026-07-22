import * as React from "react";
import { cn } from "@/lib/utils";
import { Input, type InputProps } from "@/components/ui/input";

export function DateInput({ className, ...props }: InputProps) {
  return (
    <div className="w-full min-w-0 max-w-full overflow-hidden">
      <Input
        type="date"
        className={cn("input-date block w-full max-w-full", className)}
        {...props}
      />
    </div>
  );
}
