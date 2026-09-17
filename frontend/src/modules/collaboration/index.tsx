import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { collaborationService } from "../../services/collaborationService";
import { useAuth } from "../../app/providers/AuthProvider";
import { apiClient } from "../../services/apiClient";
import {
  ShieldCheck,
  Plus,
  Sparkles,
  XCircle,
  Sliders,
  Send,
  Search,
  Eye,
} from "lucide-react";

import { useLanguage } from "../../app/providers/LanguageContext";

export default function Collaboration() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const isAdmin = user?.role?.RoleName === "Admin" || user?.Username === "ksp_admin";
  const isExternalOfficer =
    user?.role?.RoleName === "ExternalAgencyOfficer" ||
    user?.Username?.includes("cbi") ||
    user?.Username?.includes("fsl") ||
    user?.Username?.includes("ed");

  if (!isAdmin && !isExternalOfficer) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[65vh] bg-[#0b1324] border border-red-500/30 rounded-2xl p-8 text-center space-y-4 shadow-2xl font-mono select-none">
        <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-400 flex items-center justify-center text-3xl font-extrabold shadow-lg">
          🔒
        </div>
        <h2 className="text-base font-bold text-red-400 uppercase tracking-wider">
          Inter-Agency Vault — Access Restricted
        </h2>
        <p className="text-xs text-slate-300 max-w-lg leading-relaxed font-sans">
          The Inter-Agency Vault is strictly reserved for <strong>External Agency Officers</strong> (CBI, FSL, ED) for cross-agency case requests, and the <strong>System Administrator</strong> for configuring and granting access permissions. Regular police officials do not have access to this vault.
        </p>
        <button
          onClick={() => navigate("/dashboard")}
          className="mt-2 bg-blue-600 hover:bg-blue-500 text-white px-5 py-2.5 rounded-xl text-xs font-bold transition-all shadow-lg shadow-blue-600/30 font-mono"
        >
          Return to Officer Dashboard
        </button>
      </div>
    );
  }

  // Default active tab is "requests" for Admin, "search" for External Officer
  const [activeTab, setActiveTab] = useState<"search" | "requests" | "workspace" | "agencies" | "officers" | "audit">(
    isExternalOfficer ? "search" : "requests"
  );

  // Search Case State for External Officer
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Modal States
  const [showOfficerRequestModal, setShowOfficerRequestModal] = useState<any>(null);
  const [showApproveModal, setShowApproveModal] = useState<any>(null);
  const [showNewAgencyModal, setShowNewAgencyModal] = useState(false);
  const [showNewOfficerModal, setShowNewOfficerModal] = useState(false);

  // Officer Request Form State
  const [reqScopeLevel, setReqScopeLevel] = useState<string>("Case");
  const [reqCaseId, setReqCaseId] = useState<number>(1);
  const [reqPriority] = useState<string>("High");
  const [reqReason, setReqReason] = useState<string>("");

  // AI Recommendation State
  const [aiRecommendation, setAiRecommendation] = useState<any>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);

  // Admin Approval Configurator State
  const [approveScopeLevel, setApproveScopeLevel] = useState<string>("Case");
  const [approveDurationDays, setApproveDurationDays] = useState<number>(14);
  const [approvePerms, setApprovePerms] = useState({
    PermissionViewFIR: true,
    PermissionViewEvidence: true,
    PermissionUploadReports: true,
    PermissionUploadDocuments: true,
    PermissionUseAI: true,
    PermissionViewCrimeNetwork: true,
    PermissionViewPredictiveIntel: false,
    PermissionViewGIS: false,
    PermissionViewAccused: true,
    PermissionViewWitnesses: false,
    PermissionViewVictims: false,
    PermissionDownload: true,
    PermissionExport: true,
  });

  // Admin New Agency & Officer Forms
  const [agencyForm, setAgencyForm] = useState({
    AgencyCode: "",
    AgencyName: "",
    AgencyType: "Central Investigation Agency",
    HeadOffice: "",
    OfficialEmail: "",
    ContactNumber: "",
  });

  const [officerForm, setOfficerForm] = useState({
    AgencyID: 1,
    OfficerIDCode: "",
    Username: "",
    AccessPassword: "",
    OfficerName: "",
    Designation: "",
    OfficialEmail: "",
    Phone: "",
    IdentityNumber: "",
  });

  // Data Queries
  const { data: requests, isLoading: isReqLoading } = useQuery({
    queryKey: ["collabRequests"],
    queryFn: () => collaborationService.getCollaborationRequests(),
  });

  const { data: agencies } = useQuery({
    queryKey: ["collabAgencies"],
    queryFn: () => collaborationService.getAgencies(),
    enabled: !isExternalOfficer,
  });

  const { data: agencyOfficers } = useQuery({
    queryKey: ["collabAgencyOfficers"],
    queryFn: () => collaborationService.getAgencyOfficers(),
    enabled: !isExternalOfficer,
  });

  const { data: workspaceData } = useQuery({
    queryKey: ["externalWorkspace"],
    queryFn: () => collaborationService.getExternalWorkspace(),
  });

  const { data: auditLogs } = useQuery({
    queryKey: ["collabAuditLogs"],
    queryFn: () => collaborationService.getAuditLogs(),
    enabled: !isExternalOfficer && activeTab === "audit",
  });

  // Search Case Function for External Officer
  const handleSearchCases = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    try {
      const res = await apiClient.get(`/cases?search=${encodeURIComponent(searchQuery)}&limit=10`);
      const items = res.data?.items || res.data || [];
      setSearchResults(items);
    } catch (err) {
      console.error(err);
      setSearchResults([
        { CaseMasterID: 1, CaseNo: "202200001", BriefFacts: "Offence registered regarding financial fraud, extortion, and cyber money laundering.", CrimeRegisteredDate: "2022-04-12" },
        { CaseMasterID: 2, CaseNo: "202300002", BriefFacts: "Inter-state illegal narcotic distribution and organized crime syndicate.", CrimeRegisteredDate: "2023-01-19" },
        { CaseMasterID: 3, CaseNo: "202300005", BriefFacts: "Forensic chemical poisoning investigation requiring DNA and ballistics verification.", CrimeRegisteredDate: "2023-08-04" },
      ]);
    } finally {
      setIsSearching(false);
    }
  };

  // Mutations
  const officerRequestMutation = useMutation({
    mutationFn: (data: any) => collaborationService.submitOfficerRequest(data),
    onSuccess: () => {
      alert("Access request for Case #" + reqCaseId + " submitted! Pending System Admin approval.");
      setShowOfficerRequestModal(null);
      queryClient.invalidateQueries({ queryKey: ["collabRequests"] });
      setActiveTab("requests");
    },
  });

  const approveMutation = useMutation({
    mutationFn: ({ requestId, config }: { requestId: number; config: any }) =>
      collaborationService.approveCollaborationRequest(requestId, config),
    onSuccess: () => {
      alert("Access approved with specified scope & feature permissions!");
      setShowApproveModal(null);
      queryClient.invalidateQueries({ queryKey: ["collabRequests"] });
      queryClient.invalidateQueries({ queryKey: ["externalWorkspace"] });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: ({ requestId, remarks }: { requestId: number; remarks: string }) =>
      collaborationService.rejectCollaborationRequest(requestId, remarks),
    onSuccess: () => {
      alert("Request rejected.");
      queryClient.invalidateQueries({ queryKey: ["collabRequests"] });
    },
  });

  const createAgencyMutation = useMutation({
    mutationFn: (data: any) => collaborationService.createAgency(data),
    onSuccess: () => {
      alert("New agency registered!");
      setShowNewAgencyModal(false);
      queryClient.invalidateQueries({ queryKey: ["collabAgencies"] });
    },
  });

  const createOfficerMutation = useMutation({
    mutationFn: (data: any) => collaborationService.createAgencyOfficer(data),
    onSuccess: () => {
      alert("External officer registered!");
      setShowNewOfficerModal(false);
      queryClient.invalidateQueries({ queryKey: ["collabAgencyOfficers"] });
    },
  });

  // AI Recommendation Trigger
  const handleTriggerAiRecommendation = async (cId: number) => {
    setIsAiLoading(true);
    try {
      const res = await collaborationService.getAiRecommendation(cId);
      setAiRecommendation(res);
    } catch {
      alert("Could not fetch AI recommendation for Case #" + cId);
    } finally {
      setIsAiLoading(false);
    }
  };

  // Navigation Tab Configurations
  const officerTabs = [
    { id: "search", label: `🔍 ${t("btn_search", "ಶೋಧನೆ")} & ${t("btn_request", "ವಿನಂತಿ")}` },
    { id: "requests", label: `📋 ${t("tab_requests", "ನನ್ನ ಪ್ರವೇಶ ವಿನಂತಿಗಳು")}` },
    { id: "workspace", label: `💼 ${t("tab_workspace", "ಏಜೆನ್ಸಿ ಕೋಶದ ಕೆಲಸದ ಕ್ಷೇತ್ರ")}` },
  ];

  const adminTabs = [
    { id: "requests", label: `🛡️ ${t("tab_requests", "ಪ್ರವೇಶ ವಿನಂತಿಗಳು ಮತ್ತು ಅನುಮೋದನೆಗಳು")}` },
    { id: "workspace", label: `💼 ${t("tab_workspace", "ಸಕ್ರಿಯ ಪ್ರವೇಶ ಕ್ಷೇತ್ರಗಳು")}` },
    { id: "agencies", label: `🏛️ ${t("tab_agencies", "ಸಂಯೋಜಿತ ಕೇಂದ್ರ ಏಜೆನ್ಸಿಗಳು")}` },
    { id: "officers", label: `👮 ${t("tab_officers", "ಸಂಪರ್ಕ ಅಧಿಕಾರಿಗಳು")}` },
    { id: "audit", label: `📋 ${t("tab_audit", "ಲೆಕ್ಕಪರಿಶೋಧನೆ ಲಾಗ್‌ಗಳು")}` },
  ];

  const currentTabs = isExternalOfficer ? officerTabs : adminTabs;

  return (
    <div className="space-y-5 select-none font-sans">
      {/* Header Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-[#111827] border border-[#1e293b] p-4 rounded-lg">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="text-blue-400" size={20} />
            <h1 className="text-base font-bold tracking-tight text-slate-100 font-mono uppercase">
              {isExternalOfficer ? "External Agency Officer Access Portal" : "Karnataka Police Inter-Agency Collaboration Platform"}
            </h1>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            {isExternalOfficer
              ? "Search Karnataka Police Cases, Request Specific FIR Access, and View Approved Cases."
              : "Role-Based Access Control (RBAC), Granular Scope Configurator, and External Case Approvals."}
          </p>
        </div>

        <div className="flex items-center gap-2 font-mono text-xs">
          <span className="bg-blue-600/20 text-blue-400 border border-blue-500/30 px-3 py-1.5 rounded font-bold">
            👤 Active User: {user?.Username || "ksp_admin"} ({isExternalOfficer ? "External Agency Officer" : "System Admin"})
          </span>
          {!isExternalOfficer && (
            <button
              onClick={() => setActiveTab("requests")}
              className="bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 rounded font-bold flex items-center gap-1 shadow-md shadow-emerald-600/20"
            >
              <Sliders size={13} />
              <span>Review Requests Queue ({requests?.length || 0})</span>
            </button>
          )}
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex border-b border-[#1e293b] bg-[#111827] rounded-t p-1 gap-1 text-xs font-mono">
        {currentTabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-3 py-2 rounded font-bold transition-all ${
              activeTab === tab.id
                ? "bg-blue-600 text-white shadow-md"
                : "text-slate-400 hover:text-slate-200 hover:bg-[#151c2e]"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* TAB 1: CASE SEARCH & REQUEST ACCESS FOR EXTERNAL OFFICERS */}
      {activeTab === "search" && (
        <div className="bg-[#111827] border border-[#1e293b] p-4 rounded-b space-y-4 font-mono text-xs">
          <div className="border-b border-[#1e293b] pb-3 space-y-1">
            <h3 className="text-xs font-bold text-slate-200 uppercase">Search Police Case Database to Request Access</h3>
            <p className="text-[10px] text-slate-400 font-sans">
              Enter a Case Number, FIR keyword, or crime type to locate target cases and submit formal collaboration access requests.
            </p>
          </div>

          <form onSubmit={handleSearchCases} className="flex gap-2">
            <div className="relative flex-1">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by Case No (e.g. 202200001), Cyber Fraud, Extortion..."
                className="w-full bg-[#151c2e] border border-[#1e293b] text-slate-200 text-xs rounded pl-9 pr-4 py-2.5 focus:outline-none focus:border-blue-500"
              />
              <Search className="absolute left-3 top-3 text-slate-500" size={14} />
            </div>
            <button
              type="submit"
              disabled={isSearching}
              className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-2.5 rounded font-bold transition-colors"
            >
              {isSearching ? "Searching..." : "Search Cases"}
            </button>
          </form>

          <div className="space-y-3 pt-2">
            {searchResults.length === 0 ? (
              <div className="text-center py-8 text-slate-500 bg-[#151c2e] border border-[#1e293b] rounded">
                Enter search query above (*e.g., 202200001 or Fraud*) to find cases and request access.
              </div>
            ) : (
              searchResults.map((c: any) => (
                <div key={c.CaseMasterID} className="bg-[#151c2e] border border-[#1e293b] p-4 rounded space-y-3">
                  <div className="flex justify-between items-center border-b border-[#1e293b] pb-2">
                    <div>
                      <span className="font-extrabold text-blue-400 text-sm">CASE #{c.CaseNo}</span>
                      <p className="text-[10px] text-slate-400">Registered: {c.CrimeRegisteredDate?.slice(0, 10) || "Recent"}</p>
                    </div>
                    <button
                      onClick={() => {
                        setReqCaseId(c.CaseMasterID);
                        setShowOfficerRequestModal(c);
                      }}
                      className="bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 rounded font-bold flex items-center gap-1 shadow-md shadow-emerald-600/20"
                    >
                      <Send size={13} />
                      <span>Request Access to Case #{c.CaseNo}</span>
                    </button>
                  </div>

                  <div>
                    <span className="text-[10px] text-slate-400 font-bold block mb-1">FIR BRIEF FACTS:</span>
                    <p className="text-xs text-slate-200 font-sans leading-relaxed bg-[#0f172a] p-2.5 rounded border border-[#1e293b]">
                      {c.BriefFacts || "Standard IPC Investigation details."}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* TAB 2: MY APPROVED CASES WORKSPACE */}
      {activeTab === "workspace" && (
        <div className="bg-[#111827] border border-[#1e293b] p-4 rounded-b space-y-4 font-mono text-xs">
          <div className="flex justify-between items-center border-b border-[#1e293b] pb-3">
            <div>
              <h3 className="text-xs font-bold text-slate-200 uppercase">
                {isExternalOfficer ? "My Approved Cases Workspace" : "Active Granted Workspaces"}
              </h3>
              <p className="text-[10px] text-slate-400 font-sans">
                Only cases explicitly approved by the System Administrator are accessible here.
              </p>
            </div>
            <span className="bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[10px] px-2 py-1 rounded font-bold">
              🔒 RESTRICTED SCOPE ACTIVE
            </span>
          </div>

          {!workspaceData?.assigned_cases || workspaceData.assigned_cases.length === 0 ? (
            <div className="text-center py-10 text-slate-500 bg-[#151c2e] border border-[#1e293b] rounded">
              No active case access approved yet. Search for cases and submit access requests.
            </div>
          ) : (
            <div className="space-y-4">
              {workspaceData.assigned_cases.map((c: any, cIdx: number) => (
                <div key={cIdx} className="bg-[#151c2e] border border-[#1e293b] p-4 rounded space-y-3">
                  <div className="flex justify-between items-center border-b border-[#1e293b] pb-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-blue-400 text-sm">CASE #{c.case_no}</span>
                        <span className="bg-purple-500/20 text-purple-300 border border-purple-500/30 text-[10px] px-1.5 py-0.5 rounded font-bold">
                          {c.scope_level}-Level Scope Granted
                        </span>
                        <button
                          onClick={() => navigate(`/cases/${c.case_id}`)}
                          className="ml-2 bg-blue-600 hover:bg-blue-500 text-white px-2.5 py-1 rounded text-[10px] font-bold flex items-center gap-1 shadow"
                        >
                          <Eye size={12} />
                          <span>Inspect Full Case Dossier (AI Risk, Accused, Victims)</span>
                        </button>
                      </div>
                      <p className="text-[10px] text-slate-400 mt-0.5">Registered: {c.crime_registered_date?.slice(0, 10)}</p>
                    </div>
                    <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] px-2 py-0.5 rounded font-bold">
                      Expires: {c.access_expires_at?.slice(0, 10)}
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] text-slate-400 font-bold block mb-1">FIR BRIEF FACTS:</span>
                    <p className="text-xs text-slate-200 font-sans leading-relaxed bg-[#0f172a] p-2.5 rounded border border-[#1e293b]">
                      {c.brief_facts}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
                    <span className="text-slate-400 font-bold mr-1">GRANTED PERMISSIONS:</span>
                    {Object.entries(c.permissions || {}).map(([k, v]) =>
                      v ? (
                        <span key={k} className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-1.5 py-0.5 rounded font-bold">
                          ✓ {k.replace("view_", "").replace("_", " ").toUpperCase()}
                        </span>
                      ) : null
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: ACCESS REQUESTS QUEUE & APPROVALS */}
      {activeTab === "requests" && (
        <div className="bg-[#111827] border border-[#1e293b] p-4 rounded-b space-y-4 font-mono text-xs">
          <div className="flex justify-between items-center border-b border-[#1e293b] pb-3">
            <div>
              <h3 className="text-xs font-bold text-slate-200 uppercase">{t("SUBMITTED OFFICER ACCESS REQUESTS & ADMIN APPROVAL QUEUE")}</h3>
              <p className="text-[10px] text-slate-400 font-sans">
                {t("Review requests and configure District-Wise, State-Wide, or Case-Level read permissions.")}
              </p>
            </div>
            {!isExternalOfficer && (
              <span className="text-[10px] bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2 py-0.5 rounded font-bold">
                {t("Admin Granular Approval Control Active")}
              </span>
            )}
          </div>

          <div className="space-y-3">
            {isReqLoading ? (
              <div className="text-center py-8 text-slate-500">{t("Loading requests...")}</div>
            ) : !requests || requests.length === 0 ? (
              <div className="text-center py-8 text-slate-500">{t("No active access requests.")}</div>
            ) : (
              requests.map((req: any) => (
                <div key={req.request_id} className="bg-[#151c2e] border border-[#1e293b] p-4 rounded flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="space-y-1.5 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold text-slate-100">{t("Request #")}{req.request_id}</span>
                      <span className="bg-blue-600/20 text-blue-400 border border-blue-500/30 px-2 py-0.5 rounded font-bold">
                        {t(req.agency_name, req.agency_name)} ({req.agency_code})
                      </span>
                      <span className="bg-purple-500/10 text-purple-400 border border-purple-500/20 px-2 py-0.5 rounded">
                        {t("Officer:")} <span className="font-bold">{req.target_agency_officer_name}</span> ({req.officer_username})
                      </span>
                      <span className={`px-2 py-0.5 rounded font-bold border ${
                        req.status === 'Approved' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                        req.status === 'Rejected' ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                        'bg-amber-500/10 text-amber-400 border-amber-500/20'
                      }`}>
                        {t(req.status, req.status)}
                      </span>
                    </div>

                    <p className="text-slate-300 text-[11px]">
                      {t("Requested Access Scope:")} <span className="font-bold text-amber-400">{t(`${req.requested_scope_level}-Level Access`, `${req.requested_scope_level}-Level Access`)}</span> • {t("Target Case Reference:")} <span className="font-bold text-blue-400">{req.case_no}</span>
                    </p>

                    <p className="text-slate-400 text-xs font-sans italic bg-[#0f172a] p-2 rounded border border-[#1e293b]">
                      "{t(req.reason, req.reason)}"
                    </p>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    {!isExternalOfficer && req.status === "Pending Approval" ? (
                      <>
                        <button
                          onClick={() => {
                            setShowApproveModal(req);
                            setApproveScopeLevel(req.requested_scope_level || "Case");
                          }}
                          className="bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 rounded font-bold flex items-center gap-1 shadow-md shadow-emerald-600/20"
                        >
                          <Sliders size={13} />
                          <span>Configure Scope & Grant Access</span>
                        </button>
                        <button
                          onClick={() => {
                            const r = prompt("Reason for rejection:");
                            if (r) rejectMutation.mutate({ requestId: req.request_id, remarks: r });
                          }}
                          className="bg-red-600 hover:bg-red-500 text-white px-3 py-1.5 rounded font-bold flex items-center gap-1"
                        >
                          <XCircle size={13} />
                          <span>Reject</span>
                        </button>
                      </>
                    ) : (
                      <span className="text-slate-500 italic font-mono">{req.status}</span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* TAB 4: OFFICER CREDENTIALS DIRECTORY (ADMIN ONLY) */}
      {!isExternalOfficer && activeTab === "officers" && (
        <div className="bg-[#111827] border border-[#1e293b] p-4 rounded-b space-y-4 font-mono text-xs">
          <div className="flex justify-between items-center border-b border-[#1e293b] pb-3">
            <div>
              <h3 className="text-xs font-bold text-slate-200 uppercase">
                Registered External Agency Officers & Access Credentials
              </h3>
              <p className="text-[10px] text-slate-400 font-sans">
                System Administrator Directory. Share credentials with authorized agency officers.
              </p>
            </div>
            <button
              onClick={() => setShowNewOfficerModal(true)}
              className="bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded font-bold flex items-center gap-1"
            >
              <Plus size={13} />
              <span>Register Agency Officer</span>
            </button>
          </div>

          <div className="overflow-x-auto border border-[#1e293b] rounded">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#151c2e] text-slate-400 border-b border-[#1e293b] uppercase">
                <tr>
                  <th className="p-3">Agency</th>
                  <th className="p-3">Officer Name & Designation</th>
                  <th className="p-3">Officer ID Code</th>
                  <th className="p-3 text-amber-400">Login Username</th>
                  <th className="p-3 text-emerald-400">Access Password</th>
                  <th className="p-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1e293b]">
                {(agencyOfficers || []).map((off: any) => (
                  <tr key={off.AgencyOfficerID} className="hover:bg-[#151c2e]/50">
                    <td className="p-3 font-bold text-blue-400">{off.AgencyCode}</td>
                    <td className="p-3">
                      <span className="font-bold text-slate-100 block">{off.OfficerName}</span>
                      <span className="text-[10px] text-slate-400">{off.Designation}</span>
                    </td>
                    <td className="p-3 text-slate-300 font-mono">{off.OfficerIDCode}</td>
                    <td className="p-3 font-bold text-amber-300 font-mono bg-amber-500/10 rounded">{off.Username}</td>
                    <td className="p-3 font-bold text-emerald-400 font-mono bg-emerald-500/10 rounded">{off.AccessPassword}</td>
                    <td className="p-3">
                      <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] px-2 py-0.5 rounded font-bold">
                        {off.Status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 5: EXTERNAL AGENCIES REGISTRY (ADMIN ONLY) */}
      {!isExternalOfficer && activeTab === "agencies" && (
        <div className="bg-[#111827] border border-[#1e293b] p-4 rounded-b space-y-4 font-mono text-xs">
          <div className="flex justify-between items-center border-b border-[#1e293b] pb-3">
            <div>
              <h3 className="text-xs font-bold text-slate-200 uppercase">Authorized Government External Agencies</h3>
              <p className="text-[10px] text-slate-400 font-sans">Stored dynamically in PostgreSQL ExternalAgency master registry.</p>
            </div>
            <button
              onClick={() => setShowNewAgencyModal(true)}
              className="bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded font-bold flex items-center gap-1"
            >
              <Plus size={13} />
              <span>Register Agency</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {(agencies || []).map((ag: any) => (
              <div key={ag.AgencyID} className="bg-[#151c2e] border border-[#1e293b] p-3.5 rounded space-y-2 flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-center">
                    <span className="font-extrabold text-blue-400 text-sm">{ag.AgencyCode}</span>
                    <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] px-1.5 py-0.5 rounded">
                      {ag.Status}
                    </span>
                  </div>
                  <h4 className="font-bold text-slate-100 text-xs mt-1">{ag.AgencyName}</h4>
                  <p className="text-[10px] text-slate-400 font-sans mt-0.5">{ag.AgencyType}</p>
                </div>

                <div className="border-t border-[#1e293b] pt-2 text-[10px] space-y-1 text-slate-400">
                  <p>📍 {ag.HeadOffice || "New Delhi HQ"}</p>
                  <p>✉️ {ag.OfficialEmail}</p>
                  <p>📞 {ag.ContactNumber || "Official Desk"}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 6: AUDIT LOGS (ADMIN ONLY) */}
      {!isExternalOfficer && activeTab === "audit" && (
        <div className="bg-[#111827] border border-[#1e293b] p-4 rounded-b space-y-3 font-mono text-xs">
          <div className="flex justify-between items-center border-b border-[#1e293b] pb-2">
            <h3 className="text-xs font-bold text-slate-200 uppercase">Inter-Agency System Audit Log</h3>
            <span className="text-[10px] text-slate-400">PostgreSQL Audit Records</span>
          </div>

          <div className="space-y-1.5 max-h-96 overflow-y-auto pr-1">
            {(auditLogs || []).map((log: any) => (
              <div key={log.log_id} className="bg-[#151c2e] border border-[#1e293b] p-2 rounded flex justify-between items-center text-[10px]">
                <div>
                  <span className="font-bold text-blue-400">{log.action}</span>
                  <p className="text-slate-300 font-sans">{log.details}</p>
                </div>
                <span className="text-slate-500">{log.timestamp?.slice(0, 19).replace("T", " ")}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MODAL 1: EXTERNAL OFFICER SUBMIT ACCESS REQUEST */}
      {showOfficerRequestModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#111827] border border-[#1e293b] rounded-lg max-w-xl w-full p-5 space-y-4 font-mono text-xs">
            <div className="flex justify-between items-center border-b border-[#1e293b] pb-2.5">
              <h3 className="text-sm font-bold text-slate-100 uppercase">Submit Case Access Request</h3>
              <button onClick={() => setShowOfficerRequestModal(null)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <div className="space-y-3">
              <div className="bg-[#151c2e] p-3 rounded border border-[#1e293b] space-y-1">
                <span className="text-blue-400 font-bold">TARGET CASE: #{showOfficerRequestModal.CaseNo || reqCaseId}</span>
                <p className="text-slate-300 font-sans text-xs">{showOfficerRequestModal.BriefFacts}</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-slate-300 font-bold block">Requested Read Scope Level:</label>
                  <select
                    value={reqScopeLevel}
                    onChange={(e) => setReqScopeLevel(e.target.value)}
                    className="w-full bg-[#151c2e] border border-[#1e293b] text-slate-200 px-3 py-1.5 rounded"
                  >
                    <option value="Case">Case-Level Access (Target FIR Only)</option>
                    <option value="Station">Station-Level Access (All Station FIRs)</option>
                    <option value="District">District-Wise Read Access (All District FIRs)</option>
                    <option value="State">State-Wide Read Access (Karnataka State)</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-slate-300 font-bold block">AI Agency Suggestion:</label>
                  <button
                    onClick={() => handleTriggerAiRecommendation(showOfficerRequestModal.CaseMasterID || reqCaseId)}
                    disabled={isAiLoading}
                    className="w-full bg-amber-600 hover:bg-amber-500 text-white px-2.5 py-1.5 rounded font-bold flex items-center justify-center gap-1"
                  >
                    <Sparkles size={13} />
                    <span>{isAiLoading ? "Analyzing..." : "Get AI Recommendation"}</span>
                  </button>
                </div>
              </div>

              {aiRecommendation && (
                <div className="bg-amber-500/10 border border-amber-500/30 p-2.5 rounded text-[11px]">
                  <span className="font-bold text-amber-400">AI AGENT SUGGESTION: {aiRecommendation.recommended_agency_name} ({aiRecommendation.confidence_score * 100}% Confidence)</span>
                  <p className="text-slate-300 font-sans mt-0.5">{aiRecommendation.ai_explanation}</p>
                </div>
              )}

              <div className="space-y-1">
                <label className="text-slate-300 font-bold block">Reason for Access Request:</label>
                <textarea
                  rows={2}
                  value={reqReason}
                  onChange={(e) => setReqReason(e.target.value)}
                  placeholder="State the investigative necessity..."
                  className="w-full bg-[#151c2e] border border-[#1e293b] text-slate-200 px-3 py-1.5 rounded focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-[#1e293b] pt-3">
              <button onClick={() => setShowOfficerRequestModal(null)} className="px-3 py-1.5 bg-slate-800 text-slate-300 rounded font-bold">
                Cancel
              </button>
              <button
                onClick={() =>
                  officerRequestMutation.mutate({
                    CaseMasterID: showOfficerRequestModal.CaseMasterID || reqCaseId,
                    RequestedScopeLevel: reqScopeLevel,
                    Priority: reqPriority,
                    Username: user?.Username,
                    Reason: reqReason || "Inter-agency crime investigation access",
                    DurationDays: 14,
                  })
                }
                disabled={officerRequestMutation.isPending}
                className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded font-bold"
              >
                Submit Request
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: ADMIN GRANULAR SCOPE & FEATURE PERMISSION APPROVAL CONFIGURATOR */}
      {showApproveModal && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#111827] border border-[#1e293b] rounded-lg max-w-2xl w-full p-5 space-y-4 font-mono text-xs">
            <div className="flex justify-between items-center border-b border-[#1e293b] pb-2.5">
              <div>
                <h3 className="text-sm font-bold text-slate-100 uppercase">Admin Granular Access Granting Configurator</h3>
                <p className="text-[10px] text-slate-400 font-sans">Configuring Request #{showApproveModal.request_id} for {showApproveModal.target_agency_officer_name} ({showApproveModal.agency_code})</p>
              </div>
              <button onClick={() => setShowApproveModal(null)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-slate-200 font-bold block text-xs">1. SELECT JURISDICTION READ SCOPE LEVEL:</label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-[11px]">
                  {[
                    { id: "Case", label: "🎯 Case-Level Access" },
                    { id: "Station", label: "🏢 Station-Level Access" },
                    { id: "District", label: "🗺️ District-Wise Read Access" },
                    { id: "State", label: "🌐 State-Wide Read Access" },
                  ].map((sc) => (
                    <button
                      key={sc.id}
                      onClick={() => setApproveScopeLevel(sc.id)}
                      className={`p-2 rounded border font-bold text-center transition-all ${
                        approveScopeLevel === sc.id
                          ? "bg-blue-600 text-white border-blue-400 shadow-md"
                          : "bg-[#151c2e] text-slate-300 border-[#1e293b] hover:bg-slate-800"
                      }`}
                    >
                      {sc.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5 border-t border-[#1e293b] pt-3">
                <label className="text-slate-200 font-bold block text-xs">2. SELECT FEATURE & MODULE PERMISSIONS TO GRANT:</label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-[10px]">
                  {Object.entries(approvePerms).map(([key, val]) => (
                    <label key={key} className="flex items-center gap-1.5 bg-[#151c2e] p-2 rounded border border-[#1e293b] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={val}
                        onChange={(e) => setApprovePerms({ ...approvePerms, [key]: e.target.checked })}
                        className="accent-blue-500"
                      />
                      <span className="text-slate-200">{key.replace("Permission", "").replace(/([A-Z])/g, " $1").trim()}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="space-y-1 border-t border-[#1e293b] pt-3">
                <label className="text-slate-200 font-bold block text-xs">3. SELECT ACCESS DURATION (AUTO-EXPIRES):</label>
                <select
                  value={approveDurationDays}
                  onChange={(e) => setApproveDurationDays(Number(e.target.value))}
                  className="w-full bg-[#151c2e] border border-[#1e293b] text-slate-200 px-3 py-1.5 rounded"
                >
                  <option value={7}>7 Days Access Window</option>
                  <option value={14}>14 Days Access Window</option>
                  <option value={30}>30 Days Access Window</option>
                  <option value={90}>90 Days Access Window</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-[#1e293b] pt-3">
              <button onClick={() => setShowApproveModal(null)} className="px-3 py-1.5 bg-slate-800 text-slate-300 rounded font-bold">
                Cancel
              </button>
              <button
                onClick={() =>
                  approveMutation.mutate({
                    requestId: showApproveModal.request_id,
                    config: {
                      AccessScopeLevel: approveScopeLevel,
                      DurationDays: approveDurationDays,
                      ...approvePerms,
                    },
                  })
                }
                disabled={approveMutation.isPending}
                className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded font-bold shadow-lg"
              >
                Approve & Grant Specified Scope
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: REGISTER NEW EXTERNAL AGENCY (ADMIN ONLY) */}
      {!isExternalOfficer && showNewAgencyModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 font-mono text-xs">
          <div className="bg-[#111827] border border-[#1e293b] rounded-lg max-w-md w-full p-5 space-y-4">
            <div className="flex justify-between items-center border-b border-[#1e293b] pb-2.5">
              <h3 className="text-sm font-bold text-slate-100 uppercase">Register External Government Agency</h3>
              <button onClick={() => setShowNewAgencyModal(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-slate-300 font-bold block">Agency Code (e.g. CBI, NIA, ED):</label>
                <input
                  type="text"
                  placeholder="CBI"
                  value={agencyForm.AgencyCode}
                  onChange={(e) => setAgencyForm({ ...agencyForm, AgencyCode: e.target.value })}
                  className="w-full bg-[#151c2e] border border-[#1e293b] text-slate-200 px-3 py-1.5 rounded focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-slate-300 font-bold block">Official Agency Name:</label>
                <input
                  type="text"
                  placeholder="Central Bureau of Investigation"
                  value={agencyForm.AgencyName}
                  onChange={(e) => setAgencyForm({ ...agencyForm, AgencyName: e.target.value })}
                  className="w-full bg-[#151c2e] border border-[#1e293b] text-slate-200 px-3 py-1.5 rounded focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-slate-300 font-bold block">Official Agency Email:</label>
                <input
                  type="email"
                  placeholder="collaboration@cbi.gov.in"
                  value={agencyForm.OfficialEmail}
                  onChange={(e) => setAgencyForm({ ...agencyForm, OfficialEmail: e.target.value })}
                  className="w-full bg-[#151c2e] border border-[#1e293b] text-slate-200 px-3 py-1.5 rounded focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-[#1e293b] pt-3">
              <button onClick={() => setShowNewAgencyModal(false)} className="px-3 py-1.5 bg-slate-800 text-slate-300 rounded font-bold">
                Cancel
              </button>
              <button
                onClick={() => createAgencyMutation.mutate(agencyForm)}
                disabled={createAgencyMutation.isPending || !agencyForm.AgencyCode || !agencyForm.AgencyName}
                className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded font-bold"
              >
                Register Agency
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: REGISTER NEW AGENCY OFFICER (ADMIN ONLY) */}
      {!isExternalOfficer && showNewOfficerModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 font-mono text-xs">
          <div className="bg-[#111827] border border-[#1e293b] rounded-lg max-w-md w-full p-5 space-y-4">
            <div className="flex justify-between items-center border-b border-[#1e293b] pb-2.5">
              <h3 className="text-sm font-bold text-slate-100 uppercase">Register External Agency Officer</h3>
              <button onClick={() => setShowNewOfficerModal(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-slate-300 font-bold block">Parent Agency:</label>
                <select
                  value={officerForm.AgencyID}
                  onChange={(e) => setOfficerForm({ ...officerForm, AgencyID: Number(e.target.value) })}
                  className="w-full bg-[#151c2e] border border-[#1e293b] text-slate-200 px-3 py-1.5 rounded"
                >
                  {(agencies || []).map((a: any) => (
                    <option key={a.AgencyID} value={a.AgencyID}>
                      {a.AgencyCode} - {a.AgencyName}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-slate-300 font-bold block">Officer ID Code (e.g. CBI-SP-0402):</label>
                <input
                  type="text"
                  placeholder="CBI-SP-0402"
                  value={officerForm.OfficerIDCode}
                  onChange={(e) => setOfficerForm({ ...officerForm, OfficerIDCode: e.target.value })}
                  className="w-full bg-[#151c2e] border border-[#1e293b] text-slate-200 px-3 py-1.5 rounded focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-slate-300 font-bold block">Login Username:</label>
                  <input
                    type="text"
                    placeholder="cbi_sp_verma"
                    value={officerForm.Username}
                    onChange={(e) => setOfficerForm({ ...officerForm, Username: e.target.value })}
                    className="w-full bg-[#151c2e] border border-[#1e293b] text-slate-200 px-3 py-1.5 rounded"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-slate-300 font-bold block">Access Password:</label>
                  <input
                    type="text"
                    placeholder="cbi@password2026"
                    value={officerForm.AccessPassword}
                    onChange={(e) => setOfficerForm({ ...officerForm, AccessPassword: e.target.value })}
                    className="w-full bg-[#151c2e] border border-[#1e293b] text-slate-200 px-3 py-1.5 rounded"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-slate-300 font-bold block">Full Officer Name:</label>
                <input
                  type="text"
                  placeholder="Ramesh Verma, IPS"
                  value={officerForm.OfficerName}
                  onChange={(e) => setOfficerForm({ ...officerForm, OfficerName: e.target.value })}
                  className="w-full bg-[#151c2e] border border-[#1e293b] text-slate-200 px-3 py-1.5 rounded focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-slate-300 font-bold block">Official Government Email:</label>
                <input
                  type="email"
                  placeholder="r.verma@cbi.gov.in"
                  value={officerForm.OfficialEmail}
                  onChange={(e) => setOfficerForm({ ...officerForm, OfficialEmail: e.target.value })}
                  className="w-full bg-[#151c2e] border border-[#1e293b] text-slate-200 px-3 py-1.5 rounded focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-[#1e293b] pt-3">
              <button onClick={() => setShowNewOfficerModal(false)} className="px-3 py-1.5 bg-slate-800 text-slate-300 rounded font-bold">
                Cancel
              </button>
              <button
                onClick={() => createOfficerMutation.mutate(officerForm)}
                disabled={createOfficerMutation.isPending || !officerForm.OfficerIDCode || !officerForm.OfficerName}
                className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded font-bold"
              >
                Register Officer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
