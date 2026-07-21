"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, LogOut } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";
import type { FixedExpense, Profile } from "@/lib/types";
import { formatCurrency } from "@/lib/utils";

export default function AjustesPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [fixed, setFixed] = useState<FixedExpense[]>([]);
  const [salary, setSalary] = useState("");
  const [savings, setSavings] = useState("");
  const [investments, setInvestments] = useState("");
  const [newName, setNewName] = useState("");
  const [newAmount, setNewAmount] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const [{ data: p }, { data: f }] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", user.id).single(),
        supabase
          .from("fixed_expenses")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: true }),
      ]);

      if (p) {
        const profileData = p as Profile;
        setProfile(profileData);
        setSalary(String(profileData.monthly_salary));
        setSavings(String(profileData.initial_savings));
        setInvestments(String(profileData.initial_investments));
      }
      setFixed((f || []) as FixedExpense[]);
    }
    load();
  }, []);

  async function saveProfile() {
    if (!profile) return;
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("profiles")
      .update({
        monthly_salary: Number(salary.replace(",", ".")) || 0,
        initial_savings: Number(savings.replace(",", ".")) || 0,
        initial_investments: Number(investments.replace(",", ".")) || 0,
        updated_at: new Date().toISOString(),
      })
      .eq("id", profile.id);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Perfil actualizado");
    router.refresh();
  }

  async function addFixed() {
    const amount = Number(newAmount.replace(",", "."));
    if (!newName.trim() || !amount) return;
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from("fixed_expenses")
      .insert({
        user_id: user.id,
        name: newName.trim(),
        amount,
        category: "Fijos",
        active: true,
      })
      .select()
      .single();

    if (error) {
      toast.error(error.message);
      return;
    }
    setFixed((prev) => [...prev, data as FixedExpense]);
    setNewName("");
    setNewAmount("");
    toast.success("Gasto fijo añadido");
    router.refresh();
  }

  async function toggleFixed(item: FixedExpense) {
    const supabase = createClient();
    const { error } = await supabase
      .from("fixed_expenses")
      .update({ active: !item.active })
      .eq("id", item.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    setFixed((prev) =>
      prev.map((f) => (f.id === item.id ? { ...f, active: !f.active } : f))
    );
    router.refresh();
  }

  async function removeFixed(id: string) {
    const supabase = createClient();
    const { error } = await supabase.from("fixed_expenses").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    setFixed((prev) => prev.filter((f) => f.id !== id));
    toast.success("Eliminado");
    router.refresh();
  }

  async function logout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <div className="space-y-5">
      <header className="animate-rise space-y-1">
        <h1 className="font-display text-3xl font-semibold tracking-tight">
          Ajustes
        </h1>
        <p className="text-sm text-ink-muted">
          Edita nómina, patrimonio inicial y gastos fijos.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Valores base</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="salary">Nómina mensual (€)</Label>
            <Input
              id="salary"
              inputMode="decimal"
              value={salary}
              onChange={(e) => setSalary(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="savings">Ahorro inicial (€)</Label>
            <Input
              id="savings"
              inputMode="decimal"
              value={savings}
              onChange={(e) => setSavings(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="investments">Inversión inicial (€)</Label>
            <Input
              id="investments"
              inputMode="decimal"
              value={investments}
              onChange={(e) => setInvestments(e.target.value)}
            />
          </div>
          <Button onClick={saveProfile} disabled={saving} className="w-full">
            {saving ? "Guardando…" : "Guardar cambios"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Gastos fijos</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <ul className="space-y-2">
            {fixed.map((f) => (
              <li
                key={f.id}
                className="flex items-center gap-2 rounded-xl border border-line bg-surface-2/60 px-3 py-2"
              >
                <button
                  type="button"
                  onClick={() => toggleFixed(f)}
                  className={`flex-1 text-left text-sm ${
                    f.active ? "text-ink" : "text-ink-faint line-through"
                  }`}
                >
                  <span className="font-semibold">{f.name}</span>
                  <span className="ml-2 text-ink-muted">
                    {formatCurrency(Number(f.amount))}
                  </span>
                </button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => removeFixed(f.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </li>
            ))}
          </ul>
          <div className="grid grid-cols-[1fr_100px_auto] gap-2">
            <Input
              placeholder="Nombre"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />
            <Input
              placeholder="€"
              inputMode="decimal"
              value={newAmount}
              onChange={(e) => setNewAmount(e.target.value)}
            />
            <Button type="button" size="icon" onClick={addFixed}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      <Button variant="outline" className="w-full" onClick={logout}>
        <LogOut className="h-4 w-4" /> Cerrar sesión
      </Button>
    </div>
  );
}
