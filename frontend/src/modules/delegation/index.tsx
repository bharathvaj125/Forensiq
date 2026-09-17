import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { taskService, TaskDelegation } from "../../services/taskService";
import { caseService } from "../../services/caseService";
import {
  ClipboardList,
  Plus,
  UserCheck,
  CheckCircle2,
  Clock,
  AlertCircle,
  X,
  ChevronRight,
  Shield,
  Send,
  Sparkles,
  Package
} from "lucide-react";

import { useLanguage } from "../../app/providers/LanguageContext";

export default function TaskDelegationModule() {
  const { t } = useLanguage();
  const queryClient = useQueryClient();

  const [isAppointModalOpen, setIsAppointModalOpen] = useState(false);
  const [selectedTaskForTimeline, setSelectedTaskForTimeline] = useState<TaskDelegation | null>(null);
  const [filterStatus, setFilterStatus] = useState("all");

  // Form State
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [assignedToUserId, setAssignedToUserId] = useState<number | "">("");
  const [selectedCaseMasterId, setSelectedCaseMasterId] = useState<number | "">("");
  const [priority, setPriority] = useState("High");
  const [dueDate, setDueDate] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  // Evidence State
  const [evidenceType, setEvidenceType] = useState("CCTV Footage");
  const [evidenceDesc, setEvidenceDesc] = useState("");
  const [showAddEvidenceForm, setShowAddEvidenceForm] = useState(false);

  // Fetch cases accessible to appointing officer
  const { data: accessibleCases } = useQuery({
    queryKey: ["accessibleCasesList"],
    queryFn: () => caseService.getCases({ pageSize: 100 }),
  });

  const addEvidenceMutation = useMutation({
    mutationFn: ({ caseId, payload }: { caseId: number; payload: { EvidenceType: string; Description: string } }) =>
      caseService.addEvidence(caseId, payload),
    onSuccess: async (_, vars) => {
      if (selectedTaskForTimeline) {
        await taskService.updateTaskStatus(
          selectedTaskForTimeline.TaskID,
          "Evidence Collected",
          `Added Case Evidence (${vars.payload.EvidenceType}): ${vars.payload.Description}`
        );
      }
      queryClient.invalidateQueries({ queryKey: ["tasksAssignedByMe"] });
      setShowAddEvidenceForm(false);
      setEvidenceDesc("");
    },
  });

  // Fetch subordinate officers for selection
  const { data: officersList } = useQuery({
    queryKey: ["subordinateOfficers"],
    queryFn: () => taskService.getSubordinateOfficers(),
  });

  // Fetch tasks assigned by the logged-in superior officer
  const { data: appointedTasks, isLoading: isTasksLoading } = useQuery({
    queryKey: ["tasksAssignedByMe"],
    queryFn: () => taskService.getTasksAssignedByMe(),
    refetchInterval: 5000, // Real-time sync every 5s
  });

  // Mutation for appointing task
  const appointMutation = useMutation({
    mutationFn: taskService.appointTask,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasksAssignedByMe"] });
      setIsAppointModalOpen(false);
      setTitle("");
      setDescription("");
      setAssignedToUserId("");
      setPriority("High");
      setDueDate("");
      setFormError(null);
    },
    onError: (err: any) => {
      setFormError(err.response?.data?.detail || "Failed to appoint task.");
    }
  });

  const handleAppointSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !description || !assignedToUserId) {
      setFormError("Please fill in task title, description, and select a subordinate officer.");
      return;
    }

    appointMutation.mutate({
      Title: title,
      Description: description,
      AssignedToUserID: Number(assignedToUserId),
      CaseMasterID: selectedCaseMasterId ? Number(selectedCaseMasterId) : undefined,
      Priority: priority,
      DueDate: dueDate || undefined,
    });
  };

  const filteredTasks = appointedTasks?.filter((t) => {
    if (filterStatus === "all") return true;
    return t.Status.toLowerCase().replace(/\s+/g, "_") === filterStatus;
  }) || [];

  const totalAppointed = appointedTasks?.length || 0;
  const inProgressCount = appointedTasks?.filter((t) => t.Status === "In Progress" || t.Status === "Evidence Collected").length || 0;
  const underReviewCount = appointedTasks?.filter((t) => t.Status === "Under Review").length || 0;
  const completedCount = appointedTasks?.filter((t) => t.Status === "Completed").length || 0;

  const getPriorityBadge = (p: string) => {
    switch (p.toLowerCase()) {
      case "critical":
        return <span className="bg-red-500/10 border border-red-500/20 text-red-400 text-[10px] px-2 py-0.5 rounded font-mono font-bold uppercase">Critical 🔴</span>;
      case "high":
        return <span className="bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[10px] px-2 py-0.5 rounded font-mono font-bold uppercase">High 🟠</span>;
      case "medium":
        return <span className="bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[10px] px-2 py-0.5 rounded font-mono font-bold uppercase">Medium 🟡</span>;
      default:
        return <span className="bg-slate-500/10 border border-slate-500/20 text-slate-400 text-[10px] px-2 py-0.5 rounded font-mono font-bold uppercase">Low 🔵</span>;
    }
  };

  const getStatusBadge = (s: string) => {
    switch (s) {
      case "Completed":
        return <span className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs px-2.5 py-1 rounded font-bold font-mono">✅ Completed</span>;
      case "Under Review":
        return <span className="bg-purple-500/10 border border-purple-500/20 text-purple-400 text-xs px-2.5 py-1 rounded font-bold font-mono">🔍 Under Review</span>;
      case "Evidence Collected":
        return <span className="bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-xs px-2.5 py-1 rounded font-bold font-mono">📁 Evidence Collected</span>;
      case "In Progress":
        return <span className="bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs px-2.5 py-1 rounded font-bold font-mono">⏳ In Progress</span>;
      default:
        return <span className="bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs px-2.5 py-1 rounded font-bold font-mono">📌 Assigned</span>;
    }
  };

  return (
    <div className="space-y-6 select-none font-sans">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-[#111827] p-5 border border-[#1e293b] rounded-xl shadow-lg">
        <div>
          <div className="flex items-center gap-2">
            <ClipboardList className="text-blue-500" size={24} />
            <h1 className="text-xl font-bold tracking-tight text-slate-100">
              {t("task_portal_title")}
            </h1>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            {t("task_portal_sub")}
          </p>
        </div>

        <button
          onClick={() => setIsAppointModalOpen(true)}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white text-xs px-4 py-2.5 rounded-lg font-bold shadow-lg transition-all"
        >
          <Plus size={16} />
          <span>{t("task_appoint_btn")}</span>
        </button>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-[#111827] border border-[#1e293b] p-4 rounded-xl flex items-center justify-between">
          <div>
            <p className="text-[10px] font-mono text-slate-400 uppercase font-bold">{t("APPOINTED DIRECTIVES", "ನಿಯೋಜಿತ ನಿರ್ದೇಶನಗಳು")}</p>
            <p className="text-2xl font-black text-slate-100 font-mono mt-1">{totalAppointed}</p>
          </div>
          <div className="p-3 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20">
            <ClipboardList size={20} />
          </div>
        </div>

        <div className="bg-[#111827] border border-[#1e293b] p-4 rounded-xl flex items-center justify-between">
          <div>
            <p className="text-[10px] font-mono text-slate-400 uppercase font-bold">{t("IN FIELD PROGRESS", "ಸ್ಥಳೀಯ ತನಿಖೆಯಲ್ಲಿದೆ")}</p>
            <p className="text-2xl font-black text-blue-400 font-mono mt-1">{inProgressCount}</p>
          </div>
          <div className="p-3 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20">
            <Clock size={20} />
          </div>
        </div>

        <div className="bg-[#111827] border border-[#1e293b] p-4 rounded-xl flex items-center justify-between">
          <div>
            <p className="text-[10px] font-mono text-slate-400 uppercase font-bold">{t("UNDER REVIEW", "ಪರಿಶೀಲನೆಯಲ್ಲಿದೆ")}</p>
            <p className="text-2xl font-black text-purple-400 font-mono mt-1">{underReviewCount}</p>
          </div>
          <div className="p-3 rounded-lg bg-purple-500/10 text-purple-400 border border-purple-500/20">
            <AlertCircle size={20} />
          </div>
        </div>

        <div className="bg-[#111827] border border-[#1e293b] p-4 rounded-xl flex items-center justify-between">
          <div>
            <p className="text-[10px] font-mono text-slate-400 uppercase font-bold">{t("COMPLETED & VERIFIED", "ಪೂರ್ಣಗೊಂಡಿದೆ & ಪರಿಶೀಲಿಸಲಾಗಿದೆ")}</p>
            <p className="text-2xl font-black text-emerald-400 font-mono mt-1">{completedCount}</p>
          </div>
          <div className="p-3 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 size={20} />
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 border-b border-[#1e293b] pb-3">
        {[
          { id: "all", label: t("All Appointed Tasks", "ಎಲ್ಲಾ ನಿಯೋಜಿತ ಕಾರ್ಯಗಳು") },
          { id: "assigned", label: `📌 ${t("Assigned", "ನಿಯೋಜಿಸಲಾಗಿದೆ")}` },
          { id: "in_progress", label: `⏳ ${t("In Progress", "ಪ್ರಗತಿಯಲ್ಲಿದೆ")}` },
          { id: "evidence_collected", label: `📁 ${t("Evidence Collected", "ಸಾಕ್ಷ್ಯ ಸಂಗ್ರಹಿಸಲಾಗಿದೆ")}` },
          { id: "under_review", label: `🔍 ${t("Under Review", "ಪರಿಶೀಲನೆಯಲ್ಲಿದೆ")}` },
          { id: "completed", label: `✅ ${t("Completed", "ಪೂರ್ಣಗೊಂಡಿದೆ")}` },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setFilterStatus(tab.id)}
            className={`px-3 py-1.5 rounded text-xs font-bold font-mono transition-all ${
              filterStatus === tab.id
                ? "bg-blue-600/20 border border-blue-500/40 text-blue-400"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Appointed Tasks Directory */}
      <div className="bg-[#111827] border border-[#1e293b] rounded-xl p-5">
        {isTasksLoading ? (
          <div className="py-12 text-center text-slate-500 font-mono text-xs">
            Syncing Appointed Tasks & Operational Directives...
          </div>
        ) : filteredTasks.length === 0 ? (
          <div className="py-12 text-center text-slate-400 font-mono text-xs">
            No directives found under the selected filter. Click "Appoint Directive" to delegate a new task.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredTasks.map((task) => (
              <div
                key={task.TaskID}
                className="bg-[#151c2e] border border-[#1e293b] hover:border-blue-500/40 p-5 rounded-xl transition-all flex flex-col justify-between space-y-4"
              >
                <div>
                  <div className="flex justify-between items-start gap-2">
                    <h3 className="text-sm font-bold text-slate-100 leading-snug">{task.Title}</h3>
                    {getPriorityBadge(task.Priority)}
                  </div>
                  <p className="text-xs text-slate-400 mt-2 line-clamp-2 leading-relaxed">
                    {task.Description}
                  </p>
                </div>

                <div className="space-y-3 pt-3 border-t border-[#1e293b]">
                  <div className="flex items-center justify-between text-xs text-slate-300">
                    <span className="text-[10px] text-slate-500 font-mono uppercase font-bold">Appointed To:</span>
                    <span className="font-bold text-blue-400 flex items-center gap-1 font-mono">
                      <UserCheck size={12} />
                      {task.AssignedToUsername} ({task.AssignedToRank})
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[10px] text-slate-500 font-mono uppercase font-bold">Status:</span>
                    {getStatusBadge(task.Status)}
                  </div>

                  {task.DueDate && (
                    <div className="flex items-center justify-between text-xs text-slate-400">
                      <span className="text-[10px] text-slate-500 font-mono uppercase font-bold">Target Deadline:</span>
                      <span className="font-mono text-amber-400">{task.DueDate}</span>
                    </div>
                  )}

                  <button
                    onClick={() => setSelectedTaskForTimeline(task)}
                    className="w-full mt-2 flex items-center justify-center gap-2 bg-[#1e293b] hover:bg-[#334155] text-slate-200 text-xs py-2 rounded-lg font-bold font-mono transition-colors border border-slate-700"
                  >
                    <span>👁️ Execution Timeline ({task.timeline_events.length} Steps)</span>
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* APPOINT TASK MODAL */}
      {isAppointModalOpen && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#111827] border border-[#1e293b] rounded-xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <div className="flex justify-between items-center border-b border-[#1e293b] pb-3">
              <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <Shield size={18} className="text-blue-500" />
                Appoint Task / Operational Directive
              </h2>
              <button onClick={() => setIsAppointModalOpen(false)} className="text-slate-400 hover:text-slate-200">
                <X size={18} />
              </button>
            </div>

            {formError && (
              <div className="p-3 rounded bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-mono">
                {formError}
              </div>
            )}

            <form onSubmit={handleAppointSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-mono font-bold text-slate-300 uppercase mb-1">
                  1. Subordinate Officer Target *
                </label>
                <select
                  value={assignedToUserId}
                  onChange={(e) => setAssignedToUserId(Number(e.target.value))}
                  className="w-full bg-[#1e293b] border border-[#334155] text-slate-100 text-xs rounded px-3 py-2 focus:outline-none focus:border-blue-500 font-mono"
                  required
                >
                  <option value="">-- Select Officer Under Your Command --</option>
                  {officersList?.map((off: any) => (
                    <option key={off.UserID} value={off.UserID}>
                      {off.Username} ({off.Rank} | Badge #{off.BadgeNumber})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-mono font-bold text-slate-300 uppercase mb-1">
                  2. Link to Registered Case / FIR (Jurisdiction Filtered)
                </label>
                <select
                  value={selectedCaseMasterId}
                  onChange={(e) => setSelectedCaseMasterId(e.target.value ? Number(e.target.value) : "")}
                  className="w-full bg-[#1e293b] border border-[#334155] text-slate-100 text-xs rounded px-3 py-2 focus:outline-none focus:border-blue-500 font-mono"
                >
                  <option value="">-- No Specific Case Link (General Patrol Directive) --</option>
                  {accessibleCases?.data?.map((c: any) => (
                    <option key={c.CaseMasterID} value={c.CaseMasterID}>
                      Case #{c.CaseNo} — Priority: {c.InvestigationPriority || 'Standard'} (FIR Reg: {c.FIRDate || '2026'})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-mono font-bold text-slate-300 uppercase mb-1">
                  2. Directive Title *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Conduct Precinct Patrol & CCTV Audit at Shorapur"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full bg-[#1e293b] border border-[#334155] text-slate-100 text-xs rounded px-3 py-2 focus:outline-none focus:border-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-mono font-bold text-slate-300 uppercase mb-1">
                  3. Operational Instructions & Scope *
                </label>
                <textarea
                  rows={4}
                  placeholder="Provide precise instructions, evidence gathering requirements, and target checkpoints..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full bg-[#1e293b] border border-[#334155] text-slate-100 text-xs rounded px-3 py-2 focus:outline-none focus:border-blue-500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-mono font-bold text-slate-300 uppercase mb-1">
                    Priority Level
                  </label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value)}
                    className="w-full bg-[#1e293b] border border-[#334155] text-slate-100 text-xs rounded px-3 py-2 font-mono"
                  >
                    <option value="Critical">Critical 🔴</option>
                    <option value="High">High 🟠</option>
                    <option value="Medium">Medium 🟡</option>
                    <option value="Low">Low 🔵</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-mono font-bold text-slate-300 uppercase mb-1">
                    Target Due Date
                  </label>
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full bg-[#1e293b] border border-[#334155] text-slate-100 text-xs rounded px-3 py-2 font-mono"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-[#1e293b]">
                <button
                  type="button"
                  onClick={() => setIsAppointModalOpen(false)}
                  className="px-4 py-2 rounded text-xs text-slate-400 hover:text-slate-200 font-mono"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={appointMutation.isPending}
                  className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white text-xs px-4 py-2 rounded font-bold shadow-lg transition-colors font-mono"
                >
                  <Send size={14} />
                  <span>{appointMutation.isPending ? "Appointing..." : "Appoint Directive"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EXECUTION TIMELINE MODAL */}
      {selectedTaskForTimeline && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#111827] border border-[#1e293b] rounded-xl max-w-xl w-full p-6 space-y-4 shadow-2xl">
            <div className="flex justify-between items-center border-b border-[#1e293b] pb-3">
              <div>
                <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
                  <Sparkles size={18} className="text-blue-400" />
                  Directive Real-Time Execution Timeline
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">Task ID #{selectedTaskForTimeline.TaskID}: {selectedTaskForTimeline.Title}</p>
              </div>
              <button onClick={() => setSelectedTaskForTimeline(null)} className="text-slate-400 hover:text-slate-200">
                <X size={18} />
              </button>
            </div>

            <div className="bg-[#151c2e] p-4 rounded-lg border border-[#1e293b] space-y-2">
              <div className="flex justify-between text-xs text-slate-300 font-mono">
                <span>Appointed To: <strong className="text-blue-400">{selectedTaskForTimeline.AssignedToUsername} ({selectedTaskForTimeline.AssignedToRank})</strong></span>
                <span>Status: {getStatusBadge(selectedTaskForTimeline.Status)}</span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed bg-[#0d1322] p-3 rounded border border-slate-800">
                {selectedTaskForTimeline.Description}
              </p>
            </div>

            {/* ADD CASE EVIDENCE SECTION */}
            {selectedTaskForTimeline.CaseMasterID && (
              <div className="bg-[#151c2e] border border-blue-500/30 p-3.5 rounded-lg space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-blue-400 font-mono flex items-center gap-1.5 uppercase">
                    <Package size={14} />
                    Add Evidence Artifact for Case #{selectedTaskForTimeline.CaseNo || selectedTaskForTimeline.CaseMasterID}
                  </span>
                  <button
                    onClick={() => setShowAddEvidenceForm(!showAddEvidenceForm)}
                    className="text-[10px] bg-blue-600 hover:bg-blue-500 text-white px-2.5 py-1 rounded font-mono font-bold transition-colors"
                  >
                    {showAddEvidenceForm ? "Close Form" : "➕ Add Case Evidence"}
                  </button>
                </div>

                {showAddEvidenceForm && (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (!evidenceDesc || !selectedTaskForTimeline.CaseMasterID) return;
                      addEvidenceMutation.mutate({
                        caseId: selectedTaskForTimeline.CaseMasterID,
                        payload: { EvidenceType: evidenceType, Description: evidenceDesc }
                      });
                    }}
                    className="space-y-2 pt-2 border-t border-[#1e293b]"
                  >
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10px] font-mono text-slate-400 uppercase font-bold mb-1">Evidence Type</label>
                        <select
                          value={evidenceType}
                          onChange={(e) => setEvidenceType(e.target.value)}
                          className="w-full bg-[#1e293b] border border-[#334155] text-slate-100 text-xs rounded px-2.5 py-1 font-mono"
                        >
                          <option value="CCTV Footage">📹 CCTV Surveillance Footage</option>
                          <option value="Seizure Memo">📜 Physical Seizure Memo</option>
                          <option value="Forensic DNA Report">🧪 Forensic DNA & Lab Sample</option>
                          <option value="Recovered Weapon">🔪 Recovered Sharp Dagger / Weapon</option>
                          <option value="Digital Telemetry">📱 Mobile Tower / Call Telemetry</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] font-mono text-slate-400 uppercase font-bold mb-1">Evidence Description</label>
                        <input
                          type="text"
                          placeholder="e.g. Recovered DVR recorder unit #460"
                          value={evidenceDesc}
                          onChange={(e) => setEvidenceDesc(e.target.value)}
                          className="w-full bg-[#1e293b] border border-[#334155] text-slate-100 text-xs rounded px-2.5 py-1"
                          required
                        />
                      </div>
                    </div>
                    <div className="flex justify-end">
                      <button
                        type="submit"
                        disabled={addEvidenceMutation.isPending}
                        className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs px-3 py-1 rounded font-bold font-mono transition-colors"
                      >
                        {addEvidenceMutation.isPending ? "Logging..." : "Submit Evidence & Log Timeline"}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            )}

            {/* Stepper Timeline List */}
            <div className="space-y-4 max-h-72 overflow-y-auto pr-2">
              {selectedTaskForTimeline.timeline_events.length === 0 ? (
                <div className="text-xs text-slate-500 font-mono py-4 text-center">No timeline events logged yet.</div>
              ) : (
                selectedTaskForTimeline.timeline_events.map((ev, idx) => (
                  <div key={ev.EventID} className="flex gap-4 relative">
                    {/* Line connector */}
                    {idx !== selectedTaskForTimeline.timeline_events.length - 1 && (
                      <div className="absolute left-3.5 top-6 bottom-0 w-0.5 bg-[#1e293b]" />
                    )}
                    <div className="w-7 h-7 rounded-full bg-blue-600/20 border border-blue-500/40 text-blue-400 flex items-center justify-center text-xs font-mono font-bold flex-shrink-0 z-10">
                      {idx + 1}
                    </div>
                    <div className="flex-1 bg-[#151c2e] border border-[#1e293b] p-3 rounded-lg space-y-1">
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-bold text-slate-200 font-mono">{ev.Status}</span>
                        <span className="text-[10px] text-slate-500 font-mono">
                          {new Date(ev.Timestamp).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 font-sans">{ev.Note}</p>
                      <div className="text-[10px] text-slate-500 font-mono pt-1">
                        Updated By: <span className="text-slate-300 font-bold">{ev.UpdatedByUsername}</span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="flex justify-end pt-3 border-t border-[#1e293b]">
              <button
                onClick={() => setSelectedTaskForTimeline(null)}
                className="bg-[#1e293b] hover:bg-[#334155] text-slate-200 text-xs px-4 py-2 rounded font-bold font-mono transition-colors"
              >
                Close Timeline
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
