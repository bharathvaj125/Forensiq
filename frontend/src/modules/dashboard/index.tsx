import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { caseService } from "../../services/caseService";
import { dashboardService } from "../../services/dashboardService";
import { intelligenceService } from "../../services/intelligenceService";
import { collaborationService } from "../../services/collaborationService";
import KpiCard from "../../components/common/KpiCard";
import TrendChart from "../../components/charts/TrendChart";
import DataTable from "../../components/common/DataTable";
import { useAuth } from "../../app/providers/AuthProvider";
import { useLanguage } from "../../app/providers/LanguageContext";
import {
  ShieldAlert, FileText, CheckCircle, Clock, Brain, Activity, PlusCircle, Compass, AlertCircle,
  Server, UserCheck, UserCog, Users, Building2, Layers, Repeat,
} from "lucide-react";

interface DashboardProps {
  activeTab?: "executive" | "workspace";
}

type Mode = "executive" | "district" | "station";

const RISK_STYLE: Record<string, string> = {
  Severe: "bg-red-500/10 text-red-400 border-red-500/20",
  High: "bg-orange-500/10 text-orange-400 border-orange-500/20",
  Medium: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  Low: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
};

const CATEGORY_FILTERS: Record<string, { riskLevel?: string; statusGroup?: string }> = {
  all: {},
  risk: { riskLevel: "High,Severe" },
  pending: { statusGroup: "open" },
  finished: { statusGroup: "closed" },
};

const formatTime = (iso?: string | null) => (iso ? new Date(iso).toLocaleString() : "");

