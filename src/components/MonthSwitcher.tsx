"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import { AppSheet } from "@/components/AppSheet";
import { cn, shiftMonthKey } from "@/lib/utils";

interface MonthSwitcherProps {
  monthKey: string;
  label: string;
  isCurrent: boolean;
}

const MONTH_NAMES = [
  "Ene",
  "Feb",
  "Mar",
  "Abr",
  "May",
  "Jun",
  "Jul",
  "Ago",
  "Sep",
  "Oct",
  "Nov",
  "Dic",
];

function hrefForMonth(key: string, currentKey: string) {
  return key === currentKey ? "/" : `/?month=${key}`;
}

export function MonthSwitcher({
  monthKey,
  label,
  isCurrent,
}: MonthSwitcherProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const now = new Date();
  const currentKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const currentYear = now.getFullYear();
  const [yStr, mStr] = monthKey.split("-");
  const selectedYear = Number(yStr);
  const selectedMonth = Number(mStr);
  const [pickerYear, setPickerYear] = useState(selectedYear);

  const prev = shiftMonthKey(monthKey, -1);
  const next = shiftMonthKey(monthKey, 1);
  const canGoNext = monthKey < currentKey;

  const years = useMemo(() => {
    const list: number[] = [];
    for (let y = currentYear; y >= currentYear - 12; y--) list.push(y);
    return list;
  }, [currentYear]);

  function openPicker() {
    setPickerYear(selectedYear);
    setOpen(true);
  }

  function goTo(year: number, monthIndex1: number) {
    const key = `${year}-${String(monthIndex1).padStart(2, "0")}`;
    if (key > currentKey) return;
    setOpen(false);
    router.push(hrefForMonth(key, currentKey));
  }

  return (
    <>
      <div className="space-y-1.5">
        <div className="flex items-center gap-1">
          <Link
            href={hrefForMonth(prev, currentKey)}
            className="rounded-xl p-2 text-ink-muted transition hover:bg-surface-2 hover:text-ink"
            aria-label="Mes anterior"
          >
            <ChevronLeft className="h-5 w-5" />
          </Link>
          <button
            type="button"
            onClick={openPicker}
            className={cn(
              "flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-xl px-2 py-2 text-sm font-medium capitalize transition hover:bg-surface-2",
              isCurrent ? "text-ink" : "text-brand"
            )}
            aria-haspopup="dialog"
            aria-expanded={open}
          >
            <CalendarDays className="h-4 w-4 shrink-0 opacity-70" />
            <span className="truncate">{label}</span>
          </button>
          {canGoNext ? (
            <Link
              href={hrefForMonth(next, currentKey)}
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
            <Link
              href="/"
              className="font-medium text-brand underline-offset-2 hover:underline"
            >
              Volver a este mes
            </Link>
          </p>
        ) : (
          <p className="text-center text-[11px] text-ink-muted">
            Toca el mes para saltar a cualquier fecha · flechas para ir de uno en
            uno
          </p>
        )}
      </div>

      <AppSheet
        open={open}
        onClose={() => setOpen(false)}
        title="Elegir mes"
        subtitle="Salta directo a un año y mes (hasta 12 años atrás)"
      >
        <div className="space-y-4 pb-2">
          <div>
            <p className="mb-2 text-xs font-medium text-ink-muted">Año</p>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {years.map((y) => (
                <button
                  key={y}
                  type="button"
                  onClick={() => setPickerYear(y)}
                  className={cn(
                    "shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold transition",
                    pickerYear === y
                      ? "bg-brand text-white"
                      : "bg-surface-2 text-ink-muted hover:text-ink"
                  )}
                >
                  {y}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-2 text-xs font-medium text-ink-muted">Mes</p>
            <div className="grid grid-cols-3 gap-2">
              {MONTH_NAMES.map((name, idx) => {
                const monthNum = idx + 1;
                const key = `${pickerYear}-${String(monthNum).padStart(2, "0")}`;
                const disabled = key > currentKey;
                const selected =
                  pickerYear === selectedYear && monthNum === selectedMonth;
                return (
                  <button
                    key={name}
                    type="button"
                    disabled={disabled}
                    onClick={() => goTo(pickerYear, monthNum)}
                    className={cn(
                      "rounded-xl border px-2 py-3 text-sm font-medium transition",
                      disabled && "cursor-not-allowed opacity-35",
                      selected
                        ? "border-brand bg-brand/10 text-brand"
                        : "border-line text-ink hover:bg-surface-2"
                    )}
                  >
                    {name}
                  </button>
                );
              })}
            </div>
          </div>

          {!isCurrent ? (
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                router.push("/");
              }}
              className="w-full rounded-xl bg-surface-2 py-2.5 text-sm font-medium text-brand"
            >
              Ir al mes actual
            </button>
          ) : null}
        </div>
      </AppSheet>
    </>
  );
}
