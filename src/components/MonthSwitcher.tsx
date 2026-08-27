"use client";

import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn, shiftMonthKey } from "@/lib/utils";

interface MonthSwitcherProps {
  monthKey: string;
  label: string;
  isCurrent: boolean;
}

export function MonthSwitcher({
  monthKey,
  label,
  isCurrent,
}: MonthSwitcherProps) {
  const prev = shiftMonthKey(monthKey, -1);
  const next = shiftMonthKey(monthKey, 1);
  const now = new Date();
  const currentKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const canGoNext = monthKey < currentKey;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1">
        <Link
          href={prev === currentKey ? "/" : `/?month=${prev}`}
          className="rounded-xl p-2 text-ink-muted transition hover:bg-surface-2 hover:text-ink"
          aria-label="Mes anterior"
        >
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <p
          className={cn(
            "min-w-0 flex-1 text-center text-sm font-medium capitalize text-ink",
            !isCurrent && "text-brand"
          )}
        >
          {label}
        </p>
        {canGoNext ? (
          <Link
            href={next === currentKey ? "/" : `/?month=${next}`}
            className="rounded-xl p-2 text-ink-muted transition hover:bg-surface-2 hover:text-ink"
            aria-label="Mes siguiente"
          >
            <ChevronRight className="h-5 w-5" />
          </Link>
        ) : (
          <span className="rounded-xl p-2 text-ink-faint/40" aria-hidden>
            <ChevronRight className="h-5 w-5" />
          </span>
        )}
      </div>
      {!isCurrent ? (
        <p className="text-center text-[11px] text-ink-muted">
          Viendo un mes pasado.{" "}
          <Link href="/" className="font-medium text-brand underline-offset-2 hover:underline">
            Volver a este mes
          </Link>
        </p>
      ) : (
        <p className="text-center text-[11px] text-ink-muted">
          Usa las flechas para ver meses anteriores
        </p>
      )}
    </div>
  );
}
