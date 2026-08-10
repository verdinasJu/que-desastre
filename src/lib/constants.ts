export const AUTO_SALARY_DESCRIPTION = "Ingreso mensual (automático)";
export const AUTO_SALARY_CATEGORY = "Ingreso habitual";

export const AUTO_FIXED_DESCRIPTION_PREFIX = "Gasto fijo (automático)";

export function autoFixedDescription(name: string) {
  return `${AUTO_FIXED_DESCRIPTION_PREFIX}: ${name}`;
}

export const EXPENSE_CATEGORIES = [
  "Comida",
  "Transporte",
  "Ocio",
  "Salud",
  "Casa",
  "Vivienda",
  "Servicios",
  "Viaje",
  "Otros",
] as const;

export const INCOME_CATEGORIES = [
  "Ingreso habitual",
  "Extra",
  "Venta",
  "Regalo",
  "Otros",
] as const;

export const INVESTMENT_CATEGORIES = [
  "Fondos",
  "Acciones",
  "Crypto",
  "Otros",
] as const;
