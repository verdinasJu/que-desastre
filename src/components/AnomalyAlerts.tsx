import { AlertTriangle } from "lucide-react";
import type { SpendingAnomaly } from "@/lib/anomalies";
import { formatCurrency } from "@/lib/utils";

interface AnomalyAlertsProps {
  anomalies: SpendingAnomaly[];
  currency?: string;
}

export function AnomalyAlerts({
  anomalies,
  currency = "EUR",
}: AnomalyAlertsProps) {
  if (!anomalies.length) return null;

  return (
    <div className="animate-rise space-y-2">
      {anomalies.map((a) => (
        <div
          key={a.category}
          className="flex items-start gap-3 rounded-2xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm text-violet-950"
        >
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-violet-600" />
          <div className="min-w-0">
            <p className="font-semibold">Anomalía en {a.category}</p>
            <p className="mt-0.5 text-violet-900/80 leading-snug">
              {a.message} Esta semana:{" "}
              <span className="font-medium">
                {formatCurrency(a.current, currency)}
              </span>
              {a.average > 0 ? (
                <>
                  {" "}
                  · media: {formatCurrency(a.average, currency)}
                </>
              ) : null}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
