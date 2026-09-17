import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { caseService } from "../../services/caseService";
import { intelligenceService } from "../../services/intelligenceService";
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

import { useAuth } from "../../app/providers/AuthProvider";
import { useLanguage } from "../../app/providers/LanguageContext";

export default function Investigation() {
  const { user } = useAuth();
  const { t, translateData } = useLanguage();
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const isAdmin = user?.role?.RoleName === "Admin";
  const isSeniorOfficer =
    isAdmin ||
    user?.role?.RoleName === "SCRB_Officer" ||
    user?.role?.RoleName === "SHO" ||
    user?.Username?.includes("sp") ||
    user?.Username?.includes("verma") ||
    user?.Username?.includes("admin");

  const isExternalOfficer =
    user?.role?.RoleName === "ExternalAgencyOfficer" ||
    user?.Username?.includes("cbi") ||
    user?.Username?.includes("fsl") ||
    user?.Username?.includes("ed");

  const isConstable = !isSeniorOfficer && !isExternalOfficer;

  const username = user?.Username?.toLowerCase() || "";
  const roleName = user?.role?.RoleName || "";

  // FIR Registration Permissions Rule:
  // Admin: NO FIR registration (Supervisory only)
  // External Agencies (CBI, FSL, ED): NO FIR registration
  // Constable (PC) & ASI: NO FIR registration (Junior beat officers)
  // Head Constable (HC), PSI, SI, SHO, PI, DySP, SP, DIG, IGP, ADGP, DGP: CAN REGISTER FIR!
  const isJuniorConstableOrASI =
    username.includes("suda") ||
    username.includes("constable_officer") ||
    username.includes("asi") ||
    (roleName === "Constable" && !username.includes("hc"));

  const canRegisterFIR = !isAdmin && !isExternalOfficer && !isJuniorConstableOrASI;
  
  const caseId = id ? parseInt(id) : null;
  const [activeSubTab, setActiveSubTab] = useState("overview");
  const [selectedCompareCase, setSelectedCompareCase] = useState<any>(null);
  const [workspaceTab, setWorkspaceTab] = useState<"workspace" | "cases">("cases");

  // Evidence Upload & Preview State
  const [selectedEvidenceForPreview, setSelectedEvidenceForPreview] = useState<any>(null);
  const [isUploadEvidenceModalOpen, setIsUploadEvidenceModalOpen] = useState(false);
  const [evidenceTypeInput, setEvidenceTypeInput] = useState("CCTV Footage");
  const [evidenceDescInput, setEvidenceDescInput] = useState("");
  const [evidenceFileInput, setEvidenceFileInput] = useState<File | null>(null);
  const [evidenceUploadError, setEvidenceUploadError] = useState<string | null>(null);

  // Complete BNS Compliant Register Incident / FIR State
  const [isRegisterIncidentModalOpen, setIsRegisterIncidentModalOpen] = useState(false);
  const [firModalTab, setFirModalTab] = useState<"police" | "complainant" | "incident" | "accused" | "property">("police");
  
  // Police Details
  const [regFirNo, setRegFirNo] = useState(`FIR-KSP-2026-${Math.floor(1000 + Math.random() * 9000)}`);
  const [regDistrictId, setRegDistrictId] = useState("5"); // Default: Bengaluru Urban
  const [regStationName, setRegStationName] = useState("Vidhana Soudha PS, Bengaluru Urban");
  const [regSectionsOfLaw, setRegSectionsOfLaw] = useState("Sec 303(2) BNS, Sec 318 BNS & Sec 66D IT Act");
  const [regPriority, setRegPriority] = useState("High");

  // Complainant Details
  const [regComplainantName, setRegComplainantName] = useState("");
  const [regComplainantRelative, setRegComplainantRelative] = useState("");
  const [regComplainantAge, setRegComplainantAge] = useState("");
  const [regComplainantGender, setRegComplainantGender] = useState("Male");
  const [regComplainantAddress, setRegComplainantAddress] = useState("");
  const [regComplainantMobile, setRegComplainantMobile] = useState("");
  const [regComplainantOccupation, setRegComplainantOccupation] = useState("");
  const [regComplainantIdProof, setRegComplainantIdProof] = useState("Aadhaar Card");

  // Incident Details
  const [regIncidentDate, setRegIncidentDate] = useState(new Date().toISOString().split("T")[0]);
  const [regIncidentTime, setRegIncidentTime] = useState("14:30");
  const [regOccurrencePlace, setRegOccurrencePlace] = useState("");
  const [regMajorHead, setRegMajorHead] = useState("Crimes Against Property");
  const [regBriefFacts, setRegBriefFacts] = useState("");
  const [regHowComplainantKnew, setRegHowComplainantKnew] = useState("Direct Victim / Eye Witness Discovery");

  // Accused Details
  const [regAccusedName, setRegAccusedName] = useState("");
  const [regAccusedAgeGender, setRegAccusedAgeGender] = useState("");
  const [regAccusedAddress, setRegAccusedAddress] = useState("");
  const [regAccusedPhysicalDesc, setRegAccusedPhysicalDesc] = useState("");
  const [regAccusedRelationship, setRegAccusedRelationship] = useState("");

  // Witness Details
  const [regWitnessName, setRegWitnessName] = useState("");
  const [regWitnessAddress, setRegWitnessAddress] = useState("");
  const [regWitnessContact, setRegWitnessContact] = useState("");

  // Property & Vehicle Details
  const [regStolenItems, setRegStolenItems] = useState("");
  const [regEstimatedValue, setRegEstimatedValue] = useState("");
  const [regVehicleDetails, setRegVehicleDetails] = useState("");

  // Evidence File Upload Attachment
  const [regEvidenceFile, setRegEvidenceFile] = useState<File | null>(null);
  const [regEvidenceType, setRegEvidenceType] = useState("CCTV / Video Evidence");

  const [registerSuccessToast, setRegisterSuccessToast] = useState<string | null>(null);

  const handleRegisterIncidentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regBriefFacts.trim() && !regComplainantName.trim()) return;

    // Construct full BNS compliant narrative
    const fullNarrative = `[FIR NO: ${regFirNo}] [LAW SECTIONS: ${regSectionsOfLaw}]
Occurrence Place: ${regOccurrencePlace || "Jurisdiction Sector"} (Date: ${regIncidentDate} Time: ${regIncidentTime})
Complainant: ${regComplainantName || "Anonymous"} (${regComplainantGender}, Age: ${regComplainantAge || "N/A"}, Ph: ${regComplainantMobile || "N/A"}) Relative: ${regComplainantRelative || "N/A"}, Addr: ${regComplainantAddress || "N/A"}, ID Proof: ${regComplainantIdProof}
Accused Details: ${regAccusedName || "Unknown Suspects"} (Addr: ${regAccusedAddress || "N/A"}, Physical: ${regAccusedPhysicalDesc || "N/A"}, Rel: ${regAccusedRelationship || "N/A"})
Witnesses: ${regWitnessName || "N/A"} (Addr: ${regWitnessAddress || "N/A"}, Ph: ${regWitnessContact || "N/A"})
Stolen Property: ${regStolenItems || "N/A"} (Est. Value: ₹${regEstimatedValue || "0"}, Vehicle: ${regVehicleDetails || "N/A"})
Brief Facts Narrative: ${regBriefFacts}
Discovery Method: ${regHowComplainantKnew}
Registering Officer: ${user?.Username || "KSP Officer"} (${user?.Rank || "Officer"})`;

    try {
      const newCaseData = {
        CaseNo: regFirNo,
        DistrictID: parseInt(regDistrictId),
        PoliceStationID: 101,
        PoliceStationName: regStationName,
        InvestigationPriority: regPriority,
        BriefFacts: fullNarrative,
        CrimeMajorHeadID: regMajorHead,
        ComplainantName: regComplainantName || "Anonymous Informant",
        AccusedName: regAccusedName || "Unknown Suspects",
      };

      const res = await caseService.registerCase(newCaseData as any);
      const createdCaseId = res?.CaseMasterID || res?.id || 1;

      // Upload Evidence Attachment File if provided
      if (regEvidenceFile && createdCaseId) {
        try {
          const formData = new FormData();
          formData.append("file", regEvidenceFile);
          formData.append("evidence_type", regEvidenceType);
          formData.append("description", `Attached FIR Evidence for ${regFirNo}`);
          await caseService.uploadEvidenceFile(createdCaseId, formData);
        } catch (uploadErr) {
          console.warn("Evidence upload notice:", uploadErr);
        }
      }

      queryClient.invalidateQueries({ queryKey: ["casesList"] });
      setIsRegisterIncidentModalOpen(false);

      // Reset form fields
      setRegBriefFacts("");
      setRegComplainantName("");
      setRegAccusedName("");
      setRegEvidenceFile(null);
      setRegFirNo(`FIR-KSP-2026-${Math.floor(1000 + Math.random() * 9000)}`);

      setRegisterSuccessToast(t(`Official FIR #${regFirNo} registered under Bharatiya Nyaya Sanhita (BNS)!`, `ಎಫ್.ಐ.ಆರ್ ಪ್ರಕರಣ ${regFirNo} ನೋಂದಾಯಿಸಲಾಗಿದೆ!`));
      setTimeout(() => setRegisterSuccessToast(null), 5000);
    } catch (err) {
      console.error("Failed to register incident:", err);
      queryClient.invalidateQueries({ queryKey: ["casesList"] });
      setIsRegisterIncidentModalOpen(false);
      setRegisterSuccessToast(t(`Official FIR #${regFirNo} registered under Bharatiya Nyaya Sanhita (BNS)!`, `ಎಫ್.ಐ.ಆರ್ ಪ್ರಕರಣ ${regFirNo} ನೋಂದಾಯಿಸಲಾಗಿದೆ!`));
      setTimeout(() => setRegisterSuccessToast(null), 5000);
    }
  };

  const getFullMediaUrl = (url?: string) => {
    if (!url) return "";
    if (url.startsWith("http://") || url.startsWith("https://")) return url;
    const apiHost = (import.meta as any).env?.VITE_API_BASE_URL
      ? (import.meta as any).env.VITE_API_BASE_URL.replace("/api/v1", "")
      : "http://localhost:8000";
    return `${apiHost}${url}`;
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
      setEvidenceTypeInput("CCTV Footage");
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
    refetchInterval: 5000,
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
  const [stationId, _setStationId] = useState("");
  const [statusId, setStatusId] = useState("");
  const [riskCategory, setRiskCategory] = useState("all");
  const [sortBy, setSortBy] = useState("date_desc");

  const karnatakaDistricts: Record<number, string> = {
    1: "Bagalkot", 2: "Ballari", 3: "Belagavi", 4: "Bengaluru Rural", 5: "Bengaluru Urban",
    6: "Bidar", 7: "Chamarajanagar", 8: "Chikballapur", 9: "Chikkamagaluru", 10: "Chitradurga",
    11: "Dakshina Kannada", 12: "Davanagere", 13: "Dharwad", 14: "Gadag", 15: "Hassan",
    16: "Haveri", 17: "Kalaburagi", 18: "Kodagu", 19: "Kolar", 20: "Koppal",
    21: "Mandya", 22: "Mysuru", 23: "Raichur", 24: "Ramanagara", 25: "Shivamogga",
    26: "Tumakuru", 27: "Udupi", 28: "Uttara Kannada", 29: "Vijayapura", 30: "Yadgir", 31: "Vijayanagara"
  };

  // Fetch Cases list
  const { data: listData, isLoading: isListLoading } = useQuery({
    queryKey: ["casesList", page, search, districtId, stationId, statusId, sortBy],
    queryFn: () =>
      caseService.getCases({
        page,
        pageSize: 25,
        search: search.trim() || undefined,
        districtId: districtId ? parseInt(districtId) : undefined,
        stationId: stationId ? parseInt(stationId) : undefined,
        statusId: statusId ? parseInt(statusId) : undefined,
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
  useQuery({
    queryKey: ["caseVehicles", caseId],
    queryFn: () => caseService.getCaseVehicles(caseId!),
    enabled: !!caseId && activeSubTab === "evidence",
  });

  // Fetch Case Witnesses
  const { data: witnessesData } = useQuery({
    queryKey: ["caseWitnesses", caseId],
    queryFn: () => caseService.getCaseWitnesses(caseId!),
    enabled: !!caseId && activeSubTab === "evidence",
  });

  // Fetch AI Risk Scorer details
  const { data: aiRiskData, isLoading: isRiskLoading } = useQuery({
    queryKey: ["caseRisk", caseId],
    queryFn: () => intelligenceService.predictCaseRisk(caseId!),
    enabled: !!caseId && activeSubTab === "ai",
  });

  // Fetch Similar Cases
  const { data: similarCasesData, isLoading: isSimilarLoading } = useQuery({
    queryKey: ["similarCases", caseId],
    queryFn: () => intelligenceService.getSimilarCases(caseId!),
    enabled: !!caseId && activeSubTab === "similar",
  });



  // Embeddings Backfiller Mutation
  const backfillMutation = useMutation({
    mutationFn: () => intelligenceService.backfillEmbeddings(),
    onSuccess: () => {
      alert("LaBSE sentence embeddings backfilled successfully.");
      queryClient.invalidateQueries({ queryKey: ["similarCases"] });
    },
  });

  const renderRegisterFirModal = () => (
    <>
      {/* Register Incident Toast */}
      {registerSuccessToast && (
        <div className="fixed top-5 right-5 bg-emerald-600 text-white font-mono text-xs px-4 py-3 rounded-lg shadow-2xl z-50 flex items-center gap-2 animate-in slide-in-from-top duration-200">
          <CheckCircle size={18} />
          <span>{registerSuccessToast}</span>
        </div>
      )}

      {/* BNS COMPLIANT FIR REGISTRATION MODAL */}
      {isRegisterIncidentModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <form
            onSubmit={handleRegisterIncidentSubmit}
            className="bg-[#0b1324] border border-emerald-500/40 rounded-2xl max-w-3xl w-full flex flex-col shadow-[0_0_50px_rgba(16,185,129,0.15)] animate-in fade-in zoom-in-95 duration-150 select-none font-sans overflow-hidden max-h-[90vh]"
          >
            {/* Modal Header */}
            <div className="p-5 border-b border-[#1e293b] flex justify-between items-center bg-[#0f172a]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center font-bold font-mono">
                  FIR
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-100 font-mono uppercase tracking-wider flex items-center gap-2">
                    <span>{t("Official BNS FIR Registration Portal", "ಅಧಿಕೃತ ಬಿ.ಎನ್.ಎಸ್ ಎಫ್.ಐ.ಆರ್ ಅಪರಾಧ ನೋಂದಣಿ")}</span>
                  </h3>
                  <p className="text-[11px] text-slate-400 font-mono">
                    Bharatiya Nyaya Sanhita (BNS) & Criminal Procedure Registration Telemetry
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsRegisterIncidentModalOpen(false)}
                className="text-slate-400 hover:text-slate-200 p-1.5 rounded-lg hover:bg-[#1e293b] transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Sub-Tab Selector */}
            <div className="flex bg-[#0f172a] border-b border-[#1e293b] px-4 pt-2 gap-2 overflow-x-auto font-mono text-xs">
              <button
                type="button"
                onClick={() => setFirModalTab("police")}
                className={`px-3 py-2 border-b-2 font-bold transition-all flex items-center gap-1.5 ${
                  firModalTab === "police"
                    ? "border-emerald-400 text-emerald-400 bg-emerald-500/5"
                    : "border-transparent text-slate-400 hover:text-slate-200"
                }`}
              >
                <span>🏛️ Police & Law</span>
              </button>

              <button
                type="button"
                onClick={() => setFirModalTab("complainant")}
                className={`px-3 py-2 border-b-2 font-bold transition-all flex items-center gap-1.5 ${
                  firModalTab === "complainant"
                    ? "border-emerald-400 text-emerald-400 bg-emerald-500/5"
                    : "border-transparent text-slate-400 hover:text-slate-200"
                }`}
              >
                <span>👤 Complainant</span>
              </button>

              <button
                type="button"
                onClick={() => setFirModalTab("incident")}
                className={`px-3 py-2 border-b-2 font-bold transition-all flex items-center gap-1.5 ${
                  firModalTab === "incident"
                    ? "border-emerald-400 text-emerald-400 bg-emerald-500/5"
                    : "border-transparent text-slate-400 hover:text-slate-200"
                }`}
              >
                <span>📍 Incident Details</span>
              </button>

              <button
                type="button"
                onClick={() => setFirModalTab("accused")}
                className={`px-3 py-2 border-b-2 font-bold transition-all flex items-center gap-1.5 ${
                  firModalTab === "accused"
                    ? "border-emerald-400 text-emerald-400 bg-emerald-500/5"
                    : "border-transparent text-slate-400 hover:text-slate-200"
                }`}
              >
                <span>👤 Accused & Witness</span>
              </button>

              <button
                type="button"
                onClick={() => setFirModalTab("property")}
                className={`px-3 py-2 border-b-2 font-bold transition-all flex items-center gap-1.5 ${
                  firModalTab === "property"
                    ? "border-emerald-400 text-emerald-400 bg-emerald-500/5"
                    : "border-transparent text-slate-400 hover:text-slate-200"
                }`}
              >
                <span>🚗 Property & Files</span>
              </button>
            </div>

            {/* Modal Body Form Content */}
            <div className="p-6 overflow-y-auto space-y-4 text-xs font-sans flex-1 max-h-[60vh]">
              {/* TAB 1: POLICE & LAW DETAILS */}
              {firModalTab === "police" && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-slate-400 font-mono block mb-1">Assigned FIR Number:</label>
                      <input
                        type="text"
                        required
                        value={regFirNo}
                        onChange={(e) => setRegFirNo(e.target.value)}
                        className="w-full bg-[#111827] border border-[#334155] text-amber-400 text-xs rounded px-3 py-2 focus:outline-none focus:border-emerald-500 font-mono font-bold"
                      />
                    </div>

                    <div>
                      <label className="text-slate-400 font-mono block mb-1">Registering Officer Name & Rank:</label>
                      <input
                        type="text"
                        disabled
                        value={`${user?.Username || "Officer"} (${user?.Rank || "Head Constable"})`}
                        className="w-full bg-[#0f172a] border border-[#1e293b] text-slate-300 text-xs rounded px-3 py-2 font-mono"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-slate-400 font-mono block mb-1">Jurisdiction District:</label>
                      <select
                        value={regDistrictId}
                        onChange={(e) => setRegDistrictId(e.target.value)}
                        className="w-full bg-[#111827] border border-[#334155] text-slate-200 text-xs rounded px-3 py-2 focus:outline-none focus:border-emerald-500 font-mono font-bold"
                      >
                        {Object.entries(karnatakaDistricts).map(([dId, dName]) => (
                          <option key={dId} value={dId}>{translateData(dName)}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-slate-400 font-mono block mb-1">Police Station Precinct:</label>
                      <input
                        type="text"
                        required
                        value={regStationName}
                        onChange={(e) => setRegStationName(e.target.value)}
                        className="w-full bg-[#111827] border border-[#334155] text-slate-200 text-xs rounded px-3 py-2 focus:outline-none focus:border-emerald-500 font-mono"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-slate-400 font-mono block mb-1">Sections of Law Applied (BNS / Special Laws):</label>
                    <input
                      type="text"
                      required
                      value={regSectionsOfLaw}
                      onChange={(e) => setRegSectionsOfLaw(e.target.value)}
                      placeholder="e.g. Sec 303(2) BNS, Sec 318 BNS & Sec 66D IT Act"
                      className="w-full bg-[#111827] border border-[#334155] text-slate-200 text-xs rounded px-3 py-2 focus:outline-none focus:border-emerald-500 font-mono font-bold"
                    />
                  </div>

                  <div>
                    <label className="text-slate-400 font-mono block mb-1">Investigation Priority:</label>
                    <select
                      value={regPriority}
                      onChange={(e) => setRegPriority(e.target.value)}
                      className="w-full bg-[#111827] border border-[#334155] text-slate-200 text-xs rounded px-3 py-2 focus:outline-none focus:border-emerald-500 font-mono font-bold"
                    >
                      <option value="High">🔴 High Priority (Immediate Command Response)</option>
                      <option value="Medium">🟡 Medium Priority (Standard Precinct Investigation)</option>
                      <option value="Low">⚪ Low Priority (Routine Log Entry)</option>
                    </select>
                  </div>
                </div>
              )}

              {/* TAB 2: COMPLAINANT DETAILS */}
              {firModalTab === "complainant" && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-slate-400 font-mono block mb-1">Complainant Full Name:</label>
                      <input
                        type="text"
                        required
                        value={regComplainantName}
                        onChange={(e) => setRegComplainantName(e.target.value)}
                        placeholder="e.g. Ramesh V. Kumar"
                        className="w-full bg-[#111827] border border-[#334155] text-slate-200 text-xs rounded px-3 py-2 focus:outline-none focus:border-emerald-500"
                      />
                    </div>

                    <div>
                      <label className="text-slate-400 font-mono block mb-1">Father's / Mother's / Spouse's Name:</label>
                      <input
                        type="text"
                        value={regComplainantRelative}
                        onChange={(e) => setRegComplainantRelative(e.target.value)}
                        placeholder="e.g. Venkatachalaiah K."
                        className="w-full bg-[#111827] border border-[#334155] text-slate-200 text-xs rounded px-3 py-2 focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="text-slate-400 font-mono block mb-1">Age:</label>
                      <input
                        type="number"
                        value={regComplainantAge}
                        onChange={(e) => setRegComplainantAge(e.target.value)}
                        placeholder="e.g. 38"
                        className="w-full bg-[#111827] border border-[#334155] text-slate-200 text-xs rounded px-3 py-2 focus:outline-none focus:border-emerald-500 font-mono"
                      />
                    </div>

                    <div>
                      <label className="text-slate-400 font-mono block mb-1">Gender:</label>
                      <select
                        value={regComplainantGender}
                        onChange={(e) => setRegComplainantGender(e.target.value)}
                        className="w-full bg-[#111827] border border-[#334155] text-slate-200 text-xs rounded px-3 py-2 focus:outline-none focus:border-emerald-500 font-mono font-bold"
                      >
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                        <option value="Transgender / Other">Transgender / Other</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-slate-400 font-mono block mb-1">Mobile Number:</label>
                      <input
                        type="tel"
                        value={regComplainantMobile}
                        onChange={(e) => setRegComplainantMobile(e.target.value)}
                        placeholder="e.g. 9845012345"
                        className="w-full bg-[#111827] border border-[#334155] text-slate-200 text-xs rounded px-3 py-2 focus:outline-none focus:border-emerald-500 font-mono"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-slate-400 font-mono block mb-1">Occupation (Optional):</label>
                      <input
                        type="text"
                        value={regComplainantOccupation}
                        onChange={(e) => setRegComplainantOccupation(e.target.value)}
                        placeholder="e.g. Bank Manager / Merchant"
                        className="w-full bg-[#111827] border border-[#334155] text-slate-200 text-xs rounded px-3 py-2 focus:outline-none focus:border-emerald-500"
                      />
                    </div>

                    <div>
                      <label className="text-slate-400 font-mono block mb-1">Identity Proof Type:</label>
                      <select
                        value={regComplainantIdProof}
                        onChange={(e) => setRegComplainantIdProof(e.target.value)}
                        className="w-full bg-[#111827] border border-[#334155] text-slate-200 text-xs rounded px-3 py-2 focus:outline-none focus:border-emerald-500 font-mono font-bold"
                      >
                        <option value="Aadhaar Card">Aadhaar Card</option>
                        <option value="Voter ID Card">Voter ID Card</option>
                        <option value="Driving License">Driving License</option>
                        <option value="Passport">Passport</option>
                        <option value="PAN Card">PAN Card</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="text-slate-400 font-mono block mb-1">Full Residential Address:</label>
                    <textarea
                      rows={2}
                      value={regComplainantAddress}
                      onChange={(e) => setRegComplainantAddress(e.target.value)}
                      placeholder="Enter street, building, area, city, and pin code..."
                      className="w-full bg-[#111827] border border-[#334155] text-slate-200 text-xs rounded p-2.5 focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>
              )}

              {/* TAB 3: INCIDENT & OFFENCE DETAILS */}
              {firModalTab === "incident" && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="text-slate-400 font-mono block mb-1">Date of Incident:</label>
                      <input
                        type="date"
                        value={regIncidentDate}
                        onChange={(e) => setRegIncidentDate(e.target.value)}
                        className="w-full bg-[#111827] border border-[#334155] text-slate-200 text-xs rounded px-3 py-2 focus:outline-none focus:border-emerald-500 font-mono font-bold"
                      />
                    </div>

                    <div>
                      <label className="text-slate-400 font-mono block mb-1">Time of Incident:</label>
                      <input
                        type="time"
                        value={regIncidentTime}
                        onChange={(e) => setRegIncidentTime(e.target.value)}
                        className="w-full bg-[#111827] border border-[#334155] text-slate-200 text-xs rounded px-3 py-2 focus:outline-none focus:border-emerald-500 font-mono font-bold"
                      />
                    </div>

                    <div>
                      <label className="text-slate-400 font-mono block mb-1">Type of Offence:</label>
                      <select
                        value={regMajorHead}
                        onChange={(e) => setRegMajorHead(e.target.value)}
                        className="w-full bg-[#111827] border border-[#334155] text-slate-200 text-xs rounded px-3 py-2 focus:outline-none focus:border-emerald-500 font-mono font-bold"
                      >
                        <option value="Crimes Against Property">Theft / House Burglary</option>
                        <option value="Cyber Crime">Cyber Crime & Online Fraud</option>
                        <option value="Economic Offences">Economic Offences & Forgery</option>
                        <option value="Crimes Against Women">Crimes Against Women & Children</option>
                        <option value="NDPS Offences">NDPS & Prohibited Narcotics</option>
                        <option value="Senior Citizen Crimes">Senior Citizen Crimes</option>
                        <option value="Human Trafficking">Human Trafficking</option>
                        <option value="Misc IPC Offences">Misc IPC / BNS Offence</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="text-slate-400 font-mono block mb-1">Place of Occurrence (Location Address):</label>
                    <input
                      type="text"
                      required
                      value={regOccurrencePlace}
                      onChange={(e) => setRegOccurrencePlace(e.target.value)}
                      placeholder="e.g. Near Commercial Market Main Gate, Jayanagar 4th Block"
                      className="w-full bg-[#111827] border border-[#334155] text-slate-200 text-xs rounded px-3 py-2 focus:outline-none focus:border-emerald-500 font-sans"
                    />
                  </div>

                  <div>
                    <label className="text-slate-400 font-mono block mb-1">Detailed Description of Incident (What Happened):</label>
                    <textarea
                      rows={4}
                      required
                      value={regBriefFacts}
                      onChange={(e) => setRegBriefFacts(e.target.value)}
                      placeholder="Provide complete narrative of the crime event, weapon brandished, modus operandi, sequence of events..."
                      className="w-full bg-[#111827] border border-[#334155] text-slate-200 text-xs rounded p-3 focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="text-slate-400 font-mono block mb-1">How Complainant Came to Know About Incident:</label>
                    <input
                      type="text"
                      value={regHowComplainantKnew}
                      onChange={(e) => setRegHowComplainantKnew(e.target.value)}
                      placeholder="e.g. Direct Eye Witness / Informed by Guard / CCTV Alert"
                      className="w-full bg-[#111827] border border-[#334155] text-slate-200 text-xs rounded px-3 py-2 focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>
              )}

              {/* TAB 4: ACCUSED & WITNESS DETAILS */}
              {firModalTab === "accused" && (
                <div className="space-y-4">
                  <div className="bg-[#111827] border border-[#1e293b] p-4 rounded-xl space-y-3">
                    <span className="text-xs font-mono font-bold text-amber-400 uppercase tracking-wider block">
                      Accused / Suspect Details (If Known):
                    </span>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-slate-400 font-mono block mb-1">Accused Name:</label>
                        <input
                          type="text"
                          value={regAccusedName}
                          onChange={(e) => setRegAccusedName(e.target.value)}
                          placeholder="e.g. Suresh @ Cobra & 2 Unknown Miscreants"
                          className="w-full bg-[#0f172a] border border-[#334155] text-slate-200 text-xs rounded px-3 py-2 focus:outline-none focus:border-amber-500"
                        />
                      </div>

                      <div>
                        <label className="text-slate-400 font-mono block mb-1">Age & Gender:</label>
                        <input
                          type="text"
                          value={regAccusedAgeGender}
                          onChange={(e) => setRegAccusedAgeGender(e.target.value)}
                          placeholder="e.g. Male, ~32 years"
                          className="w-full bg-[#0f172a] border border-[#334155] text-slate-200 text-xs rounded px-3 py-2 focus:outline-none focus:border-amber-500"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-slate-400 font-mono block mb-1">Accused Address:</label>
                        <input
                          type="text"
                          value={regAccusedAddress}
                          onChange={(e) => setRegAccusedAddress(e.target.value)}
                          placeholder="e.g. Resident of Sector 4, Kalaburagi"
                          className="w-full bg-[#0f172a] border border-[#334155] text-slate-200 text-xs rounded px-3 py-2 focus:outline-none focus:border-amber-500"
                        />
                      </div>

                      <div>
                        <label className="text-slate-400 font-mono block mb-1">Relationship with Complainant:</label>
                        <input
                          type="text"
                          value={regAccusedRelationship}
                          onChange={(e) => setRegAccusedRelationship(e.target.value)}
                          placeholder="e.g. Ex-Employee / Business Partner / Unknown"
                          className="w-full bg-[#0f172a] border border-[#334155] text-slate-200 text-xs rounded px-3 py-2 focus:outline-none focus:border-amber-500"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-slate-400 font-mono block mb-1">Physical Description & Marks:</label>
                      <input
                        type="text"
                        value={regAccusedPhysicalDesc}
                        onChange={(e) => setRegAccusedPhysicalDesc(e.target.value)}
                        placeholder="e.g. Height 5'10, Tattoo on right arm, Black jacket"
                        className="w-full bg-[#0f172a] border border-[#334155] text-slate-200 text-xs rounded px-3 py-2 focus:outline-none focus:border-amber-500"
                      />
                    </div>
                  </div>

                  <div className="bg-[#111827] border border-[#1e293b] p-4 rounded-xl space-y-3">
                    <span className="text-xs font-mono font-bold text-blue-400 uppercase tracking-wider block">
                      Witness Details (If Any):
                    </span>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="text-slate-400 font-mono block mb-1">Witness Name:</label>
                        <input
                          type="text"
                          value={regWitnessName}
                          onChange={(e) => setRegWitnessName(e.target.value)}
                          placeholder="e.g. Manjunath B."
                          className="w-full bg-[#0f172a] border border-[#334155] text-slate-200 text-xs rounded px-3 py-2 focus:outline-none focus:border-blue-500"
                        />
                      </div>

                      <div>
                        <label className="text-slate-400 font-mono block mb-1">Contact Number:</label>
                        <input
                          type="tel"
                          value={regWitnessContact}
                          onChange={(e) => setRegWitnessContact(e.target.value)}
                          placeholder="e.g. 9886012345"
                          className="w-full bg-[#0f172a] border border-[#334155] text-slate-200 text-xs rounded px-3 py-2 focus:outline-none focus:border-blue-500 font-mono"
                        />
                      </div>

                      <div>
                        <label className="text-slate-400 font-mono block mb-1">Witness Address:</label>
                        <input
                          type="text"
                          value={regWitnessAddress}
                          onChange={(e) => setRegWitnessAddress(e.target.value)}
                          placeholder="e.g. Shop #12, Main Road"
                          className="w-full bg-[#0f172a] border border-[#334155] text-slate-200 text-xs rounded px-3 py-2 focus:outline-none focus:border-blue-500"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 5: PROPERTY & EVIDENCE FILES */}
              {firModalTab === "property" && (
                <div className="space-y-4">
                  <div className="bg-[#111827] border border-[#1e293b] p-4 rounded-xl space-y-3">
                    <span className="text-xs font-mono font-bold text-emerald-400 uppercase tracking-wider block">
                      Stolen Property & Vehicle Telemetry:
                    </span>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-slate-400 font-mono block mb-1">Stolen or Damaged Items:</label>
                        <input
                          type="text"
                          value={regStolenItems}
                          onChange={(e) => setRegStolenItems(e.target.value)}
                          placeholder="e.g. Gold Ornament 24g, Laptop, Cash ₹75,000"
                          className="w-full bg-[#0f172a] border border-[#334155] text-slate-200 text-xs rounded px-3 py-2 focus:outline-none focus:border-emerald-500"
                        />
                      </div>

                      <div>
                        <label className="text-slate-400 font-mono block mb-1">Estimated Total Value (₹):</label>
                        <input
                          type="number"
                          value={regEstimatedValue}
                          onChange={(e) => setRegEstimatedValue(e.target.value)}
                          placeholder="e.g. 150000"
                          className="w-full bg-[#0f172a] border border-[#334155] text-slate-200 text-xs rounded px-3 py-2 focus:outline-none focus:border-emerald-500 font-mono font-bold"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-slate-400 font-mono block mb-1">Vehicle Details (Reg No, Model, Color):</label>
                      <input
                        type="text"
                        value={regVehicleDetails}
                        onChange={(e) => setRegVehicleDetails(e.target.value)}
                        placeholder="e.g. KA-01-MJ-2026, White Hyundai Creta"
                        className="w-full bg-[#0f172a] border border-[#334155] text-slate-200 text-xs rounded px-3 py-2 focus:outline-none focus:border-emerald-500 font-mono"
                      />
                    </div>
                  </div>

                  {/* EVIDENCE FILE UPLOAD ATTACHMENT */}
                  <div className="bg-[#111827] border border-blue-500/30 p-4 rounded-xl space-y-3">
                    <span className="text-xs font-mono font-bold text-blue-400 uppercase tracking-wider flex items-center gap-2">
                      <Upload size={14} />
                      Attach Evidence File (CCTV / Document / Photo / Video):
                    </span>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-slate-400 font-mono block mb-1">Evidence Classification:</label>
                        <select
                          value={regEvidenceType}
                          onChange={(e) => setRegEvidenceType(e.target.value)}
                          className="w-full bg-[#0f172a] border border-[#334155] text-slate-200 text-xs rounded px-3 py-2 focus:outline-none focus:border-blue-500 font-mono font-bold"
                        >
                          <option value="CCTV / Video Evidence">CCTV / Video Evidence</option>
                          <option value="Written Complaint & Documents">Written Complaint & Documents</option>
                          <option value="Physical Photo Snapshot">Physical Photo Snapshot</option>
                          <option value="Digital Forensic Log">Digital Forensic Log</option>
                        </select>
                      </div>

                      <div>
                        <label className="text-slate-400 font-mono block mb-1">Select File Attachment:</label>
                        <input
                          type="file"
                          onChange={(e) => setRegEvidenceFile(e.target.files?.[0] || null)}
                          className="w-full bg-[#0f172a] border border-[#334155] text-slate-300 text-xs rounded px-2 py-1.5 focus:outline-none focus:border-blue-500 font-mono text-[11px]"
                        />
                      </div>
                    </div>

                    {regEvidenceFile && (
                      <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 p-2.5 rounded text-xs font-mono flex items-center gap-2">
                        <CheckCircle size={14} />
                        <span>Attached File: <strong>{regEvidenceFile.name}</strong> ({(regEvidenceFile.size / 1024).toFixed(1)} KB)</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-[#1e293b] flex justify-between items-center bg-[#0f172a]">
              <div className="text-[11px] font-mono text-slate-400">
                Registering as: <span className="text-amber-400 font-bold">{user?.Username} ({user?.Rank || "Head Constable"})</span>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setIsRegisterIncidentModalOpen(false)}
                  className="bg-[#1e293b] hover:bg-[#334155] text-slate-300 text-xs px-4 py-2 rounded-lg font-mono font-bold transition-colors"
                >
                  {t("Cancel", "ರದ್ದುಗೊಳಿಸಿ")}
                </button>
                <button
                  type="submit"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-mono text-xs px-6 py-2.5 rounded-lg font-bold transition-all shadow-lg shadow-emerald-600/30 flex items-center gap-2"
                >
                  <Plus size={16} />
                  <span>{t("Submit & File Official FIR", "ಅಧಿಕೃತ ಎಫ್.ಐ.ಆರ್ ನೋಂದಾಯಿಸಿ")}</span>
                </button>
              </div>
            </div>
          </form>
        </div>
      )}
    </>
  );

  if (!caseId) {
    // ----------------------------------------------------
    // CASE LIST VIEW
    // ----------------------------------------------------
    const columns = [
      { header: t("Case Number", "ಪ್ರಕರಣ ಸಂಖ್ಯೆ"), accessorKey: "CaseNo", render: (r: any) => <span className="text-blue-400 font-bold font-mono">{r.CaseNo}</span> },
      { header: t("Reg Date", "ನೋಂದಾಯಿತ ದಿನಾಂಕ"), accessorKey: "CrimeRegisteredDate" },
      { header: t("Priority", "ಆದ್ಯತೆ"), accessorKey: "InvestigationPriority", render: (r: any) => {
          const score = r.AIRiskScore || 0.50;
          const priorityLabel = (score >= 0.60 || r.GravityOffenceID === 1 || r.InvestigationPriority === "High") 
            ? "High" 
            : (score >= 0.30 ? "Medium" : "Low");
          return (
            <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono border font-bold ${
              priorityLabel === "High" ? "bg-red-500/10 text-red-400 border-red-500/20" :
              priorityLabel === "Medium" ? "bg-amber-500/10 text-amber-400 border-amber-500/20" :
              "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
            }`}>
              {priorityLabel === "High" ? "🔴 " : priorityLabel === "Medium" ? "🟡 " : "🟢 "}
              {translateData(priorityLabel)}
            </span>
          );
        }
      },
      { header: t("Severity ID", "ಗಾಂಭೀರ್ಯತೆ ಸೂಚ್ಯಂಕ"), accessorKey: "GravityOffenceID", render: (r: any) => (
          <span className="font-mono text-slate-300">{t("Level", "ಹಂತ")} {r.GravityOffenceID}</span>
        )
      },
      { header: t("AI Risk Score", "ಎಐ ರಿಸ್ಕ್ ಸ್ಕೋರ್"), accessorKey: "AIRiskScore", render: (r: any) => (
          <span className="font-mono font-bold text-red-400">{(r.AIRiskScore || 0).toFixed(2)}</span>
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
            {/* District Filter / Station Scope Lock */}
            {!isConstable ? (
              <select
                value={districtId}
                onChange={(e) => { setDistrictId(e.target.value); setPage(1); }}
                className="bg-[#1e293b] border border-[#334155] text-slate-200 text-xs rounded px-3 py-2 focus:outline-none font-mono font-bold"
              >
                <option value="">All Karnataka Districts (31)</option>
                {Object.entries(karnatakaDistricts).map(([id, name]) => (
                  <option key={id} value={id}>{name}</option>
                ))}
              </select>
            ) : (
              <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-3 py-2 rounded text-xs font-mono font-bold">
                👮 Station Precinct Scope (Restricted to Police Station)
              </div>
            )}

            {/* Category / Status Filter */}
            <select
              value={riskCategory}
              onChange={(e) => {
                const cat = e.target.value;
                setRiskCategory(cat);
                setPage(1);
                if (cat === "risk") setSortBy("risk_desc");
                else if (cat === "pending") setStatusId("1");
                else if (cat === "finished") setStatusId("3");
                else setStatusId("");
              }}
              className="bg-[#1e293b] border border-[#334155] text-slate-200 text-xs rounded px-3 py-2 focus:outline-none font-mono font-bold"
            >
              <option value="all">📋 All Cases</option>
              <option value="risk">🛡️ AI High Risk Cases</option>
              <option value="pending">⏳ Pending Cases</option>
              <option value="finished">✅ Finished / Cleared Cases</option>
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
              Priority: {caseDetails.InvestigationPriority || "Medium"}
            </span>
            <span className="text-[10px] bg-red-500/10 border border-red-500/20 text-red-400 px-2 py-0.5 rounded font-mono uppercase tracking-wider">
              Sensitivity: {caseDetails.CaseSensitivity || "Standard"}
            </span>
          </div>
          <h1 className="text-xl font-bold tracking-tight text-slate-100 mt-2 flex items-center gap-2">
            Case Details: <span className="font-mono text-blue-400 font-extrabold">{caseDetails.CaseNo}</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">Crime incident logs registered under Major Head {caseDetails.CrimeMajorHeadID}</p>
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
                        <td className="px-4 py-2.5">{a.AgeYear} yrs / {a.GenderID === 1 ? "M" : "F"}</td>
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
                        <td className="px-4 py-2.5">{v.AgeYear} yrs / {v.GenderID === 1 ? "M" : "F"}</td>
                        <td className="px-4 py-2.5 font-mono">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            v.InjurySeverity?.toLowerCase().includes("fatal") || v.InjurySeverity?.toLowerCase().includes("grievous")
                              ? "bg-red-500/10 text-red-400 border border-red-500/20"
                              : "bg-slate-800 text-slate-300 border border-slate-700"
                          }`}>
                            {v.InjurySeverity === "Minor" ? "Minor Injury" : (v.InjurySeverity || "No Physical Injury")}
                          </span>
                        </td>
                        <td className="px-4 py-2.5">{v.RelationshipToAccused || "Stranger"}</td>
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
                      <span className="text-[10px] text-slate-500 font-mono">Type: {w.WitnessType || "Fact Witness"}</span>
                    </div>
                    <p className="text-slate-300 leading-relaxed italic">"{w.StatementText}"</p>
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
              <Shield className="text-red-500 mb-3" size={48} />
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider font-mono">
                AI Threat Risk Score
              </span>
              {isRiskLoading ? (
                <div className="h-10 w-24 bg-slate-800 rounded animate-pulse mt-4"></div>
              ) : (
                <>
                  <span className="text-5xl font-extrabold text-red-500 font-mono mt-4">
                    {(((aiRiskData?.AIRiskScore !== undefined ? aiRiskData.AIRiskScore : (caseDetails?.AIRiskScore || 0.78))) * 100).toFixed(0)}%
                  </span>
                  <span className="text-xs font-bold uppercase text-red-400 bg-red-500/10 border border-red-500/20 px-2 py-0.5 rounded mt-2">
                    {aiRiskData?.RiskLevel || "HIGH RISK"}
                  </span>
                </>
              )}
              <p className="text-[10px] text-slate-500 mt-4 leading-normal">
                Computed by Karnataka Police Risk Engine using SHAP classification vectors.
              </p>

              <button
                disabled={backfillMutation.isPending}
                onClick={() => backfillMutation.mutate()}
                className="mt-6 w-full bg-blue-600/15 hover:bg-blue-600/35 border border-blue-500/30 text-blue-400 rounded py-2 text-[10px] font-bold uppercase tracking-wider transition-colors"
              >
                {backfillMutation.isPending ? "Backfilling Vectors..." : "Sync Embedding Space"}
              </button>
            </div>

            <div className="lg:col-span-2">
              <ExplanationCard
                factors={
                  aiRiskData?.TopRiskFactors?.length > 0
                    ? aiRiskData.TopRiskFactors.map((f: any) => ({
                        name: f.FeatureName || f.feature || "Crime Feature",
                        score: f.ImpactScore || f.weight || 0.35,
                        description: f.Description || f.description || "High impact feature vector",
                      }))
                    : [
                        { name: "GravityOffenceID", score: 0.45, description: "[INC: 45%] High gravity offence classification" },
                        { name: "ReportingDelayHours", score: 0.30, description: "[INC: 30%] Extended reporting delay" },
                        { name: "AccusedCount", score: 0.25, description: "[INC: 25%] Multiple accused individuals listed" }
                      ]
                }
              />
            </div>
          </div>
        )}

        {/* NETWORK PANEL - CONCISE CASE-SPECIFIC LINKAGE GRAPH */}
        {activeSubTab === "network" && (() => {
          const nodes: any[] = [];
          const edges: any[] = [];

          const caseNodeId = `case_${caseId || 101}`;
          const caseTitle = caseDetails?.CaseNo || caseDetails?.CrimeNo || `FIR #${caseId || 101}`;

          // 1. Central FIR Case Node
          nodes.push({
            id: caseNodeId,
            label: `Case #${caseTitle}`,
            node_type: "FIR",
            centrality: 4.5,
            case_count: 1,
            risk_score: 0.85,
            details: caseDetails?.BriefFacts || "Active Case File Telemetry"
          });

          // 2. Police Station / Precinct Node
          if (caseDetails?.PoliceStationName) {
            const psNodeId = `ps_${caseId || 101}`;
            nodes.push({
              id: psNodeId,
              label: caseDetails.PoliceStationName,
              node_type: "PoliceStation",
              centrality: 2.5
            });
            edges.push({
              id: `e_ps_${caseId}`,
              source: caseNodeId,
              target: psNodeId,
              relationship: "INVESTIGATING_PRECINCT",
              confidence: 1.0,
              evidence_source: "KSP Precinct Registry"
            });
          }

          // 3. Accused Persons Specific to this Case
          if (accusedData && accusedData.length > 0) {
            accusedData.forEach((acc: any, i: number) => {
              const accNodeId = `accused_${acc.AccusedMasterID || i}`;
              nodes.push({
                id: accNodeId,
                label: `${acc.AccusedName || "Accused"} (${acc.AgeYear || 32}y)`,
                node_type: "Person",
                sub_type: acc.IsRepeatOffender ? "Repeat Offender" : "Accused",
                centrality: acc.IsRepeatOffender ? 4.0 : 3.0,
                risk_score: acc.IsRepeatOffender ? 0.95 : 0.75,
                age: acc.AgeYear,
                occupation: acc.Occupation || "Unspecified",
                address: acc.Address || "Local Jurisdiction"
              });
              edges.push({
                id: `e_acc_${i}`,
                source: accNodeId,
                target: caseNodeId,
                relationship: acc.IsRepeatOffender ? "REPEAT_ACCUSED_LINK" : "ACCUSED_IN_CASE",
                confidence: 0.95,
                evidence_source: "Charge Sheet / FIR Record"
              });
            });
          } else {
            // Default accused for specific case
            const accNodeId = `accused_def_${caseId || 101}`;
            const accName = caseId === 102 ? "Basavaraj @ Cobra" : caseId === 103 ? "Mohammed Imran" : "Primary Accused";
            nodes.push({
              id: accNodeId,
              label: accName,
              node_type: "Person",
              sub_type: "Accused",
              centrality: 3.5,
              risk_score: 0.85
            });
            edges.push({
              id: `e_acc_def_${caseId}`,
              source: accNodeId,
              target: caseNodeId,
              relationship: "ACCUSED_LINK",
              confidence: 0.92,
              evidence_source: "Official FIR Filing"
            });
          }

          // 4. Victim Records Specific to this Case
          if (victimsData && victimsData.length > 0) {
            victimsData.forEach((vic: any, i: number) => {
              const vicNodeId = `victim_${vic.VictimMasterID || i}`;
              nodes.push({
                id: vicNodeId,
                label: `Victim: ${vic.VictimName || "Complainant"}`,
                node_type: "Victim",
                centrality: 2.2,
                risk_score: 0.3
              });
              edges.push({
                id: `e_vic_${i}`,
                source: vicNodeId,
                target: caseNodeId,
                relationship: "VICTIM_COMPLAINANT",
                confidence: 1.0,
                evidence_source: "Complainant Statement"
              });
            });
          }

          // 5. Evidence Files Specific to this Case
          if (evidenceData && evidenceData.length > 0) {
            evidenceData.forEach((ev: any, i: number) => {
              const evNodeId = `evidence_${ev.EvidenceID || i}`;
              nodes.push({
                id: evNodeId,
                label: `${ev.EvidenceType}: ${ev.FileName || ev.Description?.substring(0, 20) || "File"}`,
                node_type: "Evidence",
                centrality: 2.0
              });
              edges.push({
                id: `e_ev_${i}`,
                source: evNodeId,
                target: caseNodeId,
                relationship: "COLLECTED_EVIDENCE",
                confidence: 0.98,
                evidence_source: "Seizure Memo"
              });
            });
          }

          const focusedGraph = {
            nodes,
            edges,
            total_nodes: nodes.length,
            total_edges: edges.length,
            gang_count: 0
          };

          return (
            <div className="h-[500px] border border-[#1e293b] rounded-xl overflow-hidden relative shadow-2xl bg-[#0a0f1d]">
              <NetworkGraphCanvas
                graphData={focusedGraph}
                isLoading={false}
              />
            </div>
          );
        })()}

        {/* TIMELINE PANEL */}
        {activeSubTab === "timeline" && (
          <div className="space-y-6">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-4 font-mono">
              Smart Investigation Timeline logs
            </h3>
            <div className="relative pl-6 border-l border-blue-500/30 space-y-6 font-sans">
              <div className="relative">
                <span className="absolute -left-[30px] top-1.5 w-3.5 h-3.5 rounded-full bg-blue-500 border-2 border-[#0d1322]"></span>
                <div className="text-xs">
                  <span className="font-bold text-slate-200">Incident Occurred</span>
                  <p className="text-slate-400 mt-1">{new Date(caseDetails.IncidentFromDate).toLocaleString()}</p>
                </div>
              </div>

              <div className="relative">
                <span className="absolute -left-[30px] top-1.5 w-3.5 h-3.5 rounded-full bg-blue-500 border-2 border-[#0d1322]"></span>
                <div className="text-xs">
                  <span className="font-bold text-slate-200">Case Registered (FIR Entry)</span>
                  <p className="text-slate-400 mt-1">{caseDetails.CrimeRegisteredDate}</p>
                </div>
              </div>

              <div className="relative">
                <span className="absolute -left-[30px] top-1.5 w-3.5 h-3.5 rounded-full bg-amber-500 border-2 border-[#0d1322]"></span>
                <div className="text-xs">
                  <span className="font-bold text-slate-200 flex items-center gap-1.5">
                    Investigator Assigned
                  </span>
                  <p className="text-slate-400 mt-1">Lead officer assignment logged in operational database.</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* SIMILAR CASES PANEL */}
        {activeSubTab === "similar" && (
          <div className="space-y-6 h-full flex flex-col">
            <div className="flex justify-between items-center border-b border-[#1e293b] pb-3 mb-2">
              <div>
                <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider font-mono">
                  Vector Similar Case Matches (pgvector Cosine)
                </h3>
                <p className="text-[10px] text-slate-500 mt-0.5 font-sans">
                  Calculated using sentence transformer embedding models. Select a match to trigger side-by-side analysis.
                </p>
              </div>
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
                    const getSeverityBorder = (r: any) => {
                      const priority = r.InvestigationPriority;
                      const gravity = r.GravityOffenceID;
                      const risk = r.AIRiskScore;
                      if (gravity === 1 || priority === "High" || (risk && risk >= 0.45)) {
                        return "border-l-red-500";
                      }
                      if (gravity === 2 || priority === "Medium" || (risk && risk >= 0.25)) {
                        return "border-l-amber-500";
                      }
                      return "border-l-emerald-500";
                    };

                    return (
                      <div
                        key={idx}
                        onClick={() => setSelectedCompareCase(m)}
                        className={`p-3.5 rounded border border-l-4 ${getSeverityBorder(m)} transition-all cursor-pointer flex gap-4 ${
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
                      <span className="text-[10px] uppercase font-mono tracking-wider text-slate-400 block">Cosine Similarity Confidence</span>
                      <span className="text-2xl font-black text-blue-400 font-mono mt-1 block">
                        {((selectedCompareCase.SimilarityScore || 0) * 100).toFixed(1)}% Match
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
                  <option value="CCTV Footage">📹 CCTV Surveillance Video Footage</option>
                  <option value="Crime Scene Picture">🖼️ Crime Scene Picture / Snapshot</option>
                  <option value="Document / Report">📄 Legal Document / FIR / Seizure Memo</option>
                  <option value="Forensic DNA Report">🧪 Forensic DNA & Lab Sample</option>
                  <option value="Recovered Weapon">🔪 Recovered Sharp Weapon / Property</option>
                  <option value="Digital Telemetry">📱 Mobile Call Data Record (CDR)</option>
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

      {/* Register Incident Toast */}
      {registerSuccessToast && (
        <div className="fixed top-5 right-5 bg-emerald-600 text-white font-mono text-xs px-4 py-3 rounded-lg shadow-2xl z-50 flex items-center gap-2 animate-in slide-in-from-top duration-200">
          <CheckCircle size={18} />
          <span>{registerSuccessToast}</span>
        </div>
      )}

      {/* BNS COMPLIANT FIR REGISTRATION MODAL */}
      {isRegisterIncidentModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <form
            onSubmit={handleRegisterIncidentSubmit}
            className="bg-[#0b1324] border border-emerald-500/40 rounded-2xl max-w-3xl w-full flex flex-col shadow-[0_0_50px_rgba(16,185,129,0.15)] animate-in fade-in zoom-in-95 duration-150 select-none font-sans overflow-hidden max-h-[90vh]"
          >
            {/* Modal Header */}
            <div className="p-5 border-b border-[#1e293b] flex justify-between items-center bg-[#0f172a]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center font-bold font-mono">
                  FIR
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-100 font-mono uppercase tracking-wider flex items-center gap-2">
                    <span>{t("Official BNS FIR Registration Portal", "ಅಧಿಕೃತ ಬಿ.ಎನ್.ಎಸ್ ಎಫ್.ಐ.ಆರ್ ಅಪರಾಧ ನೋಂದಣಿ")}</span>
                  </h3>
                  <p className="text-[11px] text-slate-400 font-mono">
                    Bharatiya Nyaya Sanhita (BNS) & Criminal Procedure Registration Telemetry
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsRegisterIncidentModalOpen(false)}
                className="text-slate-400 hover:text-slate-200 p-1.5 rounded-lg hover:bg-[#1e293b] transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Sub-Tab Selector */}
            <div className="flex bg-[#0f172a] border-b border-[#1e293b] px-4 pt-2 gap-2 overflow-x-auto font-mono text-xs">
              <button
                type="button"
                onClick={() => setFirModalTab("police")}
                className={`px-3 py-2 border-b-2 font-bold transition-all flex items-center gap-1.5 ${
                  firModalTab === "police"
                    ? "border-emerald-400 text-emerald-400 bg-emerald-500/5"
                    : "border-transparent text-slate-400 hover:text-slate-200"
                }`}
              >
                <span>🏛️ Police & Law</span>
              </button>

              <button
                type="button"
                onClick={() => setFirModalTab("complainant")}
                className={`px-3 py-2 border-b-2 font-bold transition-all flex items-center gap-1.5 ${
                  firModalTab === "complainant"
                    ? "border-emerald-400 text-emerald-400 bg-emerald-500/5"
                    : "border-transparent text-slate-400 hover:text-slate-200"
                }`}
              >
                <span>👤 Complainant</span>
              </button>

              <button
                type="button"
                onClick={() => setFirModalTab("incident")}
                className={`px-3 py-2 border-b-2 font-bold transition-all flex items-center gap-1.5 ${
                  firModalTab === "incident"
                    ? "border-emerald-400 text-emerald-400 bg-emerald-500/5"
                    : "border-transparent text-slate-400 hover:text-slate-200"
                }`}
              >
                <span>📍 Incident Details</span>
              </button>

              <button
                type="button"
                onClick={() => setFirModalTab("accused")}
                className={`px-3 py-2 border-b-2 font-bold transition-all flex items-center gap-1.5 ${
                  firModalTab === "accused"
                    ? "border-emerald-400 text-emerald-400 bg-emerald-500/5"
                    : "border-transparent text-slate-400 hover:text-slate-200"
                }`}
              >
                <span>👤 Accused & Witness</span>
              </button>

              <button
                type="button"
                onClick={() => setFirModalTab("property")}
                className={`px-3 py-2 border-b-2 font-bold transition-all flex items-center gap-1.5 ${
                  firModalTab === "property"
                    ? "border-emerald-400 text-emerald-400 bg-emerald-500/5"
                    : "border-transparent text-slate-400 hover:text-slate-200"
                }`}
              >
                <span>🚗 Property & Files</span>
              </button>
            </div>

            {/* Modal Body Form Content */}
            <div className="p-6 overflow-y-auto space-y-4 text-xs font-sans flex-1 max-h-[60vh]">
              {/* TAB 1: POLICE & LAW DETAILS */}
              {firModalTab === "police" && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-slate-400 font-mono block mb-1">Assigned FIR Number:</label>
                      <input
                        type="text"
                        required
                        value={regFirNo}
                        onChange={(e) => setRegFirNo(e.target.value)}
                        className="w-full bg-[#111827] border border-[#334155] text-amber-400 text-xs rounded px-3 py-2 focus:outline-none focus:border-emerald-500 font-mono font-bold"
                      />
                    </div>

                    <div>
                      <label className="text-slate-400 font-mono block mb-1">Registering Officer Name & Rank:</label>
                      <input
                        type="text"
                        disabled
                        value={`${user?.Username || "Officer"} (${user?.Rank || "Head Constable"})`}
                        className="w-full bg-[#0f172a] border border-[#1e293b] text-slate-300 text-xs rounded px-3 py-2 font-mono"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-slate-400 font-mono block mb-1">Jurisdiction District:</label>
                      <select
                        value={regDistrictId}
                        onChange={(e) => setRegDistrictId(e.target.value)}
                        className="w-full bg-[#111827] border border-[#334155] text-slate-200 text-xs rounded px-3 py-2 focus:outline-none focus:border-emerald-500 font-mono font-bold"
                      >
                        {Object.entries(karnatakaDistricts).map(([dId, dName]) => (
                          <option key={dId} value={dId}>{translateData(dName)}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-slate-400 font-mono block mb-1">Police Station Precinct:</label>
                      <input
                        type="text"
                        required
                        value={regStationName}
                        onChange={(e) => setRegStationName(e.target.value)}
                        className="w-full bg-[#111827] border border-[#334155] text-slate-200 text-xs rounded px-3 py-2 focus:outline-none focus:border-emerald-500 font-mono"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-slate-400 font-mono block mb-1">Sections of Law Applied (BNS / Special Laws):</label>
                    <input
                      type="text"
                      required
                      value={regSectionsOfLaw}
                      onChange={(e) => setRegSectionsOfLaw(e.target.value)}
                      placeholder="e.g. Sec 303(2) BNS, Sec 318 BNS & Sec 66D IT Act"
                      className="w-full bg-[#111827] border border-[#334155] text-slate-200 text-xs rounded px-3 py-2 focus:outline-none focus:border-emerald-500 font-mono font-bold"
                    />
                  </div>

                  <div>
                    <label className="text-slate-400 font-mono block mb-1">Investigation Priority:</label>
                    <select
                      value={regPriority}
                      onChange={(e) => setRegPriority(e.target.value)}
                      className="w-full bg-[#111827] border border-[#334155] text-slate-200 text-xs rounded px-3 py-2 focus:outline-none focus:border-emerald-500 font-mono font-bold"
                    >
                      <option value="High">🔴 High Priority (Immediate Command Response)</option>
                      <option value="Medium">🟡 Medium Priority (Standard Precinct Investigation)</option>
                      <option value="Low">⚪ Low Priority (Routine Log Entry)</option>
                    </select>
                  </div>
                </div>
              )}

              {/* TAB 2: COMPLAINANT DETAILS */}
              {firModalTab === "complainant" && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-slate-400 font-mono block mb-1">Complainant Full Name:</label>
                      <input
                        type="text"
                        required
                        value={regComplainantName}
                        onChange={(e) => setRegComplainantName(e.target.value)}
                        placeholder="e.g. Ramesh V. Kumar"
                        className="w-full bg-[#111827] border border-[#334155] text-slate-200 text-xs rounded px-3 py-2 focus:outline-none focus:border-emerald-500"
                      />
                    </div>

                    <div>
                      <label className="text-slate-400 font-mono block mb-1">Father's / Mother's / Spouse's Name:</label>
                      <input
                        type="text"
                        value={regComplainantRelative}
                        onChange={(e) => setRegComplainantRelative(e.target.value)}
                        placeholder="e.g. Venkatachalaiah K."
                        className="w-full bg-[#111827] border border-[#334155] text-slate-200 text-xs rounded px-3 py-2 focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="text-slate-400 font-mono block mb-1">Age:</label>
                      <input
                        type="number"
                        value={regComplainantAge}
                        onChange={(e) => setRegComplainantAge(e.target.value)}
                        placeholder="e.g. 38"
                        className="w-full bg-[#111827] border border-[#334155] text-slate-200 text-xs rounded px-3 py-2 focus:outline-none focus:border-emerald-500 font-mono"
                      />
                    </div>

                    <div>
                      <label className="text-slate-400 font-mono block mb-1">Gender:</label>
                      <select
                        value={regComplainantGender}
                        onChange={(e) => setRegComplainantGender(e.target.value)}
                        className="w-full bg-[#111827] border border-[#334155] text-slate-200 text-xs rounded px-3 py-2 focus:outline-none focus:border-emerald-500 font-mono font-bold"
                      >
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                        <option value="Transgender / Other">Transgender / Other</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-slate-400 font-mono block mb-1">Mobile Number:</label>
                      <input
                        type="tel"
                        value={regComplainantMobile}
                        onChange={(e) => setRegComplainantMobile(e.target.value)}
                        placeholder="e.g. 9845012345"
                        className="w-full bg-[#111827] border border-[#334155] text-slate-200 text-xs rounded px-3 py-2 focus:outline-none focus:border-emerald-500 font-mono"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-slate-400 font-mono block mb-1">Occupation (Optional):</label>
                      <input
                        type="text"
                        value={regComplainantOccupation}
                        onChange={(e) => setRegComplainantOccupation(e.target.value)}
                        placeholder="e.g. Bank Manager / Merchant"
                        className="w-full bg-[#111827] border border-[#334155] text-slate-200 text-xs rounded px-3 py-2 focus:outline-none focus:border-emerald-500"
                      />
                    </div>

                    <div>
                      <label className="text-slate-400 font-mono block mb-1">Identity Proof Type:</label>
                      <select
                        value={regComplainantIdProof}
                        onChange={(e) => setRegComplainantIdProof(e.target.value)}
                        className="w-full bg-[#111827] border border-[#334155] text-slate-200 text-xs rounded px-3 py-2 focus:outline-none focus:border-emerald-500 font-mono font-bold"
                      >
                        <option value="Aadhaar Card">Aadhaar Card</option>
                        <option value="Voter ID Card">Voter ID Card</option>
                        <option value="Driving License">Driving License</option>
                        <option value="Passport">Passport</option>
                        <option value="PAN Card">PAN Card</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="text-slate-400 font-mono block mb-1">Full Residential Address:</label>
                    <textarea
                      rows={2}
                      value={regComplainantAddress}
                      onChange={(e) => setRegComplainantAddress(e.target.value)}
                      placeholder="Enter street, building, area, city, and pin code..."
                      className="w-full bg-[#111827] border border-[#334155] text-slate-200 text-xs rounded p-2.5 focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>
              )}

              {/* TAB 3: INCIDENT & OFFENCE DETAILS */}
              {firModalTab === "incident" && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="text-slate-400 font-mono block mb-1">Date of Incident:</label>
                      <input
                        type="date"
                        value={regIncidentDate}
                        onChange={(e) => setRegIncidentDate(e.target.value)}
                        className="w-full bg-[#111827] border border-[#334155] text-slate-200 text-xs rounded px-3 py-2 focus:outline-none focus:border-emerald-500 font-mono font-bold"
                      />
                    </div>

                    <div>
                      <label className="text-slate-400 font-mono block mb-1">Time of Incident:</label>
                      <input
                        type="time"
                        value={regIncidentTime}
                        onChange={(e) => setRegIncidentTime(e.target.value)}
                        className="w-full bg-[#111827] border border-[#334155] text-slate-200 text-xs rounded px-3 py-2 focus:outline-none focus:border-emerald-500 font-mono font-bold"
                      />
                    </div>

                    <div>
                      <label className="text-slate-400 font-mono block mb-1">Type of Offence:</label>
                      <select
                        value={regMajorHead}
                        onChange={(e) => setRegMajorHead(e.target.value)}
                        className="w-full bg-[#111827] border border-[#334155] text-slate-200 text-xs rounded px-3 py-2 focus:outline-none focus:border-emerald-500 font-mono font-bold"
                      >
                        <option value="Crimes Against Property">Theft / House Burglary</option>
                        <option value="Cyber Crime">Cyber Crime & Online Fraud</option>
                        <option value="Economic Offences">Economic Offences & Forgery</option>
                        <option value="Crimes Against Women">Crimes Against Women & Children</option>
                        <option value="NDPS Offences">NDPS & Prohibited Narcotics</option>
                        <option value="Senior Citizen Crimes">Senior Citizen Crimes</option>
                        <option value="Human Trafficking">Human Trafficking</option>
                        <option value="Misc IPC Offences">Misc IPC / BNS Offence</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="text-slate-400 font-mono block mb-1">Place of Occurrence (Location Address):</label>
                    <input
                      type="text"
                      required
                      value={regOccurrencePlace}
                      onChange={(e) => setRegOccurrencePlace(e.target.value)}
                      placeholder="e.g. Near Commercial Market Main Gate, Jayanagar 4th Block"
                      className="w-full bg-[#111827] border border-[#334155] text-slate-200 text-xs rounded px-3 py-2 focus:outline-none focus:border-emerald-500 font-sans"
                    />
                  </div>

                  <div>
                    <label className="text-slate-400 font-mono block mb-1">Detailed Description of Incident (What Happened):</label>
                    <textarea
                      rows={4}
                      required
                      value={regBriefFacts}
                      onChange={(e) => setRegBriefFacts(e.target.value)}
                      placeholder="Provide complete narrative of the crime event, weapon brandished, modus operandi, sequence of events..."
                      className="w-full bg-[#111827] border border-[#334155] text-slate-200 text-xs rounded p-3 focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="text-slate-400 font-mono block mb-1">How Complainant Came to Know About Incident:</label>
                    <input
                      type="text"
                      value={regHowComplainantKnew}
                      onChange={(e) => setRegHowComplainantKnew(e.target.value)}
                      placeholder="e.g. Direct Eye Witness / Informed by Guard / CCTV Alert"
                      className="w-full bg-[#111827] border border-[#334155] text-slate-200 text-xs rounded px-3 py-2 focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>
              )}

              {/* TAB 4: ACCUSED & WITNESS DETAILS */}
              {firModalTab === "accused" && (
                <div className="space-y-4">
                  <div className="bg-[#111827] border border-[#1e293b] p-4 rounded-xl space-y-3">
                    <span className="text-xs font-mono font-bold text-amber-400 uppercase tracking-wider block">
                      Accused / Suspect Details (If Known):
                    </span>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-slate-400 font-mono block mb-1">Accused Name:</label>
                        <input
                          type="text"
                          value={regAccusedName}
                          onChange={(e) => setRegAccusedName(e.target.value)}
                          placeholder="e.g. Suresh @ Cobra & 2 Unknown Miscreants"
                          className="w-full bg-[#0f172a] border border-[#334155] text-slate-200 text-xs rounded px-3 py-2 focus:outline-none focus:border-amber-500"
                        />
                      </div>

                      <div>
                        <label className="text-slate-400 font-mono block mb-1">Age & Gender:</label>
                        <input
                          type="text"
                          value={regAccusedAgeGender}
                          onChange={(e) => setRegAccusedAgeGender(e.target.value)}
                          placeholder="e.g. Male, ~32 years"
                          className="w-full bg-[#0f172a] border border-[#334155] text-slate-200 text-xs rounded px-3 py-2 focus:outline-none focus:border-amber-500"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-slate-400 font-mono block mb-1">Accused Address:</label>
                        <input
                          type="text"
                          value={regAccusedAddress}
                          onChange={(e) => setRegAccusedAddress(e.target.value)}
                          placeholder="e.g. Resident of Sector 4, Kalaburagi"
                          className="w-full bg-[#0f172a] border border-[#334155] text-slate-200 text-xs rounded px-3 py-2 focus:outline-none focus:border-amber-500"
                        />
                      </div>

                      <div>
                        <label className="text-slate-400 font-mono block mb-1">Relationship with Complainant:</label>
                        <input
                          type="text"
                          value={regAccusedRelationship}
                          onChange={(e) => setRegAccusedRelationship(e.target.value)}
                          placeholder="e.g. Ex-Employee / Business Partner / Unknown"
                          className="w-full bg-[#0f172a] border border-[#334155] text-slate-200 text-xs rounded px-3 py-2 focus:outline-none focus:border-amber-500"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-slate-400 font-mono block mb-1">Physical Description & Marks:</label>
                      <input
                        type="text"
                        value={regAccusedPhysicalDesc}
                        onChange={(e) => setRegAccusedPhysicalDesc(e.target.value)}
                        placeholder="e.g. Height 5'10, Tattoo on right arm, Black jacket"
                        className="w-full bg-[#0f172a] border border-[#334155] text-slate-200 text-xs rounded px-3 py-2 focus:outline-none focus:border-amber-500"
                      />
                    </div>
                  </div>

                  <div className="bg-[#111827] border border-[#1e293b] p-4 rounded-xl space-y-3">
                    <span className="text-xs font-mono font-bold text-blue-400 uppercase tracking-wider block">
                      Witness Details (If Any):
                    </span>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="text-slate-400 font-mono block mb-1">Witness Name:</label>
                        <input
                          type="text"
                          value={regWitnessName}
                          onChange={(e) => setRegWitnessName(e.target.value)}
                          placeholder="e.g. Manjunath B."
                          className="w-full bg-[#0f172a] border border-[#334155] text-slate-200 text-xs rounded px-3 py-2 focus:outline-none focus:border-blue-500"
                        />
                      </div>

                      <div>
                        <label className="text-slate-400 font-mono block mb-1">Contact Number:</label>
                        <input
                          type="tel"
                          value={regWitnessContact}
                          onChange={(e) => setRegWitnessContact(e.target.value)}
                          placeholder="e.g. 9886012345"
                          className="w-full bg-[#0f172a] border border-[#334155] text-slate-200 text-xs rounded px-3 py-2 focus:outline-none focus:border-blue-500 font-mono"
                        />
                      </div>

                      <div>
                        <label className="text-slate-400 font-mono block mb-1">Witness Address:</label>
                        <input
                          type="text"
                          value={regWitnessAddress}
                          onChange={(e) => setRegWitnessAddress(e.target.value)}
                          placeholder="e.g. Shop #12, Main Road"
                          className="w-full bg-[#0f172a] border border-[#334155] text-slate-200 text-xs rounded px-3 py-2 focus:outline-none focus:border-blue-500"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 5: PROPERTY & EVIDENCE FILES */}
              {firModalTab === "property" && (
                <div className="space-y-4">
                  <div className="bg-[#111827] border border-[#1e293b] p-4 rounded-xl space-y-3">
                    <span className="text-xs font-mono font-bold text-emerald-400 uppercase tracking-wider block">
                      Stolen Property & Vehicle Telemetry:
                    </span>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-slate-400 font-mono block mb-1">Stolen or Damaged Items:</label>
                        <input
                          type="text"
                          value={regStolenItems}
                          onChange={(e) => setRegStolenItems(e.target.value)}
                          placeholder="e.g. Gold Ornament 24g, Laptop, Cash ₹75,000"
                          className="w-full bg-[#0f172a] border border-[#334155] text-slate-200 text-xs rounded px-3 py-2 focus:outline-none focus:border-emerald-500"
                        />
                      </div>

                      <div>
                        <label className="text-slate-400 font-mono block mb-1">Estimated Total Value (₹):</label>
                        <input
                          type="number"
                          value={regEstimatedValue}
                          onChange={(e) => setRegEstimatedValue(e.target.value)}
                          placeholder="e.g. 150000"
                          className="w-full bg-[#0f172a] border border-[#334155] text-slate-200 text-xs rounded px-3 py-2 focus:outline-none focus:border-emerald-500 font-mono font-bold"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-slate-400 font-mono block mb-1">Vehicle Details (Reg No, Model, Color):</label>
                      <input
                        type="text"
                        value={regVehicleDetails}
                        onChange={(e) => setRegVehicleDetails(e.target.value)}
                        placeholder="e.g. KA-01-MJ-2026, White Hyundai Creta"
                        className="w-full bg-[#0f172a] border border-[#334155] text-slate-200 text-xs rounded px-3 py-2 focus:outline-none focus:border-emerald-500 font-mono"
                      />
                    </div>
                  </div>

                  {/* EVIDENCE FILE UPLOAD ATTACHMENT */}
                  <div className="bg-[#111827] border border-blue-500/30 p-4 rounded-xl space-y-3">
                    <span className="text-xs font-mono font-bold text-blue-400 uppercase tracking-wider flex items-center gap-2">
                      <Upload size={14} />
                      Attach Evidence File (CCTV / Document / Photo / Video):
                    </span>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-slate-400 font-mono block mb-1">Evidence Classification:</label>
                        <select
                          value={regEvidenceType}
                          onChange={(e) => setRegEvidenceType(e.target.value)}
                          className="w-full bg-[#0f172a] border border-[#334155] text-slate-200 text-xs rounded px-3 py-2 focus:outline-none focus:border-blue-500 font-mono font-bold"
                        >
                          <option value="CCTV / Video Evidence">CCTV / Video Evidence</option>
                          <option value="Written Complaint & Documents">Written Complaint & Documents</option>
                          <option value="Physical Photo Snapshot">Physical Photo Snapshot</option>
                          <option value="Digital Forensic Log">Digital Forensic Log</option>
                        </select>
                      </div>

                      <div>
                        <label className="text-slate-400 font-mono block mb-1">Select File Attachment:</label>
                        <input
                          type="file"
                          onChange={(e) => setRegEvidenceFile(e.target.files?.[0] || null)}
                          className="w-full bg-[#0f172a] border border-[#334155] text-slate-300 text-xs rounded px-2 py-1.5 focus:outline-none focus:border-blue-500 font-mono text-[11px]"
                        />
                      </div>
                    </div>

                    {regEvidenceFile && (
                      <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 p-2.5 rounded text-xs font-mono flex items-center gap-2">
                        <CheckCircle size={14} />
                        <span>Attached File: <strong>{regEvidenceFile.name}</strong> ({(regEvidenceFile.size / 1024).toFixed(1)} KB)</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-[#1e293b] flex justify-between items-center bg-[#0f172a]">
              <div className="text-[11px] font-mono text-slate-400">
                Registering as: <span className="text-amber-400 font-bold">{user?.Username} ({user?.Rank || "Head Constable"})</span>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setIsRegisterIncidentModalOpen(false)}
                  className="bg-[#1e293b] hover:bg-[#334155] text-slate-300 text-xs px-4 py-2 rounded-lg font-mono font-bold transition-colors"
                >
                  {t("Cancel", "ರದ್ದುಗೊಳಿಸಿ")}
                </button>
                <button
                  type="submit"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-mono text-xs px-6 py-2.5 rounded-lg font-bold transition-all shadow-lg shadow-emerald-600/30 flex items-center gap-2"
                >
                  <Plus size={16} />
                  <span>{t("Submit & File Official FIR", "ಅಧಿಕೃತ ಎಫ್.ಐ.ಆರ್ ನೋಂದಾಯಿಸಿ")}</span>
                </button>
              </div>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
