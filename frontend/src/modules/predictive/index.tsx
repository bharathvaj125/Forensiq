import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { predictiveService } from "../../services/predictiveService";
import { assistantService } from "../../services/assistantService";
import { useReferenceOptions } from "../../services/referenceService";
import TrendChart from "../../components/charts/TrendChart";
import { useLanguage } from "../../app/providers/LanguageContext";
import { Brain, TrendingUp, MapPin, Car, Sparkles, RefreshCw, Send, ShieldAlert, Bot } from "lucide-react";

type Tab = "timeSeries" | "hotspots" | "patrol" | "warnings" | "assistant";
interface ChatMessage {
  sender: "user" | "bot";
  text: string;
  actions?: string[];
}

const DATE_PRESETS = ["24h", "7d", "1m", "3m", "1y", "all"] as const;
const RISK_BADGE: Record<string, string> = {
  CRITICAL: "bg-red-500/10 text-red-400 border border-red-500/20",
  HIGH: "bg-orange-500/10 text-orange-400 border border-orange-500/20",
  MODERATE: "bg-amber-500/10 text-amber-400 border border-amber-500/20",
};
const signed = (value: number, digits = 1) => `${value >= 0 ? "+" : ""}${value.toFixed(digits)}`;

export default function Predictive() {
  const { translateData } = useLanguage();
  const reference = useReferenceOptions();
  const [activeTab, setActiveTab] = useState<Tab>("timeSeries");
  const [districtId, setDistrictId] = useState<number | undefined>(undefined);
  const [crimeCategory, setCrimeCategory] = useState<string>("");
  const [datePreset, setDatePreset] = useState<string>("all");
  const [chatInput, setChatInput] = useState<string>("");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [isChatLoading, setIsChatLoading] = useState(false);

  const crime = crimeCategory || undefined;
  const { data: dashboard, isLoading: isDashboardLoading, isError: isDashboardError, error: dashboardError, refetch: refetchDashboard } = useQuery({
    queryKey: ["predictiveDashboard", districtId, crimeCategory, datePreset],
    queryFn: () => predictiveService.getDashboard({ districtId, crimeCategory: crime, datePreset }),
  });
  const { data: hotspotData } = useQuery({
    queryKey: ["predictiveHotspotRankings", districtId, crimeCategory],
    queryFn: () => predictiveService.getHotspots({ districtId, crimeCategory: crime }),
  });
  const { data: patrol } = useQuery({
    queryKey: ["predictivePatrolStrategy", districtId],
    queryFn: () => predictiveService.getPatrolStrategy({ districtId }),
  });
  const { data: warningData } = useQuery({
    queryKey: ["predictiveEarlyWarnings", districtId],
    queryFn: () => predictiveService.getEarlyWarnings({ districtId }),
  });
  const { data: assistantStatus } = useQuery({
    queryKey: ["assistantStatus"],
    queryFn: () => assistantService.getStatus(),
    enabled: activeTab === "assistant",
  });

  const hourly = dashboard?.hourly_distribution ?? [];
  const monthly = dashboard?.monthly_trend ?? [];
  const hotspots = hotspotData?.hotspots ?? [];
  const alerts = warningData?.alerts ?? [];
  const districtScope = reference.districts.find((d) => d.id === districtId)?.name;

  const hourlyChartOptions = {
    tooltip: { trigger: "axis" },
    grid: { left: "3%", right: "4%", bottom: "10%", top: "15%", containLabel: true },
    xAxis: { type: "category", data: hourly.map((p) => `${String(p.hour).padStart(2, "0")}:00`), axisLabel: { color: "#94a3b8", fontSize: 10, fontStyle: "monospace" } },
    yAxis: { type: "value", axisLabel: { color: "#94a3b8", fontSize: 10 } },
    series: [{
      name: "Incidents",
      data: hourly.map((p) => ({ value: p.count, itemStyle: { color: p.peak_label ? "#ef4444" : "#3b82f6", borderRadius: [4, 4, 0, 0] } })),
      type: "bar",
    }],
  };

  const monthlyChartOptions = {
    tooltip: { trigger: "axis" },
    grid: { left: "3%", right: "4%", bottom: "10%", top: "15%", containLabel: true },
    xAxis: { type: "category", data: monthly.map((m) => m.year_month), axisLabel: { color: "#94a3b8", fontSize: 10, rotate: 30 } },
    yAxis: { type: "value", axisLabel: { color: "#94a3b8", fontSize: 10 } },
    series: [
      { name: "Registered FIRs", data: monthly.map((m) => (m.forecast_count == null ? m.historical_count : null)), type: "line", smooth: true, color: "#3b82f6", areaStyle: { color: "rgba(59, 130, 246, 0.15)" } },
      { name: "30-day forecast", data: monthly.map((m) => m.forecast_count), type: "bar", color: "#f59e0b" },
    ],
  };

  const handleSendChat = async (textToSend?: string) => {
    const query = textToSend || chatInput;
    if (!query.trim() || isChatLoading) return;
    setChatMessages((prev) => [...prev, { sender: "user", text: query }]);
    setChatInput("");
    setIsChatLoading(true);
    try {
      const res = await predictiveService.queryAssistant(query, districtId);
      setChatMessages((prev) => [...prev, { sender: "bot", text: res.answer, actions: res.recommended_actions }]);
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      setChatMessages((prev) => [...prev, { sender: "bot", text: typeof detail === "string" ? detail : "The assistant could not be reached. Please try again in a moment." }]);
    } finally {
      setIsChatLoading(false);
    }
  };

  const selectClass = "bg-[#151c2e] border border-[#1e293b] text-slate-200 text-xs px-2.5 py-1 rounded focus:outline-none focus:border-blue-500 font-mono";
  const metric = (label: string, value: string, sub: string, colour: string) => (
    <div className="bg-[#111827] border border-[#1e293b] p-3 rounded flex flex-col">
      <span className="text-[10px] text-slate-400 font-mono font-bold">{label}</span>
      <span className={`text-xl font-extrabold font-mono mt-1 ${colour}`}>{isDashboardLoading ? "…" : value}</span>
      <span className="text-[9px] text-slate-500 font-mono mt-0.5">{sub}</span>
    </div>
  );

  return (
    <div className="space-y-4 select-none flex flex-col h-full overflow-hidden">
      <div className="bg-[#111827] border border-[#1e293b] p-3.5 rounded shadow-xl flex flex-wrap justify-between items-center gap-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-blue-500/10 border border-blue-500/20 rounded">
            <Brain className="text-blue-400" size={22} />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight text-slate-100 font-mono uppercase">Forensiq AI Decision Support & Predictive Intelligence</h1>
            <p className="text-xs text-slate-400 font-sans">
              Forecasts, KDE hotspots, patrol plans and early warnings computed from the case database
              {dashboard?.as_of_date ? ` (FIRs registered up to ${dashboard.as_of_date}${dashboard.future_dated_cases_excluded ? `; ${dashboard.future_dated_cases_excluded} future-dated registrations excluded` : ""})` : ""}.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 font-mono text-xs">
          <div className="flex bg-[#151c2e] border border-[#1e293b] p-1 rounded">
            {DATE_PRESETS.map((id) => (
              <button key={id} onClick={() => setDatePreset(id)}
                className={`px-2 py-0.5 rounded text-[11px] font-bold transition-colors ${datePreset === id ? "bg-blue-600 text-white" : "text-slate-400 hover:text-slate-200"}`}>
                {id === "all" ? "All" : id}
              </button>
            ))}
          </div>

          <select value={districtId || ""} onChange={(e) => setDistrictId(e.target.value ? Number(e.target.value) : undefined)} className={selectClass}>
            <option value="">Statewide ({reference.districts.length || "…"} districts)</option>
            {reference.districts.map((d) => <option key={d.id} value={d.id}>{translateData(d.name)}</option>)}
          </select>

          <select value={crimeCategory} onChange={(e) => setCrimeCategory(e.target.value)} className={selectClass}>
            <option value="">All crime categories</option>
            {reference.crime_heads.map((c) => <option key={c.id} value={c.id}>{translateData(c.name)}</option>)}
          </select>

          <button onClick={() => refetchDashboard()} className="bg-blue-600/20 hover:bg-blue-600/40 text-blue-400 border border-blue-500/30 p-1.5 rounded transition-colors">
            <RefreshCw size={14} className={isDashboardLoading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {isDashboardError && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-300 text-xs rounded p-3 font-mono">
          {(dashboardError as any)?.response?.data?.detail || "The predictive dashboard could not be loaded."}
        </div>
      )}

      <div className="grid grid-cols-6 gap-3">
        {metric("ANALYSED FIRs", (dashboard?.total_cases_analyzed ?? 0).toLocaleString(), datePreset === "all" ? "All registered FIRs in scope" : `Registered in the last ${datePreset}`, "text-blue-400")}
        {metric("30-DAY FORECAST", `${dashboard?.predicted_30day_cases ?? 0} FIRs`,
          `${signed(dashboard?.growth_rate_pct ?? 0)}% vs last 30 days${dashboard?.forecast_backtest_accuracy != null ? ` · backtest ${(dashboard.forecast_backtest_accuracy * 100).toFixed(0)}%` : ""}`, "text-amber-400")}
        {metric("HIGH-RISK HOTSPOTS", `${dashboard?.high_risk_hotspot_count ?? 0} zones`, `Critical/High of ${hotspots.length} KDE clusters`, "text-red-400")}
        {metric("PATROL UNITS", `${dashboard?.patrol_squads_recommended ?? 0}`, patrol ? `${patrol.recommended_officers} officers (${patrol.officers_per_unit} per unit)` : "…", "text-emerald-400")}
        {metric("EARLY WARNINGS", `${dashboard?.early_warnings_active ?? 0} active`, "Spikes, repeat offenders, overdue work", "text-purple-400")}
        {metric("OPEN CASES", `${dashboard?.backlog_workload_index ?? 0}%`, `${(dashboard?.open_cases ?? 0).toLocaleString()} FIRs not yet closed`, "text-cyan-400")}
      </div>

      <div className="flex border-b border-[#1e293b] bg-[#111827] rounded-t p-1 gap-1 text-xs font-mono">
        {([
          { id: "timeSeries", label: "📊 Time series & explanations", icon: TrendingUp },
          { id: "hotspots", label: "🔥 KDE hotspots", icon: MapPin },
          { id: "patrol", label: "🚓 Patrol strategy", icon: Car },
          { id: "warnings", label: "⚠️ Early warnings", icon: ShieldAlert },
          { id: "assistant", label: "💬 Command assistant", icon: Bot },
        ] as { id: Tab; label: string; icon: typeof Bot }[]).map((tab) => {
          const Icon = tab.icon;
          return (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`px-3.5 py-2 rounded flex items-center gap-1.5 font-bold transition-all ${activeTab === tab.id ? "bg-blue-600 text-white shadow-lg" : "text-slate-400 hover:text-slate-200 hover:bg-[#151c2e]"}`}>
              <Icon size={14} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto pr-1 space-y-4">
        {activeTab === "timeSeries" && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-[#111827] border border-[#1e293b] p-4 rounded space-y-2">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="text-xs font-bold text-slate-200 font-mono uppercase">24-hour incident distribution</h3>
                    <p className="text-[10px] text-slate-400 font-sans">Incidents by hour of day (IncidentFromDate); the three busiest hours are red.</p>
                  </div>
                  {dashboard?.peak_window && (
                    <span className="text-[10px] bg-red-500/10 text-red-400 border border-red-500/20 px-2 py-0.5 rounded font-mono font-bold">
                      Peak: {dashboard.peak_window} ({((dashboard.peak_window_share ?? 0) * 100).toFixed(0)}%)
                    </span>
                  )}
                </div>
                <div className="h-56"><TrendChart options={hourlyChartOptions} height="220px" /></div>
              </div>

              <div className="bg-[#111827] border border-[#1e293b] p-4 rounded space-y-2">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="text-xs font-bold text-slate-200 font-mono uppercase">Monthly FIRs and 30-day forecast</h3>
                    <p className="text-[10px] text-slate-400 font-sans">
                      {monthly.length > 1 ? `${monthly[0].year_month} to ${monthly[monthly.length - 2]?.year_month}` : "No history"}; forecast by ridge regression on daily registrations.
                    </p>
                  </div>
                  {dashboard?.forecast_trend && (
                    <span className="text-[10px] bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded font-mono font-bold">
                      {signed(dashboard.growth_rate_pct)}% · trend {dashboard.forecast_trend}
                    </span>
                  )}
                </div>
                <div className="h-56"><TrendChart options={monthlyChartOptions} height="220px" /></div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4 font-mono text-xs">
              <div className="bg-[#111827] border border-[#1e293b] p-3.5 rounded space-y-2">
                <div className="flex justify-between items-center border-b border-[#1e293b] pb-2">
                  <h3 className="text-xs font-bold text-slate-200 uppercase">Top districts by FIRs</h3>
                  <span className="text-[10px] text-slate-500">growth = last 30 d vs prior 30 d</span>
                </div>
                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                  {(dashboard?.district_rankings ?? []).map((d, idx) => (
                    <div key={d.district_name} className="flex justify-between items-center bg-[#151c2e] p-2 rounded border border-[#1e293b]">
                      <span className="font-bold text-slate-200">{idx + 1}. {translateData(d.district_name)}</span>
                      <div className="flex items-center gap-3">
                        <span className="text-slate-400">{d.case_count}</span>
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${RISK_BADGE[d.risk_level] || ""}`}>{d.risk_level} ({signed(d.growth_pct, 0)}%)</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-[#111827] border border-[#1e293b] p-3.5 rounded space-y-2">
                <div className="flex justify-between items-center border-b border-[#1e293b] pb-2">
                  <h3 className="text-xs font-bold text-slate-200 uppercase">Day-of-week distribution</h3>
                </div>
                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                  {(dashboard?.dow_distribution ?? []).map((dow) => (
                    <div key={dow.dow_index} className="flex justify-between items-center bg-[#151c2e] p-2 rounded border border-[#1e293b]">
                      <span className="font-bold text-slate-200">{dow.day_name}</span>
                      <div className="flex items-center gap-3">
                        <span className="text-amber-300 font-bold">{dow.count}</span>
                        <span className="text-[10px] text-slate-400">{dow.pct}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-[#111827] border border-[#1e293b] p-3.5 rounded space-y-2">
                <div className="flex justify-between items-center border-b border-[#1e293b] pb-2">
                  <h3 className="text-xs font-bold text-slate-200 uppercase">Crime categories</h3>
                  <span className="text-[10px] text-slate-500">trend = last 90 d vs prior 90 d</span>
                </div>
                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                  {(dashboard?.category_rankings ?? []).map((c, idx) => (
                    <div key={c.category_name} className="flex justify-between items-center bg-[#151c2e] p-2 rounded border border-[#1e293b]">
                      <span className="font-bold text-slate-200">{idx + 1}. {translateData(c.category_name)}</span>
                      <div className="flex items-center gap-3">
                        <span className="text-blue-400 font-bold">{c.case_count}</span>
                        <span className="text-[10px] text-slate-400">{c.trend_direction}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Sparkles className="text-amber-400" size={16} />
                <h3 className="text-xs font-bold text-slate-200 font-mono uppercase tracking-wider">Why these predictions</h3>
              </div>
              <div className="grid grid-cols-2 gap-4">
                {(dashboard?.xai_explanations ?? []).map((xai) => (
                  <div key={xai.title} className="bg-[#111827] border border-[#1e293b] p-4 rounded space-y-3">
                    <div className="flex justify-between items-start">
                      <h4 className="text-xs font-bold text-slate-100 font-mono">{xai.title}</h4>
                      {xai.confidence != null && (
                        <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded text-[10px] font-mono font-bold">
                          Backtest accuracy {(xai.confidence * 100).toFixed(0)}%
                        </span>
                      )}
                    </div>
                    <div className="bg-[#151c2e] p-2.5 rounded border border-[#1e293b] space-y-1">
                      <span className="text-[10px] text-amber-400 font-mono font-bold block">FINDING:</span>
                      <p className="text-xs text-slate-200 font-mono leading-relaxed">{xai.prediction}</p>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 font-mono block mb-1">METHOD:</span>
                      <p className="text-xs text-slate-300 font-sans leading-relaxed bg-[#151c2e]/60 p-2.5 rounded border border-[#1e293b]">{xai.why_explanation}</p>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 font-mono block mb-1">SUPPORTING STATISTICS:</span>
                      <ul className="text-[10px] text-slate-300 font-mono list-disc pl-4 space-y-0.5">
                        {xai.supporting_stats.map((stat, i) => <li key={i}>{stat}</li>)}
                      </ul>
                      <span className="text-[9px] text-slate-500 font-mono block mt-1">Data: {xai.data_sources}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === "hotspots" && (
          <div className="space-y-4">
            <div className="flex justify-between items-center bg-[#111827] border border-[#1e293b] p-3 rounded">
              <div>
                <h3 className="text-xs font-bold text-slate-200 font-mono uppercase">Kernel density hotspot rankings</h3>
                <p className="text-[10px] text-slate-400 font-sans">
                  Clusters of incident coordinates; risk level compares each cluster's share of High/Severe FIRs with the average in scope.
                </p>
              </div>
              <span className="text-xs font-mono font-bold text-red-400 bg-red-500/10 border border-red-500/20 px-2.5 py-1 rounded">
                {hotspots.filter((h) => h.risk_level === "Critical" || h.risk_level === "High").length} Critical / High of {hotspots.length}
              </span>
            </div>

            {hotspots.length === 0 && <p className="text-xs text-slate-500 font-mono p-4">No geocoded cases in this scope.</p>}
            <div className="grid grid-cols-2 gap-4">
              {hotspots.map((hs) => (
                <div key={hs.rank} className="bg-[#111827] border border-[#1e293b] p-4 rounded space-y-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="bg-blue-600 text-white text-xs font-bold font-mono px-2 py-0.5 rounded">#{hs.rank}</span>
                        <h4 className="text-sm font-bold text-slate-100 font-mono">{translateData(hs.location_name)}</h4>
                      </div>
                      <p className="text-[10px] text-slate-400 font-mono mt-0.5">{hs.latitude.toFixed(4)} N, {hs.longitude.toFixed(4)} E</p>
                    </div>
                    <div className="text-right">
                      <span className="text-lg font-extrabold text-red-400 font-mono">{hs.hotspot_score}</span>
                      <span className="text-[9px] block font-mono text-red-400 uppercase font-bold">{hs.risk_level} · relative density</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-4 gap-2 bg-[#151c2e] p-2 rounded border border-[#1e293b] text-center font-mono text-[10px]">
                    <div><span className="text-slate-500 block text-[9px]">FIRs</span><span className="text-slate-200 font-bold">{hs.case_count}</span></div>
                    <div><span className="text-slate-500 block text-[9px]">REPEAT OFFENDER PROFILES</span><span className="text-red-400 font-bold">{hs.repeat_offenders_count}</span></div>
                    <div><span className="text-slate-500 block text-[9px]">OPEN</span><span className="text-amber-400 font-bold">{hs.pending_cases}</span></div>
                    <div><span className="text-slate-500 block text-[9px]">PEAK HOURS</span><span className="text-emerald-400 font-bold text-[9px]">{hs.peak_window}</span></div>
                  </div>

                  <div className="bg-[#151c2e]/70 p-2.5 rounded border border-[#1e293b]">
                    <span className="text-[10px] text-blue-400 font-mono font-bold block mb-0.5">EVIDENCE:</span>
                    <p className="text-xs text-slate-300 font-sans leading-relaxed">{hs.reason}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === "patrol" && (
          <div className="space-y-4">
            {!patrol ? <p className="text-xs text-slate-500 font-mono p-4">Computing patrol plan…</p> : (
              <>
                <div className="bg-[#111827] border border-[#1e293b] p-4 rounded space-y-4">
                  <div className="flex justify-between items-center border-b border-[#1e293b] pb-3">
                    <div>
                      <h3 className="text-sm font-bold text-slate-100 font-mono uppercase">Patrol allocation: {translateData(patrol.district_name)}</h3>
                      <p className="text-xs text-slate-400 font-sans mt-0.5">
                        Derived from {patrol.hotspots_considered} KDE hotspots and the hour-of-day distribution of incidents; the allocation rule is stated below.
                      </p>
                    </div>
                    <span className="bg-red-500/10 text-red-400 border border-red-500/20 px-3 py-1 rounded text-xs font-mono font-bold">{patrol.priority_level} PRIORITY</span>
                  </div>

                  <div className="grid grid-cols-4 gap-4">
                    <div className="bg-[#151c2e] p-3 rounded border border-[#1e293b]">
                      <span className="text-[10px] text-slate-400 font-mono block">OFFICERS</span>
                      <span className="text-2xl font-extrabold text-blue-400 font-mono mt-1 block">{patrol.recommended_officers}</span>
                      <span className="text-[10px] text-slate-500 font-mono">{patrol.recommended_cars + patrol.recommended_bikes} units × {patrol.officers_per_unit} officers</span>
                    </div>
                    <div className="bg-[#151c2e] p-3 rounded border border-[#1e293b]">
                      <span className="text-[10px] text-slate-400 font-mono block">VEHICLES</span>
                      <span className="text-2xl font-extrabold text-emerald-400 font-mono mt-1 block">{patrol.recommended_cars} cars / {patrol.recommended_bikes} bikes</span>
                      <span className="text-[10px] text-slate-500 font-mono">Car per Critical hotspot, bike per High</span>
                    </div>
                    <div className="bg-[#151c2e] p-3 rounded border border-[#1e293b]">
                      <span className="text-[10px] text-slate-400 font-mono block">BUSIEST 6-HOUR WINDOW</span>
                      <span className="text-xl font-extrabold text-amber-400 font-mono mt-1 block">{patrol.suggested_timing}</span>
                      <span className="text-[10px] text-slate-500 font-mono">Where most incidents occur</span>
                    </div>
                    <div className="bg-[#151c2e] p-3 rounded border border-[#1e293b]">
                      <span className="text-[10px] text-slate-400 font-mono block">SHIFT</span>
                      <span className="text-lg font-bold text-cyan-400 font-mono mt-1 block">{patrol.suggested_shift}</span>
                    </div>
                  </div>

                  <div className="bg-[#151c2e] p-3 rounded border border-[#1e293b] space-y-1">
                    <span className="text-[10px] text-blue-400 font-mono font-bold block">ROUTE (nearest-neighbour order from the densest hotspot):</span>
                    <div className="flex flex-wrap gap-2 pt-1 font-mono text-xs">
                      {patrol.patrol_route.map((stop, idx) => (
                        <span key={idx} className="bg-[#111827] text-slate-200 border border-[#1e293b] px-2.5 py-1 rounded">📍 {idx + 1}. {translateData(stop)}</span>
                      ))}
                    </div>
                  </div>

                  <div className="bg-[#151c2e]/70 p-3 rounded border border-[#1e293b]">
                    <span className="text-[10px] text-amber-400 font-mono font-bold block mb-1">REASONING:</span>
                    <p className="text-xs text-slate-300 font-sans leading-relaxed">{patrol.reasoning}</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <h3 className="text-xs font-bold text-slate-200 font-mono uppercase tracking-wider">Specialist support for the main crime types</h3>
                  <div className="grid grid-cols-2 gap-4">
                    {patrol.resource_recommendations.map((res) => (
                      <div key={res.unit_type} className="bg-[#111827] border border-[#1e293b] p-3.5 rounded space-y-2">
                        <span className="font-bold text-xs text-slate-100 font-mono">{res.unit_type}</span>
                        <p className="text-xs text-slate-300 font-sans leading-relaxed">{res.justification}</p>
                        <span className="text-[10px] text-slate-400 font-mono block">Data: {res.data_support}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {activeTab === "warnings" && (
          <div className="space-y-4">
            <div className="flex justify-between items-center bg-[#111827] border border-[#1e293b] p-3 rounded">
              <div>
                <h3 className="text-xs font-bold text-slate-200 font-mono uppercase">Early warnings</h3>
                <p className="text-[10px] text-slate-400 font-sans">
                  Crime spikes (Poisson test against the previous six 30-day periods, Bonferroni-corrected), repeat-offender activity and investigations past their statutory window.
                </p>
              </div>
              <span className="bg-purple-500/10 text-purple-400 border border-purple-500/20 px-3 py-1 rounded text-xs font-mono font-bold">{alerts.length} active</span>
            </div>

            {alerts.length === 0 && <p className="text-xs text-slate-500 font-mono p-4">No alert conditions are met in this scope.</p>}
            <div className="grid grid-cols-2 gap-4">
              {alerts.map((alert) => (
                <div key={alert.alert_id} className="bg-[#111827] border border-[#1e293b] p-4 rounded space-y-3">
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-2">
                      <ShieldAlert className="text-red-400 flex-shrink-0" size={18} />
                      <div>
                        <span className="text-[10px] text-slate-400 font-mono">{alert.alert_id} · {alert.alert_type} · {alert.risk_level}</span>
                        <h4 className="text-xs font-bold text-slate-100 font-mono">{alert.title}</h4>
                      </div>
                    </div>
                    {alert.confidence != null && (
                      <span className="bg-red-500/10 text-red-400 border border-red-500/20 px-2 py-0.5 rounded text-[10px] font-mono font-bold">
                        {(alert.confidence * 100).toFixed(2)}% statistical confidence
                      </span>
                    )}
                  </div>

                  <div className="bg-[#151c2e] p-2.5 rounded border border-[#1e293b] space-y-1">
                    <span className="text-[10px] text-amber-400 font-mono font-bold block">EVIDENCE:</span>
                    <p className="text-xs text-slate-300 font-sans leading-relaxed">{alert.evidence}</p>
                    <span className="text-[10px] text-slate-400 font-mono block">{alert.reason}</span>
                  </div>

                  {alert.affected_stations.length > 0 && (
                    <div>
                      <span className="text-[10px] text-blue-400 font-mono font-bold block mb-1">STATIONS:</span>
                      <div className="flex flex-wrap gap-1.5 font-mono text-[10px]">
                        {alert.affected_stations.map((st) => <span key={st} className="bg-[#151c2e] text-slate-300 px-2 py-0.5 rounded border border-[#1e293b]">🏢 {translateData(st)}</span>)}
                      </div>
                    </div>
                  )}

                  <div className="bg-blue-500/5 p-2.5 rounded border border-blue-500/20">
                    <span className="text-[10px] text-emerald-400 font-mono font-bold block mb-0.5">SUGGESTED ACTION:</span>
                    <p className="text-xs text-slate-200 font-sans">{alert.suggested_action}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === "assistant" && (
          <div className="bg-[#111827] border border-[#1e293b] rounded h-[580px] flex flex-col overflow-hidden">
            <div className="p-3.5 border-b border-[#1e293b] bg-[#0d1322] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bot className="text-blue-400" size={18} />
                <div>
                  <h3 className="text-xs font-bold text-slate-100 font-mono uppercase">Operational command assistant</h3>
                  <p className="text-[10px] text-slate-400 font-sans">
                    Answers by running queries against the case database{districtScope ? `; scoped to ${districtScope} unless you name another place` : ""}.
                  </p>
                </div>
              </div>
              {assistantStatus && (
                <span className={`text-[10px] border px-2 py-0.5 rounded font-mono font-bold ${assistantStatus.available ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-amber-500/10 text-amber-400 border-amber-500/20"}`}>
                  {assistantStatus.available ? `Online · ${assistantStatus.models[0]}` : assistantStatus.configured ? "Model rate-limited" : "No model configured"}
                </span>
              )}
            </div>

            <div className="flex-1 p-4 overflow-y-auto space-y-3 font-sans">
              {chatMessages.length === 0 && (
                <p className="text-xs text-slate-500 font-mono">
                  Ask about patrol needs, why an area is flagged, how many FIRs are open, or what the forecast is.
                  {assistantStatus ? ` ${assistantStatus.cases_in_scope.toLocaleString()} FIRs are queryable in your jurisdiction.` : ""}
                </p>
              )}
              {chatMessages.map((msg, idx) => (
                <div key={idx} className={`flex flex-col ${msg.sender === "user" ? "items-end" : "items-start"}`}>
                  <div className={`max-w-2xl p-3 rounded text-xs leading-relaxed whitespace-pre-wrap ${msg.sender === "user" ? "bg-blue-600 text-white rounded-br-none" : "bg-[#151c2e] border border-[#1e293b] text-slate-200 rounded-bl-none font-mono"}`}>
                    {msg.text}
                  </div>
                  {msg.actions && msg.actions.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2 max-w-2xl">
                      {msg.actions.map((act, aIdx) => (
                        <span key={aIdx} className="bg-[#151c2e] text-blue-300 border border-blue-500/30 px-2.5 py-1 rounded text-[10px] font-mono">⚡ {act}</span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              {isChatLoading && (
                <div className="flex items-center gap-2 text-xs text-blue-400 font-mono">
                  <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                  <span>Querying the database…</span>
                </div>
              )}
            </div>

            <div className="p-3 border-t border-[#1e293b] bg-[#0d1322] flex gap-2">
              <input
                type="text"
                placeholder="Ask an operational question about this scope…"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSendChat()}
                className="flex-1 bg-[#151c2e] border border-[#1e293b] text-slate-200 text-xs px-3.5 py-2 rounded focus:outline-none focus:border-blue-500 font-mono"
              />
              <button
                onClick={() => handleSendChat()}
                disabled={isChatLoading || !chatInput.trim()}
                className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white px-4 py-2 rounded text-xs font-mono font-bold flex items-center gap-1.5 transition-colors"
              >
                <Send size={14} />
                <span>Send</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
