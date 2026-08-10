-- Un auto-fijo por gasto fijo y mes; limpia duplicados y meses anteriores

delete from public.transactions t
where t.fixed_expense_id is not null
  and t.id not in (
    select distinct on (user_id, fixed_expense_id, date_trunc('month', date))
      id
    from public.transactions
    where fixed_expense_id is not null
    order by user_id, fixed_expense_id, date_trunc('month', date), created_at asc
  );

delete from public.transactions
where fixed_expense_id is not null
  and date < date_trunc('month', current_date)::date;

create unique index if not exists transactions_one_fixed_per_month
  on public.transactions (user_id, fixed_expense_id, date)
  where fixed_expense_id is not null;
