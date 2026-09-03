"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Upload, CheckSquare, Square, Pencil, Check } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AppSheet } from "@/components/AppSheet";
import { createClient } from "@/lib/supabase/client";
import { parseBankCsv, type CsvPreviewRow } from "@/lib/csv-import";
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from "@/lib/constants";
import { formatCurrency, formatDate, cn } from "@/lib/utils";

export function CsvImportButton({ onImported }: { onImported?: () => void }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<CsvPreviewRow[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [fileName, setFileName] = useState("");
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [editDesc, setEditDesc] = useState("");
  const [editCat, setEditCat] = useState("");

  const selectedCount = useMemo(
    () => rows.filter((r) => r.selected).length,
    [rows]
  );

  function handleClose() {
    setOpen(false);
    setRows([]);
    setError("");
    setFileName("");
    setEditingIdx(null);
  }

  function startEdit(i: number) {
    setEditingIdx(i);
    setEditDesc(rows[i].description);
    setEditCat(rows[i].category);
  }

  function saveEdit() {
    if (editingIdx === null) return;
    setRows((prev) =>
      prev.map((r, idx) =>
        idx === editingIdx
          ? { ...r, description: editDesc.trim() || r.description, category: editCat }
          : r
      )
    );
    setEditingIdx(null);
  }

  function applyToSelected(field: "category" | "description", value: string) {
    setRows((prev) =>
      prev.map((r) => (r.selected ? { ...r, [field]: value } : r))
    );
  }

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

  function toggleAll() {
    const allSelected = rows.every((r) => r.selected);
    setRows((prev) => prev.map((r) => ({ ...r, selected: !allSelected })));
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
    handleClose();
    onImported?.();
    router.refresh();
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
      >
        <Upload className="h-4 w-4" />
        Importar CSV
      </Button>

      <AppSheet
        open={open}
        onClose={handleClose}
        title="Importar del banco"
        subtitle="Sube un CSV de tu banco o broker. Revisa las filas antes de importar."
      >
        <div className="space-y-4">
          {/* Zona de subida */}
          <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-line bg-surface-2/50 px-4 py-6 text-center transition active:scale-[0.98]">
            <Upload className="h-6 w-6 text-brand" />
            <span className="text-sm font-medium text-ink">
              {fileName || "Elegir archivo .csv"}
            </span>
            <span className="text-[11px] text-ink-muted">
              Trade Republic, bancos ES, cualquier CSV con fecha e importe
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
            <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-600">
              {error}
            </p>
          ) : null}

          {rows.length > 0 ? (
            <div className="space-y-3">
              {/* Cabecera con contador y seleccionar todo */}
              <div className="flex items-center justify-between">
                <p className="text-xs text-ink-muted">
                  {selectedCount} de {rows.length} seleccionados
                </p>
                <button
                  type="button"
                  onClick={toggleAll}
                  className="flex items-center gap-1 text-xs font-medium text-brand"
                >
                  {rows.every((r) => r.selected) ? (
                    <CheckSquare className="h-3.5 w-3.5" />
                  ) : (
                    <Square className="h-3.5 w-3.5" />
                  )}
                  {rows.every((r) => r.selected)
                    ? "Deseleccionar"
                    : "Seleccionar"}{" "}
                  todo
                </button>
              </div>

              <p className="text-[11px] text-ink-muted">
                Toca ✏️ para editar descripción/categoría. Toca el tipo para
                cambiar gasto ↔ ingreso.
              </p>

              {/* Acciones en lote para seleccionados */}
              {selectedCount > 0 ? (
                <div className="space-y-2 rounded-xl border border-brand/20 bg-brand/5 px-3 py-2.5">
                  <p className="text-[11px] font-medium text-brand">
                    Aplicar a los {selectedCount} seleccionados:
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {(rows.some((r) => r.selected && r.type === "expense")
                      ? EXPENSE_CATEGORIES
                      : INCOME_CATEGORIES
                    ).map((cat) => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => applyToSelected("category", cat)}
                        className="rounded-full bg-surface px-2.5 py-1 text-[11px] font-medium text-ink-muted transition hover:bg-surface-2 hover:text-ink"
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              {/* Lista de movimientos */}
              <ul className="space-y-2">
                {rows.map((r, i) => (
                  <li
                    key={`${r.date}-${r.amount}-${i}`}
                    className={cn(
                      "rounded-xl border px-3 py-2.5 text-[13px] transition",
                      r.selected
                        ? "border-line bg-surface"
                        : "border-transparent bg-surface-2/40 opacity-50"
                    )}
                  >
                    {editingIdx === i ? (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-medium text-brand">
                            Editando · {formatDate(r.date)} · {formatCurrency(r.amount)}
                          </span>
                          <button
                            type="button"
                            onClick={saveEdit}
                            className="rounded-lg bg-brand p-1.5 text-white"
                          >
                            <Check className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        <Input
                          value={editDesc}
                          onChange={(e) => setEditDesc(e.target.value)}
                          placeholder="Descripción"
                          className="text-sm"
                        />
                        <div className="flex flex-wrap gap-1.5">
                          {(r.type === "expense"
                            ? EXPENSE_CATEGORIES
                            : INCOME_CATEGORIES
                          ).map((cat) => (
                            <button
                              key={cat}
                              type="button"
                              onClick={() => setEditCat(cat)}
                              className={cn(
                                "rounded-full px-2.5 py-1 text-[11px] font-medium transition",
                                editCat === cat
                                  ? "bg-brand text-white"
                                  : "bg-surface-2 text-ink-muted hover:text-ink"
                              )}
                            >
                              {cat}
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-start gap-2.5">
                        <input
                          type="checkbox"
                          className="mt-0.5 h-4 w-4 shrink-0 accent-brand"
                          checked={r.selected}
                          onChange={() => toggle(i)}
                        />
                        <div className="min-w-0 flex-1">
                          <p className="break-words font-medium leading-snug">
                            {r.description}
                          </p>
                          <p className="mt-0.5 text-[11px] text-ink-muted">
                            {formatDate(r.date)} · {r.category}
                          </p>
                        </div>
                        <div className="flex items-start gap-1.5">
                          <button
                            type="button"
                            onClick={() => startEdit(i)}
                            className="rounded-lg p-1.5 text-ink-muted transition hover:bg-surface-2 hover:text-ink"
                            aria-label="Editar"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <div className="shrink-0 text-right">
                            <button
                              type="button"
                              onClick={() => toggleType(i)}
                              className={cn(
                                "rounded-full px-2 py-0.5 text-[11px] font-semibold transition",
                                r.type === "expense"
                                  ? "bg-rose-50 text-rose-600"
                                  : "text-emerald-600 bg-emerald-50"
                              )}
                            >
                              {r.type === "expense" ? "Gasto" : "Ingreso"}
                            </button>
                            <p className="mt-0.5 text-sm font-semibold tabular-nums">
                              {formatCurrency(r.amount)}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </li>
                ))}
              </ul>

              {/* Botón importar */}
              <div className="sticky bottom-0 -mx-4 bg-surface/95 px-4 pb-1 pt-2 backdrop-blur-sm">
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
            </div>
          ) : null}
        </div>
      </AppSheet>
    </>
  );
}
