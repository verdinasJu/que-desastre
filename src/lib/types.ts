export type TransactionType = "income" | "expense" | "investment";

export interface Profile {
  id: string;
  monthly_salary: number;
  initial_savings: number;
  initial_investments: number;
  currency: string;
  onboarding_completed: boolean;
  payday_day: number;
  onboarding_completed_at?: string;
  hours_per_month: number;
  created_at?: string;
  updated_at?: string;
}

export interface FixedExpense {
  id: string;
  user_id: string;
  name: string;
  amount: number;
  category: string;
  active: boolean;
  created_at?: string;
}

export interface Transaction {
  id: string;
  user_id: string;
  type: TransactionType;
  amount: number;
  description: string;
  category: string;
  date: string;
  trip_id?: string | null;
  fixed_expense_id?: string | null;
  created_at?: string;
}

export interface Trip {
  id: string;
  user_id: string;
  name: string;
  start_date: string;
  end_date: string;
  budget: number;
  created_at?: string;
}

export interface CustomCategory {
  id: string;
  user_id: string;
  name: string;
  type: TransactionType;
  created_at?: string;
}

export interface CategoryBudget {
  id: string;
  user_id: string;
  category: string;
  amount: number;
  created_at?: string;
}

export interface SharedBudget {
  id: string;
  owner_id: string;
  category: string;
  amount: number;
  created_at?: string;
}

export interface TripMember {
  trip_id: string;
  user_id: string;
  color: string;
  label: string;
  joined_at?: string;
}

export interface SavingsGoal {
  id: string;
  user_id: string;
  name: string;
  target_amount: number;
  current_amount: number;
  deadline: string | null;
  created_at?: string;
}

export type DebtDirection = "i_owe" | "they_owe";

export interface Debt {
  id: string;
  user_id: string;
  direction: DebtDirection;
  person_name: string;
  description: string;
  amount: number;
  paid_amount: number;
  due_date: string | null;
  settled: boolean;
  created_at?: string;
}

export type AssetKind = "crypto" | "etf" | "stock" | "other";

export interface InvestmentPosition {
  id: string;
  user_id: string;
  name: string;
  asset_kind: AssetKind;
  symbol: string | null;
  quantity: number;
  /** Lo que metiste en € (coste de adquisición). */
  cost_basis: number;
  /** Si lo rellenas, se usa en lugar del precio de mercado. */
  manual_value: number | null;
  last_price: number | null;
  last_value: number | null;
  priced_at: string | null;
  notes: string;
  created_at?: string;
  updated_at?: string;
}

export interface MonthStats {
  patrimonioTotal: number;
  disponibleParaGastar: number;
  gastadoEsteMes: number;
  invertidoEsteMes: number;
  ahorroDelMes: number;
  ingresosDelMes: number;
  gastosFijosDelMes: number;
  gastosVariablesDelMes: number;
  ingresoBaseDelMes: number;
}
