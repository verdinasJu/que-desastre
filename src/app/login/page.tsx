"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const supabase = createClient();

    if (mode === "login") {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      setLoading(false);
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success("¡Bienvenido!");
      router.replace("/");
      router.refresh();
      return;
    }

    const { data, error } = await supabase.auth.signUp({ email, password });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    if (data.session) {
      toast.success("Cuenta creada");
      router.replace("/onboarding");
      router.refresh();
      return;
    }
    toast.success(
      "Cuenta creada. Si pide confirmación, revisa el email y luego inicia sesión."
    );
    setMode("login");
  }

  return (
    <main className="relative mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-5 py-10">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-16 top-20 h-56 w-56 rounded-full bg-teal-400/20 blur-3xl animate-fade" />
        <div className="absolute -right-10 bottom-24 h-64 w-64 rounded-full bg-sky-400/20 blur-3xl animate-fade" />
      </div>

      <div className="relative animate-rise space-y-8">
        <header className="space-y-3 text-center">
          <p className="font-display text-4xl font-semibold tracking-tight text-ink sm:text-5xl">
            Que Desastre
          </p>
          <p className="text-sm text-ink-muted leading-relaxed">
            Controla nómina, gastos, inversiones y ahorro sin perder de vista
            tu patrimonio real.
          </p>
        </header>

        <form
          onSubmit={handleSubmit}
          className="space-y-4 rounded-3xl border border-line/80 bg-surface/90 p-6 shadow-sm backdrop-blur"
        >
          <div className="grid grid-cols-2 gap-2 rounded-xl bg-surface-2 p-1">
            <button
              type="button"
              onClick={() => setMode("login")}
              className={`rounded-lg py-2 text-sm font-semibold transition ${
                mode === "login"
                  ? "bg-surface text-ink shadow-sm"
                  : "text-ink-muted"
              }`}
            >
              Entrar
            </button>
            <button
              type="button"
              onClick={() => setMode("register")}
              className={`rounded-lg py-2 text-sm font-semibold transition ${
                mode === "register"
                  ? "bg-surface text-ink shadow-sm"
                  : "text-ink-muted"
              }`}
            >
              Crear cuenta
            </button>
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu@email.com"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Contraseña</Label>
            <Input
              id="password"
              type="password"
              autoComplete={
                mode === "login" ? "current-password" : "new-password"
              }
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Mínimo 6 caracteres"
            />
          </div>

          <Button type="submit" className="w-full" size="lg" disabled={loading}>
            {loading
              ? "Un momento…"
              : mode === "login"
                ? "Entrar"
                : "Crear cuenta"}
          </Button>
        </form>
      </div>
    </main>
  );
}
