"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import type { CustomCategory, TransactionType } from "@/lib/types";
import {
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
  INVESTMENT_CATEGORIES,
} from "@/lib/constants";

const TABS: { value: TransactionType; label: string }[] = [
  { value: "expense", label: "Gastos" },
  { value: "income", label: "Ingresos" },
  { value: "investment", label: "Inversiones" },
];

const DEFAULTS: Record<TransactionType, readonly string[]> = {
  expense: EXPENSE_CATEGORIES,
  income: INCOME_CATEGORIES,
  investment: INVESTMENT_CATEGORIES,
};

export function CategoriesManager() {
  const router = useRouter();
  const [tab, setTab] = useState<TransactionType>("expense");
  const [items, setItems] = useState<CustomCategory[]>([]);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data } = await supabase
        .from("custom_categories")
        .select("*")
        .order("name");
      setItems((data || []) as CustomCategory[]);
    }
    load();
  }, []);

  const customForTab = items.filter((c) => c.type === tab);

  async function addCategory() {
    const trimmed = name.trim();
    if (!trimmed) return;
    if (DEFAULTS[tab].some((d) => d.toLowerCase() === trimmed.toLowerCase())) {
      toast.error("Esa categoría ya existe por defecto");
      return;
    }
    if (
      customForTab.some((c) => c.name.toLowerCase() === trimmed.toLowerCase())
    ) {
      toast.error("Ya tienes esa categoría");
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("custom_categories")
      .insert({
        user_id: user.id,
        name: trimmed,
        type: tab,
      })
      .select()
      .single();

    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }

    setItems((prev) =>
      [...prev, data as CustomCategory].sort((a, b) =>
        a.name.localeCompare(b.name)
      )
    );
    setName("");
    toast.success("Categoría creada");
    router.refresh();
  }

  async function removeCategory(id: string) {
    const supabase = createClient();
    const { error } = await supabase
      .from("custom_categories")
      .delete()
      .eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    setItems((prev) => prev.filter((c) => c.id !== id));
    toast.success("Categoría eliminada");
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Categorías</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-xs text-ink-muted leading-relaxed">
          Las categorías por defecto siempre están disponibles. Aquí puedes
          crear las tuyas (ej. Mascotas, Suscripciones…).
        </p>

        <div className="grid grid-cols-3 gap-2">
          {TABS.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => setTab(t.value)}
              className={cn(
                "rounded-xl border px-2 py-2 text-xs font-semibold transition sm:text-sm",
                tab === t.value
                  ? "border-brand bg-brand/10 text-brand"
                  : "border-line text-ink-muted hover:bg-surface-2"
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div>
          <Label className="text-xs text-ink-muted">Por defecto</Label>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {DEFAULTS[tab].map((c) => (
              <span
                key={c}
                className="rounded-lg bg-surface-2 px-2.5 py-1 text-xs text-ink-muted"
              >
                {c}
              </span>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-xs text-ink-muted">Tus categorías</Label>
          {customForTab.length === 0 ? (
            <p className="text-sm text-ink-faint">Aún no has creado ninguna.</p>
          ) : (
            <ul className="space-y-2">
              {customForTab.map((c) => (
                <li
                  key={c.id}
                  className="flex items-center gap-2 rounded-xl border border-line bg-surface-2/60 px-3 py-2"
                >
                  <span className="flex-1 text-sm font-medium">{c.name}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => removeCategory(c.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex gap-2">
          <Input
            placeholder="Nueva categoría…"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addCategory();
              }
            }}
          />
          <Button
            type="button"
            size="icon"
            onClick={addCategory}
            disabled={loading}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
