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
