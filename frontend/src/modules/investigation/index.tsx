import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { caseService } from "../../services/caseService";
import { API_BASE_URL } from "../../services/apiClient";
import { intelligenceService } from "../../services/intelligenceService";
import { useReferenceOptions } from "../../services/referenceService";
import DataTable from "../../components/common/DataTable";
import ExplanationCard from "../../components/charts/ExplanationCard";
import NetworkGraphCanvas from "../../components/graph/NetworkGraphCanvas";
import {
  FileText,
  User,
  Shield,
  Clock,
  Search,
  Package,
  FolderOpen,
  Share2,
  Compass,
  ClipboardList,
  Send,
  X,
  Sparkles,
  Upload,
  Plus,
  AlertCircle,
  Eye,
  Download,
  CheckCircle
} from "lucide-react";
import { taskService, TaskDelegation } from "../../services/taskService";
import FirRegistrationModal from "./FirRegistrationModal";

import { useAuth } from "../../app/providers/AuthProvider";
import { useLanguage } from "../../app/providers/LanguageContext";

export default function Investigation() {
  const { user } = useAuth();
  const { t, translateData } = useLanguage();
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Authority comes from the role's permissions as the server enforces them, not from guessing at usernames.
  const roleName = user?.role?.RoleName || "";
  const isConstable = roleName === "Constable"; // station-bounded by the server
  const canRegisterFIR = !!user?.Permissions?.includes("cases:create");

  const caseId = id ? parseInt(id) : null;
  const [activeSubTab, setActiveSubTab] = useState("overview");
  const [selectedCompareCase, setSelectedCompareCase] = useState<any>(null);
  const [workspaceTab, setWorkspaceTab] = useState<"workspace" | "cases">("cases");

  // Evidence Upload & Preview State
  const [selectedEvidenceForPreview, setSelectedEvidenceForPreview] = useState<any>(null);
  const [isUploadEvidenceModalOpen, setIsUploadEvidenceModalOpen] = useState(false);
  const [evidenceTypeInput, setEvidenceTypeInput] = useState("");
  const [evidenceDescInput, setEvidenceDescInput] = useState("");
  const [evidenceFileInput, setEvidenceFileInput] = useState<File | null>(null);
  const [evidenceUploadError, setEvidenceUploadError] = useState<string | null>(null);

  // FIR registration lives in FirRegistrationModal; this page only opens it and reports the outcome.
  const [isRegisterIncidentModalOpen, setIsRegisterIncidentModalOpen] = useState(false);
  const [registerSuccessToast, setRegisterSuccessToast] = useState<string | null>(null);

  const handleFirRegistered = (newCaseId: number, caseNo: string) => {
    setIsRegisterIncidentModalOpen(false);
    setRegisterSuccessToast(`${t("FIR registered", "ಎಫ್.ಐ.ಆರ್ ನೋಂದಾಯಿಸಲಾಗಿದೆ")}: ${caseNo}`);
    setTimeout(() => setRegisterSuccessToast(null), 6000);
    navigate(`/cases/${newCaseId}`);
  };

  const getFullMediaUrl = (url?: string) => {
    if (!url) return "";
    if (url.startsWith("http://") || url.startsWith("https://")) return url;
    return `${new URL(API_BASE_URL, window.location.origin).origin}${url}`;
  };

  const uploadEvidenceMutation = useMutation({
    mutationFn: async ({ caseId, file, type, desc }: { caseId: number; file: File | null; type: string; desc: string }) => {
      if (file) {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("evidence_type", type);
        formData.append("description", desc);
        return caseService.uploadEvidenceFile(caseId, formData);
      } else {
        return caseService.addEvidence(caseId, { EvidenceType: type, Description: desc });
      }
    },
    onSuccess: () => {
      if (caseId) {
        queryClient.invalidateQueries({ queryKey: ["caseEvidence", caseId] });
      }
      setIsUploadEvidenceModalOpen(false);
      setEvidenceTypeInput("");
      setEvidenceDescInput("");
      setEvidenceFileInput(null);
      setEvidenceUploadError(null);
    },
    onError: (err: any) => {
      setEvidenceUploadError(
        err.response?.data?.detail || "Failed to upload evidence. Ensure you are assigned to this case."
      );
    }
  });

  // Assigned Tasks State
  const [selectedTaskToUpdate, setSelectedTaskToUpdate] = useState<TaskDelegation | null>(null);
  const [newStatus, setNewStatus] = useState("In Progress");
  const [statusNote, setStatusNote] = useState("");

  const { data: myTasks } = useQuery({
    queryKey: ["myAssignedTasks"],
    queryFn: () => taskService.getTasksAssignedToMe(),
    refetchInterval: 30000,
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ taskId, status, note }: { taskId: number; status: string; note?: string }) =>
      taskService.updateTaskStatus(taskId, status, note),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["myAssignedTasks"] });
      setSelectedTaskToUpdate(null);
      setStatusNote("");
    },
  });

  // Query search & filters
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [districtId, setDistrictId] = useState("");
  const [crimeCategory, setCrimeCategory] = useState("");
  const [riskCategory, setRiskCategory] = useState("all");
  const [sortBy, setSortBy] = useState("date_desc");
  const reference = useReferenceOptions();
  const gravityName = (id: number | null | undefined) => reference.gravity_levels.find((g) => g.id === id)?.name ?? (id ? `Level ${id}` : "—");
  const crimeHeadName = (id: number | null | undefined) => reference.crime_heads.find((c) => c.id === id)?.name ?? (id ? `#${id}` : "—");
  const statusName = (id: number | null | undefined) => reference.case_statuses.find((c) => c.id === id)?.name ?? (id ? `#${id}` : "—");
  const genderName = (id: number | null | undefined) => reference.genders.find((g) => g.id === id)?.name ?? "—";

  // Fetch Cases list; the "category" dropdown maps to server-side filters over every case, not just the page shown.
  const { data: listData, isLoading: isListLoading } = useQuery({
    queryKey: ["casesList", page, search, districtId, crimeCategory, riskCategory, sortBy],
    queryFn: () =>
      caseService.getCases({
        page,
        pageSize: 25,
        search: search.trim() || undefined,
        districtId: districtId ? parseInt(districtId) : undefined,
        crimeCategory: crimeCategory || undefined,
        riskLevel: riskCategory === "risk" ? "High,Severe" : undefined,
        statusGroup: riskCategory === "pending" ? "open" : riskCategory === "finished" ? "closed" : undefined,
        sortBy: sortBy,
      }),
    enabled: !caseId,
  });

  // Fetch Case Details
  const { data: caseDetails, isLoading: isDetailsLoading } = useQuery({
    queryKey: ["caseDetails", caseId],
    queryFn: () => caseService.getCaseDetails(caseId!),
    enabled: !!caseId,
  });

  // Fetch Case Accused
  const { data: accusedData } = useQuery({
    queryKey: ["caseAccused", caseId],
    queryFn: () => caseService.getCaseAccused(caseId!),
    enabled: !!caseId && (activeSubTab === "people" || activeSubTab === "network"),
  });

  // Fetch Case Victims
  const { data: victimsData } = useQuery({
    queryKey: ["caseVictims", caseId],
    queryFn: () => caseService.getCaseVictims(caseId!),
    enabled: !!caseId && (activeSubTab === "people" || activeSubTab === "network"),
  });

  // Fetch Case Evidence
  const { data: evidenceData } = useQuery({
    queryKey: ["caseEvidence", caseId],
    queryFn: () => caseService.getCaseEvidence(caseId!),
    enabled: !!caseId && (activeSubTab === "evidence" || activeSubTab === "network"),
  });

  // Fetch Case Vehicles
  const { data: vehiclesData } = useQuery({
    queryKey: ["caseVehicles", caseId],
    queryFn: () => caseService.getCaseVehicles(caseId!),
    enabled: !!caseId && (activeSubTab === "evidence" || activeSubTab === "network"),
  });

  // Fetch Case Witnesses
  const { data: witnessesData } = useQuery({
    queryKey: ["caseWitnesses", caseId],
    queryFn: () => caseService.getCaseWitnesses(caseId!),
    enabled: !!caseId && (activeSubTab === "evidence" || activeSubTab === "network"),
  });

  // Chronology built by the server from the case's dates, audit trail, assignments, evidence and notes
  const { data: timelineData, isLoading: isTimelineLoading } = useQuery({
    queryKey: ["caseTimeline", caseId],
    queryFn: () => caseService.getCaseTimeline(caseId!),
    enabled: !!caseId && activeSubTab === "timeline",
  });

  // Fetch AI Risk Scorer details
  const { data: aiRiskData, isLoading: isRiskLoading, error: riskError } = useQuery({
    queryKey: ["caseRisk", caseId],
    queryFn: () => intelligenceService.predictCaseRisk(caseId!),
    enabled: !!caseId && activeSubTab === "ai",
    retry: false,
  });

  // Fetch Similar Cases
  const { data: similarCasesData, isLoading: isSimilarLoading } = useQuery({
    queryKey: ["similarCases", caseId],
    queryFn: () => intelligenceService.getSimilarCases(caseId!),
    enabled: !!caseId && activeSubTab === "similar",
  });



  // Index more FIRs for similar-case search (resumable; the server reports how many remain and why it stopped)
  const [embedNote, setEmbedNote] = useState<string | null>(null);
  const backfillMutation = useMutation({
    mutationFn: () => intelligenceService.backfillEmbeddings(),
    onSuccess: (result: any) => {
      setEmbedNote(`${result.Created ?? 0} FIRs indexed with ${result.ModelName}.${result.Pending != null ? ` ${result.Pending} still pending.` : ""}${result.Note ? ` ${result.Note}` : ""}`);
      queryClient.invalidateQueries({ queryKey: ["similarCases"] });
    },
    onError: (err: any) => setEmbedNote(err?.response?.data?.detail || "Indexing failed."),
  });

  // Case actions: status, priority and journal notes (the server enforces who may do what)
  const canUpdateCase = !!user?.Permissions?.includes("cases:update");
  const canAnnotate = !!user?.Permissions?.includes("cases:annotate");
  const [actionNote, setActionNote] = useState("");
  const [noteCategory, setNoteCategory] = useState("General Note");
  const [actionError, setActionError] = useState<string | null>(null);
  const refreshCase = () => {
    queryClient.invalidateQueries({ queryKey: ["caseDetails", caseId] });
    queryClient.invalidateQueries({ queryKey: ["caseTimeline", caseId] });
    queryClient.invalidateQueries({ queryKey: ["casesList"] });
    setActionError(null);
  };
  const failure = (err: any) => setActionError(err?.response?.data?.detail || "The change could not be saved.");
  const statusMutation = useMutation({ mutationFn: (statusId: number) => caseService.updateCaseStatus(caseId!, statusId), onSuccess: refreshCase, onError: failure });
  const priorityMutation = useMutation({ mutationFn: (priority: string) => caseService.updateCasePriority(caseId!, priority), onSuccess: refreshCase, onError: failure });
  const noteMutation = useMutation({
    mutationFn: () => caseService.addAnnotation(caseId!, { NotesText: actionNote.trim(), Category: noteCategory }),
    onSuccess: () => { setActionNote(""); refreshCase(); },
    onError: failure,
  });

  const renderRegisterFirModal = () => (
    <>
      {registerSuccessToast && (
        <div className="fixed top-5 right-5 bg-emerald-600 text-white font-mono text-xs px-4 py-3 rounded-lg shadow-2xl z-50 flex items-center gap-2">
          <CheckCircle size={18} />
          <span>{registerSuccessToast}</span>
        </div>
      )}
      <FirRegistrationModal open={isRegisterIncidentModalOpen} onClose={() => setIsRegisterIncidentModalOpen(false)} onRegistered={handleFirRegistered} />
    </>
  );

  if (!caseId) {
    // ----------------------------------------------------
    // CASE LIST VIEW
    // ----------------------------------------------------
    const RISK_BADGE: Record<string, string> = {
      Severe: "bg-red-500/10 text-red-400 border-red-500/20", High: "bg-orange-500/10 text-orange-400 border-orange-500/20",
      Medium: "bg-amber-500/10 text-amber-400 border-amber-500/20", Low: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    };
    const columns = [
      { header: t("Case Number", "ಪ್ರಕರಣ ಸಂಖ್ಯೆ"), accessorKey: "CaseNo", render: (r: any) => <span className="text-blue-400 font-bold font-mono">{r.CaseNo}</span> },
      { header: t("Reg Date", "ನೋಂದಾಯಿತ ದಿನಾಂಕ"), accessorKey: "CrimeRegisteredDate" },
      { header: t("Status", "ಸ್ಥಿತಿ"), accessorKey: "CaseStatusID", render: (r: any) => <span className="text-slate-300">{translateData(statusName(r.CaseStatusID))}</span> },
      { header: t("Priority", "ಆದ್ಯತೆ"), accessorKey: "InvestigationPriority", render: (r: any) => (
          r.InvestigationPriority
            ? <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono border font-bold ${RISK_BADGE[r.InvestigationPriority] || RISK_BADGE.Low}`}>{translateData(r.InvestigationPriority)}</span>
            : <span className="text-slate-600">—</span>
        )
      },
      { header: t("Gravity", "ಗಂಭೀರತೆ"), accessorKey: "GravityOffenceID", render: (r: any) => <span className="font-mono text-slate-300">{gravityName(r.GravityOffenceID)}</span> },
      { header: t("AI Risk", "ಎಐ ಅಪಾಯ"), accessorKey: "AIRiskScore", render: (r: any) => (
          r.AIRiskLevel
            ? <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono border font-bold ${RISK_BADGE[r.AIRiskLevel] || ""}`} title={r.AIRiskScore != null ? `Risk index ${Math.round(r.AIRiskScore * 100)} out of 100 (Low is near 0, Medium near 33, High near 67, Severe near 100)` : undefined}>{r.AIRiskLevel}{r.AIRiskScore != null ? ` · ${Math.round(r.AIRiskScore * 100)}/100` : ""}</span>
            : <span className="text-slate-600" title="Not scored yet">—</span>
        )
      },
      { header: t("Brief Facts", "ಅಪರಾಧ ಸಾರಾಂಶ"), accessorKey: "BriefFacts", render: (r: any) => <p className="truncate max-w-sm">{translateData(r.BriefFacts)}</p> }
    ];

    return (
      <div className="space-y-5 h-full flex flex-col select-none">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-100 flex items-center gap-2">
              <Shield className="text-blue-500" size={22} />
              Officer Workspace & Operational Command
            </h1>
            <p className="text-xs text-slate-400 mt-1">Manage assigned operational directives, execute tasks, and inspect jurisdiction case files</p>
          </div>

          {/* TAB BAR FOR OFFICER WORKSPACE VS CASE REGISTRY */}
          <div className="flex flex-wrap items-center gap-2">
            {canRegisterFIR && (
              <button
                onClick={() => setIsRegisterIncidentModalOpen(true)}
                className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-mono text-xs font-bold px-3 py-2 rounded-lg transition-all shadow-lg shadow-emerald-600/30"
              >
                <Plus size={15} />
                <span>{t("Register Incident / FIR", "ಅಪರಾಧ ಪ್ರಕರಣ ನೋಂದಾಯಿಸಿ")}</span>
              </button>
            )}

            <div className="flex gap-1.5 bg-[#111827] border border-[#1e293b] p-1 rounded-lg text-xs font-mono">
              <button
                onClick={() => setWorkspaceTab("workspace")}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-md font-bold transition-all ${
                  workspaceTab === "workspace"
                    ? "bg-blue-600 text-white shadow-md shadow-blue-600/30"
                    : "text-slate-400 hover:text-slate-200 hover:bg-[#1e293b]"
                }`}
              >
                <ClipboardList size={14} />
                <span>📌 {t("My Assigned Directives", "ನಿಯೋಜಿತ ನಿರ್ದೇಶನಗಳು")} ({myTasks?.length || 0})</span>
              </button>

              <button
                onClick={() => setWorkspaceTab("cases")}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-md font-bold transition-all ${
                  workspaceTab === "cases"
                    ? "bg-blue-600 text-white shadow-md shadow-blue-600/30"
                    : "text-slate-400 hover:text-slate-200 hover:bg-[#1e293b]"
                }`}
              >
                <FileText size={14} />
                <span>📁 {t("Case Registry Files", "ಪ್ರಕರಣಗಳ ರಿಜಿಸ್ಟ್ರಿ ಫೈಲ್‌ಗಳು")}</span>
              </button>
            </div>
          </div>
        </div>

        {/* WORKSPACE DIRECTIVES TAB */}
        {workspaceTab === "workspace" && (
          <div className="space-y-4">
            <div className="bg-[#111827] border border-blue-500/30 p-5 rounded-xl space-y-4 shadow-xl">
              <div className="flex justify-between items-center border-b border-[#1e293b] pb-3">
                <div className="flex items-center gap-2">
                  <ClipboardList className="text-blue-400" size={20} />
                  <h3 className="text-sm font-bold text-slate-100 font-mono uppercase tracking-wider">
                    Operational Tasks & Directives Appointed to You ({myTasks?.length || 0})
                  </h3>
                </div>
                <span className="text-xs bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2.5 py-1 rounded-md font-mono font-bold flex items-center gap-1.5">
                  <Sparkles size={13} />
                  Real-Time Workspace Sync
                </span>
              </div>

              {!myTasks || myTasks.length === 0 ? (
                <div className="py-12 text-center text-slate-500 font-mono text-xs space-y-2">
                  <Shield size={32} className="mx-auto text-slate-600 mb-2" />
                  <p className="text-slate-300 font-bold">No active directives assigned to your officer account.</p>
                  <p className="text-slate-500">Tasks appointed by superior officers (DGP, SP, DySP) will appear here in real-time.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {myTasks.map((t) => (
                    <div
                      key={t.TaskID}
                      className="bg-[#151c2e] border border-[#1e293b] hover:border-blue-500/60 p-4 rounded-xl space-y-3 flex flex-col justify-between transition-all shadow-md group"
                    >
                      <div>
                        <div className="flex justify-between items-start gap-2">
                          <h4 className="text-sm font-bold text-slate-100 group-hover:text-blue-400 transition-colors leading-snug">{t.Title}</h4>
                          <span className={`text-[10px] px-2 py-0.5 rounded-md font-mono font-bold uppercase flex-shrink-0 ${
                            t.Status === 'Completed' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                          }`}>
                            {t.Status}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 line-clamp-3 mt-2 leading-relaxed bg-[#0d1322] p-2.5 rounded border border-slate-800/80">
                          {t.Description}
                        </p>
                        {t.CaseNo && (
                          <div className="mt-2 text-[10px] text-blue-400 font-mono font-bold flex items-center gap-1">
                            <FileText size={12} />
                            <span>Linked Case #{t.CaseNo}</span>
                          </div>
                        )}
                      </div>

                      <div className="pt-3 border-t border-[#1e293b] flex justify-between items-center text-xs">
                        <div className="text-[11px] text-slate-400 font-mono">
                          Appointed by: <strong className="text-blue-400">{t.AssignedByUsername}</strong>
                          <span className="block text-[9px] text-slate-500">{t.AssignedByRank}</span>
                        </div>
                        <button
                          onClick={() => {
                            setSelectedTaskToUpdate(t);
                            setNewStatus(t.Status);
                          }}
                          className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold px-3 py-1.5 rounded-lg font-mono shadow-md transition-all flex items-center gap-1"
                        >
                          <Clock size={13} />
                          <span>Update Timeline</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* CASE REGISTRY TAB */}
        {workspaceTab === "cases" && (
          <>

        {/* Filter controls bar */}
        <div className="bg-[#111827] border border-[#1e293b] rounded p-4 flex flex-wrap gap-4 items-center">
          <div className="relative flex-1 min-w-[200px]">
            <input
              type="text"
              placeholder="Search by Case Number or Brief Facts..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="w-full bg-[#1e293b] border border-[#1e293b] text-slate-200 text-xs rounded pl-9 pr-4 py-2 focus:outline-none focus:border-blue-500"
            />
            <Search className="absolute left-3 top-2.5 text-slate-500" size={14} />
          </div>

          <div className="flex flex-wrap gap-3">
            {/* District filter; station-level officers are already restricted by the server to their precinct */}
            {!isConstable ? (
              <select
                value={districtId}
                onChange={(e) => { setDistrictId(e.target.value); setPage(1); }}
                className="bg-[#1e293b] border border-[#334155] text-slate-200 text-xs rounded px-3 py-2 focus:outline-none font-mono font-bold"
              >
                <option value="">{t("All districts", "ಎಲ್ಲಾ ಜಿಲ್ಲೆಗಳು")} ({reference.districts.length || "…"})</option>
                {reference.districts.map((d) => (
                  <option key={d.id} value={d.id}>{translateData(d.name)}</option>
                ))}
              </select>
            ) : (
              <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-3 py-2 rounded text-xs font-mono font-bold">
                👮 {t("Showing the cases in your jurisdiction", "ನಿಮ್ಮ ವ್ಯಾಪ್ತಿಯ ಪ್ರಕರಣಗಳು")}
              </div>
            )}

            <select
              value={crimeCategory}
              onChange={(e) => { setCrimeCategory(e.target.value); setPage(1); }}
              className="bg-[#1e293b] border border-[#334155] text-slate-200 text-xs rounded px-3 py-2 focus:outline-none font-mono font-bold"
            >
              <option value="">{t("All crime types", "ಎಲ್ಲಾ ಅಪರಾಧ ವಿಧಗಳು")}</option>
              {reference.crime_heads.map((c) => <option key={c.id} value={c.id}>{translateData(c.name)}</option>)}
            </select>

            {/* Category filter */}
            <select
              value={riskCategory}
              onChange={(e) => {
                const cat = e.target.value;
                setRiskCategory(cat);
                setPage(1);
                if (cat === "risk") setSortBy("risk_desc");
                else if (sortBy.startsWith("risk")) setSortBy("date_desc");
              }}
              className="bg-[#1e293b] border border-[#334155] text-slate-200 text-xs rounded px-3 py-2 focus:outline-none font-mono font-bold"
            >
              <option value="all">📋 {t("All cases", "ಎಲ್ಲಾ ಪ್ರಕರಣಗಳು")}</option>
              <option value="risk">🛡️ {t("AI high / severe risk", "ಎಐ ಹೆಚ್ಚು / ತೀವ್ರ ಅಪಾಯ")}</option>
              <option value="pending">⏳ {t("Open cases", "ತೆರೆದಿರುವ ಪ್ರಕರಣಗಳು")}</option>
              <option value="finished">✅ {t("Closed / disposed", "ಮುಕ್ತಾಯ / ವಿಲೇವಾರಿ")}</option>
            </select>

            {/* Sorting Sub-Filter */}
            <select
              value={sortBy}
              onChange={(e) => { setSortBy(e.target.value); setPage(1); }}
              className="bg-[#1e293b] border border-[#334155] text-slate-200 text-xs rounded px-3 py-2 focus:outline-none font-mono font-bold"
            >
              {riskCategory === "risk" ? (
                <>
                  <option value="risk_desc">⚡ Risk: High to Low</option>
                  <option value="risk_asc">⚡ Risk: Low to High</option>
                </>
              ) : (
                <>
                  <option value="date_desc">📅 Date: Newest to Oldest</option>
                  <option value="date_asc">📅 Oldest to Newest</option>
                </>
              )}
            </select>
          </div>
        </div>

        {/* Grid List Table */}
        <div className="flex-1 min-h-0">
          <DataTable
            columns={columns}
            data={listData?.data || []}
            loading={isListLoading}
            onRowClick={(row) => navigate(`/cases/${row.CaseMasterID}`)}
            meta={listData?.meta}
            onPageChange={(p) => setPage(p)}
          />
        </div>
        </>
      )}
        {renderRegisterFirModal()}
      </div>
    );
  }

  // ----------------------------------------------------
  // CASE DETAIL INTELLIGENCE VIEW
  // ----------------------------------------------------
  if (isDetailsLoading) {
    return <div className="text-center py-12 text-slate-500 font-mono">Decrypting Case File Metadata...</div>;
  }

  if (!caseDetails) {
    return (
      <div className="bg-[#111827] border border-[#1e293b] rounded p-8 text-center max-w-lg mx-auto my-12 space-y-4 shadow-2xl select-none">
        <div className="w-12 h-12 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mx-auto">
          <Shield size={24} />
        </div>
        <h3 className="text-sm font-bold text-slate-200 font-mono uppercase tracking-wider">Precinct Jurisdiction Access Restricted</h3>
        <p className="text-xs text-slate-400 leading-relaxed font-sans">
          Case #{caseId} is registered under an external division boundary outside your active officer jurisdiction scope.
        </p>
        <div className="flex justify-center gap-3 pt-2">
          <button onClick={() => navigate("/collaboration")} className="bg-blue-600 hover:bg-blue-700 text-white text-xs px-3.5 py-2 rounded font-bold font-mono transition-colors">
            Request Cross-District Access
          </button>
          <button onClick={() => navigate("/cases")} className="bg-[#1e293b] hover:bg-[#334155] text-slate-300 text-xs px-3.5 py-2 rounded font-mono transition-colors">
            Back to Registry
          </button>
        </div>
      </div>
    );
  }

  const tabs = [
    { id: "overview", label: t("tab_overview"), icon: FileText },
    { id: "people", label: t("tab_people"), icon: User },
    { id: "evidence", label: t("tab_evidence"), icon: Package },
    { id: "ai", label: t("tab_ai"), icon: Shield },
    { id: "network", label: t("tab_network"), icon: Share2 },
    { id: "timeline", label: t("tab_timeline"), icon: Clock },
    { id: "similar", label: t("tab_similar"), icon: FolderOpen },
  ];

  return (
    <div className="space-y-6 select-none h-full flex flex-col">
      {/* Header Info */}
      <div className="flex justify-between items-start border-b border-[#1e293b] pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] bg-blue-500/10 border border-blue-500/20 text-blue-400 px-2 py-0.5 rounded font-mono uppercase tracking-wider">
              Priority: {caseDetails.InvestigationPriority || "not set"}
            </span>
            <span className="text-[10px] bg-slate-500/10 border border-slate-500/20 text-slate-300 px-2 py-0.5 rounded font-mono uppercase tracking-wider">
              Status: {translateData(statusName(caseDetails.CaseStatusID))}
            </span>
            <span className="text-[10px] bg-red-500/10 border border-red-500/20 text-red-400 px-2 py-0.5 rounded font-mono uppercase tracking-wider">
              Sensitivity: {caseDetails.CaseSensitivity || "Standard"}
            </span>
          </div>
          <h1 className="text-xl font-bold tracking-tight text-slate-100 mt-2 flex items-center gap-2">
            Case Details: <span className="font-mono text-blue-400 font-extrabold">{caseDetails.CaseNo}</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">{translateData(crimeHeadName(caseDetails.CrimeMajorHeadID))} · {gravityName(caseDetails.GravityOffenceID)}</p>
        </div>

        <button
          onClick={() => navigate("/cases")}
          className="text-xs border border-slate-700 hover:border-slate-500 text-slate-300 px-3 py-1.5 rounded transition-colors"
        >
          Back to Registry
        </button>
      </div>

      {/* Tabs list */}
      <div className="flex border-b border-[#1e293b] gap-2 overflow-x-auto">
        {tabs.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setActiveSubTab(t.id)}
              className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold uppercase tracking-wider border-b-2 transition-colors focus:outline-none ${
                activeSubTab === t.id
                  ? "border-blue-500 text-blue-400"
                  : "border-transparent text-slate-400 hover:text-slate-200"
              }`}
            >
              <Icon size={14} />
              <span>{t.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab Panels content */}
      <div className="flex-1 overflow-auto min-h-0 bg-[#0d1322] border border-[#1e293b] rounded p-6">
        {/* OVERVIEW PANEL */}
        {activeSubTab === "overview" && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 text-xs">
              <div>
                <span className="text-slate-500 uppercase tracking-wide font-mono block">Crime Register No</span>
                <span className="text-slate-200 font-bold block mt-1 font-mono">{caseDetails.CrimeNo}</span>
              </div>
              <div>
                <span className="text-slate-500 uppercase tracking-wide font-mono block">Registered Date</span>
                <span className="text-slate-200 block mt-1 font-mono">{caseDetails.CrimeRegisteredDate}</span>
              </div>
              <div>
                <span className="text-slate-500 uppercase tracking-wide font-mono block">Incident Start</span>
                <span className="text-slate-200 block mt-1 font-mono">{new Date(caseDetails.IncidentFromDate).toLocaleString()}</span>
              </div>
              <div>
                <span className="text-slate-500 uppercase tracking-wide font-mono block">GPS Coordinates</span>
                <span className="text-slate-200 block mt-1 font-mono">
                  {caseDetails.latitude.toFixed(5)}° N, {caseDetails.longitude.toFixed(5)}° E
                </span>
              </div>
            </div>

            <div className="border-t border-[#1e293b] pt-5">
              <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2 font-mono">
                Official Brief Facts Narrative
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed font-sans bg-[#111827] border border-[#1e293b] p-4 rounded">
                {translateData(caseDetails.BriefFacts)}
              </p>
            </div>
          </div>
        )}

        {/* PEOPLE PANEL */}
        {activeSubTab === "people" && (
          <div className="space-y-6">
            <div>
              <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-3 font-mono">
                Accused Profiles & Entities
              </h3>
              <div className="border border-[#1e293b] rounded bg-[#111827] overflow-hidden">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-[#0f1524] border-b border-[#1e293b] text-slate-400">
                      <th className="px-4 py-2.5">Name</th>
                      <th className="px-4 py-2.5">Age/Gender</th>
                      <th className="px-4 py-2.5">Occupation</th>
                      <th className="px-4 py-2.5">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1e293b] text-slate-300">
                    {accusedData?.map((a: any, idx: number) => (
                      <tr key={idx}>
                        <td className="px-4 py-2.5 font-bold text-slate-100">{a.AccusedName}</td>
                        <td className="px-4 py-2.5">{a.AgeYear != null ? `${a.AgeYear} yrs` : "age n/a"} / {genderName(a.GenderID)}</td>
                        <td className="px-4 py-2.5">{a.Occupation || "Unspecified"}</td>
                        <td className="px-4 py-2.5">
                          {a.IsRepeatOffender ? (
                            <span className="bg-red-500/10 text-red-400 border border-red-500/20 px-1.5 py-0.5 rounded text-[10px] font-mono">
                              Repeat Offender Flag
                            </span>
                          ) : (
                            <span className="text-slate-500">First Offence</span>
                          )}
                        </td>
                      </tr>
                    ))}
                    {(!accusedData || accusedData.length === 0) && (
                      <tr>
                        <td colSpan={4} className="px-4 py-4 text-center text-slate-500">No accused entities linked.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div>
              <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-3 font-mono">
                Victim Records
              </h3>
              <div className="border border-[#1e293b] rounded bg-[#111827] overflow-hidden">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-[#0f1524] border-b border-[#1e293b] text-slate-400">
                      <th className="px-4 py-2.5">Name</th>
                      <th className="px-4 py-2.5">Age/Gender</th>
                      <th className="px-4 py-2.5">Injury Severity</th>
                      <th className="px-4 py-2.5">Relation to Accused</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1e293b] text-slate-300">
                    {victimsData?.map((v: any, idx: number) => (
                      <tr key={idx}>
                        <td className="px-4 py-2.5 font-bold">{v.VictimName}</td>
                        <td className="px-4 py-2.5">{v.AgeYear != null ? `${v.AgeYear} yrs` : "age n/a"} / {genderName(v.GenderID)}</td>
                        <td className="px-4 py-2.5 font-mono">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            v.InjurySeverity?.toLowerCase().includes("fatal") || v.InjurySeverity?.toLowerCase().includes("grievous")
                              ? "bg-red-500/10 text-red-400 border border-red-500/20"
                              : "bg-slate-800 text-slate-300 border border-slate-700"
                          }`}>
                            {v.InjurySeverity || "Not recorded"}
                          </span>
                        </td>
                        <td className="px-4 py-2.5">{v.RelationshipToAccused || "Not recorded"}</td>
                      </tr>
                    ))}
                    {(!victimsData || victimsData.length === 0) && (
                      <tr>
                        <td colSpan={4} className="px-4 py-4 text-center text-slate-500">No victim entities linked.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* EVIDENCE PANEL */}
        {activeSubTab === "evidence" && (
          <div className="space-y-6">
            <div>
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider font-mono">
                  {t("section_evidence_items")}
                </h3>
                <button
                  onClick={() => {
                    setEvidenceUploadError(null);
                    setIsUploadEvidenceModalOpen(true);
                  }}
                  className="bg-blue-600 hover:bg-blue-500 text-white text-xs px-3 py-1.5 rounded-lg font-bold font-mono transition-all flex items-center gap-1.5 shadow-md"
                >
                  <Plus size={14} />
                  <span>{t("btn_upload_assigned_only")}</span>
                </button>
              </div>

              {evidenceUploadError && (
                <div className="mb-3 bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded text-xs flex items-center gap-2 font-mono">
                  <AlertCircle size={16} />
                  <span>{evidenceUploadError}</span>
                </div>
              )}

              <div className="border border-[#1e293b] rounded bg-[#111827] overflow-hidden">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-[#0f1524] border-b border-[#1e293b] text-slate-400 font-mono text-[11px]">
                      <th className="px-4 py-2.5">{t("col_item_category")}</th>
                      <th className="px-4 py-2.5">{t("col_description")}</th>
                      <th className="px-4 py-2.5">{t("col_attachment")}</th>
                      <th className="px-4 py-2.5">{t("col_collection_date")}</th>
                      <th className="px-4 py-2.5 text-right">{t("col_actions")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1e293b] text-slate-300">
                    {evidenceData?.map((e: any, idx: number) => {
                      const isCCTV = e.EvidenceType?.toLowerCase().includes("cctv") || e.EvidenceType?.toLowerCase().includes("video");
                      const isPicture = e.EvidenceType?.toLowerCase().includes("picture") || e.EvidenceType?.toLowerCase().includes("photo") || e.EvidenceType?.toLowerCase().includes("image");
                      const isDoc = e.EvidenceType?.toLowerCase().includes("doc") || e.EvidenceType?.toLowerCase().includes("memo") || e.EvidenceType?.toLowerCase().includes("report");

                      return (
                        <tr key={idx} className="hover:bg-[#151c2e] transition-colors">
                          <td className="px-4 py-3 font-bold text-slate-100 flex items-center gap-2">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-mono uppercase font-bold border ${
                              isCCTV ? "bg-purple-500/10 text-purple-400 border-purple-500/20" :
                              isPicture ? "bg-cyan-500/10 text-cyan-400 border-cyan-500/20" :
                              isDoc ? "bg-amber-500/10 text-amber-400 border-amber-500/20" :
                              "bg-blue-500/10 text-blue-400 border-blue-500/20"
                            }`}>
                              {isCCTV ? t("cat_cctv") : isPicture ? t("cat_picture") : isDoc ? t("cat_document") : `📁 ${e.EvidenceType}`}
                            </span>
                          </td>
                          <td className="px-4 py-3 leading-relaxed max-w-xs">{translateData(e.Description)}</td>
                          <td className="px-4 py-3 font-mono">
                            {e.FileUrl ? (
                              <button
                                onClick={() => setSelectedEvidenceForPreview(e)}
                                className="text-blue-400 hover:text-blue-300 hover:underline flex items-center gap-1 font-bold text-[11px]"
                              >
                                📥 {e.FileName || "Attached Evidence File"}
                              </button>
                            ) : e.FileName ? (
                              <span className="text-slate-400 font-bold">{e.FileName}</span>
                            ) : (
                              <span className="text-slate-600 italic font-mono text-[10px]">{t("file_no_digital")}</span>
                            )}
                          </td>
                          <td className="px-4 py-3 font-mono text-slate-400">
                            {e.CollectionDate ? new Date(e.CollectionDate).toLocaleDateString() : "N/A"}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button
                              onClick={() => setSelectedEvidenceForPreview(e)}
                              className="bg-blue-600/20 hover:bg-blue-600/40 border border-blue-500/40 text-blue-400 text-[11px] px-2.5 py-1 rounded font-bold font-mono transition-all inline-flex items-center gap-1"
                            >
                              <Eye size={12} />
                              <span>{isCCTV ? t("btn_play_cctv") : isPicture ? t("btn_view_image") : t("btn_view_preview")}</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                    {(!evidenceData || evidenceData.length === 0) && (
                      <tr>
                        <td colSpan={5} className="px-4 py-8 text-center text-slate-500 font-mono">
                          No evidence entries collected for this case yet. Click "Upload Case Evidence" to submit CCTV, pictures, or documents.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div>
              <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-3 font-mono">
                Witness statements
              </h3>
              <div className="space-y-3">
                {witnessesData?.map((w: any, idx: number) => (
                  <div key={idx} className="bg-[#111827] border border-[#1e293b] p-4 rounded text-xs">
                    <div className="flex justify-between items-center mb-2 border-b border-[#1e293b] pb-1.5">
                      <span className="font-bold text-blue-400">{w.WitnessName}</span>
                      <span className="text-[10px] text-slate-500 font-mono">{w.WitnessType ? `Type: ${w.WitnessType}` : ""}</span>
                    </div>
                    <p className="text-slate-300 leading-relaxed italic">{w.StatementSummary ? `"${w.StatementSummary}"` : "No statement summary recorded."}</p>
                  </div>
                ))}
                {(!witnessesData || witnessesData.length === 0) && (
                  <div className="text-center py-6 text-slate-500 text-xs">No witness statements recorded.</div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* AI PANEL */}
        {activeSubTab === "ai" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1 bg-[#111827] border border-[#1e293b] rounded p-5 flex flex-col items-center justify-center text-center">
              <Shield className={`mb-3 ${aiRiskData?.RiskLevel === "Severe" ? "text-red-500" : aiRiskData?.RiskLevel === "High" ? "text-orange-500" : aiRiskData?.RiskLevel === "Medium" ? "text-amber-400" : "text-emerald-500"}`} size={48} />
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider font-mono">Model risk assessment</span>
              {isRiskLoading ? (
                <div className="h-10 w-24 bg-slate-800 rounded animate-pulse mt-4"></div>
              ) : riskError || !aiRiskData ? (
                <p className="text-xs text-amber-400 mt-4 font-mono">{(riskError as any)?.response?.data?.detail || "The risk model could not score this case."}</p>
              ) : (
                <>
                  <span className="text-xs font-bold uppercase text-slate-100 bg-slate-700/60 border border-slate-600 px-2 py-0.5 rounded mt-3">{aiRiskData.RiskLevel} risk</span>
                  <span className="text-4xl font-extrabold text-slate-100 font-mono mt-3">{(aiRiskData.AIRiskScore * 100).toFixed(0)}<span className="text-lg text-slate-500">/100</span></span>
                  <span className="text-[10px] text-slate-400 mt-1 font-mono">risk index (Low near 0, Medium near 33, High near 67, Severe near 100)</span>
                  {aiRiskData.HighOrSevereProbability != null && (
                    <span className="text-[11px] text-amber-300 mt-2 font-mono">Chance of a High or Severe rating: {(aiRiskData.HighOrSevereProbability * 100).toFixed(0)}%</span>
                  )}
                  {aiRiskData.ClassProbabilities && (
                    <div className="w-full mt-4 space-y-1 text-left">
                      {Object.entries(aiRiskData.ClassProbabilities as Record<string, number>).map(([level, p]) => (
                        <div key={level} className="flex items-center gap-2 text-[10px] font-mono text-slate-400">
                          <span className="w-14">{level}</span>
                          <div className="flex-1 h-1.5 bg-slate-800 rounded"><div className="h-1.5 bg-blue-500 rounded" style={{ width: `${p * 100}%` }} /></div>
                          <span className="w-9 text-right">{(p * 100).toFixed(0)}%</span>
                        </div>
                      ))}
                    </div>
                  )}
                  <p className="text-[10px] text-slate-500 mt-4 leading-normal">{aiRiskData.Summary}</p>
                  <p className="text-[10px] text-slate-600 mt-2 leading-normal font-mono">{aiRiskData.ModelVersion}{aiRiskData.ConfidenceMeaning ? ` · ${aiRiskData.ConfidenceMeaning}` : ""}</p>
                </>
              )}
            </div>

            <div className="lg:col-span-2">
              {aiRiskData?.TopRiskFactors?.length > 0 ? (
                <ExplanationCard
                  title="What drove the chance of a High or Severe rating (each feature's contribution)"
                  factors={aiRiskData.TopRiskFactors.map((f: any) => ({ name: f.FeatureName, score: f.ImpactScore, description: f.Description }))}
                />
              ) : (
                <div className="bg-[#111827] border border-[#1e293b] rounded p-5 text-xs text-slate-500 font-mono">
                  {isRiskLoading ? "Computing the explanation…" : "No explanation is available for this case."}
                </div>
              )}
            </div>
          </div>
        )}

        {/* NETWORK PANEL: the people, vehicles, evidence and station recorded on this FIR (links are direct records) */}
        {activeSubTab === "network" && (() => {
          const nodes: any[] = [];
          const edges: any[] = [];
          const caseNodeId = `case_${caseId}`;
          const link = (id: string, source: string, relationship: string, evidenceSource: string) =>
            edges.push({ id, source, target: caseNodeId, relationship, confidence: 1.0, evidence_source: evidenceSource });

          nodes.push({
            id: caseNodeId, label: `FIR ${caseDetails.CaseNo}`, node_type: "FIR", centrality: 3, case_count: 1,
            risk_score: caseDetails.AIRiskScore ?? undefined, details: caseDetails.BriefFacts,
          });
          if (caseDetails.PoliceStationName) {
            nodes.push({ id: `ps_${caseId}`, label: caseDetails.PoliceStationName, node_type: "PoliceStation", centrality: 2, details: "Registering police station" });
            edges.push({ id: `e_ps_${caseId}`, source: caseNodeId, target: `ps_${caseId}`, relationship: "REGISTERED_AT", confidence: 1.0, evidence_source: "FIR record" });
          }
          (accusedData || []).forEach((acc: any) => {
            const id = `accused_${acc.AccusedMasterID}`;
            nodes.push({
              id, label: acc.AccusedName || "Accused", node_type: "Person", sub_type: acc.IsRepeatOffender ? "Repeat Offender" : "Accused",
              centrality: acc.IsRepeatOffender ? 2 : 1, age: acc.AgeYear ?? undefined, occupation: acc.Occupation ?? undefined, address: acc.Address ?? undefined,
              details: acc.IsRepeatOffender ? "Recorded repeat offender" : "Accused in this FIR",
            });
            link(`e_${id}`, id, acc.IsRepeatOffender ? "REPEAT_ACCUSED_IN" : "ACCUSED_IN", "FIR record");
          });
          (victimsData || []).forEach((vic: any) => {
            const id = `victim_${vic.VictimMasterID}`;
            nodes.push({ id, label: `${vic.VictimName || "Victim"} (victim)`, node_type: "Victim", centrality: 1, details: vic.InjurySeverity ? `Injury: ${vic.InjurySeverity}` : "Victim / complainant" });
            link(`e_${id}`, id, "VICTIM_IN", "FIR record");
          });
          (witnessesData || []).forEach((w: any) => {
            const id = `witness_${w.WitnessMasterID}`;
            nodes.push({ id, label: `${w.WitnessName} (witness)`, node_type: "Witness", centrality: 1, details: w.StatementSummary || "Witness" });
            link(`e_${id}`, id, "WITNESS_IN", "Witness record");
          });
          (vehiclesData || []).forEach((veh: any) => {
            const id = `vehicle_${veh.VehicleID}`;
            nodes.push({ id, label: veh.RegistrationNumber || veh.VehicleType || "Vehicle", node_type: "Vehicle", centrality: 1, registration_no: veh.RegistrationNumber ?? undefined,
              details: [veh.VehicleType, veh.Make, veh.Model, veh.Color, veh.InvolvementRole].filter(Boolean).join(" · ") || "Vehicle" });
            link(`e_${id}`, id, veh.InvolvementRole ? `VEHICLE_${String(veh.InvolvementRole).toUpperCase().replace(/\s+/g, "_")}` : "VEHICLE_IN", "Vehicle record");
          });
          (evidenceData || []).forEach((ev: any) => {
            const id = `evidence_${ev.EvidenceID}`;
            nodes.push({ id, label: ev.EvidenceType || "Evidence", node_type: "Evidence", centrality: 1, details: ev.Description });
            link(`e_${id}`, id, "COLLECTED_IN", "Evidence record");
          });

          return (
            <div className="h-[500px] border border-[#1e293b] rounded-xl overflow-hidden relative shadow-2xl bg-[#0a0f1d]">
              <NetworkGraphCanvas graphData={{ nodes, edges, total_nodes: nodes.length, total_edges: edges.length, gang_count: 0 }} isLoading={false} />
            </div>
          );
        })()}

        {/* TIMELINE PANEL */}
        {activeSubTab === "timeline" && (
          <div className="space-y-6">
            {(canUpdateCase || canAnnotate) && (
              <div className="bg-[#111827] border border-[#1e293b] rounded p-4 space-y-3">
                <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider font-mono">Case actions</h3>
                {actionError && <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-2.5 rounded text-xs font-mono">{actionError}</div>}
                {canUpdateCase && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <label className="text-[10px] font-mono text-slate-400 uppercase">
                      Status
                      <select value={caseDetails.CaseStatusID} disabled={statusMutation.isPending}
                        onChange={(e) => statusMutation.mutate(Number(e.target.value))}
                        className="mt-1 w-full bg-[#1e293b] border border-[#334155] text-slate-100 text-xs rounded px-3 py-1.5 font-mono normal-case">
                        {reference.case_statuses.map((st) => <option key={st.id} value={st.id}>{translateData(st.name)}</option>)}
                      </select>
                    </label>
                    <label className="text-[10px] font-mono text-slate-400 uppercase">
                      Investigation priority
                      <select value={caseDetails.InvestigationPriority || ""} disabled={priorityMutation.isPending}
                        onChange={(e) => e.target.value && priorityMutation.mutate(e.target.value)}
                        className="mt-1 w-full bg-[#1e293b] border border-[#334155] text-slate-100 text-xs rounded px-3 py-1.5 font-mono normal-case">
                        {!caseDetails.InvestigationPriority && <option value="">Not set</option>}
                        {["High", "Medium", "Low"].map((p) => <option key={p} value={p}>{p}</option>)}
                      </select>
                    </label>
                  </div>
                )}
                {canAnnotate && (
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <select value={noteCategory} onChange={(e) => setNoteCategory(e.target.value)}
                        className="bg-[#1e293b] border border-[#334155] text-slate-100 text-xs rounded px-2 py-1.5 font-mono">
                        {["General Note", "Forensic Progress", "Accused Movement", "Evidence Log", "Case Journal"].map((c) => <option key={c}>{c}</option>)}
                      </select>
                      <input value={actionNote} onChange={(e) => setActionNote(e.target.value)} placeholder="Add a note to the case journal (min. 5 characters)"
                        className="flex-1 bg-[#1e293b] border border-[#334155] text-slate-100 text-xs rounded px-3 py-1.5" />
                      <button disabled={actionNote.trim().length < 5 || noteMutation.isPending} onClick={() => noteMutation.mutate()}
                        className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs px-3 py-1.5 rounded font-bold font-mono">Add note</button>
                    </div>
                  </div>
                )}
              </div>
            )}

            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider font-mono">Case chronology</h3>
            {isTimelineLoading ? (
              <p className="text-xs text-slate-500 font-mono">Loading…</p>
            ) : (
              <div className="relative pl-6 border-l border-blue-500/30 space-y-5 font-sans">
                {(timelineData?.events ?? []).map((ev: any, idx: number) => {
                  const colour = ev.kind === "incident" ? "bg-red-500" : ev.kind === "fir" ? "bg-blue-500" : ev.kind === "status" ? "bg-emerald-500" : ev.kind === "evidence" ? "bg-purple-500" : ev.kind === "assignment" ? "bg-amber-500" : "bg-slate-500";
                  return (
                    <div key={idx} className="relative">
                      <span className={`absolute -left-[30px] top-1.5 w-3.5 h-3.5 rounded-full ${colour} border-2 border-[#0d1322]`}></span>
                      <div className="text-xs">
                        <span className="font-bold text-slate-200">{translateData(ev.title)}</span>
                        <span className="ml-2 text-[10px] text-slate-500 font-mono">{new Date(ev.at).toLocaleString()}{ev.actor ? ` · ${ev.actor}` : ""}</span>
                        {ev.detail && <p className="text-slate-400 mt-1 leading-relaxed">{translateData(ev.detail)}</p>}
                      </div>
                    </div>
                  );
                })}
                {(timelineData?.events ?? []).length === 0 && <p className="text-xs text-slate-500 font-mono">No dated events recorded.</p>}
              </div>
            )}
          </div>
        )}

        {/* SIMILAR CASES PANEL */}
        {activeSubTab === "similar" && (
          <div className="space-y-6 h-full flex flex-col">
            <div className="flex justify-between items-center border-b border-[#1e293b] pb-3 mb-2 gap-4">
              <div>
                <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider font-mono">
                  Similar cases by narrative (pgvector cosine search)
                </h3>
                {similarCasesData?.SearchedCases != null && (
                  <p className="text-[10px] text-amber-400/90 mt-0.5 font-mono">
                    Searching {similarCasesData.SearchedCases.toLocaleString()} of {similarCasesData.TotalCases?.toLocaleString()} FIRs that have been indexed so far.
                  </p>
                )}
                <p className="text-[10px] text-slate-500 mt-0.5 font-sans">
                  Cosine similarity between Gemini text embeddings of the case narratives. Select a match to compare it side by side.
                </p>
                {embedNote && <p className="text-[10px] text-slate-400 mt-1 font-mono">{embedNote}</p>}
              </div>
              <button
                disabled={backfillMutation.isPending}
                onClick={() => backfillMutation.mutate()}
                className="flex-shrink-0 bg-blue-600/15 hover:bg-blue-600/35 border border-blue-500/30 text-blue-400 rounded px-3 py-2 text-[10px] font-bold uppercase tracking-wider transition-colors disabled:opacity-50"
              >
                {backfillMutation.isPending ? "Indexing…" : "Index more FIRs"}
              </button>
            </div>

            <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Match List Column */}
              <div className="space-y-3 overflow-y-auto pr-1">
                {isSimilarLoading ? (
                  <div className="text-center py-8 text-xs text-slate-500 font-mono">Querying vector index...</div>
                ) : !similarCasesData || similarCasesData.Matches?.length === 0 ? (
                  <div className="text-center py-8 text-xs text-slate-500 font-mono">No similar MO matches found.</div>
                ) : (
                  similarCasesData.Matches.map((m: any, idx: number) => {
                    return (
                      <div
                        key={idx}
                        onClick={() => setSelectedCompareCase(m)}
                        className={`p-3.5 rounded border border-l-4 border-l-blue-500 transition-all cursor-pointer flex gap-4 ${
                          selectedCompareCase === m
                            ? "bg-blue-600/10 border-blue-500/50"
                            : "bg-[#111827] border-[#1e293b] hover:border-slate-700"
                        }`}
                      >
                        <div className="w-16 border-r border-[#1e293b] flex flex-col items-center justify-center text-center">
                          <span className="text-[10px] font-bold text-slate-400">Match #{idx + 1}</span>
                          <span className="text-sm font-extrabold text-blue-400 mt-1 font-mono">
                            {((m.SimilarityScore || 0) * 100).toFixed(0)}%
                          </span>
                        </div>
                        <div className="flex-1 text-xs">
                          <span className="font-bold text-slate-200 block">Case No: {m.CaseNo || `ID #${m.CaseMasterID}`}</span>
                          <p className="text-slate-400 mt-1 line-clamp-2 italic">"{m.BriefFacts}"</p>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Side-by-Side Comparison Matrix */}
              <div className="bg-[#111827] border border-[#1e293b] rounded p-5 flex flex-col overflow-y-auto">
                <h4 className="text-xs font-bold text-slate-300 font-mono uppercase tracking-wider mb-4 border-b border-[#1e293b] pb-2">
                  Dossier Comparison Matrix
                </h4>

                {selectedCompareCase ? (
                  <div className="space-y-4 text-xs">
                    {/* Header Similarity Indicator */}
                    <div className="bg-blue-500/10 border border-blue-500/20 p-3 rounded text-center">
                      <span className="text-[10px] uppercase font-mono tracking-wider text-slate-400 block">Cosine similarity</span>
                      <span className="text-2xl font-black text-blue-400 font-mono mt-1 block">
                        {((selectedCompareCase.SimilarityScore || 0) * 100).toFixed(1)}%
                      </span>
                    </div>

                    {/* Comparison rows */}
                    <div className="divide-y divide-[#1e293b] space-y-3.5">
                      <div className="pt-3">
                        <span className="text-slate-500 font-mono text-[10px] uppercase block mb-1">Current Case Facts</span>
                        <p className="text-slate-300 font-sans leading-relaxed bg-[#0d1322] p-2.5 rounded border border-[#1e293b]/50">
                          {caseDetails.BriefFacts}
                        </p>
                      </div>

                      <div className="pt-3">
                        <span className="text-slate-500 font-mono text-[10px] uppercase block mb-1">Compared Case Facts (Case No: {selectedCompareCase.CaseNo})</span>
                        <p className="text-slate-300 font-sans leading-relaxed bg-[#0d1322] p-2.5 rounded border border-[#1e293b]/50 italic">
                          "{selectedCompareCase.BriefFacts}"
                        </p>
                      </div>

                      {selectedCompareCase.TopFactors?.length > 0 && (
                        <div className="pt-3">
                          <span className="text-slate-500 font-mono text-[10px] uppercase block mb-1.5">Shared Modus Operandi & Features</span>
                          <div className="flex flex-wrap gap-1.5">
                            {selectedCompareCase.TopFactors.map((f: any, fIdx: number) => (
                              <span
                                key={fIdx}
                                title={f.Description}
                                className="bg-blue-500/10 text-blue-400 border border-blue-500/20 px-1.5 py-0.5 rounded text-[10px] font-mono"
                              >
                                {f.FeatureName}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center text-center text-slate-500 text-xs">
                    <Compass className="text-slate-600 mb-2 animate-pulse" size={24} />
                    <span>Select a matching case on the left to trigger side-by-side structural comparison.</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
      {/* SUBORDINATE TASK UPDATE & REAL-TIME TIMELINE MODAL */}
      {selectedTaskToUpdate && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#111827] border border-[#1e293b] rounded-xl max-w-xl w-full p-6 space-y-4 shadow-2xl">
            <div className="flex justify-between items-center border-b border-[#1e293b] pb-3">
              <div>
                <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
                  <Sparkles size={18} className="text-blue-400" />
                  Update Operational Progress & Timeline
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">Task ID #{selectedTaskToUpdate.TaskID}: {selectedTaskToUpdate.Title}</p>
              </div>
              <button onClick={() => setSelectedTaskToUpdate(null)} className="text-slate-400 hover:text-slate-200">
                <X size={18} />
              </button>
            </div>

            <div className="bg-[#151c2e] p-3.5 rounded-lg border border-[#1e293b] space-y-1">
              <div className="flex justify-between text-xs text-slate-300 font-mono">
                <span>Appointed By: <strong className="text-blue-400">{selectedTaskToUpdate.AssignedByUsername} ({selectedTaskToUpdate.AssignedByRank})</strong></span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed bg-[#0d1322] p-2.5 rounded border border-slate-800">
                {selectedTaskToUpdate.Description}
              </p>
            </div>

            {/* Status Update Form */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                updateStatusMutation.mutate({
                  taskId: selectedTaskToUpdate.TaskID,
                  status: newStatus,
                  note: statusNote,
                });
              }}
              className="space-y-3 bg-[#151c2e] p-4 rounded-lg border border-blue-500/20"
            >
              <h4 className="text-xs font-bold text-blue-400 font-mono uppercase">Log Real-Time Progress Update</h4>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-mono text-slate-400 uppercase font-bold mb-1">Update Status</label>
                  <select
                    value={newStatus}
                    onChange={(e) => setNewStatus(e.target.value)}
                    className="w-full bg-[#1e293b] border border-[#334155] text-slate-100 text-xs rounded px-3 py-1.5 font-mono"
                  >
                    <option value="In Progress">⏳ In Progress</option>
                    <option value="Evidence Collected">📁 Evidence Collected</option>
                    <option value="Under Review">🔍 Under Review for Senior Approval</option>
                    <option value="Completed">✅ Directive Completed</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-mono text-slate-400 uppercase font-bold mb-1">Execution Note / Report</label>
                  <input
                    type="text"
                    placeholder="e.g. Conducted site audit, collected CCTV logs."
                    value={statusNote}
                    onChange={(e) => setStatusNote(e.target.value)}
                    className="w-full bg-[#1e293b] border border-[#334155] text-slate-100 text-xs rounded px-3 py-1.5"
                    required
                  />
                </div>
              </div>
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={updateStatusMutation.isPending}
                  className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs px-3.5 py-1.5 rounded font-bold font-mono transition-colors"
                >
                  <Send size={12} />
                  <span>{updateStatusMutation.isPending ? "Logging..." : "Log Progress Event"}</span>
                </button>
              </div>
            </form>

            {/* Stepper Timeline */}
            <div className="space-y-3 max-h-48 overflow-y-auto pr-1">
              <h4 className="text-xs font-bold text-slate-300 font-mono uppercase">Execution Timeline History</h4>
              {selectedTaskToUpdate.timeline_events.map((ev, idx) => (
                <div key={ev.EventID} className="flex gap-3 text-xs bg-[#151c2e] p-2.5 rounded border border-[#1e293b]">
                  <span className="font-mono text-blue-400 font-bold">#{idx + 1} {ev.Status}:</span>
                  <span className="text-slate-300 flex-1">{ev.Note}</span>
                  <span className="text-[10px] text-slate-500 font-mono">{new Date(ev.Timestamp).toLocaleTimeString()}</span>
                </div>
              ))}
            </div>

            <div className="flex justify-end border-t border-[#1e293b] pt-3">
              <button
                onClick={() => setSelectedTaskToUpdate(null)}
                className="bg-[#1e293b] text-slate-300 text-xs px-4 py-2 rounded font-mono font-bold"
              >
                Close Modal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* UPLOAD EVIDENCE MODAL */}
      {isUploadEvidenceModalOpen && caseId && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#111827] border border-[#1e293b] rounded-xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex justify-between items-center border-b border-[#1e293b] pb-3">
              <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <Package size={18} className="text-blue-500" />
                Upload Evidence File for Case #{caseId}
              </h2>
              <button
                onClick={() => setIsUploadEvidenceModalOpen(false)}
                className="text-slate-400 hover:text-slate-200"
              >
                <X size={18} />
              </button>
            </div>

            {evidenceUploadError && (
              <div className="p-3 rounded bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-mono">
                {evidenceUploadError}
              </div>
            )}

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!evidenceDescInput.trim()) return;
                uploadEvidenceMutation.mutate({
                  caseId,
                  file: evidenceFileInput,
                  type: evidenceTypeInput,
                  desc: evidenceDescInput.trim(),
                });
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-xs font-mono font-bold text-slate-300 uppercase mb-1">
                  1. Evidence Category *
                </label>
                <select
                  value={evidenceTypeInput}
                  onChange={(e) => setEvidenceTypeInput(e.target.value)}
                  className="w-full bg-[#1e293b] border border-[#334155] text-slate-100 text-xs rounded px-3 py-2 focus:outline-none focus:border-blue-500 font-mono"
                  required
                >
                  <option value="" disabled>Select a category</option>
                  {reference.vocabulary.evidence_type.map((x) => <option key={x} value={x}>{x}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-xs font-mono font-bold text-slate-300 uppercase mb-1">
                  2. Detailed Description *
                </label>
                <textarea
                  rows={3}
                  placeholder="Provide evidence details (e.g. CCTV clip showing suspect fleeing motorcycle at 22:15 hrs)..."
                  value={evidenceDescInput}
                  onChange={(e) => setEvidenceDescInput(e.target.value)}
                  className="w-full bg-[#1e293b] border border-[#334155] text-slate-100 text-xs rounded px-3 py-2 focus:outline-none focus:border-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-mono font-bold text-slate-300 uppercase mb-1">
                  3. Attach Evidence File (CCTV Video, Image, PDF)
                </label>
                <input
                  type="file"
                  onChange={(e) => setEvidenceFileInput(e.target.files?.[0] || null)}
                  className="w-full bg-[#1e293b] border border-[#334155] text-slate-100 text-xs rounded px-3 py-2 font-mono file:mr-3 file:py-1 file:px-2.5 file:rounded file:border-0 file:text-xs file:font-mono file:bg-blue-600 file:text-white hover:file:bg-blue-500 cursor-pointer"
                />
                <p className="text-[10px] text-slate-500 mt-1 font-mono">
                  Supported: MP4, AVI, JPG, PNG, PDF, DOCX
                </p>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-[#1e293b]">
                <button
                  type="button"
                  onClick={() => setIsUploadEvidenceModalOpen(false)}
                  className="px-4 py-2 rounded text-xs text-slate-400 hover:text-slate-200 font-mono"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={uploadEvidenceMutation.isPending}
                  className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white text-xs px-4 py-2 rounded font-bold shadow-lg transition-colors font-mono"
                >
                  {uploadEvidenceMutation.isPending ? (
                    <>
                      <span className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></span>
                      <span>Uploading Evidence...</span>
                    </>
                  ) : (
                    <>
                      <Upload size={14} />
                      <span>Upload Evidence</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EVIDENCE PREVIEW MODAL */}
      {selectedEvidenceForPreview && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-[#111827] border border-[#1e293b] rounded-xl max-w-2xl w-full p-6 space-y-4 shadow-2xl">
            <div className="flex justify-between items-center border-b border-[#1e293b] pb-3">
              <div>
                <h2 className="text-base font-bold text-slate-100 flex items-center gap-2 font-mono">
                  {selectedEvidenceForPreview.EvidenceType?.toLowerCase().includes("cctv") || selectedEvidenceForPreview.EvidenceType?.toLowerCase().includes("video") ? "📹 CCTV Footage Preview" :
                   selectedEvidenceForPreview.EvidenceType?.toLowerCase().includes("picture") || selectedEvidenceForPreview.EvidenceType?.toLowerCase().includes("photo") || selectedEvidenceForPreview.EvidenceType?.toLowerCase().includes("image") ? "🖼️ Image Evidence Preview" :
                   "📄 Evidence Artifact File"}
                </h2>
                <p className="text-xs text-slate-400 mt-0.5 font-mono">
                  Collected: {selectedEvidenceForPreview.CollectionDate ? new Date(selectedEvidenceForPreview.CollectionDate).toLocaleString() : "N/A"}
                </p>
              </div>
              <button
                onClick={() => setSelectedEvidenceForPreview(null)}
                className="text-slate-400 hover:text-slate-200 p-1 rounded"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-3">
              <div className="bg-[#151c2e] p-3 rounded border border-[#1e293b] text-xs">
                <span className="text-slate-400 font-mono font-bold uppercase text-[10px]">Description:</span>
                <p className="text-slate-200 mt-1 font-sans leading-relaxed">{selectedEvidenceForPreview.Description}</p>
              </div>

              {/* MEDIA PREVIEW DISPLAY */}
              {selectedEvidenceForPreview.FileUrl ? (
                <div className="bg-[#0b0f19] p-4 rounded-xl border border-[#1e293b] flex flex-col items-center justify-center min-h-[250px]">
                  {selectedEvidenceForPreview.EvidenceType?.toLowerCase().includes("cctv") || selectedEvidenceForPreview.EvidenceType?.toLowerCase().includes("video") || selectedEvidenceForPreview.FileName?.endsWith(".mp4") || selectedEvidenceForPreview.FileName?.endsWith(".avi") ? (
                    <div className="w-full space-y-2">
                      <video
                        controls
                        autoPlay={false}
                        src={getFullMediaUrl(selectedEvidenceForPreview.FileUrl)}
                        className="w-full max-h-[380px] rounded-lg border border-[#1e293b] bg-black shadow-lg"
                      >
                        Your browser does not support HTML5 video playback.
                      </video>
                      <div className="flex justify-between items-center text-[10px] font-mono text-slate-400 px-1 pt-1">
                        <span>Video Stream File: {selectedEvidenceForPreview.FileName}</span>
                        <a
                          href={getFullMediaUrl(selectedEvidenceForPreview.FileUrl)}
                          download={selectedEvidenceForPreview.FileName}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-400 hover:underline font-bold flex items-center gap-1"
                        >
                          <Download size={12} /> Download Raw CCTV Video
                        </a>
                      </div>
                    </div>
                  ) : selectedEvidenceForPreview.EvidenceType?.toLowerCase().includes("picture") || selectedEvidenceForPreview.EvidenceType?.toLowerCase().includes("photo") || selectedEvidenceForPreview.EvidenceType?.toLowerCase().includes("image") || selectedEvidenceForPreview.FileName?.endsWith(".jpg") || selectedEvidenceForPreview.FileName?.endsWith(".png") || selectedEvidenceForPreview.FileName?.endsWith(".jpeg") ? (
                    <div className="w-full space-y-2 text-center">
                      <img
                        src={getFullMediaUrl(selectedEvidenceForPreview.FileUrl)}
                        alt={selectedEvidenceForPreview.FileName || "Evidence Picture"}
                        className="max-h-[380px] object-contain mx-auto rounded-lg border border-[#1e293b] shadow-lg"
                      />
                      <div className="flex justify-between items-center text-[10px] font-mono text-slate-400 px-1 pt-1">
                        <span>Image File: {selectedEvidenceForPreview.FileName}</span>
                        <a
                          href={getFullMediaUrl(selectedEvidenceForPreview.FileUrl)}
                          download={selectedEvidenceForPreview.FileName}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-400 hover:underline font-bold flex items-center gap-1"
                        >
                          <Download size={12} /> Download High-Res Snapshot
                        </a>
                      </div>
                    </div>
                  ) : (
                    <div className="w-full text-center space-y-4 py-8">
                      <div className="p-4 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 inline-block">
                        <FileText size={36} />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-slate-200 font-mono">{selectedEvidenceForPreview.FileName || "Document Attachment"}</h4>
                        <p className="text-xs text-slate-400 mt-1 font-mono">
                          Size: {selectedEvidenceForPreview.FileSize ? `${(selectedEvidenceForPreview.FileSize / 1024).toFixed(1)} KB` : "Standard File"}
                        </p>
                      </div>
                      <a
                        href={getFullMediaUrl(selectedEvidenceForPreview.FileUrl)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white text-xs px-4 py-2 rounded-lg font-bold font-mono transition-all shadow-lg"
                      >
                        <Download size={14} />
                        <span>View / Download Document</span>
                      </a>
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-[#151c2e] p-8 rounded-lg border border-[#1e293b] text-center text-xs text-slate-400 font-mono">
                  Physical evidence record logged into digital vault. No digital file attachment uploaded.
                </div>
              )}
            </div>

            <div className="flex justify-end pt-3 border-t border-[#1e293b]">
              <button
                onClick={() => setSelectedEvidenceForPreview(null)}
                className="bg-[#1e293b] hover:bg-[#334155] text-slate-200 text-xs px-4 py-2 rounded-lg font-bold font-mono transition-colors"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}

      {renderRegisterFirModal()}
    </div>
  );
}
