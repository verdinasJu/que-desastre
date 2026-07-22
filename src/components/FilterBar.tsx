"use client";

import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { DateInput } from "@/components/ui/date-input";
import { Label } from "@/components/ui/label";

interface FilterBarProps {
  query: string;
  from: string;
  to: string;
  onQueryChange: (v: string) => void;
  onFromChange: (v: string) => void;
  onToChange: (v: string) => void;
}

export function FilterBar({
  query,
  from,
  to,
  onQueryChange,
  onFromChange,
  onToChange,
}: FilterBarProps) {
  return (
    <div className="overflow-hidden rounded-2xl border border-line/80 bg-surface p-4 shadow-sm">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
        <Input
          className="pl-9"
          placeholder="Buscar…"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
        />
      </div>
      <div className="mt-3 flex flex-col gap-3">
        <div className="min-w-0 space-y-1.5">
          <Label htmlFor="from">Desde</Label>
          <DateInput
            id="from"
            value={from}
            onChange={(e) => onFromChange(e.target.value)}
          />
        </div>
        <div className="min-w-0 space-y-1.5">
          <Label htmlFor="to">Hasta</Label>
          <DateInput
            id="to"
            value={to}
            onChange={(e) => onToChange(e.target.value)}
          />
        </div>
      </div>
    </div>
  );
}
