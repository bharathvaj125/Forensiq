import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { adminService, AdminUser, NewOfficerAccount } from "../../services/adminService";
import { useReferenceOptions } from "../../services/referenceService";
import PasswordDialog from "../../components/common/PasswordDialog";
import { useAuth } from "../../app/providers/AuthProvider";
import { useLanguage } from "../../app/providers/LanguageContext";
import { Database, Terminal, UserPlus, Users, CheckCircle2, ShieldCheck, Award, Sliders, X, Cpu, Activity, AlertTriangle } from "lucide-react";

interface AdminProps {
  activeTab?: "system" | "appointments";
}

// Police ranks of the Karnataka force, for the rank field. A rank does not decide access: the role below does.
const RANK_GROUPS: { label: string; ranks: { code: string; name: string }[] }[] = [
  { label: "IPS cadre (gazetted)", ranks: [
    { code: "DGP", name: "Director General of Police" }, { code: "ADGP", name: "Additional Director General of Police" },
    { code: "IGP", name: "Inspector General of Police" }, { code: "DIGP", name: "Deputy Inspector General of Police" },
    { code: "SP (SG)", name: "Superintendent of Police (Selection Grade)" }, { code: "SP", name: "Superintendent of Police" },
    { code: "Addl. SP", name: "Additional Superintendent of Police" }, { code: "ASP", name: "Assistant Superintendent of Police" },
  ] },
  { label: "Karnataka State Police (gazetted)", ranks: [
    { code: "SP (KSPS)", name: "Superintendent of Police (KSPS)" }, { code: "Addl. SP (KSPS)", name: "Additional Superintendent of Police (KSPS)" },
    { code: "DySP", name: "Deputy Superintendent of Police" }, { code: "PI and CI", name: "Police Inspector and Circle Inspector" },
  ] },
  { label: "Karnataka State Police (non-gazetted)", ranks: [
    { code: "PSI / SI", name: "Sub Inspector of Police" }, { code: "ASI", name: "Assistant Sub Inspector of Police" },
    { code: "HC", name: "Head Constable" }, { code: "PC", name: "Police Constable" },
  ] },
];