export default function Dashboard({ activeTab = "executive" }: DashboardProps) {
  const { user } = useAuth();
  const { t, translateData } = useLanguage();
  const navigate = useNavigate();

  const roleName = user?.role?.RoleName;
  const isAdmin = roleName === "Admin";
  const isExternalOfficer = roleName === "ExternalAgencyOfficer";
  const isConstable = roleName === "Constable";

  const { data: workspaceData } = useQuery({
    queryKey: ["externalWorkspace"],
    queryFn: () => collaborationService.getExternalWorkspace(),
    enabled: isExternalOfficer,
  });
  const grantedScope = workspaceData?.assigned_cases?.[0]?.scope_level || "District";

  const [subMode, setSubMode] = useState<Mode>(isExternalOfficer && grantedScope !== "State" ? "district" : "executive");
  const [selectedDistrict, setSelectedDistrict] = useState<number | "">("");
  const [selectedStation, setSelectedStation] = useState<number | "">("");
  const [category, setCategory] = useState<keyof typeof CATEGORY_FILTERS>("all");
  const [sortBy, setSortBy] = useState("date_desc");
  const [page, setPage] = useState(1);

  const scope = {
    districtId: subMode === "executive" || selectedDistrict === "" ? undefined : Number(selectedDistrict),
    stationId: subMode === "station" && selectedStation !== "" ? Number(selectedStation) : undefined,
  };

  const { data: summary, isLoading, isError, refetch } = useQuery({
    queryKey: ["dashboardSummary", scope.districtId, scope.stationId],
    queryFn: () => dashboardService.getSummary(scope),
    retry: 1,
  });

  const { data: anomalies } = useQuery({
    queryKey: ["dashboardAnomalies"],
    queryFn: () => intelligenceService.getCaseAnomalies(),
    retry: 1,
    enabled: activeTab === "executive" && subMode === "executive",
  });

  const { data: casesData, isLoading: isCasesLoading } = useQuery({
    queryKey: ["dashboardCases", scope.districtId, scope.stationId, category, sortBy, page],
    queryFn: () => caseService.getCases({ ...scope, ...CATEGORY_FILTERS[category], sortBy, page, pageSize: 25 }),
    enabled: activeTab === "executive" && subMode !== "executive",
  });

  const { data: workspace } = useQuery({
    queryKey: ["dashboardWorkspace"],
    queryFn: () => dashboardService.getWorkspace(),
    enabled: activeTab === "workspace",
  });
  const { data: health } = useQuery({
    queryKey: ["platformHealth"],
    queryFn: () => dashboardService.getHealth(),
    enabled: activeTab === "workspace" && isAdmin,
  });

  const districts: { id: number; name: string }[] = summary?.districts || [];
  const stations: { id: number; name: string }[] = summary?.stations || [];
  const topDistrict = summary?.by_district?.[0]?.id;

  // Pick sensible defaults once the lists are known: the busiest district, then its busiest station.
  useEffect(() => {
    if ((subMode === "district" || subMode === "station") && selectedDistrict === "" && topDistrict) setSelectedDistrict(topDistrict);
  }, [subMode, selectedDistrict, topDistrict]);
  useEffect(() => {
    if (subMode === "station" && selectedStation === "" && selectedDistrict !== "" && summary?.by_station?.length) {
      setSelectedStation(summary.by_station[0].id);
    }
  }, [subMode, selectedStation, selectedDistrict, summary]);

  const resetTable = () => setPage(1);
  const totals = summary?.totals;

  const caseColumns = [
    { header: t("Case No"), accessorKey: "CaseNo", render: (r: any) => <span className="text-blue-400 font-bold">{r.CaseNo}</span> },
    { header: t("Registered Date"), accessorKey: "CrimeRegisteredDate" },
    { header: t("Priority"), accessorKey: "InvestigationPriority", render: (r: any) => (r.InvestigationPriority ? (
        <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono border font-bold ${RISK_STYLE[r.InvestigationPriority === "High" ? "High" : r.InvestigationPriority] || ""}`}>
          {translateData(r.InvestigationPriority)}
        </span>) : <span className="text-slate-600">—</span>) },
    { header: t("AI Risk"), accessorKey: "AIRiskScore", render: (r: any) => (r.AIRiskScore == null ? <span className="text-slate-600">not scored</span> : (
        <div className="flex items-center gap-2 font-mono">
          <span>{r.AIRiskScore.toFixed(2)}</span>
          {r.AIRiskLevel && <span className={`px-1.5 py-0.5 rounded text-[10px] border font-bold ${RISK_STYLE[r.AIRiskLevel] || ""}`}>{r.AIRiskLevel}</span>}
        </div>)) },
    { header: t("Incident Brief"), accessorKey: "BriefFacts", render: (r: any) => <p className="truncate max-w-xs">{translateData(r.BriefFacts)}</p> },
  ];

  if (isError) {
    return (
      <div className="flex h-full w-full items-center justify-center p-8 select-none">
        <div className="w-full max-w-md bg-[#0d1322] border border-red-500/20 rounded p-8 shadow-2xl text-center">
          <AlertCircle className="text-red-500 mx-auto mb-4" size={40} />
          <h2 className="text-lg font-bold text-red-400 tracking-tight font-mono uppercase">Could not load the dashboard</h2>
          <p className="text-xs text-slate-400 mt-2 leading-relaxed font-sans">The server did not respond. Check that the API is online and try again.</p>
          <button onClick={() => refetch()} className="mt-6 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 px-4 py-2 rounded text-xs font-mono font-bold uppercase transition-colors">
            Retry
          </button>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------- workspace tab
  if (activeTab === "workspace") {
    const mine = workspace?.mine;
    const platform = workspace?.platform;
    return (
      <div className="space-y-6 select-none">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-100 uppercase tracking-widest font-mono">
              {isAdmin ? "Administration Workspace" : "Field Investigator Workspace"}
            </h1>
            <p className="text-xs text-slate-400 mt-1">{isAdmin ? "Platform totals and your own assignments" : "Your assigned cases and tasks"}</p>
          </div>
          {isAdmin ? (
            <button onClick={() => navigate("/admin")} className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-3 py-2 rounded transition-colors font-mono">
              <UserCog size={14} /> Manage System Users
            </button>
          ) : (
            <button onClick={() => navigate("/cases")} className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-3 py-2 rounded transition-colors">
              <PlusCircle size={14} /> Register Incident
            </button>
          )}
        </div>

        {isAdmin && platform && (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
            <KpiCard title="Active Users" value={platform.users} icon={<UserCheck size={16} />} description="Accounts that can sign in." />
            <KpiCard title="Rostered Officers" value={platform.officers} icon={<Users size={16} />} description="Officers listed in the roster." />
            <KpiCard title="Police Stations" value={platform.police_stations} icon={<Building2 size={16} />} description={`Across ${platform.districts} districts.`} />
            <KpiCard title="FIR Records" value={platform.cases.toLocaleString()} icon={<FileText size={16} />} description={`${platform.accused_records.toLocaleString()} accused records.`} />
            <KpiCard
              title="Platform Status"
              value={health ? (health.status === "online" ? "ONLINE" : "DEGRADED") : "…"}
              icon={<Server size={16} />}
              trendType={health && health.status === "online" ? "success" : "error"}
              description={health ? `Database: ${health.database}${health.dialect ? ` (${health.dialect})` : ""}` : "Checking…"}
            />
          </div>
        )}
        {isAdmin && platform && (
          <p className="text-[11px] text-slate-500 font-mono">AI runs in the last 7 days: {platform.ai_runs_last_7_days} · Audit events in the last 7 days: {platform.audit_events_last_7_days}</p>
        )}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KpiCard title="Assigned Cases" value={mine?.assigned_cases ?? "…"} icon={<FileText size={16} />} description="Cases you are actively assigned to." />
          <KpiCard title="Open Tasks" value={mine?.tasks_open ?? "…"} icon={<Clock size={16} />} description="Tasks appointed to you and not completed." />
          <KpiCard title="Overdue Tasks" value={mine?.tasks_overdue ?? "…"} icon={<AlertCircle size={16} />} trendType={mine?.tasks_overdue ? "error" : "neutral"} description="Open tasks past their due date." />
          <KpiCard title="Completed (7 days)" value={mine?.tasks_completed_last_7_days ?? "…"} icon={<CheckCircle size={16} />} description="Tasks you completed this week." />
        </div>

        <div className="bg-[#111827] border border-[#1e293b] rounded p-5 flex flex-col h-[400px]">
          <h3 className="text-sm font-bold text-slate-300 mb-4 font-mono uppercase tracking-wider">Cases assigned to you</h3>
          <div className="flex-1 min-h-0">
            {mine && mine.assigned_case_list.length === 0 ? (
              <p className="text-xs text-slate-500 font-mono italic py-8 text-center">No cases are currently assigned to you.</p>
            ) : (
              <DataTable
                columns={caseColumns.map((c) => c.accessorKey === "CaseNo" ? { ...c, accessorKey: "case_no", render: (r: any) => <span className="text-blue-400 font-bold">{r.case_no}</span> } : c)
                  .filter((c) => ["case_no", "AIRiskScore", "BriefFacts"].includes(c.accessorKey))
                  .map((c) => c.accessorKey === "AIRiskScore" ? { ...c, render: (r: any) => (r.risk_score == null ? "—" : `${r.risk_score.toFixed(2)} ${r.risk_level || ""}`) }
                    : c.accessorKey === "BriefFacts" ? { ...c, render: (r: any) => <p className="truncate max-w-xs">{translateData(r.facts)}</p> } : c)}
                data={mine?.assigned_case_list || []}
                loading={!mine}
                onRowClick={(row) => navigate(`/cases/${row.case_id}`)}
              />
            )}
          </div>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------- charts
  const byDistrict = (summary?.by_district || []).slice(0, 10);
  const barRows = subMode === "executive" ? byDistrict : (summary?.by_station || []);
  const barChart = {
    grid: { bottom: 65, left: 40, right: 20, top: 20 },
    tooltip: { trigger: "axis" },
    xAxis: { type: "category", data: barRows.map((r: any) => translateData(r.name)), axisLabel: { interval: 0, rotate: 35, color: "#94a3b8", fontSize: 10 } },
    yAxis: { type: "value", axisLabel: { color: "#94a3b8", fontSize: 10 } },
    series: [
      { name: "FIRs", data: barRows.map((r: any) => r.cases), type: "bar", color: "#3b82f6", barWidth: "45%", itemStyle: { borderRadius: [4, 4, 0, 0] } },
      { name: "High / Severe", data: barRows.map((r: any) => r.high_risk), type: "bar", color: "#ef4444", barWidth: "45%", itemStyle: { borderRadius: [4, 4, 0, 0] } },
    ],
  };
  const crimeChart = {
    tooltip: { trigger: "item", formatter: "{b}: {c} cases ({d}%)" },
    series: [{
      type: "pie", radius: ["35%", "65%"],
      data: (summary?.by_crime_type || []).map((r: any) => ({ name: translateData(r.name), value: r.cases })),
      label: { color: "#cbd5e1", fontSize: 10, formatter: "{b}\n({c})" }, labelLine: { length: 8, length2: 8 },
    }],
  };
  const monthlyChart = {
    grid: { bottom: 40, left: 40, right: 20, top: 20 },
    tooltip: { trigger: "axis" },
    xAxis: { type: "category", data: (summary?.monthly || []).map((m: any) => m.month), axisLabel: { color: "#94a3b8", fontSize: 10, rotate: 40 } },
    yAxis: { type: "value", axisLabel: { color: "#94a3b8", fontSize: 10 } },
    series: [{ name: "FIRs registered", data: (summary?.monthly || []).map((m: any) => m.cases), type: "line", smooth: true, color: "#10b981", areaStyle: { opacity: 0.12 } }],
  };
  const topBar = barRows[0];
  const topCrime = summary?.by_crime_type?.[0];
  const sumCrime = (summary?.by_crime_type || []).reduce((a: number, r: any) => a + r.cases, 0) || 1;

  const scopeName = summary?.scope?.name || "";
  const modeSwitcher = !isConstable ? (
    <div className="flex bg-[#111827] border border-[#1e293b] rounded p-0.5 text-xs font-mono">
      {(!isExternalOfficer || grantedScope === "State") && (
        <button onClick={() => { setSubMode("executive"); resetTable(); }} className={`px-3 py-1.5 rounded transition-colors ${subMode === "executive" ? "bg-blue-600 text-white font-bold" : "text-slate-400 hover:text-slate-200"}`}>
          {t("Statewide Executive", "ರಾಜ್ಯಮಟ್ಟದ ಆಡಳಿತ ಸಾರಾಂಶ")}
        </button>
      )}
      <button onClick={() => { setSubMode("district"); resetTable(); }} className={`px-3 py-1.5 rounded transition-colors ${subMode === "district" ? "bg-blue-600 text-white font-bold" : "text-slate-400 hover:text-slate-200"}`}>
        {t("District Level", "ಜಿಲ್ಲಾ ವಿಭಾಗ")}
      </button>
      {(!isExternalOfficer || grantedScope === "Station") && (
        <button onClick={() => { setSubMode("station"); resetTable(); }} className={`px-3 py-1.5 rounded transition-colors ${subMode === "station" ? "bg-blue-600 text-white font-bold" : "text-slate-400 hover:text-slate-200"}`}>
          {t("Station Precinct", "ಠಾಣಾ ವ್ಯಾಪ್ತಿ")}
        </button>
      )}
    </div>
  ) : (
    <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-3 py-1.5 rounded text-xs font-mono font-bold">
      👮 {t("Station Precinct Scope (Restricted to Police Station)", "ಠಾಣಾ ವ್ಯಾಪ್ತಿಯ ಸೀಮಿತ ಪ್ರವೇಶ")}
    </div>
  );

  const kpis = (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
      <KpiCard title="FIRs IN SCOPE" value={totals?.cases?.toLocaleString() ?? "…"} icon={<FileText size={16} />} loading={isLoading}
        badges={[{ label: scopeName, type: "neutral" }]} description={`${totals?.open ?? 0} open · ${totals?.closed ?? 0} closed`} />
      <KpiCard title="HIGH / SEVERE RISK" value={totals?.high_risk?.toLocaleString() ?? "…"} icon={<ShieldAlert size={16} />} loading={isLoading}
        badges={[{ label: `${totals?.severe ?? 0} severe`, type: "error" }]} description="Rated High or Severe by the risk model." />
      <KpiCard title="LATE-REPORTING ANOMALIES" value={totals?.anomalies_flagged ?? "…"} icon={<AlertCircle size={16} />} loading={isLoading}
        badges={[{ label: "Robust z ≥ 3.5", type: "warning" }]} description="Cases reported unusually long after the incident." />
      <KpiCard title="HOTSPOTS" value={totals?.hotspots ?? "…"} icon={<Compass size={16} />} loading={isLoading}
        badges={[{ label: `${totals?.critical_or_high_hotspots ?? 0} high-risk`, type: "neutral" }]} description="Kernel-density clusters of incidents." />
      <KpiCard title="REPEAT OFFENDERS" value={totals?.repeat_offender_profiles ?? "…"} icon={<Repeat size={16} />} loading={isLoading}
        badges={[{ label: "Recorded profiles", type: "neutral" }]} description="Criminal profiles linked to these cases." />
      <KpiCard title="ACTIVE ALERTS" value={totals?.active_alerts ?? "…"} icon={<Layers size={16} />} loading={isLoading}
        badges={[{ label: "Early warning", type: totals?.active_alerts ? "warning" : "success" }]} description="Statistical spikes and overdue work." />
    </div>
  );

  const briefing = (
    <div className="bg-[#1e293b]/30 border border-blue-500/30 rounded p-5">
      <div className="flex items-center justify-between mb-3 border-b border-[#1e293b] pb-2">
        <div className="flex items-center gap-2">
          <Brain className="text-blue-400" size={18} />
          <h2 className="text-xs font-bold text-blue-400 uppercase tracking-widest font-mono">Situation briefing — {scopeName}</h2>
        </div>
        <span className="text-[10px] text-slate-500 font-mono">Data up to {summary?.as_of_date}{summary?.future_dated_excluded ? ` · ${summary.future_dated_excluded} future-dated records excluded` : ""}</span>
      </div>
      <p className="text-xs text-slate-300 leading-relaxed">{isLoading ? "Computing…" : translateData(summary?.briefing)}</p>
    </div>
  );

  const panels = (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="bg-[#111827] border border-[#1e293b] rounded p-5 flex flex-col h-[360px]">
        <div className="flex items-center gap-2 border-b border-[#1e293b] pb-3 mb-4">
          <AlertCircle className="text-red-500" size={16} />
          <h3 className="text-xs font-bold text-slate-300 font-mono uppercase tracking-wider">Alerts</h3>
        </div>
        <div className="flex-1 overflow-y-auto space-y-2.5 pr-2">
          {(summary?.alerts || []).map((a: any) => (
            <div key={a.alert_id} className="p-3 bg-red-500/5 border border-red-500/15 border-l-4 border-l-red-500 rounded">
              <span className="text-[10px] bg-red-500/10 text-red-400 px-1 rounded font-mono font-bold uppercase">{a.alert_type} · {a.risk_level}</span>
              <h4 className="font-semibold text-slate-200 mt-1 text-xs">{a.title}</h4>
              <p className="text-[10px] text-slate-400 mt-0.5">{a.evidence}</p>
            </div>
          ))}
          {subMode === "executive" && (anomalies?.Findings || []).slice(0, 5).map((f: any) => (
            <button key={f.CaseMasterID} onClick={() => navigate(`/cases/${f.CaseMasterID}`)}
              className="w-full text-left p-3 bg-amber-500/5 border border-amber-500/15 border-l-4 border-l-amber-500 rounded hover:bg-amber-500/10">
              <span className="text-[10px] bg-amber-500/10 text-amber-400 px-1 rounded font-mono font-bold">LATE REPORT · z {f.ZScore}</span>
              <h4 className="font-semibold text-slate-200 mt-1 text-xs font-mono">FIR {f.CaseNo}</h4>
              <p className="text-[10px] text-slate-400 mt-0.5">{f.Factors?.[0]}</p>
            </button>
          ))}
          {!isLoading && !(summary?.alerts || []).length && !(anomalies?.Findings || []).length && (
            <p className="text-center py-8 text-xs text-slate-500 font-mono italic">No active alerts in this scope.</p>
          )}
        </div>
      </div>

      <div className="bg-[#111827] border border-[#1e293b] rounded p-5 flex flex-col h-[360px]">
        <div className="flex items-center gap-2 border-b border-[#1e293b] pb-3 mb-4">
          <Compass className="text-blue-500" size={16} />
          <h3 className="text-xs font-bold text-slate-300 font-mono uppercase tracking-wider">Recommended actions</h3>
        </div>
        <div className="flex-1 overflow-y-auto space-y-2.5 pr-2">
          {(summary?.recommendations || []).map((r: any, index: number) => (
            <div key={index} className="p-3 bg-blue-500/5 border border-blue-500/10 rounded text-xs">
              <div className="flex justify-between items-start gap-2">
                <span className="text-[10px] text-blue-400 font-mono uppercase font-bold tracking-wider">{r.title}</span>
                <span className="text-[10px] text-amber-400 font-bold uppercase font-mono">{r.priority}</span>
              </div>
              <p className="text-[11px] text-slate-300 mt-1">{r.detail}</p>
            </div>
          ))}
          {!isLoading && !(summary?.recommendations || []).length && <p className="text-center py-8 text-xs text-slate-500 font-mono italic">Nothing to recommend from the current data.</p>}
        </div>
      </div>

      <div className="bg-[#111827] border border-[#1e293b] rounded p-5 flex flex-col h-[360px]">
        <div className="flex items-center gap-2 border-b border-[#1e293b] pb-3 mb-4">
          <Clock className="text-emerald-500" size={16} />
          <h3 className="text-xs font-bold text-slate-300 font-mono uppercase tracking-wider">Recent AI activity</h3>
        </div>
        <div className="flex-1 overflow-y-auto space-y-3 pr-2">
          {(summary?.activity || []).map((e: any, index: number) => (
            <div key={index} className="flex gap-3 text-xs">
              <div className="w-5 h-5 rounded-full bg-[#1e293b] border border-[#334155] flex items-center justify-center flex-shrink-0"><Activity className="text-blue-400" size={11} /></div>
              <div>
                <span className="font-bold text-slate-200 block text-[10px] uppercase font-mono tracking-wide">{e.label}</span>
                <p className="text-[10px] text-slate-400">{e.detail}</p>
                <p className="text-[10px] text-slate-600 font-mono">{formatTime(e.time)}</p>
              </div>
            </div>
          ))}
          {!isLoading && !(summary?.activity || []).length && <p className="text-center py-8 text-xs text-slate-500 font-mono italic">No AI activity recorded yet.</p>}
        </div>
      </div>
    </div>
  );

  const charts = (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="bg-[#111827] border border-[#1e293b] rounded p-5">
        <TrendChart options={barChart} loading={isLoading} headline={subMode === "executive" ? "FIRs by district (top 10)" : "FIRs by police station"}
          aiInsight={topBar ? `${topBar.name} has the most FIRs (${topBar.cases}), of which ${topBar.high_risk} are rated High/Severe.` : undefined} />
      </div>
      <div className="bg-[#111827] border border-[#1e293b] rounded p-5">
        <TrendChart options={crimeChart} loading={isLoading} headline="Crime categories"
          aiInsight={topCrime ? `${topCrime.name} is the largest category with ${topCrime.cases} FIRs (${Math.round((topCrime.cases / sumCrime) * 100)}%).` : undefined} />
      </div>
      <div className="bg-[#111827] border border-[#1e293b] rounded p-5">
        <TrendChart options={monthlyChart} loading={isLoading} headline="FIRs registered per month (last 24 months)" />
      </div>
    </div>
  );

  const selectors = subMode !== "executive" && (
    <div className="bg-[#111827] border border-[#1e293b] rounded p-5 flex flex-wrap items-end gap-4">
      <div className="flex flex-col">
        <span className="text-[9px] text-slate-500 font-mono uppercase mb-0.5">{t("Select District:", "ಜಿಲ್ಲೆ ಆಯ್ಕೆ ಮಾಡಿ:")}</span>
        <select value={selectedDistrict} disabled={isConstable}
          onChange={(e) => { setSelectedDistrict(Number(e.target.value)); setSelectedStation(""); resetTable(); }}
          className="bg-[#1e293b] border border-[#1e293b] text-slate-200 text-xs rounded px-3 py-2 focus:outline-none focus:border-blue-500 font-mono font-bold">
          {districts.map((d) => <option key={d.id} value={d.id}>{translateData(d.name)}</option>)}
        </select>
      </div>
      {subMode === "station" && (
        <div className="flex flex-col">
          <span className="text-[9px] text-slate-500 font-mono uppercase mb-0.5">{t("Select Station:", "ಠಾಣೆ ಆಯ್ಕೆ ಮಾಡಿ:")}</span>
          <select value={selectedStation} onChange={(e) => { setSelectedStation(Number(e.target.value)); resetTable(); }}
            className="bg-[#1e293b] border border-[#1e293b] text-slate-200 text-xs rounded px-3 py-2 focus:outline-none focus:border-blue-500 font-mono font-bold">
            {stations.map((s) => <option key={s.id} value={s.id}>{translateData(s.name)}</option>)}
          </select>
        </div>
      )}
    </div>
  );

  const caseTable = subMode !== "executive" && (
    <div className="bg-[#111827] border border-[#1e293b] rounded p-5 flex flex-col h-[520px]">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4 border-b border-[#1e293b] pb-3">
        <h3 className="text-sm font-bold text-slate-300 font-mono uppercase tracking-wider">{scopeName} — case logs</h3>
        <div className="flex items-center gap-2">
          <select value={category} onChange={(e) => { setCategory(e.target.value as keyof typeof CATEGORY_FILTERS); setSortBy(e.target.value === "risk" ? "risk_desc" : "date_desc"); resetTable(); }}
            className="bg-[#1e293b] border border-[#334155] text-slate-200 text-xs rounded px-2.5 py-1.5 font-mono font-bold">
            <option value="all">📋 {t("All Records", "ಎಲ್ಲಾ ದಾಖಲೆಗಳು")}</option>
            <option value="risk">🛡️ {t("High / Severe Risk", "ಎಐ ಉನ್ನತ ರಿಸ್ಕ್ ಪ್ರಕರಣಗಳು")}</option>
            <option value="pending">⏳ {t("Open Cases", "ಬಾಕಿ ಇರುವ ಪ್ರಕರಣಗಳು")}</option>
            <option value="finished">✅ {t("Closed Cases", "ಪೂರ್ಣಗೊಂಡ ಪ್ರಕರಣಗಳು")}</option>
          </select>
          <select value={sortBy} onChange={(e) => { setSortBy(e.target.value); resetTable(); }}
            className="bg-[#1e293b] border border-[#334155] text-slate-200 text-xs rounded px-2.5 py-1.5 font-mono font-bold">
            <option value="date_desc">📅 {t("Newest to Oldest", "ಇತ್ತೀಚಿನವುಗಳಿಂದ ಹಳೆಯವು")}</option>
            <option value="date_asc">📅 {t("Oldest to Newest", "ಹಳೆಯವುಗಳಿಂದ ಇತ್ತೀಚಿನವು")}</option>
            <option value="risk_desc">⚡ {t("High to Low Risk", "ಹೆಚ್ಚಿನ ರಿಸ್ಕ್‌ನಿಂದ ಕಡಿಮೆ ರಿಸ್ಕ್")}</option>
            <option value="risk_asc">⚡ {t("Low to High Risk", "ಕಡಿಮೆ ರಿಸ್ಕ್‌ನಿಂದ ಹೆಚ್ಚಿನ ರಿಸ್ಕ್")}</option>
          </select>
        </div>
      </div>
      <div className="flex-1 min-h-0">
        <DataTable columns={caseColumns} data={casesData?.data || []} loading={isCasesLoading} meta={casesData?.meta} onPageChange={setPage}
          onRowClick={(row) => navigate(`/cases/${row.CaseMasterID}`)} />
      </div>
    </div>
  );

  return (
    <div className="space-y-6 select-none font-sans pb-10">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-[#1e293b] pb-4 gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-100 uppercase tracking-widest font-mono">{t("dash_title")}</h1>
          <p className="text-xs text-slate-400 mt-1">{t("dash_sub")}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">{modeSwitcher}</div>
      </div>

      {selectors}

      {subMode === "executive" && summary?.recent_cases?.length > 0 && (
        <div className="bg-[#0b0f19] border border-[#1e293b] rounded py-2.5 px-4 flex items-center gap-3 text-[10px] font-mono overflow-hidden">
          <span className="text-blue-400 font-bold uppercase tracking-wider flex-shrink-0">Latest FIRs:</span>
          <div className="flex-1 overflow-hidden whitespace-nowrap text-slate-400">
            {summary.recent_cases.slice(0, 4).map((c: any) => (
              <button key={c.case_id} onClick={() => navigate(`/cases/${c.case_id}`)} className="mr-8 inline-block hover:text-slate-200">
                <span className="text-blue-400 font-bold">[{c.case_no}]</span> {translateData(c.facts)}
              </button>
            ))}
          </div>
        </div>
      )}

      {briefing}
      {kpis}
      {panels}
      {charts}
      {caseTable}
    </div>
  );
}
