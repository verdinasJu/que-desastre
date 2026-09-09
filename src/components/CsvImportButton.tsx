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
import { AppSheet } from "@/components/AppSheet";
import { createClient } from "@/lib/supabase/client";
import { parseBankCsv, type CsvPreviewRow } from "@/lib/csv-import";
import {
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
} from "@/lib/constants";
import { formatCurrency, formatDate, cn } from "@/lib/utils";
import type { CustomCategory, Transaction, TransactionType } from "@/lib/types";

interface CsvRowWithDup extends CsvPreviewRow {
  duplicate?: boolean;
  matchDesc?: string;
}

function categoryChips(
  type: TransactionType,
  custom: string[],
  extras: string[]
): string[] {
  const base =
    type === "income"
      ? INCOME_CATEGORIES
      : type === "investment"
        ? ["Otros"]
        : EXPENSE_CATEGORIES;
  const set = new Set<string>();
  for (const c of [...extras, ...custom, ...base]) {
    const t = c.trim();
    if (t) set.add(t);
  }
  return Array.from(set);
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
  const [bulkCat, setBulkCat] = useState("");
  const [customCats, setCustomCats] = useState<CustomCategory[]>([]);
  /** Categorías escritas a mano en esta sesión (ej. Bet) para que salgan como chip. */
  const [sessionCats, setSessionCats] = useState<string[]>([]);

  const selectedCount = useMemo(
    () => rows.filter((r) => r.selected).length,
    [rows]
  );

  const dupCount = useMemo(() => rows.filter((r) => r.duplicate).length, [rows]);
  const newCount = useMemo(
    () => rows.filter((r) => !r.duplicate).length,
    [rows]
  );

  const bulkType: TransactionType = rows.some(
    (r) => r.selected && r.type === "income"
  )
    ? "income"
    : "expense";

  const bulkChips = useMemo(() => {
    const names = customCats
      .filter((c) => c.type === bulkType)
      .map((c) => c.name);
    return categoryChips(bulkType, names, sessionCats);
  }, [customCats, bulkType, sessionCats]);

  useEffect(() => {
    if (!open) return;
    async function loadCustom() {
      const supabase = createClient();
      const { data } = await supabase.from("custom_categories").select("*");
      setCustomCats((data || []) as CustomCategory[]);
    }
    loadCustom();
  }, [open]);

  function rememberCategory(name: string) {
    const t = name.trim();
    if (!t) return;
    setSessionCats((prev) =>
      prev.some((c) => c.toLowerCase() === t.toLowerCase())
        ? prev
        : [t, ...prev]
    );
  }

  async function persistCustomCategory(
    name: string,
    type: TransactionType
  ) {
    const t = name.trim();
    if (!t) return;
    const defaults =
      type === "income"
        ? INCOME_CATEGORIES
        : type === "investment"
          ? (["Otros"] as const)
          : EXPENSE_CATEGORIES;
    if (defaults.some((d) => d.toLowerCase() === t.toLowerCase())) return;
    if (
      customCats.some(
        (c) => c.type === type && c.name.toLowerCase() === t.toLowerCase()
      )
    ) {
      return;
    }

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from("custom_categories")
      .insert({ user_id: user.id, name: t, type })
      .select()
      .single();

    if (data) {
      setCustomCats((prev) => [...prev, data as CustomCategory]);
    }
  }

  function handleClose() {
    setOpen(false);
    setRows([]);
    setExisting([]);
    setError("");
    setFileName("");
    setEditingIdx(null);
    setBulkCat("");
    setSessionCats([]);
  }

  function applyBulkCategory() {
    const value = bulkCat.trim();
    if (!value) return;
    rememberCategory(value);
    void persistCustomCategory(value, bulkType);
    applyToSelected("category", value);
    setBulkCat("");
    toast.success(`Categoría «${value}» aplicada a ${selectedCount}`);
  }

  function startEdit(i: number) {
    setEditingIdx(i);
    setEditDesc(rows[i].description);
    setEditCat(rows[i].category);
  }

  function saveEdit() {
    if (editingIdx === null) return;
    const cat = editCat.trim() || rows[editingIdx].category;
    const row = rows[editingIdx];
    rememberCategory(cat);
    void persistCustomCategory(cat, row.type);
    setRows((prev) =>
      prev.map((r, idx) =>
        idx === editingIdx
          ? {
              ...r,
              description: editDesc.trim() || r.description,
              category: cat,
            }
          : r
      )
    );
    setEditingIdx(null);
  }

  function applyToSelected(field: "category" | "description", value: string) {
    if (field === "category") rememberCategory(value);
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

    // Categorías ya usadas en movimientos → chips (incluye "Bet" si existe)
    const used = Array.from(
      new Set(
        existingTx
          .map((t) => (t.category || "").trim())
          .filter(Boolean)
      )
    );
    setSessionCats((prev) => Array.from(new Set([...used, ...prev])));

    const enriched: CsvRowWithDup[] = parsed.rows.map((r) => {
      const match = existingTx.find(
        (tx) =>
          tx.date === r.date &&
          Math.abs(Number(tx.amount) - r.amount) < 0.02
      );
      if (match) {
        return {
          ...r,
          selected: false,
          duplicate: true,
          matchDesc: match.description,
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

    // Guardar categorías nuevas usadas
    for (const r of selected) {
      await persistCustomCategory(r.category, r.type);
    }

    const payload = selected.map((r) => ({
      user_id: user.id,
      type: r.type,
      amount: r.amount,
      description: r.description,
      category: r.category.trim() || "Otros",
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
        subtitle="Sube un CSV. En categoría puedes escribir Bet, Cumpleaños… lo que quieras."
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
                  <Label className="text-[11px] font-medium text-brand">
                    Categoría libre → {selectedCount} seleccionados
                  </Label>
                  <p className="text-[11px] text-ink-muted">
                    Escribe <strong>Bet</strong>, Cumpleaños… y pulsa Aplicar.
                    No hace falta que esté en los chips.
                  </p>
                  <div className="flex gap-2">
                    <Input
                      value={bulkCat}
                      onChange={(e) => setBulkCat(e.target.value)}
                      placeholder="Ej. Bet"
                      className="h-10 text-base"
                      autoCapitalize="sentences"
                      autoCorrect="off"
                      enterKeyHint="done"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          applyBulkCategory();
                        }
                      }}
                    />
                    <Button
                      type="button"
                      size="sm"
                      className="h-10 shrink-0"
                      disabled={!bulkCat.trim()}
                      onClick={applyBulkCategory}
                    >
                      Aplicar
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {bulkChips.map((cat) => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => {
                          applyToSelected("category", cat);
                          toast.success(`«${cat}» aplicada`);
                        }}
                        className="rounded-full bg-surface px-2.5 py-1 text-[11px] font-medium text-ink-muted transition hover:bg-surface-2 hover:text-ink"
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              <ul className="space-y-2">
                {rows.map((r, i) => {
                  const chips = categoryChips(
                    r.type,
                    customCats
                      .filter((c) => c.type === r.type)
                      .map((c) => c.name),
                    sessionCats
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
                          <div className="space-y-1">
                            <Label className="text-[11px] text-ink-muted">
                              Categoría (escribe la que quieras)
                            </Label>
                            <Input
                              value={editCat}
                              onChange={(e) => setEditCat(e.target.value)}
                              placeholder="Ej. Bet, Cumpleaños, Uber…"
                              className="text-base"
                              autoFocus
                              autoCapitalize="sentences"
                              autoCorrect="off"
                              enterKeyHint="done"
                              onFocus={(e) => e.currentTarget.select()}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  saveEdit();
                                }
                              }}
                            />
                            <p className="text-[10px] text-ink-muted">
                              Borra el texto y escribe Bet (u otra). Luego
                              Guardar. Los chips son solo atajos.
                            </p>
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {chips.map((cat) => (
                              <button
                                key={cat}
                                type="button"
                                onClick={() => setEditCat(cat)}
                                className={cn(
                                  "rounded-full px-2.5 py-1 text-[11px] font-medium transition",
                                  editCat.trim().toLowerCase() ===
                                    cat.toLowerCase()
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
