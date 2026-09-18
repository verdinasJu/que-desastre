"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Upload,
  CheckSquare,
  Square,
  Pencil,
  Check,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { AppSheet } from "@/components/AppSheet";
import { createClient } from "@/lib/supabase/client";
import { parseBankCsv, isLikelyDuplicateTx, guessCategory, isLikelySalaryDescription, type CsvPreviewRow } from "@/lib/csv-import";
import { mergeAllCategories } from "@/lib/categories";
import { formatCurrency, formatDate, cn } from "@/lib/utils";
import { AUTO_SALARY_DESCRIPTION } from "@/lib/constants";
import type { CustomCategory, Transaction } from "@/lib/types";

interface CsvRowWithDup extends CsvPreviewRow {
  duplicate?: boolean;
  matchDesc?: string;
}

export function CsvImportButton({ onImported }: { onImported?: () => void }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<CsvRowWithDup[]>([]);
  const [existing, setExisting] = useState<Transaction[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [fileName, setFileName] = useState("");
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [editDesc, setEditDesc] = useState("");
  const [editCat, setEditCat] = useState("");
  const [customCats, setCustomCats] = useState<CustomCategory[]>([]);
  /** Categorías ya usadas en movimientos (por si no están en custom_categories). */
  const [usedCats, setUsedCats] = useState<string[]>([]);

  const selectedCount = useMemo(
    () => rows.filter((r) => r.selected).length,
    [rows]
  );

  const dupCount = useMemo(() => rows.filter((r) => r.duplicate).length, [rows]);
  const newCount = useMemo(
    () => rows.filter((r) => !r.duplicate).length,
    [rows]
  );

  const allCategoryOptions = useMemo(() => {
    const extra = [...customCats.map((c) => c.name), ...usedCats];
    return mergeAllCategories(extra);
  }, [customCats, usedCats]);

  function catsForRow(current?: string) {
    return mergeAllCategories(
      [...customCats.map((c) => c.name), ...usedCats],
      current
    );
  }

  useEffect(() => {
    if (!open) return;
    async function loadCustom() {
      const supabase = createClient();
      const [{ data: custom }, { data: txs }] = await Promise.all([
        supabase.from("custom_categories").select("*").order("name"),
        supabase.from("transactions").select("category").limit(500),
      ]);
      setCustomCats((custom || []) as CustomCategory[]);
      const used = Array.from(
        new Set(
          ((txs || []) as { category: string }[])
            .map((t) => (t.category || "").trim())
            .filter(Boolean)
        )
      );
      setUsedCats(used);
    }
    loadCustom();
  }, [open]);

  function handleClose() {
    setOpen(false);
    setRows([]);
    setExisting([]);
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
          ? {
              ...r,
              description: editDesc.trim() || r.description,
              category: editCat || r.category,
            }
          : r
      )
    );
    setEditingIdx(null);
  }

  function applyToSelected(category: string) {
    if (!category) return;
    setRows((prev) =>
      prev.map((r) => (r.selected ? { ...r, category } : r))
    );
    toast.success(`«${category}» aplicada a ${selectedCount}`);
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

    const supabase = createClient();
    const dates = parsed.rows.map((r) => r.date).filter(Boolean);
    const minDate = dates.length
      ? dates.reduce((a, b) => (a < b ? a : b))
      : undefined;

    let existingTx: Transaction[] = [];
    if (minDate) {
      const { data } = await supabase
        .from("transactions")
        .select("*")
        .gte("date", minDate)
        .order("date", { ascending: false });
      existingTx = (data || []) as Transaction[];
    }
    setExisting(existingTx);

    const used = Array.from(
      new Set(
        existingTx
          .map((t) => (t.category || "").trim())
          .filter(Boolean)
      )
    );
    setUsedCats((prev) => Array.from(new Set([...used, ...prev])));

    const enriched: CsvRowWithDup[] = parsed.rows.map((r, idx) => {
      const match = existingTx.find((tx) => isLikelyDuplicateTx(r, tx));
      const salaryMatch =
        !match &&
        r.type === "income" &&
        isLikelySalaryDescription(r.description)
          ? existingTx.find(
              (tx) =>
                tx.type === "income" &&
                tx.description === AUTO_SALARY_DESCRIPTION &&
                tx.date.slice(0, 7) === r.date.slice(0, 7) &&
                Math.abs(Number(tx.amount) - r.amount) < 1
            )
          : undefined;
      const dupInFile = parsed.rows.findIndex(
        (other, j) =>
          j < idx &&
          isLikelyDuplicateTx(r, {
            date: other.date,
            amount: other.amount,
            type: other.type,
            description: other.description,
          })
      );
      const found = match || salaryMatch;
      if (found || dupInFile >= 0) {
        return {
          ...r,
          selected: false,
          duplicate: true,
          matchDesc:
            found?.description || parsed.rows[dupInFile]?.description,
        };
      }
      return { ...r, duplicate: false };
    });

    setRows(enriched);
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
        return { ...r, type, category: guessCategory(r.description, type) };
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
      category: r.category || "Otros",
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
        subtitle="Elige categoría en el listado. Incluye las de Ajustes y las que ya hayas usado."
      >
        <div className="space-y-4">
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
              {dupCount > 0 ? (
                <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                  <div className="text-[12px] text-amber-800">
                    <p className="font-medium">
                      {dupCount} movimiento{dupCount === 1 ? "" : "s"} ya
                      registrado{dupCount === 1 ? "" : "s"}
                    </p>
                    <p className="mt-0.5 text-amber-700/80">
                      Se han deseleccionado automáticamente.{" "}
                      {newCount > 0
                        ? `${newCount} nuevo${newCount === 1 ? "" : "s"} listo${newCount === 1 ? "" : "s"} para importar.`
                        : "No hay movimientos nuevos."}
                    </p>
                  </div>
                </div>
              ) : null}

              {existing.length > 0 ? (
                <details className="rounded-xl border border-line bg-surface-2/30">
                  <summary className="cursor-pointer px-3 py-2 text-[12px] font-medium text-ink-muted">
                    📋 Tus últimos {Math.min(existing.length, 15)} movimientos
                    registrados (para comparar)
                  </summary>
                  <ul className="max-h-40 space-y-1 overflow-y-auto px-3 pb-2">
                    {existing.slice(0, 15).map((tx) => (
                      <li
                        key={tx.id}
                        className="flex items-center justify-between text-[11px] text-ink-muted"
                      >
                        <span className="min-w-0 truncate">
                          {formatDate(tx.date)} · {tx.description}
                        </span>
                        <span
                          className={cn(
                            "ml-2 shrink-0 font-semibold tabular-nums",
                            tx.type === "expense"
                              ? "text-rose-600"
                              : "text-emerald-600"
                          )}
                        >
                          {tx.type === "expense" ? "−" : "+"}
                          {formatCurrency(Number(tx.amount))}
                        </span>
                      </li>
                    ))}
                  </ul>
                </details>
              ) : null}

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

              {selectedCount > 0 ? (
                <div className="space-y-2 rounded-xl border border-brand/20 bg-brand/5 px-3 py-2.5">
                  <Label
                    htmlFor="csv-bulk-category"
                    className="text-[11px] font-medium text-brand"
                  >
                    Categoría → {selectedCount} seleccionados
                  </Label>
                  <NativeSelect
                    id="csv-bulk-category"
                    value=""
                    onChange={(e) => applyToSelected(e.target.value)}
                  >
                    <option value="" disabled>
                      Elige una categoría
                    </option>
                    {allCategoryOptions.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </NativeSelect>
                  <p className="text-[10px] text-ink-muted">
                    Salen todas las categorías. Si creas una nueva en Ajustes,
                    vuelve a abrir Importar CSV.
                  </p>
                </div>
              ) : null}

              <ul className="space-y-2">
                {rows.map((r, i) => {
                  const cats = catsForRow(
                    editingIdx === i ? editCat : r.category
                  );
                  return (
                    <li
                      key={`${r.date}-${r.amount}-${i}`}
                      className={cn(
                        "rounded-xl border px-3 py-2.5 text-[13px] transition",
                        r.duplicate
                          ? "border-amber-200 bg-amber-50/50 opacity-60"
                          : r.selected
                            ? "border-line bg-surface"
                            : "border-transparent bg-surface-2/40 opacity-50"
                      )}
                    >
                      {editingIdx === i ? (
                        <div className="space-y-2.5">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[11px] font-medium text-brand">
                              Editando · {formatDate(r.date)} ·{" "}
                              {formatCurrency(r.amount)}
                            </span>
                            <button
                              type="button"
                              onClick={saveEdit}
                              className="inline-flex items-center gap-1 rounded-lg bg-brand px-2.5 py-1.5 text-[11px] font-semibold text-white"
                            >
                              <Check className="h-3.5 w-3.5" />
                              Guardar
                            </button>
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[11px] text-ink-muted">
                              Descripción
                            </Label>
                            <Input
                              value={editDesc}
                              onChange={(e) => setEditDesc(e.target.value)}
                              placeholder="Descripción"
                              className="text-base"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label
                              htmlFor="csv-row-category"
                              className="text-[11px] text-ink-muted"
                            >
                              Categoría
                            </Label>
                            <NativeSelect
                              id="csv-row-category"
                              value={editCat}
                              onChange={(e) => setEditCat(e.target.value)}
                            >
                              {cats.map((cat) => (
                                <option key={cat} value={cat}>
                                  {cat}
                                </option>
                              ))}
                            </NativeSelect>
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
                            {r.duplicate ? (
                              <p className="mt-0.5 text-[10px] font-medium text-amber-600">
                                ⚠️ Ya registrado
                                {r.matchDesc ? ` como "${r.matchDesc}"` : ""}
                              </p>
                            ) : null}
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
                  );
                })}
              </ul>

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
