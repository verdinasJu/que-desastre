"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { createClient } from "@/lib/supabase/client";
import { parseBankCsv, type CsvPreviewRow } from "@/lib/csv-import";
import { formatCurrency, formatDate, cn } from "@/lib/utils";

export function CsvImportButton({ onImported }: { onImported?: () => void }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<CsvPreviewRow[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [fileName, setFileName] = useState("");

  const selectedCount = useMemo(
    () => rows.filter((r) => r.selected).length,
    [rows]
  );

  async function onFile(file: File) {
    setError("");
    setFileName(file.name);
    const text = await file.text();
    const parsed = parseBankCsv(text);
    if (parsed.error) {
      setRows([]);
      setError(parsed.error);
      return;
    }
    setRows(parsed.rows);
  }

  function toggle(i: number) {
    setRows((prev) =>
      prev.map((r, idx) =>
        idx === i ? { ...r, selected: !r.selected } : r
      )
    );
  }

  function toggleType(i: number) {
    setRows((prev) =>
      prev.map((r, idx) => {
        if (idx !== i) return r;
        const type = r.type === "expense" ? "income" : "expense";
        return { ...r, type };
      })
    );
  }

  async function importSelected() {
    const selected = rows.filter((r) => r.selected);
    if (!selected.length) return;
    setLoading(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      toast.error("Sesión no válida");
      return;
    }

    const payload = selected.map((r) => ({
      user_id: user.id,
      type: r.type,
      amount: r.amount,
      description: r.description,
      category: r.category,
      date: r.date,
    }));

    const { error: insertError } = await supabase
      .from("transactions")
      .insert(payload);

    setLoading(false);
    if (insertError) {
      toast.error(insertError.message);
      return;
    }

    toast.success(`${payload.length} movimientos importados`);
    setOpen(false);
    setRows([]);
    setFileName("");
    onImported?.();
    router.refresh();
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) {
          setRows([]);
          setError("");
          setFileName("");
        }
      }}
    >
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm">
          <Upload className="h-4 w-4" />
          Importar CSV
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Importar del banco</DialogTitle>
          <DialogDescription>
            Sube un CSV exportado de tu banco o broker (Trade Republic, etc.).
            Revisa las filas antes de importar. Los importes negativos se
            tratan como gastos.
          </DialogDescription>
        </DialogHeader>

        <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-line bg-surface-2/50 px-4 py-8 text-center">
          <Upload className="h-6 w-6 text-brand" />
          <span className="text-sm font-medium text-ink">
            {fileName || "Elegir archivo .csv"}
          </span>
          <input
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onFile(f);
            }}
          />
        </label>

        {error ? (
          <p className="text-sm text-rose-600">{error}</p>
        ) : null}

        {rows.length > 0 ? (
          <div className="space-y-3">
            <p className="text-xs text-ink-muted">
              {selectedCount} de {rows.length} seleccionados. Toca el tipo para
              cambiar gasto ↔ ingreso.
            </p>
            <ul className="max-h-64 space-y-2 overflow-y-auto">
              {rows.map((r, i) => (
                <li
                  key={`${r.date}-${r.amount}-${i}`}
                  className={cn(
                    "rounded-xl border px-3 py-2 text-sm",
                    r.selected
                      ? "border-line bg-surface"
                      : "border-transparent bg-surface-2/40 opacity-60"
                  )}
                >
                  <div className="flex items-start gap-2">
                    <input
                      type="checkbox"
                      className="mt-1"
                      checked={r.selected}
                      onChange={() => toggle(i)}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{r.description}</p>
                      <p className="text-xs text-ink-muted">
                        {formatDate(r.date)} · {r.category}
                      </p>
                    </div>
                    <div className="text-right">
                      <button
                        type="button"
                        onClick={() => toggleType(i)}
                        className={cn(
                          "text-xs font-semibold",
                          r.type === "expense"
                            ? "text-rose-600"
                            : "text-emerald-600"
                        )}
                      >
                        {r.type === "expense" ? "Gasto" : "Ingreso"}
                      </button>
                      <p className="text-sm font-semibold tabular-nums">
                        {formatCurrency(r.amount)}
                      </p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
            <Button
              className="w-full"
              disabled={!selectedCount || loading}
              onClick={importSelected}
            >
              {loading
                ? "Importando…"
                : `Importar ${selectedCount} movimiento${selectedCount === 1 ? "" : "s"}`}
            </Button>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
