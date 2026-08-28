import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/** Redirige a /onboarding si el perfil aún no está completo. */
export async function requireOnboardingComplete() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("onboarding_completed")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.onboarding_completed) redirect("/onboarding");
}

/** Redirige al inicio si el onboarding ya está hecho. */
export async function redirectIfOnboardingComplete() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("onboarding_completed")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.onboarding_completed) redirect("/");
}