const formatBytes = (bytes: number | null | undefined) => {
  if (bytes == null) return "n/a";
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024).toFixed(1)} KB`;
};

const input = "w-full bg-[#151c2e] border border-[#334155] rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-blue-500";
const SCOPE_STYLE: Record<string, string> = {
  Statewide: "bg-blue-500/20 text-blue-300 border-blue-500/30", District: "bg-cyan-500/20 text-cyan-300 border-cyan-500/30",
  Station: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30", "Granted access only": "bg-purple-500/20 text-purple-300 border-purple-500/30",
  None: "bg-red-500/20 text-red-300 border-red-500/30",
};

export default function Admin({ activeTab: initialTab = "appointments" }: AdminProps) {
  const { t, translateData } = useLanguage();
  const { user: me } = useAuth();
  const queryClient = useQueryClient();
  const reference = useReferenceOptions();
  const [activeTab, setActiveTab] = useState<"system" | "appointments">(initialTab);

  const [form, setForm] = useState({ username: "", password: "", email: "", officerName: "", badgeNumber: "", rank: "PSI / SI", roleId: "", districtId: "", stationId: "" });
  const [formSuccess, setFormSuccess] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [configUser, setConfigUser] = useState<AdminUser | null>(null);
  const [configRoleId, setConfigRoleId] = useState("");
  const [configError, setConfigError] = useState<string | null>(null);
  const [resetFor, setResetFor] = useState<AdminUser | null>(null);

  const { data: users } = useQuery({ queryKey: ["adminUsers"], queryFn: () => adminService.getUsers() });
  const { data: roles } = useQuery({ queryKey: ["adminRoles"], queryFn: () => adminService.getRoles() });
  const { data: health, isLoading: isHealthLoading, error: healthError } = useQuery({
    queryKey: ["adminSystemHealth"], queryFn: () => adminService.getSystemHealth(), enabled: activeTab === "system",
  });
  const { data: logs, isLoading: isLogsLoading } = useQuery({ queryKey: ["adminLogs"], queryFn: () => adminService.getAuditLogs(), enabled: activeTab === "system" });

  const usersList = users ?? [];
  const rolesList = roles ?? [];
  const usernames = useMemo(() => new Map(usersList.map((u) => [u.UserID, u.Username])), [usersList]);
  const chosenRole = rolesList.find((r) => String(r.RoleID) === form.roleId);
  const needsPosting = !!chosenRole && chosenRole.ScopeLevel === "Station / district";
  const stations = reference.stations.filter((s) => !form.districtId || s.district_id === Number(form.districtId));

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["adminUsers"] });
    queryClient.invalidateQueries({ queryKey: ["adminRoles"] });
    queryClient.invalidateQueries({ queryKey: ["adminLogs"] });
  };

  const createUser = useMutation({
    mutationFn: (payload: NewOfficerAccount) => adminService.createUser(payload),
    onSuccess: (created) => {
      setFormSuccess(`${created.OfficerName} (${created.Rank}) appointed as ${created.role?.RoleName}. Scope: ${created.ScopeLevel} — ${created.ScopeDescription}.`);
      setFormError(null);
      setForm({ ...form, username: "", password: "", email: "", officerName: "", badgeNumber: "" });
      refresh();
    },
    onError: (err: any) => {
      const detail = err?.response?.data?.detail;
      setFormSuccess(null);
      setFormError(typeof detail === "string" ? detail : Array.isArray(detail) ? detail.map((d: any) => `${(d.loc || []).slice(1).join(".")}: ${d.msg}`).join("; ") : "The account could not be created.");
    },
  });

  const changeRole = useMutation({
    mutationFn: () => adminService.updateUserRole(configUser!.UserID, Number(configRoleId)),
    onSuccess: () => { setConfigUser(null); refresh(); },
    onError: (err: any) => setConfigError(err?.response?.data?.detail || "The role could not be changed."),
  });

  const toggleActive = useMutation({
    mutationFn: (u: AdminUser) => adminService.setUserActive(u.UserID, !u.IsActive),
    onSuccess: refresh,
    onError: (err: any) => window.alert(err?.response?.data?.detail || "The account could not be updated."),
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormSuccess(null);
    setFormError(null);
    if (!form.roleId) { setFormError("Choose a role."); return; }
    createUser.mutate({
      Username: form.username.trim(), Password: form.password, Email: form.email.trim(), RoleID: Number(form.roleId), Rank: form.rank,
      OfficerName: form.officerName.trim(), BadgeNumber: form.badgeNumber.trim(),
      ...(form.stationId ? { PoliceStationID: Number(form.stationId) } : form.districtId ? { DistrictID: Number(form.districtId) } : {}),
    });
  };

  return (
    <div className="space-y-6 select-none font-sans">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-[#111827] p-5 border border-[#1e293b] rounded-xl shadow">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="text-blue-500" size={22} />
            <h1 className="text-xl font-bold tracking-tight text-slate-100">{t("admin_title")}</h1>
          </div>
          <p className="text-xs text-slate-400 mt-1">{t("admin_sub")}</p>
        </div>
        <div className="flex items-center gap-2 bg-[#151c2e] border border-[#1e293b] p-1 rounded-lg">
          {([["appointments", `👮 ${t("tab_appointments")}`], ["system", `📊 ${t("tab_system_health")}`]] as const).map(([id, label]) => (
            <button key={id} onClick={() => setActiveTab(id)}
              className={`px-4 py-2 rounded text-xs font-bold transition-all ${activeTab === id ? "bg-blue-600 text-white shadow-md" : "text-slate-400 hover:text-slate-200"}`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {activeTab === "appointments" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-5 bg-[#111827] border border-[#1e293b] rounded-xl p-5 space-y-4 shadow-xl">
            <div className="flex items-center gap-2 border-b border-[#1e293b] pb-3">
              <UserPlus className="text-blue-500" size={18} />
              <h3 className="text-xs font-bold text-slate-200 font-mono uppercase tracking-wider">Appoint a police officer</h3>
            </div>

            <form onSubmit={submit} className="space-y-3.5 text-xs">
              {formSuccess && (
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-lg flex items-start gap-2 text-xs font-medium">
                  <CheckCircle2 size={16} className="flex-shrink-0 mt-0.5" /><span>{formSuccess}</span>
                </div>
              )}
              {formError && <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg text-xs font-medium">{formError}</div>}

              <div>
                <label className="block text-slate-300 font-bold mb-1 flex items-center gap-1.5"><Award size={14} className="text-amber-400" /><span>Rank and designation</span></label>
                <select value={form.rank} onChange={(e) => setForm({ ...form, rank: e.target.value })} className={`${input} font-mono font-bold`}>
                  {RANK_GROUPS.map((g) => (
                    <optgroup key={g.label} label={g.label}>
                      {g.ranks.map((r) => <option key={r.code} value={r.code}>{r.code} — {r.name}</option>)}
                    </optgroup>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-1">Role (decides what the account may do and see)</label>
                <select required value={form.roleId} onChange={(e) => setForm({ ...form, roleId: e.target.value })} className={`${input} font-mono font-bold`}>
                  <option value="">Select a role</option>
                  {rolesList.map((r) => <option key={r.RoleID} value={r.RoleID}>{r.RoleName} — {r.ScopeLevel}</option>)}
                </select>
                {chosenRole && (
                  <div className="mt-2 p-2.5 bg-[#151c2e] border border-[#1e293b] rounded-lg font-mono text-[10px] text-slate-400 space-y-1">
                    <p className="font-sans text-slate-300">{chosenRole.Description}</p>
                    <p>Permissions: <span className="text-slate-200">{chosenRole.Permissions.join(", ") || "none"}</span></p>
                    <p>Case visibility: <span className="text-slate-200">{chosenRole.ScopeLevel}</span></p>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Full officer name</label>
                  <input required className={input} value={form.officerName} onChange={(e) => setForm({ ...form, officerName: e.target.value })} />
                </div>
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Badge number</label>
                  <input required className={`${input} font-mono`} value={form.badgeNumber} onChange={(e) => setForm({ ...form, badgeNumber: e.target.value })} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Login username</label>
                  <input required minLength={3} className={`${input} font-mono`} value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
                </div>
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Password</label>
                  <input required type="password" autoComplete="new-password" className={`${input} font-mono`} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
                </div>
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1">Official email</label>
                <input required type="email" className={`${input} font-mono`} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>

              <div className="p-3 bg-[#151c2e] border border-blue-500/20 rounded-lg space-y-2.5 font-mono">
                <span className="text-blue-400 font-bold block text-xs">📍 Posting {needsPosting ? "(required for this role)" : "(optional for this role)"}</span>
                <div>
                  <label className="text-[10px] text-slate-400 block mb-1">District</label>
                  <select value={form.districtId} onChange={(e) => setForm({ ...form, districtId: e.target.value, stationId: "" })}
                    className="w-full bg-[#0d1322] border border-[#334155] text-slate-100 rounded px-2.5 py-1.5 text-xs font-bold focus:outline-none focus:border-blue-500">
                    <option value="">{needsPosting ? "Select a district" : "No specific district"}</option>
                    {reference.districts.map((d) => <option key={d.id} value={d.id}>{translateData(d.name)}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 block mb-1">Police station (leave empty for district-wide access)</label>
                  <select value={form.stationId} onChange={(e) => setForm({ ...form, stationId: e.target.value })} disabled={!form.districtId}
                    className="w-full bg-[#0d1322] border border-[#334155] text-slate-100 rounded px-2.5 py-1.5 text-xs font-bold focus:outline-none focus:border-blue-500 disabled:opacity-50">
                    <option value="">{form.districtId ? "Whole district" : "Choose a district first"}</option>
                    {stations.map((s) => <option key={s.id} value={s.id}>{translateData(s.name)}</option>)}
                  </select>
                </div>
              </div>

              <button type="submit" disabled={createUser.isPending}
                className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white font-extrabold py-2.5 rounded-lg transition-colors shadow-lg shadow-blue-600/20 text-xs font-mono uppercase tracking-wider">
                {createUser.isPending ? "Appointing…" : "Appoint officer"}
              </button>
            </form>
          </div>

          <div className="lg:col-span-7 space-y-6">
            <div className="bg-[#111827] border border-[#1e293b] rounded-xl p-5 flex flex-col h-[760px] shadow-xl">
              <div className="flex items-center justify-between border-b border-[#1e293b] pb-3 mb-4">
                <div className="flex items-center gap-2">
                  <Users className="text-blue-500" size={18} />
                  <h3 className="text-xs font-bold text-slate-200 font-mono uppercase tracking-wider">Accounts ({usersList.length})</h3>
                </div>
                <div className="flex flex-wrap gap-1.5 justify-end">
                  {rolesList.map((r) => (
                    <span key={r.RoleID} className="text-[10px] font-mono text-slate-400 bg-[#151c2e] border border-[#1e293b] px-2 py-0.5 rounded">{r.RoleName}: {r.Users}</span>
                  ))}
                </div>
              </div>

              <div className="flex-1 overflow-y-auto space-y-3 pr-1 text-xs">
                {usersList.length === 0 ? (
                  <div className="text-center text-xs text-slate-500 py-12 font-mono">No accounts.</div>
                ) : usersList.map((u) => (
                  <div key={u.UserID} className={`p-4 bg-[#151c2e] border rounded-xl space-y-3 transition-colors shadow ${u.IsActive ? "border-[#1e293b] hover:border-blue-500/40" : "border-red-500/20 opacity-70"}`}>
                    <div className="flex justify-between items-start gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-extrabold text-slate-100 text-sm font-mono">{u.Username}</span>
                          <span className={`text-[9px] px-2 py-0.5 rounded font-bold font-mono uppercase border ${SCOPE_STYLE[u.ScopeLevel] || SCOPE_STYLE.None}`}>{u.ScopeLevel}</span>
                          {!u.IsActive && <span className="text-[9px] px-2 py-0.5 rounded font-bold font-mono uppercase border bg-red-500/20 text-red-300 border-red-500/30">Deactivated</span>}
                        </div>
                        <p className="text-[11px] text-slate-300 mt-0.5">{u.OfficerName ?? "No officer record"}{u.Rank ? ` · ${u.Rank}` : ""}{u.BadgeNumber ? ` · ${u.BadgeNumber}` : ""}</p>
                        <p className="text-[11px] text-slate-500 font-mono">{u.Email}</p>
                      </div>
                      <div className="flex gap-2 flex-shrink-0">
                        <button onClick={() => { setConfigUser(u); setConfigRoleId(String(u.role?.RoleID ?? "")); setConfigError(null); }} disabled={u.UserID === me?.UserID}
                          title={u.UserID === me?.UserID ? "You cannot change your own role" : undefined}
                          className="bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-[10px] font-bold px-3 py-1.5 rounded-lg flex items-center gap-1 font-mono shadow">
                          <Sliders size={12} /><span>Role</span>
                        </button>
                        <button onClick={() => setResetFor(u)} className="bg-[#1e293b] hover:bg-[#334155] text-slate-200 text-[10px] font-bold px-3 py-1.5 rounded-lg font-mono">Reset password</button>
                        <button onClick={() => toggleActive.mutate(u)} disabled={u.UserID === me?.UserID || toggleActive.isPending}
                          className="bg-[#1e293b] hover:bg-[#334155] disabled:opacity-40 text-slate-200 text-[10px] font-bold px-3 py-1.5 rounded-lg font-mono">
                          {u.IsActive ? "Deactivate" : "Reactivate"}
                        </button>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[#1e293b] text-[10px] font-mono text-slate-400">
                      <div><span className="text-slate-500 block">ROLE</span><span className="text-slate-200 font-bold">{u.role?.RoleName ?? "none"}</span></div>
                      <div><span className="text-slate-500 block">CASE VISIBILITY</span><span className="text-emerald-400 font-bold">{u.ScopeDescription}</span></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === "system" && (
        <div className="space-y-6">
          {healthError && <div className="bg-red-500/10 border border-red-500/30 text-red-300 text-xs rounded-lg p-4 font-mono">{(healthError as any)?.response?.data?.detail || "System health could not be read."}</div>}
          {health?.database.fallback_active && (
            <div className="bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs rounded-lg p-4 font-mono flex items-center gap-2">
              <AlertTriangle size={16} />The primary database is unreachable; the platform is running on a local fallback database and any data entered now will not reach production.
            </div>
          )}

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 text-xs font-mono">
            {[
              ["Database", health ? `${health.database.dialect} · ${health.database.latency_ms} ms` : "…", health ? formatBytes(health.database.size_bytes) : ""],
              ["Cases scored by the current model", health ? `${health.scoring.scored_with_current_model.toLocaleString()} / ${health.scoring.cases.toLocaleString()}` : "…", "risk model coverage"],
              ["Similar-case index", health ? `${health.embeddings.embedded_cases.toLocaleString()} / ${health.embeddings.cases.toLocaleString()}` : "…", "FIRs embedded for narrative search"],
              ["Activity (24 h)", health ? `${health.activity_24h.audit_events} events` : "…", health ? `${health.activity_24h.ai_runs} AI runs · ${health.activity_24h.active_users} active users` : ""],
            ].map(([title, value, sub]) => (
              <div key={title} className="bg-[#111827] border border-[#1e293b] rounded-xl p-4">
                <span className="text-slate-500 text-[10px] uppercase block">{title}</span>
                <span className="text-slate-100 text-sm font-bold block mt-1">{value}</span>
                <span className="text-slate-500 text-[10px] block mt-0.5">{sub}</span>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="bg-[#111827] border border-[#1e293b] rounded-xl p-5 flex flex-col h-[480px] shadow-xl">
              <div className="flex items-center gap-2 border-b border-[#1e293b] pb-3 mb-4">
                <Database className="text-blue-500" size={18} />
                <h3 className="text-xs font-bold text-slate-300 font-mono uppercase tracking-wider">Tables</h3>
              </div>
              <div className="flex-1 overflow-y-auto space-y-2 pr-1 text-xs">
                {isHealthLoading ? <div className="text-center text-xs text-slate-500 py-6 font-mono">Reading the database…</div>
                  : (health?.tables ?? []).map((tb) => (
                    <div key={tb.table_name} className="p-3 bg-[#151c2e] border border-[#1e293b] rounded-lg flex justify-between items-center">
                      <div>
                        <h4 className="font-semibold text-slate-200 font-mono">{tb.table_name}</h4>
                        <p className="text-[10px] text-slate-500 mt-0.5 font-mono">{formatBytes(tb.size_bytes)}</p>
                      </div>
                      <span className="text-blue-400 font-mono font-bold">{tb.row_count.toLocaleString()} rows</span>
                    </div>
                  ))}
              </div>
            </div>

            <div className="bg-[#111827] border border-[#1e293b] rounded-xl p-5 flex flex-col h-[480px] shadow-xl">
              <div className="flex items-center gap-2 border-b border-[#1e293b] pb-3 mb-4">
                <Cpu className="text-blue-500" size={18} />
                <h3 className="text-xs font-bold text-slate-300 font-mono uppercase tracking-wider">Models and services</h3>
              </div>
              <div className="flex-1 overflow-y-auto space-y-2 pr-1 text-xs">
                {(health?.models ?? []).map((m) => (
                  <div key={m.name} className="p-3 bg-[#151c2e] border border-[#1e293b] rounded-lg">
                    <h4 className="font-semibold text-slate-200 font-mono">{m.name}</h4>
                    <p className="text-[10px] text-slate-400 mt-0.5 font-mono">{m.version}</p>
                    {m.detail?.cross_validated_accuracy != null && (
                      <p className="text-[10px] text-slate-500 mt-1 font-mono">
                        5-fold accuracy {(m.detail.cross_validated_accuracy * 100).toFixed(1)}% (guessing the most common class: {(m.detail.majority_class_accuracy * 100).toFixed(1)}%); trained {new Date(m.detail.trained_at).toLocaleDateString()} on {m.detail.trained_on?.rows?.toLocaleString()} labelled cases
                      </p>
                    )}
                  </div>
                ))}
                {health && (
                  <div className="p-3 bg-[#151c2e] border border-[#1e293b] rounded-lg">
                    <h4 className="font-semibold text-slate-200 font-mono flex items-center gap-1.5"><Activity size={13} />Language model</h4>
                    <p className={`text-[10px] mt-0.5 font-mono ${health.assistant.available ? "text-emerald-400" : "text-amber-400"}`}>
                      {!health.assistant.configured ? "No API key configured" : health.assistant.available ? `Available · ${health.assistant.models[0]} (+${health.assistant.models.length - 1} fallbacks)` : `Rate-limited${health.assistant.retry_in_seconds ? `, retry in about ${Math.ceil(health.assistant.retry_in_seconds / 60)} min` : ""}`}
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-[#111827] border border-[#1e293b] rounded-xl p-5 flex flex-col h-[480px] shadow-xl">
              <div className="flex items-center gap-2 border-b border-[#1e293b] pb-3 mb-4">
                <Terminal className="text-blue-500" size={18} />
                <h3 className="text-xs font-bold text-slate-300 font-mono uppercase tracking-wider">Audit trail (latest)</h3>
              </div>
              <div className="flex-1 overflow-y-auto space-y-2 pr-1 font-mono text-[10px] leading-relaxed text-slate-400">
                {isLogsLoading ? <div className="text-center text-xs text-slate-500 py-6">Loading…</div>
                  : (logs ?? []).length === 0 ? <div className="text-center text-xs text-slate-500 py-6">No audit entries.</div>
                  : (logs ?? []).map((log: any) => (
                    <div key={log.AuditLogID ?? `${log.Timestamp}-${log.Action}`} className="p-2.5 bg-[#090d16] border border-[#1e293b]/50 rounded-lg">
                      <span className="text-blue-400">{new Date(log.Timestamp).toLocaleString()}</span>{" "}
                      <span className="text-slate-200 font-bold">{log.Action}</span> · <span>{log.ModuleName}</span>
                      {log.ResourceID ? <> · <span className="text-slate-500">#{log.ResourceID}</span></> : null}
                      <span className="text-slate-500"> · {usernames.get(log.UserID) ?? (log.UserID ? `user #${log.UserID}` : "system")}</span>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {resetFor && (
        <PasswordDialog title={`Reset password: ${resetFor.Username}`} askCurrent={false}
          onSubmit={(_current, next) => adminService.resetPassword(resetFor.UserID, next)} onClose={() => setResetFor(null)} />
      )}

      {configUser && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#111827] border border-[#1e293b] rounded-xl w-[480px] p-6 space-y-5 shadow-2xl">
            <div className="flex justify-between items-center border-b border-[#1e293b] pb-3">
              <div className="flex items-center gap-2">
                <ShieldCheck size={20} className="text-blue-400" />
                <h3 className="text-sm font-bold text-slate-100 font-mono uppercase">Change role: {configUser.Username}</h3>
              </div>
              <button onClick={() => setConfigUser(null)} className="text-slate-400 hover:text-slate-200"><X size={18} /></button>
            </div>
            {configError && <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded-lg font-mono">{configError}</div>}
            <div className="space-y-3 text-xs font-mono">
              <select value={configRoleId} onChange={(e) => setConfigRoleId(e.target.value)} className="w-full bg-[#151c2e] border border-[#334155] rounded-lg px-3 py-2 text-slate-100 font-bold">
                {rolesList.map((r) => <option key={r.RoleID} value={r.RoleID}>{r.RoleName} — {r.ScopeLevel}</option>)}
              </select>
              {rolesList.find((r) => String(r.RoleID) === configRoleId) && (
                <div className="p-3 bg-[#151c2e] border border-[#1e293b] rounded-lg space-y-1 text-[11px] text-slate-400">
                  <p className="font-sans text-slate-300">{rolesList.find((r) => String(r.RoleID) === configRoleId)?.Description}</p>
                  <p>Permissions: <span className="text-slate-200">{rolesList.find((r) => String(r.RoleID) === configRoleId)?.Permissions.join(", ") || "none"}</span></p>
                </div>
              )}
              <p className="text-[10px] text-slate-500">Permissions come from the role; to change what a role allows, edit the role's permissions in the database. A user's own district or station posting does not change when the role does.</p>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setConfigUser(null)} className="bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold px-4 py-2 rounded-lg font-mono">Cancel</button>
              <button onClick={() => changeRole.mutate()} disabled={changeRole.isPending || String(configUser.role?.RoleID) === configRoleId}
                className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold px-5 py-2 rounded-lg font-mono shadow disabled:opacity-50">
                {changeRole.isPending ? "Saving…" : "Save role"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
