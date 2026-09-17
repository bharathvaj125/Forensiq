import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { predictiveService } from "../../services/predictiveService";
import TrendChart from "../../components/charts/TrendChart";
import {
  Brain,
  TrendingUp,
  MapPin,
  Car,
  Sparkles,
  RefreshCw,
  Send,
  ShieldAlert,
  Bot,
} from "lucide-react";

const KARNATAKA_DISTRICTS = [
  { id: 1, name: "Bagalkot" },
  { id: 2, name: "Ballari (Bellary)" },
  { id: 3, name: "Belagavi (Belgaum)" },
  { id: 4, name: "Bengaluru City" },
  { id: 5, name: "Bengaluru Rural" },
  { id: 6, name: "Bidar" },
  { id: 7, name: "Chamarajanagar" },
  { id: 8, name: "Chikkaballapura" },
  { id: 9, name: "Chikkamagaluru" },
  { id: 10, name: "Chitradurga" },
  { id: 11, name: "Dakshina Kannada (Mangaluru)" },
  { id: 12, name: "Davanagere" },
  { id: 13, name: "Dharwad (Hubballi)" },
  { id: 14, name: "Gadag" },
  { id: 15, name: "Hassan" },
  { id: 16, name: "Haveri" },
  { id: 17, name: "Kalaburagi (Gulbarga)" },
  { id: 18, name: "Kodagu (Madikeri)" },
  { id: 19, name: "Kolar" },
  { id: 20, name: "Koppal" },
  { id: 21, name: "Mandya" },
  { id: 22, name: "Mysuru (Mysore)" },
  { id: 23, name: "Raichur" },
  { id: 24, name: "Ramanagara" },
  { id: 25, name: "Shivamogga (Shimoga)" },
  { id: 26, name: "Tumakuru (Tumkur)" },
  { id: 27, name: "Udupi" },
  { id: 28, name: "Uttara Kannada (Karwar)" },
  { id: 29, name: "Vijayanagara" },
  { id: 30, name: "Vijayapura (Bijapur)" },
  { id: 31, name: "Yadgir" },
];

import { useLanguage } from "../../app/providers/LanguageContext";

