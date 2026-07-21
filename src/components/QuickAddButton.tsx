"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
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
import { TransactionForm } from "@/components/TransactionForm";
import { createClient } from "@/lib/supabase/client";
import type { TransactionType } from "@/lib/types";

export function QuickAddButton() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(values: {
    type: TransactionType;
    amount: number;
    description: string;
    category: string;
    date: string;
  }) {
    setLoading(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      toast.error("Sesión no válida");
      setLoading(false);
      return;
    }

    const { error } = await supabase.from("transactions").insert({
      user_id: user.id,
      ...values,
    });

    setLoading(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success("Movimiento añadido");
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          size="icon"
          className="fixed bottom-20 right-4 z-50 h-14 w-14 rounded-full shadow-lg shadow-brand/30 sm:right-8"
          aria-label="Añadir movimiento"
        >
          <Plus className="h-6 w-6" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nuevo movimiento</DialogTitle>
          <DialogDescription>
            Gasto, ingreso o inversión. Las inversiones se restan del
            disponible pero siguen contando en tu patrimonio.
          </DialogDescription>
        </DialogHeader>
        <TransactionForm onSubmit={handleSubmit} loading={loading} />
      </DialogContent>
    </Dialog>
  );
}
