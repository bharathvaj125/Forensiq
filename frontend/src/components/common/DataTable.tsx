import { ReactNode } from "react";

interface Column {
  header: string;
  accessorKey: string;
  render?: (row: any) => ReactNode;
}

interface Meta {
  total: number;
  page: number;
  pageSize: number;
}

interface DataTableProps {
  columns: Column[];
  data: any[];
  loading?: boolean;
  onRowClick?: (row: any) => void;
  meta?: Meta;
  onPageChange?: (page: number) => void;
}

import { useLanguage } from "../../app/providers/LanguageContext";

export default function DataTable({
  columns,
  data,
  loading = false,
  onRowClick,
  meta,
  onPageChange,
}: DataTableProps) {
  const { t } = useLanguage();

  return (
    <div className="flex flex-col h-full bg-[#111827] border border-[#1e293b] rounded overflow-hidden select-none">
      <div className="flex-1 overflow-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-[#0f1524] border-b border-[#1e293b]">
              <th className="w-1 px-0 py-3"></th>
              {columns.map((col, idx) => (
                <th
                  key={idx}
                  className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-400 font-mono"
                >
                  {t(col.header, col.header)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1e293b] text-slate-200">
            {loading ? (
              Array.from({ length: 5 }).map((_, rIdx) => (
                <tr key={rIdx} className="animate-pulse">
                  <td className="w-1 p-0">
                    <div className="w-1 h-8 bg-slate-800"></div>
                  </td>
                  {columns.map((_, cIdx) => (
                    <td key={cIdx} className="px-4 py-3.5">
                      <div className="h-4 bg-slate-800 rounded w-2/3"></div>
                    </td>
                  ))}
                </tr>
              ))
            ) : data.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length + 1}
                  className="px-4 py-8 text-center text-xs text-slate-500 font-mono"
                >
                  No matching record entries found in jurisdiction logs.
                </td>
              </tr>
            ) : (
              data.map((row, rIdx) => {
                const getSeverityColorClass = (r: any) => {
                  const priority = r.InvestigationPriority;
                  const gravity = r.GravityOffenceID;
                  const risk = r.AIRiskScore;
                  if (priority === undefined && gravity === undefined && risk === undefined) {
                    return "bg-transparent";
                  }
                  if (gravity === 1 || priority === "High" || (risk && risk >= 0.60)) {
                    return "bg-red-500";
                  }
                  if (gravity === 2 || priority === "Medium" || (risk && risk >= 0.30)) {
                    return "bg-amber-500";
                  }
                  return "bg-emerald-500";
                };

                return (
                  <tr
                    key={rIdx}
                    onClick={() => onRowClick && onRowClick(row)}
                    className={`text-xs transition-colors ${
                      onRowClick ? "cursor-pointer hover:bg-[#151c2e]" : ""
                    }`}
                  >
                    <td className="w-1 p-0">
                      <div className={`w-1 h-8 ${getSeverityColorClass(row)}`}></div>
                    </td>
                    {columns.map((col, cIdx) => (
                      <td key={cIdx} className="px-4 py-3 leading-relaxed">
                        {col.render ? col.render(row) : row[col.accessorKey]}
                      </td>
                    ))}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {meta && onPageChange && (
        <div className="bg-[#0f1524] border-t border-[#1e293b] px-4 py-3 flex items-center justify-between text-xs text-slate-400 font-mono">
          <div>
            Showing <span className="text-slate-200">{(meta.page - 1) * meta.pageSize + 1}</span> to{" "}
            <span className="text-slate-200">
              {Math.min(meta.page * meta.pageSize, meta.total)}
            </span>{" "}
            of <span className="text-slate-200">{meta.total}</span> records
          </div>
          <div className="flex gap-2">
            <button
              disabled={meta.page <= 1}
              onClick={() => onPageChange(meta.page - 1)}
              className="px-2.5 py-1 rounded bg-[#111827] border border-[#1e293b] hover:bg-slate-800 disabled:opacity-30 disabled:hover:bg-[#111827] text-[10px]"
            >
              Previous
            </button>
            <button
              disabled={meta.page * meta.pageSize >= meta.total}
              onClick={() => onPageChange(meta.page + 1)}
              className="px-2.5 py-1 rounded bg-[#111827] border border-[#1e293b] hover:bg-slate-800 disabled:opacity-30 disabled:hover:bg-[#111827] text-[10px]"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
