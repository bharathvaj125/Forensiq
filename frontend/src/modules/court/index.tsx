import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { courtService, CourtCaseItem, HearingUpdate } from "../../services/courtService";
import { useAuth } from "../../app/providers/AuthProvider";
import { useLanguage } from "../../app/providers/LanguageContext";
import DataTable from "../../components/common/DataTable";
import KpiCard from "../../components/common/KpiCard";
import { Scale, Calendar, CheckCircle, AlertTriangle, Building, X, Lock, ArrowRight, Shield, Gavel, Edit3, Eye, Info, Clock } from "lucide-react";

const PAGE_SIZE = 25;
const RISK_BADGE: Record<string, string> = {
  Severe: "text-red-300 bg-red-500/15 border-red-500/30",
  High: "text-orange-300 bg-orange-500/15 border-orange-500/30",
  Medium: "text-amber-300 bg-amber-500/15 border-amber-500/30",
  Low: "text-emerald-300 bg-emerald-500/15 border-emerald-500/30",
};

interface EditForm {
  TrialStage: string;
  NextHearingDate: string;
  JudgeBench: string;
  PublicProsecutor: string;
  DefenseCounsel: string;
  OrderNotes: string;
}

const emptyForm: EditForm = { TrialStage: "", NextHearingDate: "", JudgeBench: "", PublicProsecutor: "", DefenseCounsel: "", OrderNotes: "" };