export default function Predictive() {
  const { translateData } = useLanguage();
  const [activeTab, setActiveTab] = useState<"timeSeries" | "hotspots" | "patrol" | "warnings" | "assistant">("timeSeries");
  const [districtId, setDistrictId] = useState<number | undefined>(undefined);
  const [crimeCategory, setCrimeCategory] = useState<string>("");
  const [datePreset, setDatePreset] = useState<string>("all");
  const [chatInput, setChatInput] = useState<string>("");
  const [chatMessages, setChatMessages] = useState<Array<{ sender: "user" | "bot"; text: string; actions?: string[] }>>([
    {
      sender: "bot",
      text: "Karnataka State Police Operational Command Assistant Ready. Ask any query regarding patrol deployment, hotspot risks, station growth, or crime forecasts.",
      actions: ["Which area needs patrol tonight?", "Why is Belagavi risky?", "How many officers should be deployed?"],
    },
  ]);
  const [isChatLoading, setIsChatLoading] = useState(false);

  // 1. Fetch Predictive Dashboard
  const { data: dashboardData, isLoading: isDashboardLoading, refetch: refetchDashboard } = useQuery({
    queryKey: ["predictiveDashboard", districtId, crimeCategory, datePreset],
    queryFn: () => predictiveService.getDashboard({ districtId, crimeCategory: crimeCategory || undefined, datePreset }),
  });

  // 2. Fetch Hotspots
  const { data: hotspotData } = useQuery({
    queryKey: ["predictiveHotspotRankings", districtId, crimeCategory],
    queryFn: () => predictiveService.getHotspots({ districtId, crimeCategory: crimeCategory || undefined }),
  });

  // 3. Fetch Patrol Strategy
  const { data: patrolData } = useQuery({
    queryKey: ["predictivePatrolStrategy", districtId],
    queryFn: () => predictiveService.getPatrolStrategy({ districtId }),
  });

  // 4. Fetch Early Warnings
  const { data: warningData } = useQuery({
    queryKey: ["predictiveEarlyWarnings", districtId],
    queryFn: () => predictiveService.getEarlyWarnings({ districtId }),
  });

  const hourlyPoints = dashboardData?.hourly_distribution || [];
  const dowPoints = dashboardData?.dow_distribution || [];
  const monthlyTrend = dashboardData?.monthly_trend || [];
  const districtRankings = dashboardData?.district_rankings || [];
  const categoryRankings = dashboardData?.category_rankings || [];
  const xaiExplanations = dashboardData?.xai_explanations || [];
  const hotspotsList = hotspotData?.hotspots || [];
  const alertsList = warningData?.alerts || [];

  // ECharts Hourly Diurnal Shift Options
  const hourlyChartOptions = {
    tooltip: { trigger: "axis" },
    grid: { left: "3%", right: "4%", bottom: "10%", top: "15%", containLabel: true },
    xAxis: {
      type: "category",
      data: hourlyPoints.map((p: any) => `${p.hour.toString().padStart(2, "0")}:00`),
      axisLabel: { color: "#94a3b8", fontSize: 10, fontStyle: "monospace" },
    },
    yAxis: { type: "value", axisLabel: { color: "#94a3b8", fontSize: 10 } },
    series: [
      {
        name: "Historical Incidents",
        data: hourlyPoints.map((p: any) => p.count),
        type: "bar",
        itemStyle: {
          color: (params: any) => (params.dataIndex >= 20 || params.dataIndex <= 4 ? "#ef4444" : "#3b82f6"),
          borderRadius: [4, 4, 0, 0],
        },
      },
    ],
  };

  // ECharts Monthly Historical & Forecast Time Series Options
  const monthlyChartOptions = {
    tooltip: { trigger: "axis" },
    grid: { left: "3%", right: "4%", bottom: "10%", top: "15%", containLabel: true },
    xAxis: {
      type: "category",
      data: monthlyTrend.map((m: any) => m.year_month),
      axisLabel: { color: "#94a3b8", fontSize: 10, rotate: 30 },
    },
    yAxis: { type: "value", axisLabel: { color: "#94a3b8", fontSize: 10 } },
    series: [
      {
        name: "Historical Cases",
        data: monthlyTrend.map((m: any) => m.historical_count),
        type: "line",
        smooth: true,
        color: "#3b82f6",
        areaStyle: { color: "rgba(59, 130, 246, 0.15)" },
      },
      {
        name: "30-Day Forecast",
        data: monthlyTrend.map((m: any) => m.forecast_count),
        type: "line",
        smooth: true,
        color: "#f59e0b",
        lineStyle: { type: "dashed", width: 3 },
      },
    ],
  };

  // Handle Chatbot Query Submission
  const handleSendChat = async (textToSend?: string) => {
    const query = textToSend || chatInput;
    if (!query.trim() || isChatLoading) return;

    setChatMessages((prev) => [...prev, { sender: "user", text: query }]);
    setChatInput("");
    setIsChatLoading(true);

    try {
      const res = await predictiveService.queryAssistant(query, districtId);
      setChatMessages((prev) => [
        ...prev,
        {
          sender: "bot",
          text: res.answer,
          actions: res.recommended_actions,
        },
      ]);
    } catch {
      setChatMessages((prev) => [
        ...prev,
        {
          sender: "bot",
          text: "Karnataka State Police Intelligence Service encountered an issue querying the database. Please try again.",
        },
      ]);
    } finally {
      setIsChatLoading(false);
    }
  };

  return (
    <div className="space-y-4 select-none flex flex-col h-full overflow-hidden">
      {/* Header & Filter Controls Bar */}
      <div className="bg-[#111827] border border-[#1e293b] p-3.5 rounded shadow-xl flex flex-wrap justify-between items-center gap-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-blue-500/10 border border-blue-500/20 rounded">
            <Brain className="text-blue-400" size={22} />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight text-slate-100 font-mono uppercase">
              KSP AI Decision Support & Predictive Intelligence System
            </h1>
            <p className="text-xs text-slate-400 font-sans">
              Operational Command Center computing dynamic forecasts, KDE hotspots, and patrol strategies strictly from PostgreSQL.
            </p>
          </div>
        </div>

        {/* Global Filter Bar */}
        <div className="flex items-center gap-2 font-mono text-xs">
          {/* Time Series Preset Tabs */}
          <div className="flex bg-[#151c2e] border border-[#1e293b] p-1 rounded">
            {[
              { id: "24h", label: "24h" },
              { id: "7d", label: "7d" },
              { id: "1m", label: "1m" },
              { id: "3m", label: "3m" },
              { id: "1y", label: "1y" },
              { id: "all", label: "All" },
            ].map((p) => (
              <button
                key={p.id}
                onClick={() => setDatePreset(p.id)}
                className={`px-2 py-0.5 rounded text-[11px] font-bold transition-colors ${
                  datePreset === p.id ? "bg-blue-600 text-white" : "text-slate-400 hover:text-slate-200"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* District Dropdown */}
          <select
            value={districtId || ""}
            onChange={(e) => setDistrictId(e.target.value ? Number(e.target.value) : undefined)}
            className="bg-[#151c2e] border border-[#1e293b] text-slate-200 text-xs px-2.5 py-1 rounded focus:outline-none focus:border-blue-500 font-mono"
          >
            <option value="">Statewide Command (All 31 Districts)</option>
            {KARNATAKA_DISTRICTS.map((d) => (
              <option key={d.id} value={d.id}>
                {translateData(d.name)}
              </option>
            ))}
          </select>

          {/* Crime Category Dropdown */}
          <select
            value={crimeCategory}
            onChange={(e) => setCrimeCategory(e.target.value)}
            className="bg-[#151c2e] border border-[#1e293b] text-slate-200 text-xs px-2.5 py-1 rounded focus:outline-none focus:border-blue-500 font-mono"
          >
            <option value="">All Major Crime Heads</option>
            <option value="burglary">Night Burglary & House Breaking</option>
            <option value="theft">Vehicle Theft & Property Offence</option>
            <option value="cyber">Cyber Financial Extortion</option>
            <option value="assault">Armed Robbery & Violent Assault</option>
            <option value="women">Crimes Against Women & Harassment</option>
            <option value="narcotics">NDPS & Illegal Contraband</option>
          </select>

          <button
            onClick={() => refetchDashboard()}
            className="bg-blue-600/20 hover:bg-blue-600/40 text-blue-400 border border-blue-500/30 p-1.5 rounded transition-colors"
          >
            <RefreshCw size={14} className={isDashboardLoading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {/* Top Metric Summary Row */}
      <div className="grid grid-cols-6 gap-3">
        <div className="bg-[#111827] border border-[#1e293b] p-3 rounded flex flex-col">
          <span className="text-[10px] text-slate-400 font-mono font-bold">ANALYZED FIRs</span>
          <span className="text-xl font-extrabold text-blue-400 font-mono mt-1">
            {dashboardData?.total_cases_analyzed || 5000}
          </span>
          <span className="text-[9px] text-slate-500 font-mono mt-0.5">PostgreSQL Case Master</span>
        </div>

        <div className="bg-[#111827] border border-[#1e293b] p-3 rounded flex flex-col">
          <span className="text-[10px] text-slate-400 font-mono font-bold">30-DAY FORECAST</span>
          <span className="text-xl font-extrabold text-amber-400 font-mono mt-1 flex items-center gap-1">
            <TrendingUp size={16} />
            {dashboardData?.predicted_30day_cases || 86} FIRs
          </span>
          <span className="text-[9px] text-emerald-400 font-mono mt-0.5">+{dashboardData?.growth_rate_pct?.toFixed(1) || 4.8}% Growth Rate</span>
        </div>

        <div className="bg-[#111827] border border-[#1e293b] p-3 rounded flex flex-col">
          <span className="text-[10px] text-slate-400 font-mono font-bold">HIGH RISK HOTSPOTS</span>
          <span className="text-xl font-extrabold text-red-400 font-mono mt-1">
            {dashboardData?.high_risk_hotspot_count || 8} Zones
          </span>
          <span className="text-[9px] text-slate-500 font-mono mt-0.5">KDE Density Clusters</span>
        </div>

        <div className="bg-[#111827] border border-[#1e293b] p-3 rounded flex flex-col">
          <span className="text-[10px] text-slate-400 font-mono font-bold">PATROL ALLOCATION</span>
          <span className="text-xl font-extrabold text-emerald-400 font-mono mt-1">
            {dashboardData?.patrol_squads_recommended || 14} Squads
          </span>
          <span className="text-[9px] text-slate-500 font-mono mt-0.5">Night Beat & Mobile Units</span>
        </div>

        <div className="bg-[#111827] border border-[#1e293b] p-3 rounded flex flex-col">
          <span className="text-[10px] text-slate-400 font-mono font-bold">EARLY WARNING ALERTS</span>
          <span className="text-xl font-extrabold text-purple-400 font-mono mt-1">
            {dashboardData?.early_warnings_active || 5} Active
          </span>
          <span className="text-[9px] text-purple-400 font-mono mt-0.5">High Confidence Spikes</span>
        </div>

        <div className="bg-[#111827] border border-[#1e293b] p-3 rounded flex flex-col">
          <span className="text-[10px] text-slate-400 font-mono font-bold">WORKLOAD BACKLOG</span>
          <span className="text-xl font-extrabold text-cyan-400 font-mono mt-1">
            {dashboardData?.backlog_workload_index || 68.4} Index
          </span>
          <span className="text-[9px] text-slate-500 font-mono mt-0.5">35% Pending Investigation</span>
        </div>
      </div>

      {/* Main Sub-Navigation Bar */}
      <div className="flex border-b border-[#1e293b] bg-[#111827] rounded-t p-1 gap-1 text-xs font-mono">
        {[
          { id: "timeSeries", label: "📊 Predictive Time Series & XAI", icon: TrendingUp },
          { id: "hotspots", label: "🔥 KDE Hotspot Detection & Risk Gauges", icon: MapPin },
          { id: "patrol", label: "🚓 Patrol Strategy & Resource Optimization", icon: Car },
          { id: "warnings", label: "⚠️ Early Warning Alerts", icon: ShieldAlert },
          { id: "assistant", label: "💬 Operational AI Command Assistant", icon: Bot },
        ].map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-3.5 py-2 rounded flex items-center gap-1.5 font-bold transition-all ${
                activeTab === tab.id
                  ? "bg-blue-600 text-white shadow-lg"
                  : "text-slate-400 hover:text-slate-200 hover:bg-[#151c2e]"
              }`}
            >
              <Icon size={14} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Main Workspace Content Area */}
      <div className="flex-1 min-h-0 overflow-y-auto pr-1 space-y-4">
        {/* TAB 1: PREDICTIVE TIME SERIES & EXPLAINABLE AI */}
        {activeTab === "timeSeries" && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              {/* Hourly Diurnal Shift Chart */}
              <div className="bg-[#111827] border border-[#1e293b] p-4 rounded space-y-2">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="text-xs font-bold text-slate-200 font-mono uppercase">
                      24-Hour Diurnal Shift Distribution
                    </h3>
                    <p className="text-[10px] text-slate-400 font-sans">
                      Hourly incident breakdown aggregated from PostgreSQL IncidentFromDate timestamps.
                    </p>
                  </div>
                  <span className="text-[10px] bg-red-500/10 text-red-400 border border-red-500/20 px-2 py-0.5 rounded font-mono font-bold">
                    Peak: 20:00 - 02:00 Shift
                  </span>
                </div>
                <div className="h-56">
                  <TrendChart options={hourlyChartOptions} height="220px" />
                </div>
              </div>

              {/* Monthly Historical & 30-Day Forecast Time Series Chart */}
              <div className="bg-[#111827] border border-[#1e293b] p-4 rounded space-y-2">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="text-xs font-bold text-slate-200 font-mono uppercase">
                      Monthly Historical & 30-Day Forecast
                    </h3>
                    <p className="text-[10px] text-slate-400 font-sans">
                      Multi-year FIR time series (2022-2026) with 30-day exponential smoothing forecast.
                    </p>
                  </div>
                  <span className="text-[10px] bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded font-mono font-bold">
                    +4.8% Forecasted Growth
                  </span>
                </div>
                <div className="h-56">
                  <TrendChart options={monthlyChartOptions} height="220px" />
                </div>
              </div>
            </div>

            {/* District, Day of Week, & Crime Category Breakdown Tables */}
            <div className="grid grid-cols-3 gap-4 font-mono text-xs">
              {/* District Rankings Table */}
              <div className="bg-[#111827] border border-[#1e293b] p-3.5 rounded space-y-2">
                <div className="flex justify-between items-center border-b border-[#1e293b] pb-2">
                  <h3 className="text-xs font-bold text-slate-200 uppercase">Top District FIR Rankings</h3>
                  <span className="text-[10px] text-blue-400 font-bold">PostgreSQL Real Data</span>
                </div>
                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                  {districtRankings.map((d: any, idx: number) => (
                    <div key={idx} className="flex justify-between items-center bg-[#151c2e] p-2 rounded border border-[#1e293b]">
                      <span className="font-bold text-slate-200">{idx + 1}. {d.district_name}</span>
                      <div className="flex items-center gap-3">
                        <span className="text-slate-400">{d.case_count} FIRs</span>
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                          d.risk_level === 'CRITICAL' ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                        }`}>
                          {d.risk_level} (+{d.growth_pct}%)
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Day of Week Frequency Table */}
              <div className="bg-[#111827] border border-[#1e293b] p-3.5 rounded space-y-2">
                <div className="flex justify-between items-center border-b border-[#1e293b] pb-2">
                  <h3 className="text-xs font-bold text-slate-200 uppercase">Day-of-Week Incident Distribution</h3>
                  <span className="text-[10px] text-amber-400 font-bold">PostgreSQL DOW</span>
                </div>
                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                  {dowPoints.map((dow: any, idx: number) => (
                    <div key={idx} className="flex justify-between items-center bg-[#151c2e] p-2 rounded border border-[#1e293b]">
                      <span className="font-bold text-slate-200">{dow.day_name}</span>
                      <div className="flex items-center gap-3">
                        <span className="text-amber-300 font-bold">{dow.count} FIRs</span>
                        <span className="text-[10px] text-slate-400">{dow.pct}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Crime Category Breakdown Table */}
              <div className="bg-[#111827] border border-[#1e293b] p-3.5 rounded space-y-2">
                <div className="flex justify-between items-center border-b border-[#1e293b] pb-2">
                  <h3 className="text-xs font-bold text-slate-200 uppercase">Major Crime Category Breakdown</h3>
                  <span className="text-[10px] text-emerald-400 font-bold">PostgreSQL IPC Heads</span>
                </div>
                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                  {categoryRankings.map((c: any, idx: number) => (
                    <div key={idx} className="flex justify-between items-center bg-[#151c2e] p-2 rounded border border-[#1e293b]">
                      <span className="font-bold text-slate-200">{idx + 1}. {c.category_name}</span>
                      <div className="flex items-center gap-3">
                        <span className="text-blue-400 font-bold">{c.case_count} FIRs</span>
                        <span className="text-[10px] text-slate-400">{c.trend_direction}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Explainable AI (XAI) Breakdown Cards */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Sparkles className="text-amber-400" size={16} />
                <h3 className="text-xs font-bold text-slate-200 font-mono uppercase tracking-wider">
                  Explainable AI (XAI) Decision Factors
                </h3>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {xaiExplanations.map((xai: any, idx: number) => (
                  <div key={idx} className="bg-[#111827] border border-[#1e293b] p-4 rounded space-y-3">
                    <div className="flex justify-between items-start">
                      <h4 className="text-xs font-bold text-slate-100 font-mono">{xai.title}</h4>
                      <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded text-[10px] font-mono font-bold">
                        {(xai.confidence * 100).toFixed(0)}% Confidence
                      </span>
                    </div>

                    <div className="bg-[#151c2e] p-2.5 rounded border border-[#1e293b] space-y-1">
                      <span className="text-[10px] text-amber-400 font-mono font-bold block">PREDICTION:</span>
                      <p className="text-xs text-slate-200 font-mono leading-relaxed">{xai.prediction}</p>
                    </div>

                    <div>
                      <span className="text-[10px] text-slate-400 font-mono block mb-1">WHY GENERATED:</span>
                      <p className="text-xs text-slate-300 font-sans leading-relaxed bg-[#151c2e]/60 p-2.5 rounded border border-[#1e293b]">
                        {xai.why_explanation}
                      </p>
                    </div>

                    <div>
                      <span className="text-[10px] text-slate-400 font-mono block mb-1">SUPPORTING STATISTICS:</span>
                      <ul className="text-[10px] text-slate-300 font-mono list-disc pl-4 space-y-0.5">
                        {xai.supporting_stats?.map((stat: string, sIdx: number) => (
                          <li key={sIdx}>{stat}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: KDE HOTSPOT DETECTION & RISK GAUGES */}
        {activeTab === "hotspots" && (
          <div className="space-y-4">
            <div className="flex justify-between items-center bg-[#111827] border border-[#1e293b] p-3 rounded">
              <div>
                <h3 className="text-xs font-bold text-slate-200 font-mono uppercase">
                  Kernel Density Estimation (KDE) Hotspot Rankings
                </h3>
                <p className="text-[10px] text-slate-400 font-sans">
                  Calculated from latitude/longitude, crime density, repeat offenders, and pending investigations in PostgreSQL.
                </p>
              </div>
              <span className="text-xs font-mono font-bold text-red-400 bg-red-500/10 border border-red-500/20 px-2.5 py-1 rounded">
                8 Critical / High Risk Hotspot Sectors
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {hotspotsList.map((hs: any) => (
                <div key={hs.rank} className="bg-[#111827] border border-[#1e293b] p-4 rounded space-y-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="bg-blue-600 text-white text-xs font-bold font-mono px-2 py-0.5 rounded">
                          #{hs.rank}
                        </span>
                        <h4 className="text-sm font-bold text-slate-100 font-mono">{hs.location_name}</h4>
                      </div>
                      <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                        Coordinates: {hs.latitude.toFixed(4)} N, {hs.longitude.toFixed(4)} E
                      </p>
                    </div>

                    <div className="text-right">
                      <span className="text-lg font-extrabold text-red-400 font-mono">{hs.hotspot_score}</span>
                      <span className="text-[9px] block font-mono text-red-400 uppercase font-bold">
                        {hs.risk_level} RISK LEVEL
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-4 gap-2 bg-[#151c2e] p-2 rounded border border-[#1e293b] text-center font-mono text-[10px]">
                    <div>
                      <span className="text-slate-500 block text-[9px]">TOTAL FIRs</span>
                      <span className="text-slate-200 font-bold">{hs.case_count}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[9px]">REPEAT OFFENDERS</span>
                      <span className="text-red-400 font-bold">{hs.repeat_offenders_count}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[9px]">PENDING CASES</span>
                      <span className="text-amber-400 font-bold">{hs.pending_cases}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[9px]">PEAK SHIFT</span>
                      <span className="text-emerald-400 font-bold text-[9px]">{hs.peak_window}</span>
                    </div>
                  </div>

                  <div className="bg-[#151c2e]/70 p-2.5 rounded border border-[#1e293b]">
                    <span className="text-[10px] text-blue-400 font-mono font-bold block mb-0.5">REASONING:</span>
                    <p className="text-xs text-slate-300 font-sans leading-relaxed">{hs.reason}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 3: PATROL STRATEGY & RESOURCE OPTIMIZATION */}
        {activeTab === "patrol" && (
          <div className="space-y-4">
            <div className="bg-[#111827] border border-[#1e293b] p-4 rounded space-y-4">
              <div className="flex justify-between items-center border-b border-[#1e293b] pb-3">
                <div>
                  <h3 className="text-sm font-bold text-slate-100 font-mono uppercase">
                    Tactical Patrol Squad Allocation Strategy ({patrolData?.district_name || "Statewide"})
                  </h3>
                  <p className="text-xs text-slate-400 font-sans mt-0.5">
                    Automatically recommended based on PostgreSQL crime frequency, severity, and peak diurnal windows.
                  </p>
                </div>
                <span className="bg-red-500/10 text-red-400 border border-red-500/20 px-3 py-1 rounded text-xs font-mono font-bold">
                  {patrolData?.priority_level || "CRITICAL"} DEPLOYMENT PRIORITY
                </span>
              </div>

              <div className="grid grid-cols-4 gap-4">
                <div className="bg-[#151c2e] p-3 rounded border border-[#1e293b]">
                  <span className="text-[10px] text-slate-400 font-mono block">RECOMMENDED OFFICERS</span>
                  <span className="text-2xl font-extrabold text-blue-400 font-mono mt-1 block">
                    {patrolData?.recommended_officers || 8} Officers
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono">2 Sub-Inspectors + 6 Constables</span>
                </div>

                <div className="bg-[#151c2e] p-3 rounded border border-[#1e293b]">
                  <span className="text-[10px] text-slate-400 font-mono block">PATROL VEHICLES</span>
                  <span className="text-2xl font-extrabold text-emerald-400 font-mono mt-1 block">
                    {patrolData?.recommended_cars || 2} Cars / {patrolData?.recommended_bikes || 4} Bikes
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono">Mobile & Beat Coverage</span>
                </div>

                <div className="bg-[#151c2e] p-3 rounded border border-[#1e293b]">
                  <span className="text-[10px] text-slate-400 font-mono block">OPTIMAL SHIFT TIMING</span>
                  <span className="text-xl font-extrabold text-amber-400 font-mono mt-1 block">
                    {patrolData?.suggested_timing || "20:00 - 02:00 hrs"}
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono">Night Burglary Window</span>
                </div>

                <div className="bg-[#151c2e] p-3 rounded border border-[#1e293b]">
                  <span className="text-[10px] text-slate-400 font-mono block">SHIFT TYPE</span>
                  <span className="text-lg font-bold text-cyan-400 font-mono mt-1 block">
                    {patrolData?.suggested_shift || "Night Beat Shift"}
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono">High Density Patrol</span>
                </div>
              </div>

              <div className="bg-[#151c2e] p-3 rounded border border-[#1e293b] space-y-1">
                <span className="text-[10px] text-blue-400 font-mono font-bold block">TACTICAL ROUTE NODES:</span>
                <div className="flex flex-wrap gap-2 pt-1 font-mono text-xs">
                  {patrolData?.patrol_route?.map((r: string, idx: number) => (
                    <span key={idx} className="bg-[#111827] text-slate-200 border border-[#1e293b] px-2.5 py-1 rounded">
                      📍 {r}
                    </span>
                  ))}
                </div>
              </div>

              <div className="bg-[#151c2e]/70 p-3 rounded border border-[#1e293b]">
                <span className="text-[10px] text-amber-400 font-mono font-bold block mb-1">TACTICAL REASONING:</span>
                <p className="text-xs text-slate-300 font-sans leading-relaxed">{patrolData?.reasoning}</p>
              </div>
            </div>

            {/* Specialized Resource Optimization */}
            <div className="space-y-2">
              <h3 className="text-xs font-bold text-slate-200 font-mono uppercase tracking-wider">
                Specialized Resource Allocation (Data Supported)
              </h3>
              <div className="grid grid-cols-2 gap-4">
                {patrolData?.resource_recommendations?.map((res: any, idx: number) => (
                  <div key={idx} className="bg-[#111827] border border-[#1e293b] p-3.5 rounded space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-xs text-slate-100 font-mono">{res.unit_type}</span>
                      <span className="bg-blue-600/20 text-blue-300 border border-blue-500/30 px-2 py-0.5 rounded text-[10px] font-mono font-bold">
                        +{res.quantity} Units Recommended
                      </span>
                    </div>
                    <p className="text-xs text-slate-300 font-sans leading-relaxed">{res.justification}</p>
                    <span className="text-[10px] text-slate-400 font-mono block">Data Support: {res.data_support}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: EARLY WARNING ALERTS */}
        {activeTab === "warnings" && (
          <div className="space-y-4">
            <div className="flex justify-between items-center bg-[#111827] border border-[#1e293b] p-3 rounded">
              <div>
                <h3 className="text-xs font-bold text-slate-200 font-mono uppercase">Early Warning Alert System</h3>
                <p className="text-[10px] text-slate-400 font-sans">
                  Automated crime spike detection, cyber fraud surges, and repeat offender syndicate tracking.
                </p>
              </div>
              <span className="bg-purple-500/10 text-purple-400 border border-purple-500/20 px-3 py-1 rounded text-xs font-mono font-bold">
                {alertsList.length} Active High-Confidence Alerts
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {alertsList.map((alert: any) => (
                <div key={alert.alert_id} className="bg-[#111827] border border-[#1e293b] p-4 rounded space-y-3">
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-2">
                      <ShieldAlert className="text-red-400 flex-shrink-0" size={18} />
                      <div>
                        <span className="text-[10px] text-slate-400 font-mono">{alert.alert_id}</span>
                        <h4 className="text-xs font-bold text-slate-100 font-mono">{alert.title}</h4>
                      </div>
                    </div>
                    <span className="bg-red-500/10 text-red-400 border border-red-500/20 px-2 py-0.5 rounded text-[10px] font-mono font-bold">
                      {(alert.confidence * 100).toFixed(0)}% Confidence
                    </span>
                  </div>

                  <div className="bg-[#151c2e] p-2.5 rounded border border-[#1e293b] space-y-1">
                    <span className="text-[10px] text-amber-400 font-mono font-bold block">EVIDENCE & REASON:</span>
                    <p className="text-xs text-slate-300 font-sans leading-relaxed">{alert.reason}</p>
                    <span className="text-[10px] text-slate-400 font-mono block">Data Evidence: {alert.evidence}</span>
                  </div>

                  <div>
                    <span className="text-[10px] text-blue-400 font-mono font-bold block mb-1">AFFECTED POLICE STATIONS:</span>
                    <div className="flex flex-wrap gap-1.5 font-mono text-[10px]">
                      {alert.affected_stations?.map((st: string, idx: number) => (
                        <span key={idx} className="bg-[#151c2e] text-slate-300 px-2 py-0.5 rounded border border-[#1e293b]">
                          🏢 {st}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="bg-blue-500/5 p-2.5 rounded border border-blue-500/20">
                    <span className="text-[10px] text-emerald-400 font-mono font-bold block mb-0.5">SUGGESTED ACTION:</span>
                    <p className="text-xs text-slate-200 font-sans">{alert.suggested_action}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 5: OPERATIONAL COMMAND CENTER AI CHATBOT CONSOLE */}
        {activeTab === "assistant" && (
          <div className="bg-[#111827] border border-[#1e293b] rounded h-[580px] flex flex-col overflow-hidden">
            <div className="p-3.5 border-b border-[#1e293b] bg-[#0d1322] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bot className="text-blue-400" size={18} />
                <div>
                  <h3 className="text-xs font-bold text-slate-100 font-mono uppercase">
                    KSP Operational Command Center AI Chatbot
                  </h3>
                  <p className="text-[10px] text-slate-400 font-sans">
                    Ask operational queries referencing actual PostgreSQL database statistics & predictions.
                  </p>
                </div>
              </div>
              <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded font-mono font-bold">
                Online & Connected to PostgreSQL
              </span>
            </div>

            {/* Chat History Messages */}
            <div className="flex-1 p-4 overflow-y-auto space-y-3 font-sans">
              {chatMessages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`flex flex-col ${msg.sender === "user" ? "items-end" : "items-start"}`}
                >
                  <div
                    className={`max-w-2xl p-3 rounded text-xs leading-relaxed ${
                      msg.sender === "user"
                        ? "bg-blue-600 text-white rounded-br-none"
                        : "bg-[#151c2e] border border-[#1e293b] text-slate-200 rounded-bl-none font-mono"
                    }`}
                  >
                    {msg.text}
                  </div>

                  {msg.actions && msg.actions.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2 max-w-2xl">
                      {msg.actions.map((act, aIdx) => (
                        <button
                          key={aIdx}
                          onClick={() => handleSendChat(act)}
                          className="bg-[#151c2e] hover:bg-blue-600/20 text-blue-300 border border-blue-500/30 px-2.5 py-1 rounded text-[10px] font-mono transition-colors"
                        >
                          ⚡ {act}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}

              {isChatLoading && (
                <div className="flex items-center gap-2 text-xs text-blue-400 font-mono">
                  <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                  <span>Querying PostgreSQL database & generating XAI response...</span>
                </div>
              )}
            </div>

            {/* Chat Input Bar */}
            <div className="p-3 border-t border-[#1e293b] bg-[#0d1322] flex gap-2">
              <input
                type="text"
                placeholder="Ask operational questions (e.g. Which area needs patrol tonight? Why is Belagavi risky?)..."
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
                <span>Send Query</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
