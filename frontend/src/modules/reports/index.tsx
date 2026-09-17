import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { reportService } from "../../services/reportService";
import { FileText, Download, CheckCircle, Eye, X } from "lucide-react";
import { useLanguage } from "../../app/providers/LanguageContext";

export default function Reports() {
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const [caseInput, setCaseInput] = useState("");
  const [downloadingId, setDownloadingId] = useState<number | null>(null);
  const [previewBlobUrl, setPreviewBlobUrl] = useState<string | null>(null);
  const [previewTitle, setPreviewTitle] = useState<string>("");

  // Fetch report logs history
  const { data: historyData, isLoading } = useQuery({
    queryKey: ["reportHistory"],
    queryFn: () => reportService.getReportHistory(),
  });

  const history = historyData?.history || [];

  // Handle direct file download
  const handleDownload = async (reportJobId: number, caseMasterId: number) => {
    try {
      setDownloadingId(reportJobId);
      await reportService.downloadReportPdf(reportJobId, caseMasterId);
    } catch (err) {
      alert("Failed to download PDF report file.");
    } finally {
      setDownloadingId(null);
    }
  };

  // Handle in-app preview
  const handlePreview = async (reportJobId: number, caseMasterId: number) => {
    try {
      const blobUrl = await reportService.getReportBlobUrl(reportJobId);
      setPreviewBlobUrl(blobUrl);
      setPreviewTitle(`Case Dossier #${caseMasterId}`);
    } catch (err) {
      alert("Failed to load PDF preview.");
    }
  };

  // Generate Report Mutation
  const generateMutation = useMutation({
    mutationFn: (caseMasterIdOrNo: string) => reportService.generateReport(caseMasterIdOrNo),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["reportHistory"] });
      setCaseInput("");
      
      if (data?.ReportJobID) {
        handleDownload(data.ReportJobID, data.CaseMasterID);
      }
    },
    onError: (err: any) => {
      const detail = err?.response?.data?.detail || "Failed to compile dossier. Please verify the Case ID or Case Number.";
      alert(detail);
    }
  });

  return (
    <div className="space-y-6 select-none relative">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-slate-100">{t("report_title")}</h1>
        <p className="text-xs text-slate-400 mt-1">{t("report_sub")}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Compiler Form */}
        <div className="lg:col-span-1 bg-[#111827] border border-[#1e293b] rounded p-5 space-y-4">
          <h3 className="text-xs font-bold text-slate-300 font-mono uppercase tracking-wider">
            {t("COMPILE DOSSIER")}
          </h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            {t("Enter a Case Master ID (e.g. 1, 4823) or Case Number (e.g. 202600006). The platform will extract incident facts, evidence items, victims, accused profiles, vehicle logs, and AI risk metrics into a downloadable PDF.")}
          </p>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              const trimmed = caseInput.trim();
              if (trimmed) {
                generateMutation.mutate(trimmed);
              }
            }}
            className="space-y-3 pt-2"
          >
            <div>
              <label className="block text-[10px] uppercase font-mono tracking-wider text-slate-500 mb-1">
                {t("CASE ID OR CASE NUMBER")}
              </label>
              <input
                type="text"
                value={caseInput}
                onChange={(e) => setCaseInput(e.target.value)}
                required
                placeholder="e.g. 202600006 or 1"
                className="w-full bg-[#1e293b] border border-[#1e293b] text-slate-200 text-xs rounded px-3 py-2 focus:outline-none focus:border-blue-500 font-mono"
              />
            </div>

            <button
              type="submit"
              disabled={generateMutation.isPending || !caseInput.trim()}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 disabled:opacity-50 text-white rounded py-2 text-xs font-semibold uppercase tracking-wider transition-colors border border-blue-500/30 shadow-lg shadow-blue-500/10 flex items-center justify-center gap-2"
            >
              {generateMutation.isPending ? (
                <>
                  <span className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-white"></span>
                  <span>{t("Compiling PDF Dossier...")}</span>
                </>
              ) : (
                <>
                  <FileText size={14} />
                  <span>{t("COMPILE PDF REPORT")}</span>
                </>
              )}
            </button>
          </form>

          {/* Quick Dataset Exports */}
          <div className="border-t border-[#1e293b] pt-4 space-y-2">
            <h4 className="text-[10px] font-mono text-slate-400 uppercase tracking-wider font-bold">Multi-Format Dataset Exports</h4>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => reportService.downloadCsv()}
                className="bg-[#1e293b] hover:bg-slate-700 text-emerald-400 border border-emerald-500/30 rounded py-1.5 px-2 text-[11px] font-mono font-bold flex items-center justify-center gap-1 transition-colors"
              >
                <span>CSV</span>
              </button>
              <button
                type="button"
                onClick={() => reportService.downloadExcel(Number(caseInput) || 1)}
                className="bg-[#1e293b] hover:bg-slate-700 text-blue-400 border border-blue-500/30 rounded py-1.5 px-2 text-[11px] font-mono font-bold flex items-center justify-center gap-1 transition-colors"
              >
                <span>XLS</span>
              </button>
              <button
                type="button"
                onClick={() => reportService.downloadDocx(Number(caseInput) || 1)}
                className="bg-[#1e293b] hover:bg-slate-700 text-indigo-400 border border-indigo-500/30 rounded py-1.5 px-2 text-[11px] font-mono font-bold flex items-center justify-center gap-1 transition-colors"
              >
                <span>DOCX</span>
              </button>
            </div>
          </div>
        </div>

        {/* History log / Side section */}
        <div className="lg:col-span-2 bg-[#111827] border border-[#1e293b] rounded p-5 flex flex-col h-[480px]">
          <div className="flex items-center justify-between border-b border-[#1e293b] pb-2 mb-4">
            <h3 className="text-xs font-bold text-slate-300 font-mono uppercase tracking-wider flex items-center gap-2">
              <FileText className="text-blue-400" size={14} />
              <span>{t("COMPILED EXECUTIVE DOSSIERS")}</span>
            </h3>
            <span className="text-[10px] text-slate-500 font-mono">{t("Official Judicial Registry Files")}</span>
          </div>

          <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
            {isLoading ? (
              <div className="text-center py-12 text-xs text-slate-500 font-mono">{t("Retrieving report logs...")}</div>
            ) : history.length === 0 ? (
              <div className="text-center py-12 text-xs text-slate-500 font-mono">{t("No case dossiers compiled yet.")}</div>
            ) : (
              history.map((h: any, idx: number) => (
                <div key={idx} className="bg-[#151c2e] hover:bg-[#1a233a] border border-[#1e293b] hover:border-blue-500/30 p-4 rounded-lg flex items-center justify-between text-xs transition-all">
                  <div className="flex items-center gap-3.5">
                    <div className="p-2.5 bg-blue-500/10 border border-blue-500/20 rounded-md">
                      <FileText className="text-blue-400" size={18} />
                    </div>
                    <div>
                      <p className="font-semibold text-slate-100 text-sm">{t("Case Dossier #")}{h.CaseMasterID}</p>
                      <div className="flex items-center gap-3 mt-1 text-[10px] text-slate-400 font-mono">
                        <span>{t("Compiled:")} {new Date(h.CompiledAt).toLocaleString()}</span>
                        <span>•</span>
                        <span className="text-emerald-400 flex items-center gap-1 font-semibold">
                          <CheckCircle size={11} />
                          <span>{t("Ready for Export")}</span>
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handlePreview(h.ReportJobID, h.CaseMasterID)}
                      className="bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium px-3 py-1.5 rounded flex items-center gap-1.5 text-xs transition-colors border border-slate-700"
                    >
                      <Eye size={13} />
                      <span>{t("Preview")}</span>
                    </button>

                    <button
                      onClick={() => handleDownload(h.ReportJobID, h.CaseMasterID)}
                      disabled={downloadingId === h.ReportJobID}
                      className="bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 text-white font-medium px-3.5 py-1.5 rounded flex items-center gap-1.5 text-xs transition-colors shadow-sm"
                    >
                      {downloadingId === h.ReportJobID ? (
                        <span className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></span>
                      ) : (
                        <Download size={13} />
                      )}
                      <span>{t("Download PDF")}</span>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* PDF In-App Preview Modal */}
      {previewBlobUrl && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#111827] border border-[#1e293b] w-full max-w-5xl rounded-lg shadow-2xl overflow-hidden flex flex-col h-[85vh]">
            <div className="px-5 py-3.5 bg-[#151c2e] border-b border-[#1e293b] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="text-blue-400" size={18} />
                <span className="font-semibold text-slate-100 text-sm">{previewTitle} — Official Case Dossier</span>
              </div>
              <button
                onClick={() => {
                  window.URL.revokeObjectURL(previewBlobUrl);
                  setPreviewBlobUrl(null);
                }}
                className="text-slate-400 hover:text-white p-1 rounded hover:bg-slate-800 transition-colors"
              >
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 bg-slate-900">
              <iframe
                src={previewBlobUrl}
                title="Case Dossier Preview"
                className="w-full h-full border-0"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
