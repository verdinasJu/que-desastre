-- Vincular movimientos auto-generados a gastos fijos
alter table public.transactions
  add column if not exists fixed_expense_id uuid
  references public.fixed_expenses(id) on delete set null;

create index if not exists transactions_fixed_expense_idx
  on public.transactions (fixed_expense_id)
  where fixed_expense_id is not null;
