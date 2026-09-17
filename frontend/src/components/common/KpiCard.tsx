/**
 * Summary KPI card for the 12-column dashboard grid (SAD Section 12.1). Used by: all dashboard variants.
 */
import { ReactNode } from "react";

interface KpiBadge {
  label: string;
  type?: "success" | "warning" | "error" | "neutral";
}

interface KpiCardProps {
  title: string;
  value: string | number;
  icon?: ReactNode;
  description?: string;
  trend?: string;
  trendType?: "success" | "warning" | "error" | "neutral";
  loading?: boolean;
  badges?: KpiBadge[];
}

export default function KpiCard({
  title,
  value,
  icon,
  description,
  trend,
  trendType = "neutral",
  loading = false,
  badges = [],
}: KpiCardProps) {
  if (loading) {
    return (
      <div className="bg-[#111827] border border-[#1e293b] rounded p-5 flex flex-col gap-3 animate-pulse select-none">
        <div className="h-4 w-24 bg-slate-800 rounded"></div>
        <div className="h-8 w-16 bg-slate-800 rounded"></div>
        <div className="h-3 w-32 bg-slate-800 rounded"></div>
      </div>
    );
  }

  const getTrendColor = (type = trendType) => {
    switch (type) {
      case "success":
        return "text-emerald-400 bg-emerald-500/10 border-emerald-500/20";
      case "warning":
        return "text-amber-400 bg-amber-500/10 border-amber-500/20";
      case "error":
        return "text-red-400 bg-red-500/10 border-red-500/20";
      default:
        return "text-slate-400 bg-slate-500/10 border-slate-500/20";
    }
  };

  return (
    <div className="bg-[#111827] border border-[#1e293b] rounded p-5 hover:border-slate-700 transition-colors select-none">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-400 tracking-wider uppercase">
          {title}
        </span>
        {icon && <div className="text-blue-500">{icon}</div>}
      </div>

      <div className="mt-4 flex items-baseline gap-2">
        <span className="text-2xl font-bold font-mono text-slate-100 tracking-tight">
          {value}
        </span>
        {trend && (
          <span className={`text-[10px] px-1.5 py-0.5 rounded border font-mono ${getTrendColor()}`}>
            {trend}
          </span>
        )}
      </div>

      {badges.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {badges.map((badge, idx) => (
            <span
              key={idx}
              className={`text-[10px] px-1.5 py-0.5 rounded border font-mono ${getTrendColor(badge.type)}`}
            >
              {badge.label}
            </span>
          ))}
        </div>
      )}

      {description && (
        <p className="mt-2.5 text-[10px] text-slate-500 leading-normal">
          {description}
        </p>
      )}
    </div>
  );
}
