"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";

interface RedeemInviteCardProps {
  hint?: string;
}

export function RedeemInviteCard({
  hint = "Introduce el código de un solo uso que te han pasado.",
}: RedeemInviteCardProps) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);

  async function redeem() {
    const trimmed = code.trim().toUpperCase();
    if (trimmed.length < 6) {
      toast.error("Código demasiado corto");
      return;
    }
    setLoading(true);
    const supabase = createClient();
    const { data, error } = await supabase.rpc("redeem_share_invite", {
      p_code: trimmed,
    });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    const type = (data as { resource_type?: string } | null)?.resource_type;
    toast.success(
      type === "trip" ? "Te has unido al viaje" : "Te has unido al presupuesto"
    );
    setCode("");
    if (type === "trip") {
      router.push("/viajes");
    } else if (type === "budget") {
      router.push("/presupuestos");
    }
    router.refresh();
  }

  return (
    <div className="rounded-2xl border border-dashed border-line bg-surface/70 p-4 space-y-3">
      <div>
        <p className="text-sm font-semibold text-ink">Unirme con código</p>
        <p className="text-xs text-ink-muted mt-0.5">{hint}</p>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <div className="min-w-0 flex-1 space-y-1.5">
          <Label htmlFor="invite-code">Código</Label>
          <Input
            id="invite-code"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="ABCD1234"
            autoCapitalize="characters"
            className="font-mono tracking-wider uppercase"
          />
        </div>
        <Button
          type="button"
          onClick={redeem}
          disabled={loading}
          className="sm:mb-0"
        >
          {loading ? "Uniendo…" : "Unirme"}
        </Button>
      </div>
    </div>
  );
}
