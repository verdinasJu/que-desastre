"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Calculator, Plane, LayoutGrid, X } from "lucide-react";
import { cn } from "@/lib/utils";

const tools = [
  {
    href: "/viajes",
    label: "Modo viaje",
    description: "Presupuesto del viaje",
    icon: Plane,
    tile: "from-sky-50 to-indigo-50 text-sky-800",
    iconWrap: "bg-white/80 text-sky-700 shadow-sm",
  },
  {
    href: "/calculadora",
    label: "Interés compuesto",
    description: "Simula inversiones",
    icon: Calculator,
    tile: "from-teal-50 to-emerald-50 text-teal-900",
    iconWrap: "bg-white/80 text-brand shadow-sm",
  },
] as const;

export function MoreMenuButton() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const active =
    pathname.startsWith("/viajes") || pathname.startsWith("/calculadora");

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "flex min-w-0 flex-1 flex-col items-center gap-1 rounded-xl px-1 py-2 text-[10px] font-medium transition-colors sm:text-[11px]",
          active ? "text-brand" : "text-ink-muted hover:text-ink"
        )}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <span
          className={cn(
            "flex h-8 w-8 items-center justify-center rounded-xl transition",
            active ? "bg-brand/10" : "bg-transparent"
          )}
        >
          <LayoutGrid
            className={cn("h-5 w-5", active && "stroke-[2.5px]")}
          />
        </span>
        <span className="truncate">Más</span>
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="more-menu-title"
        >
          <button
            type="button"
            className="absolute inset-0 bg-ink/45 backdrop-blur-[2px] animate-in fade-in-0"
            aria-label="Cerrar menú"
            onClick={() => setOpen(false)}
          />
          <div className="relative z-10 w-full max-w-lg animate-in fade-in-0 slide-in-from-bottom-4 duration-200 sm:mx-4 sm:zoom-in-95 sm:slide-in-from-bottom-0">
            <div className="rounded-t-[1.75rem] border border-line bg-surface shadow-2xl sm:rounded-3xl">
              <div className="mx-auto mt-2.5 h-1 w-10 rounded-full bg-line sm:hidden" />
              <div className="flex items-start justify-between gap-3 px-5 pb-2 pt-3 sm:pt-5">
                <div>
                  <p
                    id="more-menu-title"
                    className="font-display text-xl font-semibold tracking-tight text-ink"
                  >
                    Más opciones
                  </p>
                  <p className="mt-0.5 text-xs text-ink-muted">
                    Calculadora, viaje y más herramientas
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-xl p-2 text-ink-muted transition hover:bg-surface-2 hover:text-ink"
                  aria-label="Cerrar"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3 p-4 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
                {tools.map(
                  ({
                    href,
                    label,
                    description,
                    icon: Icon,
                    tile,
                    iconWrap,
                  }) => {
                    const isCurrent = pathname.startsWith(href);
                    return (
                      <Link
                        key={href}
                        href={href}
                        onClick={() => setOpen(false)}
                        className={cn(
                          "group flex min-h-[8.5rem] flex-col justify-between rounded-2xl bg-gradient-to-br p-4 ring-1 ring-inset transition",
                          tile,
                          isCurrent
                            ? "ring-brand/35 shadow-md"
                            : "ring-black/5 hover:shadow-md"
                        )}
                      >
                        <span
                          className={cn(
                            "flex h-10 w-10 items-center justify-center rounded-xl",
                            iconWrap
                          )}
                        >
                          <Icon className="h-5 w-5" />
                        </span>
                        <span>
                          <span className="block text-sm font-semibold leading-snug">
                            {label}
                          </span>
                          <span className="mt-0.5 block text-[11px] leading-snug opacity-75">
                            {description}
                          </span>
                        </span>
                      </Link>
                    );
                  }
                )}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
