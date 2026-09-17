import { useState } from "react";
import NetworkGraphCanvas from "../../components/graph/NetworkGraphCanvas";
import { useQuery } from "@tanstack/react-query";
import { networkService } from "../../services/networkService";
import {
  Users,
  Filter,
  RefreshCw,
  Shield,
  Calendar,
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

export default function NetworkModule() {
  const { translateData } = useLanguage();
  const [districtId, setDistrictId] = useState<number | undefined>(undefined);
  const [crimeCategory, setCrimeCategory] = useState<string>("");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [minConfidence, setMinConfidence] = useState<number>(0.0);
  const [selectedNodeTypes, setSelectedNodeTypes] = useState<string[]>([
    "Person",
    "FIR",
    "PoliceStation",
    "Vehicle",
    "Weapon",
    "BankAccount",
    "PhoneNumber",
    "Evidence",
    "Victim",
    "Address",
    "Organization",
  ]);

  // Fetch Enterprise Dynamic Criminal Intelligence Graph
  const { data: graphData, isLoading: isGraphLoading, refetch } = useQuery({
    queryKey: [
      "criminalIntelligenceGraph",
      districtId,
      crimeCategory,
      startDate,
      endDate,
      minConfidence,
      selectedNodeTypes.join(","),
    ],
    queryFn: () =>
      networkService.getGraph({
        districtId,
        crimeCategory: crimeCategory || undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        minConfidence,
        nodeTypes: selectedNodeTypes.join(","),
        limit: 150,
      }),
  });

  // Fetch Gang Communities
  const { data: gangData } = useQuery({
    queryKey: ["networkGangsModule"],
    queryFn: () => networkService.getGangs(),
  });

  const communities = gangData?.Communities || [];

  const toggleNodeType = (type: string) => {
    if (selectedNodeTypes.includes(type)) {
      setSelectedNodeTypes(selectedNodeTypes.filter((t) => t !== type));
    } else {
      setSelectedNodeTypes([...selectedNodeTypes, type]);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-100px)] space-y-3 select-none overflow-hidden">
      {/* Top Title & Metric Summary Bar */}
      <div className="flex justify-between items-center bg-[#111827] border border-[#1e293b] p-3 rounded shadow-lg flex-shrink-0">
        <div>
          <div className="flex items-center gap-2">
            <Shield className="text-blue-500" size={18} />
            <h1 className="text-base font-bold tracking-tight text-slate-100 font-mono uppercase">
              KSP Criminal Intelligence Link Analysis
            </h1>
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5 font-sans">
            Enterprise dynamic network traversal over PostgreSQL FIR records, co-accused syndicates, weapons, and assets.
          </p>
        </div>

        <div className="flex items-center gap-3 text-xs font-mono">
          <div className="bg-[#151c2e] border border-[#1e293b] px-2.5 py-1 rounded">
            <span className="text-slate-500 block text-[9px]">TOTAL NODES</span>
            <span className="text-blue-400 font-bold text-xs">{graphData?.total_nodes || 0}</span>
          </div>

          <div className="bg-[#151c2e] border border-[#1e293b] px-2.5 py-1 rounded">
            <span className="text-slate-500 block text-[9px]">RELATIONAL EDGES</span>
            <span className="text-emerald-400 font-bold text-xs">{graphData?.total_edges || 0}</span>
          </div>

          <div className="bg-[#151c2e] border border-[#1e293b] px-2.5 py-1 rounded">
            <span className="text-slate-500 block text-[9px]">INFERRED SYNDICATES</span>
            <span className="text-amber-400 font-bold text-xs">{graphData?.gang_count || 0} Rings</span>
          </div>

          <button
            onClick={() => refetch()}
            className="bg-blue-600/20 hover:bg-blue-600/40 text-blue-400 border border-blue-500/30 p-1.5 rounded transition-colors"
            title="Refresh Dynamic Network"
          >
            <RefreshCw size={14} className={isGraphLoading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {/* Main Workspace Layout */}
      <div className="flex-1 min-h-0 flex gap-3 overflow-hidden">
        {/* Left Filter & Gang Panel (Isolated Scrollbar) */}
        <div className="w-80 flex-shrink-0 bg-[#111827] border border-[#1e293b] rounded p-3.5 flex flex-col space-y-4 overflow-y-auto max-h-full">
          {/* Intelligence Filters Drawer */}
          <div className="space-y-3 border-b border-[#1e293b] pb-4">
            <div className="flex items-center gap-2 mb-1">
              <Filter className="text-blue-400" size={15} />
              <h3 className="text-xs font-bold text-slate-200 font-mono uppercase tracking-wider">
                Intelligence Filters
              </h3>
            </div>
            {/* Date Range Filters */}
            <div>
              <label className="text-[10px] text-slate-400 font-mono flex items-center gap-1 mb-1">
                <Calendar size={11} className="text-blue-400" />
                DATE RANGE (FIR REGISTRATION)
              </label>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="bg-[#151c2e] border border-[#1e293b] text-slate-200 text-[11px] p-1.5 rounded focus:outline-none focus:border-blue-500 font-mono"
                />
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="bg-[#151c2e] border border-[#1e293b] text-slate-200 text-[11px] p-1.5 rounded focus:outline-none focus:border-blue-500 font-mono"
                />
              </div>
            </div>

            {/* District Filter */}
            <div>
              <label className="text-[10px] text-slate-400 font-mono block mb-1">STATE DISTRICT</label>
              <select
                value={districtId || ""}
                onChange={(e) => setDistrictId(e.target.value ? Number(e.target.value) : undefined)}
                className="w-full bg-[#151c2e] border border-[#1e293b] text-slate-200 text-xs p-2 rounded focus:outline-none focus:border-blue-500 font-mono"
              >
                <option value="">All 31 Districts (Statewide)</option>
                {KARNATAKA_DISTRICTS.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Crime Category Filter */}
            <div>
              <label className="text-[10px] text-slate-400 font-mono block mb-1">CRIME TYPE / CATEGORY</label>
              <select
                value={crimeCategory}
                onChange={(e) => setCrimeCategory(e.target.value)}
                className="w-full bg-[#151c2e] border border-[#1e293b] text-slate-200 text-xs p-2 rounded focus:outline-none focus:border-blue-500 font-mono"
              >
                <option value="">All Major Crime Heads</option>
                <option value="burglary">Night Burglary & House Breaking</option>
                <option value="theft">Vehicle Theft & Property Offence</option>
                <option value="cyber">Cyber Financial Extortion</option>
                <option value="assault">Armed Robbery & Violent Assault</option>
                <option value="women">Crimes Against Women & Harassment</option>
                <option value="narcotics">NDPS & Illegal Contraband</option>
              </select>
            </div>

            {/* Minimum Confidence Slider */}
            <div>
              <div className="flex justify-between items-center text-[10px] text-slate-400 font-mono mb-1">
                <span>MIN RELATIONAL CONFIDENCE</span>
                <span className="text-emerald-400 font-bold">{(minConfidence * 100).toFixed(0)}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="0.9"
                step="0.1"
                value={minConfidence}
                onChange={(e) => setMinConfidence(parseFloat(e.target.value))}
                className="w-full h-1.5 bg-[#151c2e] rounded-lg appearance-none cursor-pointer accent-blue-500"
              />
            </div>

            {/* Node Types Selector */}
            <div>
              <label className="text-[10px] text-slate-400 font-mono block mb-1">ENTITY NODE TYPES</label>
              <div className="grid grid-cols-2 gap-1.5 text-[10px] font-mono">
                {[
                  { id: "Person", label: "👤 Person" },
                  { id: "FIR", label: "📄 FIR Case" },
                  { id: "PoliceStation", label: "🏢 Station" },
                  { id: "Vehicle", label: "🚗 Vehicle" },
                  { id: "Weapon", label: "🔫 Weapon" },
                  { id: "BankAccount", label: "💳 Bank Acc" },
                  { id: "PhoneNumber", label: "📞 Phone" },
                  { id: "Evidence", label: "📦 Evidence" },
                  { id: "Victim", label: "👤 Victim" },
                  { id: "Address", label: "📍 Address" },
                  { id: "Organization", label: "🔶 Syndicate" },
                ].map((type) => (
                  <button
                    key={type.id}
                    onClick={() => toggleNodeType(type.id)}
                    className={`px-2 py-1 rounded border text-left transition-colors ${
                      selectedNodeTypes.includes(type.id)
                        ? "bg-blue-600/20 text-blue-300 border-blue-500/40"
                        : "bg-[#151c2e] text-slate-500 border-[#1e293b]"
                    }`}
                  >
                    {type.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Identified Gang Communities Panel */}
          <div className="flex-1 min-h-0 flex flex-col space-y-2">
            <div className="flex items-center justify-between border-b border-[#1e293b] pb-2">
              <div className="flex items-center gap-1.5">
                <Users className="text-amber-400" size={15} />
                <h3 className="text-xs font-bold text-slate-200 font-mono uppercase tracking-wider">
                  Inferred Gang Syndicates
                </h3>
              </div>
              <span className="text-[10px] bg-amber-500/10 text-amber-400 border border-amber-500/20 px-1.5 py-0.5 rounded font-mono font-bold">
                Louvain AI
              </span>
            </div>

            {communities.length === 0 ? (
              <div className="text-center text-xs text-slate-500 py-6 font-mono">No communities detected.</div>
            ) : (
              <div className="space-y-2.5 flex-1 overflow-y-auto min-h-0 pr-1">
                {communities.map((g: any, idx: number) => (
                  <div key={idx} className="bg-[#151c2e] border border-[#1e293b] p-2.5 rounded text-xs leading-relaxed">
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-bold text-amber-300 font-mono">Syndicate Ring #{idx + 1}</span>
                      <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-1.5 py-0.5 rounded text-[9px] font-mono">
                        {(g.Confidence * 100).toFixed(0)}% Conf
                      </span>
                    </div>
                    <p className="text-slate-300 text-[10px] italic">"{translateData(g.Explanation)}"</p>
                    <div className="mt-1.5 text-[10px] text-slate-400 font-mono flex justify-between items-center">
                      <span>Members: {g.MemberPersonIDs?.length || 0} suspects</span>
                      <span className="text-blue-400 text-[9px]">High Co-offending</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Center Dynamic Graph Canvas */}
        <div className="flex-1 bg-[#111827] border border-[#1e293b] rounded overflow-hidden relative">
          <NetworkGraphCanvas graphData={graphData} isLoading={isGraphLoading} refetch={refetch} />
        </div>
      </div>
    </div>
  );
}
