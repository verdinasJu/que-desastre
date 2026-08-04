"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Calculator, Plane, LayoutGrid } from "lucide-react";
import { cn } from "@/lib/utils";
import { AppSheet } from "@/components/AppSheet";

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
  const close = useCallback(() => setOpen(false), []);
  const pathname = usePathname();
  const active =
    pathname.startsWith("/viajes") || pathname.startsWith("/calculadora");

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

      <AppSheet
        open={open}
        onClose={close}
        title="Más opciones"
        subtitle="Calculadora, viaje y más herramientas"
        labelledBy="more-menu-title"
      >
        <div className="grid grid-cols-2 gap-3 pb-1">
          {tools.map(
            ({ href, label, description, icon: Icon, tile, iconWrap }) => {
              const isCurrent = pathname.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={close}
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
      </AppSheet>
    </>
  );
}
