import ReactECharts from "echarts-for-react";
import { Brain, Compass } from "lucide-react";

interface TrendChartProps {
  options: any;
  height?: string;
  loading?: boolean;
  headline?: string;
  aiInsight?: string;
  recommendation?: string;
}

export default function TrendChart({
  options,
  height = "300px",
  loading = false,
  headline,
  aiInsight,
  recommendation,
}: TrendChartProps) {
  if (loading) {
    return (
      <div
        className="bg-[#111827] border border-[#1e293b] rounded flex items-center justify-center animate-pulse"
        style={{ height }}
      >
        <span className="text-xs text-slate-500 font-mono">Loading telemetry...</span>
      </div>
    );
  }

  const darkThemeOptions = {
    backgroundColor: "transparent",
    textStyle: {
      color: "#94a3b8",
      fontFamily: "Inter, system-ui, sans-serif",
    },
    title: {
      ...options.title,
      textStyle: {
        color: "#f8fafc",
        fontSize: 14,
        fontWeight: "bold",
      },
    },
    tooltip: {
      trigger: "axis",
      backgroundColor: "#0f172a",
      borderColor: "#1e293b",
      textStyle: {
        color: "#f8fafc",
        fontSize: 11,
      },
      ...options.tooltip,
    },
    grid: {
      left: "3%",
      right: "4%",
      bottom: "3%",
      containLabel: true,
      ...options.grid,
    },
    ...options,
  };

  return (
    <div className="flex flex-col gap-3 w-full">
      {headline && (
        <div className="border-b border-[#1e293b] pb-2 mb-1">
          <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider font-mono">
            {headline}
          </h4>
        </div>
      )}

      <div style={{ height, width: "100%" }}>
        <ReactECharts
          option={darkThemeOptions}
          style={{ height: "100%", width: "100%" }}
          theme="dark"
          notMerge={true}
          lazyUpdate={true}
        />
      </div>

      {(aiInsight || recommendation) && (
        <div className="mt-2 bg-[#090d16] border border-[#1e293b]/60 rounded p-3 space-y-2 text-xs">
          {aiInsight && (
            <div className="flex items-start gap-2">
              <Brain className="text-blue-400 mt-0.5 flex-shrink-0" size={13} />
              <div>
                <span className="font-semibold text-slate-300 block text-[10px] uppercase font-mono tracking-wider">AI Trend Insight</span>
                <p className="text-slate-400 mt-0.5 text-[11px] leading-relaxed">{aiInsight}</p>
              </div>
            </div>
          )}
          {recommendation && (
            <div className="flex items-start gap-2 border-t border-[#1e293b]/40 pt-2">
              <Compass className="text-amber-400 mt-0.5 flex-shrink-0" size={13} />
              <div>
                <span className="font-semibold text-amber-400 block text-[10px] uppercase font-mono tracking-wider">AI Operations Suggestion</span>
                <p className="text-slate-300 mt-0.5 text-[11px] leading-relaxed">{recommendation}</p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