export default function CourtCaseMonitoring() {
  const { user } = useAuth();
  const { t, translateData } = useLanguage();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const roleName = user?.role?.RoleName || "Guest";
  const canEdit = Boolean(user?.Permissions?.includes("court:update"));
  const isExternalOfficer = roleName === "ExternalAgencyOfficer";

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [stage, setStage] = useState("all");
  const [page, setPage] = useState(1);
  const [timelineCase, setTimelineCase] = useState<CourtCaseItem | null>(null);
  const [editCase, setEditCase] = useState<CourtCaseItem | null>(null);
  const [form, setForm] = useState<EditForm>(emptyForm);
  const [toast, setToast] = useState<{ text: string; ok: boolean } | null>(null);

  useEffect(() => {
    const handle = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 350);
    return () => clearTimeout(handle);
  }, [searchInput]);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["courtCases", stage, search, page],
    queryFn: () => courtService.getCases({ stage, search, limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE }),
    placeholderData: keepPreviousData,
  });

  const save = useMutation({
    mutationFn: ({ id, update }: { id: number; update: HearingUpdate }) => courtService.recordHearing(id, update),
    onSuccess: (_result, { id }) => {
      queryClient.invalidateQueries({ queryKey: ["courtCases"] });
      const saved = editCase;
      setEditCase(null);
      showToast(`${t("Hearing details saved for FIR", "ವಿಚಾರಣೆ ವಿವರಗಳನ್ನು ಉಳಿಸಲಾಗಿದೆ")} ${saved?.CaseNo ?? id}`, true);
    },
    onError: (err: any) => showToast(err?.response?.data?.detail || t("Could not save the hearing details.", "ವಿವರಗಳನ್ನು ಉಳಿಸಲು ಸಾಧ್ಯವಾಗಲಿಲ್ಲ."), false),
  });

  const showToast = (text: string, ok: boolean) => {
    setToast({ text, ok });
    setTimeout(() => setToast(null), 4000);
  };

  const stageCounts = data?.stage_counts ?? {};
  const stageNames = Object.keys(stageCounts);
  const totalAtCourt = Object.values(stageCounts).reduce((sum, n) => sum + n, 0);
  const hearings = data?.hearings;

  const openEdit = (row: CourtCaseItem) => {
    setForm({
      TrialStage: row.TrialStage || "", NextHearingDate: row.NextHearingDate || "", JudgeBench: row.JudgeBench || "",
      PublicProsecutor: row.PublicProsecutor || "", DefenseCounsel: row.DefenseCounsel || "", OrderNotes: row.OrderNotes || "",
    });
    setEditCase(row);
  };

  const submitEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editCase) return;
    // Send only what the officer changed so untouched fields keep their stored values.
    const update: HearingUpdate = {};
    (Object.keys(form) as (keyof EditForm)[]).forEach((key) => {
      const original = (editCase[key] as string | null) || "";
      if (form[key].trim() !== original) update[key] = form[key].trim();
    });
    if (!Object.keys(update).length) {
      setEditCase(null);
      return;
    }
    save.mutate({ id: editCase.CaseMasterID, update });
  };

  if (isExternalOfficer && data && totalAtCourt === 0) {
    return (
      <div className="space-y-6 select-none max-w-4xl mx-auto pt-10 font-sans">
        <div className="bg-[#111827] border border-amber-500/30 rounded-xl p-8 text-center space-y-5 shadow-2xl">
          <div className="w-16 h-16 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-full flex items-center justify-center mx-auto">
            <Lock size={32} />
          </div>
          <h2 className="text-lg font-bold text-slate-100 uppercase tracking-wider font-mono">
            {t("NO COURT-STAGE CASES SHARED WITH YOU", "ನಿಮ್ಮೊಂದಿಗೆ ಹಂಚಿಕೊಂಡ ನ್ಯಾಯಾಲಯ ಹಂತದ ಪ್ರಕರಣಗಳಿಲ್ಲ")}
          </h2>
          <p className="text-xs text-slate-400 max-w-xl mx-auto leading-relaxed">
            {t(
              "External agency officers only see the FIRs that an administrator has granted them access to. None of the cases shared with you has reached a court stage yet.",
              "ಬಾಹ್ಯ ಸಂಸ್ಥೆ ಅಧಿಕಾರಿಗಳು ಆಡಳಿತಾಧಿಕಾರಿ ಅನುಮತಿ ನೀಡಿದ ಪ್ರಕರಣಗಳನ್ನು ಮಾತ್ರ ನೋಡಬಹುದು."
            )}
          </p>
          <button
            onClick={() => navigate("/collaboration")}
            className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-mono text-xs px-5 py-2.5 rounded-lg font-bold transition-all"
          >
            <Shield size={16} />
            <span>{t("Open the Inter-Agency Vault", "ಅಂತರ-ಸಂಸ್ಥೆ ವಾಲ್ಟ್ ತೆರೆಯಿರಿ")}</span>
            <ArrowRight size={14} />
          </button>
        </div>
      </div>
    );
  }

  const columns = [
    {
      header: t("FIR & Court", "ಎಫ್.ಐ.ಆರ್ & ನ್ಯಾಯಾಲಯ"),
      accessorKey: "CaseNo",
      render: (r: CourtCaseItem) => (
        <div>
          <span className="text-blue-400 font-bold font-mono text-xs block">{r.CaseNo}</span>
          <span className="text-[10px] text-slate-400 block">{r.CourtName || t("Court not recorded", "ನ್ಯಾಯಾಲಯ ದಾಖಲಾಗಿಲ್ಲ")}</span>
          <span className="text-[9px] text-slate-500 font-mono block">{r.FIRNo}</span>
        </div>
      ),
    },
    {
      header: t("District / Station", "ಜಿಲ್ಲೆ / ಠಾಣೆ"),
      accessorKey: "PoliceStationName",
      render: (r: CourtCaseItem) => (
        <div className="text-xs text-slate-300">
          <span className="block">{translateData(r.PoliceStationName || "—")}</span>
          <span className="text-[10px] text-slate-500">{translateData(r.DistrictName || "")}</span>
        </div>
      ),
    },
    {
      header: t("Stage & AI Risk", "ಹಂತ & AI ಅಪಾಯ"),
      accessorKey: "TrialStage",
      render: (r: CourtCaseItem) => (
        <div className="space-y-1">
          <span className="inline-block bg-purple-500/10 text-purple-400 border border-purple-500/20 px-2 py-0.5 rounded text-[10px] font-mono font-bold">
            {translateData(r.TrialStage)}
          </span>
          {r.AIRiskLevel && (
            <span className={`block w-fit px-1.5 py-0.5 rounded border text-[9px] font-mono ${RISK_BADGE[r.AIRiskLevel] || ""}`}>
              {r.AIRiskLevel} {t("risk", "ಅಪಾಯ")}
            </span>
          )}
        </div>
      ),
    },
    {
      header: t("Public Prosecutor", "ಸರ್ಕಾರಿ ಅಭಿಯೋಜಕರು"),
      accessorKey: "PublicProsecutor",
      render: (r: CourtCaseItem) =>
        r.PublicProsecutor ? <span className="text-xs text-slate-300">{translateData(r.PublicProsecutor)}</span>
          : <span className="text-[10px] text-slate-600 italic">{t("Not recorded", "ದಾಖಲಾಗಿಲ್ಲ")}</span>,
    },
    {
      header: t("Next Hearing", "ಮುಂದಿನ ವಿಚಾರಣೆ"),
      accessorKey: "NextHearingDate",
      render: (r: CourtCaseItem) =>
        r.NextHearingDate ? (
          <div className="flex items-center gap-1.5 text-xs font-mono text-amber-400 font-bold">
            <Calendar size={13} />
            <span>{r.NextHearingDate}</span>
          </div>
        ) : <span className="text-[10px] text-slate-600 italic">{t("Not scheduled", "ನಿಗದಿಯಾಗಿಲ್ಲ")}</span>,
    },
    {
      header: t("Actions", "ಕಾರ್ಯಾಚರಣೆ"),
      accessorKey: "CaseMasterID",
      render: (r: CourtCaseItem) => (
        <div className="flex items-center gap-2">
          <button
            onClick={() => setTimelineCase(r)}
            className="flex items-center gap-1 bg-[#1e293b] hover:bg-[#334155] text-slate-300 border border-slate-700 px-2.5 py-1 rounded text-[11px] font-mono font-bold transition-all"
          >
            <Eye size={12} />
            <span>{t("Timeline", "ಟೈಮ್‌ಲೈನ್")}</span>
          </button>
          {canEdit ? (
            <button
              onClick={() => openEdit(r)}
              className="flex items-center gap-1 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 px-2.5 py-1 rounded text-[11px] font-mono font-bold transition-all"
            >
              <Edit3 size={12} />
              <span>{t("Update", "ಅಪ್‌ಡೇಟ್")}</span>
            </button>
          ) : (
            <span className="text-[10px] text-slate-500 font-mono italic">{t("(View only)", "(ವೀಕ್ಷಣೆ ಮಾತ್ರ)")}</span>
          )}
        </div>
      ),
    },
  ];

  const field = "w-full bg-[#1e293b] border border-[#334155] text-slate-200 text-xs rounded px-3 py-2 focus:outline-none focus:border-amber-500";

  return (
    <div className="space-y-6 select-none font-sans pb-10">
      {toast && (
        <div className={`fixed top-5 right-5 ${toast.ok ? "bg-emerald-600" : "bg-red-600"} text-white font-mono text-xs px-4 py-2.5 rounded-lg shadow-2xl z-50 flex items-center gap-2`}>
          {toast.ok ? <CheckCircle size={16} /> : <AlertTriangle size={16} />}
          <span>{toast.text}</span>
        </div>
      )}

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-[#1e293b] pb-4 gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-100 flex items-center gap-2 uppercase tracking-widest font-mono">
            <Scale className="text-blue-500" size={24} />
            {t("Court Case Monitoring Portal", "ನ್ಯಾಯಾಲಯ ಪ್ರಕರಣಗಳ ಮೇಲ್ವಿಚಾರಣೆ ಪೋರ್ಟಲ್")}
          </h1>
          <p className="text-xs text-slate-400 mt-1 flex items-start gap-1.5">
            <Info size={13} className="text-blue-400 flex-shrink-0 mt-0.5" />
            <span>
              {t(
                "Every FIR that has been charge-sheeted, is in trial or has reached judgment appears here automatically. The dataset records the court by id only, so hearing details (bench, prosecutor, next date, orders) are what officers enter below.",
                "ಚಾರ್ಜ್‌ಶೀಟ್, ವಿಚಾರಣೆ ಅಥವಾ ತೀರ್ಪಿನ ಹಂತ ತಲುಪಿದ ಪ್ರತಿ ಎಫ್.ಐ.ಆರ್ ಇಲ್ಲಿ ಸ್ವಯಂಚಾಲಿತವಾಗಿ ಕಾಣಿಸುತ್ತದೆ."
              )}
            </span>
          </p>
        </div>
        <div className={`px-3 py-1.5 rounded border text-xs font-mono font-bold flex items-center gap-2 ${canEdit ? "bg-blue-500/10 border-blue-500/20 text-blue-400" : "bg-slate-500/10 border-slate-500/20 text-slate-400"}`}>
          <Scale size={14} />
          <span>{canEdit ? t("Hearing updates authorised", "ವಿಚಾರಣೆ ಅಪ್‌ಡೇಟ್ ಅನುಮತಿಸಲಾಗಿದೆ") : t("View only", "ವೀಕ್ಷಣೆ ಮಾತ್ರ")} · {roleName}</span>
        </div>
      </div>

      {isError && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-300 text-xs rounded-lg p-4 font-mono">
          {(error as any)?.response?.data?.detail || t("The court registry could not be loaded.", "ನ್ಯಾಯಾಲಯ ನೋಂದಣಿ ಲೋಡ್ ಆಗಲಿಲ್ಲ.")}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {(stageNames.length ? stageNames : ["…", "…", "…"]).slice(0, 3).map((name) => (
          <KpiCard
            key={name}
            title={translateData(name)}
            value={isLoading ? "…" : (stageCounts[name] ?? 0).toLocaleString()}
            icon={<Gavel size={16} />}
            loading={isLoading}
            badges={totalAtCourt ? [{ label: `${(((stageCounts[name] ?? 0) / totalAtCourt) * 100).toFixed(0)}% ${t("of court-stage FIRs", "ನ್ಯಾಯಾಲಯ ಹಂತದ ಪ್ರಕರಣಗಳಲ್ಲಿ")}`, type: "neutral" }] : []}
            description={`${t("FIRs currently recorded as", "ಪ್ರಸ್ತುತ ದಾಖಲಾಗಿರುವ ಸ್ಥಿತಿ")} "${name}".`}
          />
        ))}
        <KpiCard
          title={t("Hearings in next 7 days", "ಮುಂದಿನ ೭ ದಿನಗಳ ವಿಚಾರಣೆ")}
          value={isLoading ? "…" : hearings?.next_7_days ?? 0}
          icon={<Calendar size={16} />}
          loading={isLoading}
          badges={[
            { label: `${hearings?.records ?? 0} ${t("hearing records", "ದಾಖಲೆಗಳು")}`, type: "neutral" },
            ...(hearings?.overdue ? [{ label: `${hearings.overdue} ${t("date passed", "ದಿನಾಂಕ ಮುಗಿದಿದೆ")}`, type: "warning" as const }] : []),
          ]}
          description={t("Counted from next-hearing dates officers have recorded; FIRs without one are not counted.", "ಅಧಿಕಾರಿಗಳು ದಾಖಲಿಸಿದ ವಿಚಾರಣೆ ದಿನಾಂಕಗಳ ಆಧಾರದಲ್ಲಿ.")}
        />
      </div>

      <div className="bg-[#111827] border border-[#1e293b] rounded-xl p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shadow-xl">
        <div className="flex-1 w-full sm:w-auto">
          <input
            type="text"
            placeholder={t("Search by case no, FIR number or offence text...", "ಪ್ರಕರಣ ಸಂಖ್ಯೆ, ಎಫ್.ಐ.ಆರ್ ಸಂಖ್ಯೆ ಅಥವಾ ವಿವರ ಹುಡುಕಿ...")}
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="w-full bg-[#1e293b] border border-[#334155] text-slate-200 text-xs rounded-lg px-4 py-2.5 focus:outline-none focus:border-blue-500"
          />
        </div>
        <select
          value={stage}
          onChange={(e) => { setStage(e.target.value); setPage(1); }}
          className="bg-[#1e293b] border border-[#334155] text-slate-200 text-xs rounded-lg px-3 py-2.5 focus:outline-none font-mono font-bold"
        >
          <option value="all">{t("All court stages", "ಎಲ್ಲಾ ಹಂತಗಳು")} ({totalAtCourt.toLocaleString()})</option>
          {stageNames.map((name) => (
            <option key={name} value={name}>{translateData(name)} ({(stageCounts[name] ?? 0).toLocaleString()})</option>
          ))}
        </select>
      </div>

      <div className="bg-[#111827] border border-[#1e293b] rounded-xl p-5 flex flex-col h-[560px] shadow-xl">
        <div className="flex justify-between items-center mb-4 border-b border-[#1e293b] pb-3">
          <h3 className="text-xs font-bold text-slate-300 font-mono uppercase tracking-wider flex items-center gap-2">
            <Building size={16} className="text-blue-400" />
            <span>{t("Court-stage FIR registry", "ನ್ಯಾಯಾಲಯ ಹಂತದ ಎಫ್.ಐ.ಆರ್ ನೋಂದಣಿ")}</span>
          </h3>
          <span className="text-[10px] text-slate-400 font-mono bg-[#1e293b] px-2.5 py-1 rounded">
            {data ? `${data.total.toLocaleString()} ${t("FIRs", "ಎಫ್.ಐ.ಆರ್")} · ${t("registered up to", "ನೋಂದಣಿ ದಿನಾಂಕದವರೆಗೆ")} ${data.as_of_date}` : "…"}
          </span>
        </div>
        <div className="flex-1 min-h-0">
          <DataTable
            columns={columns}
            data={data?.items ?? []}
            loading={isLoading}
            meta={data ? { total: data.total, page, pageSize: PAGE_SIZE } : undefined}
            onPageChange={setPage}
          />
        </div>
      </div>

      {timelineCase && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-[#0f172a] border border-[#1e293b] rounded-xl max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl select-none font-sans">
            <div className="p-5 border-b border-[#1e293b] flex justify-between items-center bg-[#111827] rounded-t-xl">
              <div className="flex items-center gap-2">
                <Gavel className="text-blue-400" size={20} />
                <div>
                  <h3 className="text-sm font-bold text-slate-100 font-mono">{t("Case timeline", "ಪ್ರಕರಣ ಕಾಲಾನುಕ್ರಮ")}: {timelineCase.CaseNo}</h3>
                  <p className="text-[11px] text-slate-400">{timelineCase.CourtName || t("Court not recorded", "ನ್ಯಾಯಾಲಯ ದಾಖಲಾಗಿಲ್ಲ")}</p>
                </div>
              </div>
              <button onClick={() => setTimelineCase(null)} className="text-slate-400 hover:text-slate-200 p-1 rounded hover:bg-[#1e293b]">
                <X size={18} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-5 flex-1 text-xs">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-[#111827] border border-[#1e293b] p-3.5 rounded-lg font-mono">
                <div>
                  <span className="text-[10px] text-slate-500 uppercase block">{t("Accused", "ಆರೋಪಿ")}</span>
                  <span className="text-slate-200 font-bold">{timelineCase.AccusedNames || t("None recorded", "ದಾಖಲಾಗಿಲ್ಲ")}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 uppercase block">{t("Next hearing", "ಮುಂದಿನ ವಿಚಾರಣೆ")}</span>
                  <span className="text-amber-400 font-bold">{timelineCase.NextHearingDate || t("Not scheduled", "ನಿಗದಿಯಾಗಿಲ್ಲ")}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 uppercase block">{t("Bench", "ಪೀಠ")}</span>
                  <span className="text-slate-300 font-bold">{timelineCase.JudgeBench || t("Not recorded", "ದಾಖಲಾಗಿಲ್ಲ")}</span>
                </div>
              </div>

              <p className="text-slate-300 leading-relaxed">{translateData(timelineCase.OffenceSummary)}</p>

              <div className="space-y-5 relative border-l-2 border-blue-500/30 ml-4 pl-6">
                {timelineCase.Milestones.map((m, i) => {
                  const done = m.status === "Completed";
                  return (
                    <div key={i} className="relative">
                      <div className={`absolute -left-[31px] top-0 w-4 h-4 rounded-full border-2 border-[#0f172a] flex items-center justify-center text-[9px] font-bold ${done ? "bg-emerald-500 text-black" : "bg-blue-500 text-white"}`}>
                        {done ? "✓" : "▶"}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-mono font-bold ${done ? "text-emerald-400" : "text-blue-400"}`}>{i + 1}. {translateData(m.stage)}</span>
                        <span className="text-[9px] font-mono bg-[#1e293b] text-slate-400 px-1.5 py-0.5 rounded flex items-center gap-1">
                          <Clock size={10} />
                          {m.date}
                        </span>
                      </div>
                      <p className="text-slate-300 mt-1 leading-relaxed">{m.note}</p>
                    </div>
                  );
                })}
              </div>

              {timelineCase.OrderNotes && (
                <div className="bg-[#111827] border border-[#1e293b] p-4 rounded-lg space-y-1">
                  <span className="text-[10px] text-amber-400 font-mono font-bold uppercase tracking-wider block">{t("Latest order note", "ಇತ್ತೀಚಿನ ಆದೇಶ ಟಿಪ್ಪಣಿ")}</span>
                  <p className="text-slate-300 italic">"{timelineCase.OrderNotes}"</p>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-[#1e293b] flex justify-end bg-[#111827] rounded-b-xl">
              <button onClick={() => setTimelineCase(null)} className="bg-[#1e293b] hover:bg-[#334155] text-slate-300 text-xs px-4 py-2 rounded font-mono font-bold">
                {t("Close", "ಮುಚ್ಚಿ")}
              </button>
            </div>
          </div>
        </div>
      )}

      {editCase && canEdit && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <form onSubmit={submitEdit} className="bg-[#0f172a] border border-amber-500/30 rounded-xl max-w-lg w-full flex flex-col shadow-2xl select-none font-sans">
            <div className="p-5 border-b border-[#1e293b] flex justify-between items-center bg-[#111827] rounded-t-xl">
              <div className="flex items-center gap-2">
                <Edit3 className="text-amber-400" size={18} />
                <h3 className="text-sm font-bold text-slate-100 font-mono">{t("Update hearing details", "ವಿಚಾರಣೆ ವಿವರ ಅಪ್‌ಡೇಟ್")}: {editCase.CaseNo}</h3>
              </div>
              <button type="button" onClick={() => setEditCase(null)} className="text-slate-400 hover:text-slate-200 p-1 rounded hover:bg-[#1e293b]">
                <X size={18} />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <label className="block">
                <span className="text-slate-400 font-mono block mb-1">{t("Trial stage", "ವಿಚಾರಣೆ ಹಂತ")}</span>
                <input list="court-stage-options" value={form.TrialStage} onChange={(e) => setForm({ ...form, TrialStage: e.target.value })} className={field} />
                <datalist id="court-stage-options">
                  {stageNames.map((name) => <option key={name} value={name} />)}
                </datalist>
              </label>
              <label className="block">
                <span className="text-slate-400 font-mono block mb-1">{t("Next hearing date", "ಮುಂದಿನ ವಿಚಾರಣೆ ದಿನಾಂಕ")}</span>
                <input type="date" value={form.NextHearingDate} onChange={(e) => setForm({ ...form, NextHearingDate: e.target.value })} className={field} />
              </label>
              <label className="block">
                <span className="text-slate-400 font-mono block mb-1">{t("Judge / bench", "ನ್ಯಾಯಾಧೀಶರು / ಪೀಠ")}</span>
                <input type="text" value={form.JudgeBench} onChange={(e) => setForm({ ...form, JudgeBench: e.target.value })} className={field} />
              </label>
              <label className="block">
                <span className="text-slate-400 font-mono block mb-1">{t("Public prosecutor", "ಸರ್ಕಾರಿ ಅಭಿಯೋಜಕರು")}</span>
                <input type="text" value={form.PublicProsecutor} onChange={(e) => setForm({ ...form, PublicProsecutor: e.target.value })} className={field} />
              </label>
              <label className="block">
                <span className="text-slate-400 font-mono block mb-1">{t("Defence counsel", "ಪ್ರತಿವಾದಿ ವಕೀಲರು")}</span>
                <input type="text" value={form.DefenseCounsel} onChange={(e) => setForm({ ...form, DefenseCounsel: e.target.value })} className={field} />
              </label>
              <label className="block">
                <span className="text-slate-400 font-mono block mb-1">{t("Court order / note", "ನ್ಯಾಯಾಲಯದ ಆದೇಶ / ಟಿಪ್ಪಣಿ")}</span>
                <textarea rows={3} value={form.OrderNotes} onChange={(e) => setForm({ ...form, OrderNotes: e.target.value })} className={field} />
              </label>
            </div>

            <div className="p-4 border-t border-[#1e293b] flex justify-end gap-3 bg-[#111827] rounded-b-xl">
              <button type="button" onClick={() => setEditCase(null)} className="bg-[#1e293b] hover:bg-[#334155] text-slate-300 text-xs px-4 py-2 rounded font-mono font-bold">
                {t("Cancel", "ರದ್ದುಗೊಳಿಸಿ")}
              </button>
              <button type="submit" disabled={save.isPending} className="bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white font-mono text-xs px-5 py-2 rounded font-bold">
                {save.isPending ? t("Saving…", "ಉಳಿಸಲಾಗುತ್ತಿದೆ…") : t("Save", "ಉಳಿಸಿ")}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
