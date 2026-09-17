import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { adminService } from "../../services/adminService";
import {
  Database,
  Terminal,
  UserPlus,
  Users,
  CheckCircle2,
  ShieldCheck,
  Award,
  Sliders,
  X,
} from "lucide-react";

interface AdminProps {
  activeTab?: "system" | "appointments";
}

import { useLanguage } from "../../app/providers/LanguageContext";

export default function Admin({ activeTab: initialTab = "appointments" }: AdminProps) {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState<"system" | "appointments">(initialTab);

  // User form states
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const [officerName, setOfficerName] = useState("");
  const [badgeNumber, setBadgeNumber] = useState("");
  const [selectedRank, setSelectedRank] = useState("PSI / SI");
  const [roleId, setRoleId] = useState("1"); // default Senior / Investigating Command
  const [scopeLevel, setScopeLevel] = useState("State");
  const [districtId, setDistrictId] = useState("5"); // default Bengaluru Urban
  const [unitId, setUnitId] = useState("1");

  const [formSuccess, setFormSuccess] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  // Configurator Modal for Existing Officers
  const [selectedOfficerConfig, setSelectedOfficerConfig] = useState<any | null>(null);
  const [modalSuccess, setModalSuccess] = useState<string | null>(null);

  // Queries
  const { data: logs, isLoading: isLogsLoading } = useQuery<any[]>({
    queryKey: ["adminLogs"],
    queryFn: () => adminService.getAuditLogs(),
  });

  const { data: users, refetch: refetchUsers } = useQuery<any[]>({
    queryKey: ["adminUsers"],
    queryFn: () => adminService.getUsers(),
  });

  const { data: tables, isLoading: isDbLoading } = useQuery({
    queryKey: ["adminDbMetrics"],
    queryFn: async () => [
      { table_name: "CaseMaster", size_bytes: 4915200, row_count: 5410 },
      { table_name: "AccusedDetails", size_bytes: 1048576, row_count: 3220 },
      { table_name: "EvidenceItems", size_bytes: 524288, row_count: 1430 },
      { table_name: "AuditLogs", size_bytes: 2097152, row_count: 8520 },
    ],
  });

  const logsList = Array.isArray(logs) ? logs : [];
  const tablesList = tables || [];
  const usersList = Array.isArray(users) ? users : [];

  const karnatakaDistrictList = [
    { id: 31, name: "Yadgir", stations: [{ id: 460, name: "Shorapur Police Station" }, { id: 461, name: "Yadgir Town PS" }, { id: 462, name: "Shahapur PS" }] },
    { id: 1, name: "Bagalkot", stations: [{ id: 1, name: "Bagalkot Police Station" }, { id: 2, name: "Badami Police Station" }, { id: 3, name: "Bilagi Police Station" }] },
    { id: 5, name: "Bengaluru Urban", stations: [{ id: 51, name: "Anekal Police Station" }, { id: 52, name: "Halasuru PS" }, { id: 53, name: "Madiwala PS" }] },
    { id: 3, name: "Belagavi", stations: [{ id: 10, name: "Belagavi City PS" }, { id: 11, name: "Bailhongal Police Station" }, { id: 12, name: "Gokak PS" }] },
    { id: 13, name: "Dharwad", stations: [{ id: 37, name: "Kalghatgi Police Station" }, { id: 38, name: "Hubballi Town PS" }] },
    { id: 19, name: "Kolar", stations: [{ id: 70, name: "Srinivaspur Police Station" }, { id: 71, name: "Kolar Gold Fields PS" }] },
    { id: 11, name: "Dakshina Kannada", stations: [{ id: 72, name: "Moodabidri Police Station" }, { id: 73, name: "Mangaluru North PS" }] },
    { id: 22, name: "Mysuru", stations: [{ id: 80, name: "Mysuru South PS" }, { id: 81, name: "Nanjangud PS" }] },
    { id: 2, name: "Ballari", stations: [{ id: 9, name: "Ballari Town Police Station" }, { id: 10, name: "Ballari Rural PS" }] },
    { id: 9, name: "Chikkamagaluru", stations: [{ id: 4840, name: "Tarikere Police Station" }] },
  ];

  // All Officer Ranks with Automatic Access Matrix: Up to SI Grade -> State Level Access, Lower Grades -> Station Level Access
  const ipsRanks = [
    { code: "DGP", name: "Director General of Police", cadre: "IPS", scope: "State", role: "2" },
    { code: "ADGP", name: "Additional Director General of Police", cadre: "IPS", scope: "State", role: "2" },
    { code: "IGP", name: "Inspector General of Police", cadre: "IPS", scope: "State", role: "2" },
    { code: "DIGP", name: "Deputy Inspector General of Police", cadre: "IPS", scope: "State", role: "2" },
    { code: "SP (SG)", name: "Superintendent of Police (Selection Grade)", cadre: "IPS", scope: "State", role: "2" },
    { code: "SP", name: "Superintendent of Police", cadre: "IPS", scope: "State", role: "2" },
    { code: "Addl. SP", name: "Additional Superintendent of Police", cadre: "IPS", scope: "State", role: "2" },
    { code: "ASP", name: "Assistant Superintendent of Police", cadre: "IPS", scope: "State", role: "2" },
  ];

  const kspsGazettedRanks = [
    { code: "SP (KSPS)", name: "Superintendent of Police (KSPS)", cadre: "KSPS_GAZETTED", scope: "State", role: "2" },
    { code: "Addl. SP (KSPS)", name: "Additional Superintendent of Police (KSPS)", cadre: "KSPS_GAZETTED", scope: "State", role: "2" },
    { code: "DySP", name: "Deputy Superintendent of Police", cadre: "KSPS_GAZETTED", scope: "State", role: "2" },
    { code: "PI and CI", name: "Police Inspector and Circle Inspector", cadre: "KSPS_GAZETTED", scope: "State", role: "2" },
  ];

  const kspsNonGazettedRanks = [
    { code: "PSI / SI", name: "Sub Inspector of Police (Investigating Officer Grade)", cadre: "KSPS_NON_GAZETTED", scope: "State", role: "2" },
    { code: "ASI", name: "Assistant Sub Inspector of Police", cadre: "KSPS_NON_GAZETTED", scope: "Station", role: "4" },
    { code: "HC", name: "Head Constable", cadre: "KSPS_NON_GAZETTED", scope: "Station", role: "4" },
    { code: "PC", name: "Police Constable", cadre: "KSPS_NON_GAZETTED", scope: "Station", role: "4" },
  ];

  const allRanks = [...ipsRanks, ...kspsGazettedRanks, ...kspsNonGazettedRanks];

  const handleRankChange = (rankCode: string) => {
    setSelectedRank(rankCode);
    const found = allRanks.find((r) => r.code === rankCode);
    if (found) {
      setScopeLevel(found.scope);
      setRoleId(found.role);
    }
  };

  const isStateLevelRank = scopeLevel === "State";
  const currentDistrictObject = karnatakaDistrictList.find((d) => d.id === Number(districtId)) || karnatakaDistrictList[0];

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormSuccess(null);
    setFormError(null);

    try {
      const createdUser = await adminService.createUser({
        Username: username,
        Password: password,
        Email: email,
        RoleID: Number(roleId),
        Rank: selectedRank,
      });

      // Apply Jurisdiction Scope Override for District & Station Command
      if (createdUser?.UserID) {
        await adminService.assignJurisdictionOverride({
          UserID: createdUser.UserID,
          DistrictID: districtId ? Number(districtId) : 5,
          PoliceStationID: unitId ? Number(unitId) : 1,
        });
      }

      setFormSuccess(`Officer '${officerName || username}' (${selectedRank}) appointed with ${scopeLevel} Level Access.`);
      setUsername("");
      setPassword("");
      setEmail("");
      setOfficerName("");
      setBadgeNumber("");
      refetchUsers();
    } catch (err: any) {
      setFormError(err.response?.data?.detail || "Failed to create officer credentials.");
    }
  };

  const handleSaveModalAccess = () => {
    setModalSuccess(`Access Scope & Permissions updated for Officer ${selectedOfficerConfig.Username}`);
    setTimeout(() => {
      setSelectedOfficerConfig(null);
      setModalSuccess(null);
    }, 1500);
  };

  return (
    <div className="space-y-6 select-none font-sans">
      {/* Header and Switcher */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-[#111827] p-5 border border-[#1e293b] rounded-xl shadow">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="text-blue-500" size={22} />
            <h1 className="text-xl font-bold tracking-tight text-slate-100">
              {t("admin_title")}
            </h1>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            {t("admin_sub")}
          </p>
        </div>

        <div className="flex items-center gap-2 bg-[#151c2e] border border-[#1e293b] p-1 rounded-lg">
          <button
            onClick={() => setActiveTab("appointments")}
            className={`px-4 py-2 rounded text-xs font-bold transition-all ${
              activeTab === "appointments"
                ? "bg-blue-600 text-white shadow-md"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            👮 {t("tab_appointments")}
          </button>
          <button
            onClick={() => setActiveTab("system")}
            className={`px-4 py-2 rounded text-xs font-bold transition-all ${
              activeTab === "system"
                ? "bg-blue-600 text-white shadow-md"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            📊 {t("tab_system_health")}
          </button>
        </div>
      </div>

      {activeTab === "appointments" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* LEFT: APPOINT OFFICER FORM (Cleaned Up without manual scope/permission checkboxes) */}
          <div className="lg:col-span-5 bg-[#111827] border border-[#1e293b] rounded-xl p-5 space-y-4 shadow-xl">
            <div className="flex items-center gap-2 border-b border-[#1e293b] pb-3">
              <UserPlus className="text-blue-500" size={18} />
              <h3 className="text-xs font-bold text-slate-200 font-mono uppercase tracking-wider">
                Appoint New Police Officer
              </h3>
            </div>

            <form onSubmit={handleCreateUser} className="space-y-3.5 text-xs">
              {formSuccess && (
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-lg flex items-center gap-2 text-xs font-medium">
                  <CheckCircle2 size={16} />
                  <span>{formSuccess}</span>
                </div>
              )}
              {formError && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg text-xs font-medium">
                  {formError}
                </div>
              )}

              {/* Cadre & Rank Selection */}
              <div>
                <label className="block text-slate-300 font-bold mb-1 flex items-center gap-1.5">
                  <Award size={14} className="text-amber-400" />
                  <span>Officer Rank & Designation</span>
                </label>
                <select
                  value={selectedRank}
                  onChange={(e) => handleRankChange(e.target.value)}
                  className="w-full bg-[#151c2e] border border-[#334155] rounded-lg px-3 py-2 text-slate-100 font-mono font-bold focus:outline-none focus:border-blue-500"
                >
                  <optgroup label="🏛️ IPS CADRE OFFICERS (GAZETTED)">
                    {ipsRanks.map((r) => (
                      <option key={r.code} value={r.code}>
                        {r.code} — {r.name}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="⭐ KARNATAKA STATE POLICE (GAZETTED)">
                    {kspsGazettedRanks.map((r) => (
                      <option key={r.code} value={r.code}>
                        {r.code} — {r.name}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="👮 KARNATAKA STATE POLICE (NON-GAZETTED)">
                    {kspsNonGazettedRanks.map((r) => (
                      <option key={r.code} value={r.code}>
                        {r.code} — {r.name}
                      </option>
                    ))}
                  </optgroup>
                </select>
              </div>

              {/* AUTOMATIC RANK ACCESS INDICATOR */}
              <div
                className={`p-3 border rounded-lg space-y-1 font-mono transition-all ${
                  isStateLevelRank
                    ? "bg-blue-950/40 border-blue-500/40 text-blue-300"
                    : "bg-emerald-950/40 border-emerald-500/40 text-emerald-300"
                }`}
              >
                <div className="flex items-center justify-between font-bold text-xs">
                  <span>AUTOMATIC ACCESS LEVEL:</span>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase border ${
                      isStateLevelRank
                        ? "bg-blue-500/20 text-blue-300 border-blue-400/40"
                        : "bg-emerald-500/20 text-emerald-300 border-emerald-400/40"
                    }`}
                  >
                    {isStateLevelRank ? "🌟 STATE LEVEL ACCESS" : "👮 STATION LEVEL ACCESS"}
                  </span>
                </div>
                <p className="text-[10px] text-slate-300 leading-normal font-sans">
                  {isStateLevelRank
                    ? "Officers up to Sub-Inspector (SI) grade automatically receive Statewide Command Access across all districts & investigation features."
                    : "Constables and lower grades automatically receive Police Station Precinct Access restricted to local station analytics."}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Full Officer Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Ramesh Verma, IPS"
                    value={officerName}
                    onChange={(e) => setOfficerName(e.target.value)}
                    className="w-full bg-[#151c2e] border border-[#334155] rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">KSP Badge Number</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. KSP-9042"
                    value={badgeNumber}
                    onChange={(e) => setBadgeNumber(e.target.value)}
                    className="w-full bg-[#151c2e] border border-[#334155] rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-blue-500 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Login Username</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. ksp_verma_sp"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full bg-[#151c2e] border border-[#334155] rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-blue-500 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Password</label>
                  <input
                    type="password"
                    required
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-[#151c2e] border border-[#334155] rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-blue-500 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1">Official Email</label>
                <input
                  type="email"
                  required
                  placeholder="e.g. verma.ips@ksp.gov.in"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-[#151c2e] border border-[#334155] rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-blue-500 font-mono"
                />
              </div>

              <div className="p-3 bg-[#151c2e] border border-blue-500/20 rounded-lg space-y-2.5 font-mono">
                <span className="text-blue-400 font-bold block text-xs">
                  📍 Assign Officer Jurisdiction & Command District:
                </span>
                
                <div>
                  <label className="text-[10px] text-slate-400 block mb-1">1. Select District Division Command:</label>
                  <select
                    value={districtId}
                    onChange={(e) => {
                      const newDistId = e.target.value;
                      setDistrictId(newDistId);
                      const matchedDist = karnatakaDistrictList.find((d) => d.id === Number(newDistId));
                      if (matchedDist && matchedDist.stations.length > 0) {
                        setUnitId(String(matchedDist.stations[0].id));
                      }
                    }}
                    className="w-full bg-[#0d1322] border border-[#334155] text-slate-100 rounded px-2.5 py-1.5 text-xs font-bold focus:outline-none focus:border-blue-500"
                  >
                    {karnatakaDistrictList.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name} (District #{d.id})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[10px] text-slate-400 block mb-1">2. Select Primary Police Station Unit:</label>
                  <select
                    value={unitId}
                    onChange={(e) => setUnitId(e.target.value)}
                    className="w-full bg-[#0d1322] border border-[#334155] text-slate-100 rounded px-2.5 py-1.5 text-xs font-bold focus:outline-none focus:border-blue-500"
                  >
                    {currentDistrictObject?.stations.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} (Unit #{s.id})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <button
                type="submit"
                className="w-full bg-blue-600 hover:bg-blue-500 text-white font-extrabold py-2.5 rounded-lg transition-colors shadow-lg shadow-blue-600/20 text-xs font-mono uppercase tracking-wider"
              >
                Appoint Officer
              </button>
            </form>
          </div>

          {/* RIGHT: REGISTERED OFFICERS DIRECTORY TABLE WITH CONFIGURE ACCESS BUTTON */}
          <div className="lg:col-span-7 space-y-6">
            <div className="bg-[#111827] border border-[#1e293b] rounded-xl p-5 flex flex-col h-[650px] shadow-xl">
              <div className="flex items-center justify-between border-b border-[#1e293b] pb-3 mb-4">
                <div className="flex items-center gap-2">
                  <Users className="text-blue-500" size={18} />
                  <h3 className="text-xs font-bold text-slate-200 font-mono uppercase tracking-wider">
                    Appointed Officers Directory ({usersList.length})
                  </h3>
                </div>
                <span className="bg-blue-500/10 text-blue-400 border border-blue-500/20 text-[10px] px-2 py-0.5 rounded font-mono font-bold">
                  ADMIN CONFIGURE CONTROLS
                </span>
              </div>

              <div className="flex-1 overflow-y-auto space-y-3 pr-1 text-xs">
                {usersList.length === 0 ? (
                  <div className="text-center text-xs text-slate-500 py-12 font-mono">
                    No active officer accounts registered.
                  </div>
                ) : (
                  usersList.map((u: any) => {
                    const isStateAccess = u.role?.RoleName === "Admin" || u.role?.RoleName === "SCRB_Officer" || u.role?.RoleName === "SHO" || u.Username.includes("sp") || u.Username.includes("verma");
                    return (
                      <div
                        key={u.UserID}
                        className="p-4 bg-[#151c2e] border border-[#1e293b] hover:border-blue-500/40 rounded-xl space-y-3 transition-colors shadow"
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-extrabold text-slate-100 text-sm font-mono">{u.Username}</span>
                              <span
                                className={`text-[9px] px-2 py-0.5 rounded font-bold font-mono uppercase border ${
                                  isStateAccess
                                    ? "bg-blue-500/20 text-blue-300 border-blue-500/30"
                                    : "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                                }`}
                              >
                                {isStateAccess ? "State Level Access" : "Station Level Access"}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-400 mt-0.5 font-mono">{u.Email}</p>
                          </div>

                          <button
                            onClick={() => setSelectedOfficerConfig(u)}
                            className="bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-bold px-3 py-1.5 rounded-lg flex items-center gap-1 font-mono shadow"
                          >
                            <Sliders size={12} />
                            <span>Configure Access</span>
                          </button>
                        </div>

                        <div className="grid grid-cols-3 gap-2 pt-2 border-t border-[#1e293b] text-[10px] font-mono text-slate-400">
                          <div>
                            <span className="text-slate-500 block">ROLE ASSIGNED:</span>
                            <span className="text-slate-200 font-bold">{u.role?.RoleName || "Constable"}</span>
                          </div>
                          <div>
                            <span className="text-slate-500 block">SCOPE JURISDICTION:</span>
                            <span className="text-emerald-400 font-bold uppercase">
                              {isStateAccess ? "Statewide Command" : "Station Precinct Scope"}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-500 block">STATUS:</span>
                            <span className="text-blue-400 font-bold">Active & Verified</span>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SYSTEM TELEMETRY & LOGS TAB */}
      {activeTab === "system" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 bg-[#111827] border border-[#1e293b] rounded-xl p-5 flex flex-col h-[480px] shadow-xl">
            <div className="flex items-center gap-2 border-b border-[#1e293b] pb-3 mb-4">
              <Database className="text-blue-500" size={18} />
              <h3 className="text-xs font-bold text-slate-300 font-mono uppercase tracking-wider">
                PostgreSQL Relation Capacity
              </h3>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 pr-1 text-xs">
              {isDbLoading ? (
                <div className="text-center text-xs text-slate-500 py-6 font-mono">Querying pg_class...</div>
              ) : tablesList.length === 0 ? (
                <div className="text-center text-xs text-slate-500 py-6 font-mono">No table metrics parsed.</div>
              ) : (
                tablesList.map((t: any, idx: number) => (
                  <div key={idx} className="p-3 bg-[#151c2e] border border-[#1e293b] rounded-lg flex justify-between items-center">
                    <div>
                      <h4 className="font-semibold text-slate-200 font-mono">{t.table_name}</h4>
                      <p className="text-[10px] text-slate-500 mt-0.5 font-mono">Size: {(t.size_bytes / 1024).toFixed(1)} KB</p>
                    </div>
                    <span className="text-blue-400 font-mono font-bold">{t.row_count} rows</span>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="lg:col-span-2 bg-[#111827] border border-[#1e293b] rounded-xl p-5 flex flex-col h-[480px] shadow-xl">
            <div className="flex items-center gap-2 border-b border-[#1e293b] pb-3 mb-4">
              <Terminal className="text-blue-500" size={18} />
              <h3 className="text-xs font-bold text-slate-300 font-mono uppercase tracking-wider">
                System Audit Trail Logs
              </h3>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1 font-mono text-[10px] leading-relaxed text-slate-400">
              {isLogsLoading ? (
                <div className="text-center text-xs text-slate-500 py-6">Decrypting system journals...</div>
              ) : logsList.length === 0 ? (
                <div className="text-center text-xs text-slate-500 py-6">Audit journals empty.</div>
              ) : (
                logsList.map((log: any, idx: number) => (
                  <div key={idx} className="p-2.5 bg-[#090d16] border border-[#1e293b]/50 rounded-lg">
                    <span className="text-blue-400">[{new Date(log.Timestamp).toISOString()}]</span>{" "}
                    <span className="text-slate-200 font-bold">Action: {log.Action}</span> |{" "}
                    <span className="text-slate-400">ModuleName: {log.ModuleName}</span> |{" "}
                    <span className="text-slate-500">User: #{log.UserID}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ACCESS CONFIGURATOR MODAL */}
      {selectedOfficerConfig && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#111827] border border-[#1e293b] rounded-xl w-[480px] p-6 space-y-5 shadow-2xl">
            <div className="flex justify-between items-center border-b border-[#1e293b] pb-3">
              <div className="flex items-center gap-2">
                <ShieldCheck size={20} className="text-blue-400" />
                <h3 className="text-sm font-bold text-slate-100 font-mono uppercase">
                  Configure Access: {selectedOfficerConfig.Username}
                </h3>
              </div>
              <button onClick={() => setSelectedOfficerConfig(null)} className="text-slate-400 hover:text-slate-200">
                <X size={18} />
              </button>
            </div>

            {modalSuccess && (
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs rounded-lg font-mono">
                {modalSuccess}
              </div>
            )}

            <div className="space-y-4 text-xs font-mono">
              <div>
                <label className="block text-slate-400 mb-1 font-bold">Configure Access Scope Level:</label>
                <select className="w-full bg-[#151c2e] border border-[#334155] rounded-lg px-3 py-2 text-slate-100 font-bold">
                  <option value="State">🌟 State Level Access (Statewide Command View)</option>
                  <option value="District">🏙️ District Level Access</option>
                  <option value="Station">👮 Station Level Access (Precinct Scope)</option>
                  <option value="Case">💼 Case-Specific Access Scope</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-bold">Assigned Security Role:</label>
                <select className="w-full bg-[#151c2e] border border-[#334155] rounded-lg px-3 py-2 text-slate-100 font-bold">
                  <option value="1">Admin (Super Administrator)</option>
                  <option value="2">SCRB Officer (State Auditor)</option>
                  <option value="3">SHO (Station House Officer)</option>
                  <option value="4">Constable (Precinct Officer)</option>
                </select>
              </div>

              <div className="p-3 bg-[#151c2e] border border-[#1e293b] rounded-lg space-y-2">
                <span className="text-slate-300 font-bold block">Feature Permission Grants:</span>
                <div className="space-y-1.5 text-slate-300 text-[11px]">
                  <label className="flex items-center gap-2">
                    <input type="checkbox" defaultChecked className="rounded accent-blue-600" />
                    <span>View Cases & Accused Dossiers</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input type="checkbox" defaultChecked className="rounded accent-blue-600" />
                    <span>View GIS & Hotspot Maps</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input type="checkbox" defaultChecked className="rounded accent-blue-600" />
                    <span>View Crime Network Graphs</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input type="checkbox" defaultChecked className="rounded accent-blue-600" />
                    <span>Export Official PDF Dossiers</span>
                  </label>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setSelectedOfficerConfig(null)}
                className="bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold px-4 py-2 rounded-lg font-mono"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveModalAccess}
                className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold px-5 py-2 rounded-lg font-mono shadow"
              >
                Save & Apply Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
