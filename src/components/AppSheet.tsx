"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface AppSheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
  labelledBy?: string;
}

/**
 * Panel inferior/centrado montado en document.body (evita congelados
 * por stacking context de la barra fija).
 */
export function AppSheet({
  open,
  onClose,
  title,
  subtitle,
  children,
  labelledBy = "app-sheet-title",
}: AppSheetProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!mounted || !open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby={labelledBy}
    >
      <div
        className="absolute inset-0 bg-ink/40"
        aria-hidden
        onClick={onClose}
        onKeyDown={undefined}
      />
      <div
        className={cn(
          "relative z-10 flex w-full max-w-lg flex-col",
          "max-h-[min(88dvh,40rem)] sm:max-h-[min(85vh,36rem)]",
          "sm:mx-4"
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex max-h-full flex-col overflow-hidden rounded-t-[1.75rem] border border-line bg-surface shadow-2xl sm:rounded-3xl">
          <div className="mx-auto mt-2.5 h-1 w-10 shrink-0 rounded-full bg-line sm:hidden" />
          <div className="flex shrink-0 items-start justify-between gap-3 px-5 pb-2 pt-3 sm:pt-5">
            <div className="min-w-0">
              <p
                id={labelledBy}
                className="font-display text-xl font-semibold tracking-tight text-ink"
              >
                {title}
              </p>
              {subtitle ? (
                <p className="mt-0.5 text-xs text-ink-muted">{subtitle}</p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl p-2 text-ink-muted transition hover:bg-surface-2 hover:text-ink"
              aria-label="Cerrar"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-1">
            {children}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
