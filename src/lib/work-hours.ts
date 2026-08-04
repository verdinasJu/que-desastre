/** Horas de trabajo equivalentes a un importe (€). */
export function amountToWorkHours(
  amount: number,
  monthlySalary: number,
  hoursPerMonth = 160
): number {
  const salary = Number(monthlySalary);
  const hours = Number(hoursPerMonth) || 160;
  if (!salary || salary <= 0 || !hours || hours <= 0) return 0;
  const hourly = salary / hours;
  if (hourly <= 0) return 0;
  return Number(amount) / hourly;
}

export function formatWorkHours(hours: number): string {
  if (!hours || hours <= 0) return "";
  if (hours < 1) {
    const mins = Math.round(hours * 60);
    return mins <= 1 ? "1 min de trabajo" : `${mins} min de trabajo`;
  }
  const rounded = hours >= 10 ? Math.round(hours) : Math.round(hours * 10) / 10;
  return rounded === 1 ? "1 h de trabajo" : `${rounded} h de trabajo`;
}

export function hourlyRate(monthlySalary: number, hoursPerMonth = 160) {
  const salary = Number(monthlySalary);
  const hours = Number(hoursPerMonth) || 160;
  if (!salary || !hours) return 0;
  return salary / hours;
}
