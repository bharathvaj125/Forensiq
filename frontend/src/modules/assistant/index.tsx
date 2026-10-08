import { useState, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { assistantService } from "../../services/assistantService";
import { reportService } from "../../services/reportService";
import { X, Send, ShieldCheck, FileText, Sparkles, Maximize2, Minimize2, RefreshCw } from "lucide-react";
import { Link } from "react-router-dom";

// Example questions only; every answer is computed from the database by the assistant's tools.
const QUICK_PROMPTS = [
  { label: "📊 Open cases by district", query: "How many open FIRs are there in each district? Show the top five." },
  { label: "👤 Repeat offenders", query: "Which repeat offenders appear in the most FIRs, and where?" },
  { label: "🚨 Overdue investigations", query: "Which police stations have the most investigations past the statutory window?" },
  { label: "📈 Rising crime types", query: "Which crime types have increased most over the last three months?" },
];

export default function AssistantPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [query, setQuery] = useState("");
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: status } = useQuery({
    queryKey: ["assistantStatus"],
    queryFn: () => assistantService.getStatus(),
    enabled: isOpen,
    refetchInterval: isOpen ? 60000 : false,
  });

  const downloadDossier = async (downloadUrl: string, messageIndex: number) => {
    const jobId = Number(downloadUrl.match(/jobs\/(\d+)\//)?.[1]);
    try {
      await reportService.downloadReportPdf(jobId);
    } catch {
      setMessages((prev) => prev.map((m, i) => (i === messageIndex ? { ...m, downloadNote: "The dossier is still being compiled or is not available to you. Try again in a few seconds." } : m)));
    }
  };

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const handleSend = async (customQuery?: string) => {
    const q = customQuery || query;
    if (!q.trim()) return;

    setMessages((prev) => [...prev, { sender: "user", text: q }]);
    if (!customQuery) setQuery("");
    setLoading(true);

    try {
      const data = await assistantService.queryAssistant(q);
      setMessages((prev) => [
        ...prev,
        {
          sender: "bot",
          text: data.answer,
          sources: data.source_case_ids || [],
          downloadUrl: data.download_url || null,
          modelVersion: data.model_version,
        },
      ]);
    } catch (err: any) {
      console.error(err);
      // The backend explains quota / availability problems in `detail`; show that rather than a generic failure.
      const detail = err?.response?.data?.detail;
      setMessages((prev) => [
        ...prev,
        { sender: "bot", text: typeof detail === "string" ? detail : "The assistant could not be reached. Please try again in a moment." },
      ]);
    } finally {
      setLoading(false);
    }
  };

  // Helper to format assistant markdown text
  const renderFormattedText = (text: string) => {
    const lines = text.split("\n");
    return lines.map((line, lIdx) => {
      let content = line;

      if (content.startsWith("### ")) {
        return (
          <h3 key={lIdx} className="text-xs font-bold text-[#60a5fa] mt-1.5 mb-1 font-mono uppercase tracking-wider">
            {content.replace("### ", "")}
          </h3>
        );
      }
      if (content.startsWith("#### ")) {
        return (
          <h4 key={lIdx} className="text-[11px] font-bold text-amber-400 mt-1 mb-0.5 font-mono uppercase">
            {content.replace("#### ", "")}
          </h4>
        );
      }
      if (content.startsWith("* ") || content.startsWith("- ")) {
        const bulletText = content.replace(/^[*|-]\s+/, "");
        return (
          <div key={lIdx} className="flex items-start gap-1.5 my-0.5 pl-1">
            <span className="text-blue-400 font-mono">•</span>
            <span className="flex-1">{renderBoldText(bulletText)}</span>
          </div>
        );
      }

      return (
        <p key={lIdx} className="my-0.5 leading-relaxed">
          {renderBoldText(content)}
        </p>
      );
    });
  };

  const renderBoldText = (str: string) => {
    const parts = str.split(/(\*\*.*?\*\*|\`.*?\`|\*.*?\*)/g);
    return parts.map((part, pIdx) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return <strong key={pIdx} className="font-bold text-slate-100">{part.slice(2, -2)}</strong>;
      }
      if (part.startsWith("`") && part.endsWith("`")) {
        return <code key={pIdx} className="bg-blue-950/80 text-blue-300 font-mono px-1 py-0.5 rounded text-[10px]">{part.slice(1, -1)}</code>;
      }
      if (part.startsWith("*") && part.endsWith("*")) {
        return <em key={pIdx} className="italic text-slate-300">{part.slice(1, -1)}</em>;
      }
      return part;
    });
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 select-none font-sans flex flex-col items-end">
      {/* FLOATING POLICE BADGE BUTTON */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="group relative flex items-center justify-center w-14 h-14 bg-gradient-to-br from-blue-700 via-blue-900 to-[#0b0f19] border-2 border-blue-400/50 rounded-full shadow-[0_0_25px_rgba(37,99,235,0.6)] hover:shadow-[0_0_35px_rgba(59,130,246,0.8)] transition-all transform hover:scale-105 active:scale-95 focus:outline-none"
        >
          <div className="absolute inset-0 rounded-full bg-blue-500/20 animate-ping"></div>
          <ShieldCheck size={28} className="text-blue-300 group-hover:text-white transition-colors drop-shadow-[0_0_8px_rgba(59,130,246,0.8)]" />
          <span className="absolute -top-1 -right-1 bg-amber-500 text-black text-[9px] font-extrabold px-1.5 py-0.5 rounded-full font-mono shadow border border-black uppercase">
            AI
          </span>
        </button>
      )}

      {/* CHATBOT DRAWER WINDOW */}
      {isOpen && (
        <div
          className={`bg-[#0b0f19] border border-[#1e293b] rounded-xl shadow-[0_0_50px_rgba(0,0,0,0.8)] flex flex-col overflow-hidden transition-all duration-200 ${
            isExpanded ? "w-[560px] h-[680px]" : "w-[420px] h-[560px]"
          }`}
        >
          {/* HEADER */}
          <div className="bg-gradient-to-r from-[#0f172a] via-[#1e293b] to-[#0f172a] px-4 py-3 border-b border-[#1e293b] flex items-center justify-between shadow">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-blue-600/30 border border-blue-400/40 flex items-center justify-center text-blue-400 shadow">
                <ShieldCheck size={18} />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-extrabold text-slate-100 tracking-tight font-mono uppercase">
                    Forensiq Intelligence Assistant
                  </span>
                  <span className={`border text-[9px] px-1.5 py-0.2 rounded font-mono font-bold ${
                    !status ? "bg-slate-500/20 text-slate-400 border-slate-500/30"
                      : status.available ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                      : "bg-amber-500/20 text-amber-400 border-amber-500/30"
                  }`}>
                    {!status ? "…" : status.available ? "ONLINE" : "MODEL BUSY"}
                  </span>
                </div>
                <p className="text-[10px] text-blue-400 font-mono">
                  {status?.models[0] ?? (status && !status.configured ? "No language model configured" : "Database-grounded assistant")}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="text-slate-400 hover:text-slate-200 p-1 rounded hover:bg-slate-800 transition-colors"
                title={isExpanded ? "Minimize Window" : "Maximize Window"}
              >
                {isExpanded ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="text-slate-400 hover:text-slate-200 p-1 rounded hover:bg-slate-800 transition-colors"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* MESSAGES BODY */}
          <div className="flex-1 p-4 overflow-y-auto space-y-3.5 flex flex-col bg-gradient-to-b from-[#0b0f19] to-[#0f172a]">
            <div className="bg-[#151c2e] border border-[#1e293b] text-slate-200 self-start mr-auto rounded-lg rounded-bl-none p-3 text-xs leading-relaxed max-w-[90%]">
              {status ? (
                <>
                  <h3 className="text-xs font-bold text-[#60a5fa] mb-1 font-mono uppercase tracking-wider">Forensiq intelligence assistant</h3>
                  <p>
                    Ask about FIRs, accused, networks, hotspots or trends. I answer by querying the <strong className="text-slate-100">{status.cases_in_scope.toLocaleString()} FIRs</strong> in
                    your jurisdiction (registered up to {status.as_of_date}); similar-case search covers the {status.embedded_cases.toLocaleString()} FIRs that have been embedded so far.
                  </p>
                  {!status.available && (
                    <p className="mt-1.5 text-amber-400">
                      {status.configured
                        ? `The language model is rate-limited right now${status.retry_in_seconds ? ` (retry in about ${Math.ceil(status.retry_in_seconds / 60)} min)` : ""}.`
                        : "No language model is configured on the server, so chat answers are unavailable."}
                    </p>
                  )}
                </>
              ) : (
                <p className="text-slate-400 font-mono">Checking what I can answer from…</p>
              )}
            </div>
            {messages.map((m, idx) => (
              <div
                key={idx}
                className={`flex flex-col max-w-[90%] rounded-lg p-3 text-xs leading-relaxed shadow-lg ${
                  m.sender === "user"
                    ? "bg-blue-600 text-white self-end ml-auto rounded-br-none border border-blue-500/30"
                    : "bg-[#151c2e] border border-[#1e293b] text-slate-200 self-start mr-auto rounded-bl-none"
                }`}
              >
                {m.sender === "bot" ? (
                  <div className="space-y-1 font-sans">{renderFormattedText(m.text)}</div>
                ) : (
                  <p className="font-sans font-medium">{m.text}</p>
                )}

                {/* PDF Download Button */}
                {m.downloadUrl && (
                  <>
                    <button
                      onClick={() => downloadDossier(m.downloadUrl, idx)}
                      className="mt-3 inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-3.5 py-1.5 rounded text-xs font-bold font-mono transition-all w-fit shadow-lg shadow-emerald-600/20"
                    >
                      <FileText size={14} />
                      <span>Download case dossier (PDF)</span>
                    </button>
                    {m.downloadNote && <p className="mt-1.5 text-[10px] text-amber-400">{m.downloadNote}</p>}
                  </>
                )}

                {/* Source Citations */}
                {m.sources && m.sources.length > 0 && (
                  <div className="mt-2.5 border-t border-[#1e293b] pt-2 flex flex-wrap gap-1.5 items-center">
                    <span className="text-[9px] text-slate-400 font-mono font-bold uppercase">CITED FIR DOSSIERS:</span>
                    {m.sources.map((srcId: number) => (
                      <Link
                        key={srcId}
                        to={`/cases/${srcId}`}
                        onClick={() => setIsOpen(false)}
                        className="bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/30 px-2 py-0.5 rounded text-[10px] font-mono font-bold flex items-center gap-1 transition-colors"
                      >
                        <FileText size={10} />
                        <span>Case #{srcId}</span>
                      </Link>
                    ))}
                  </div>
                )}

                {m.sender === "bot" && m.modelVersion && (
                  <div className="text-[9px] text-slate-500 font-mono mt-1.5 text-right uppercase tracking-wider">
                    {m.modelVersion}
                  </div>
                )}
              </div>
            ))}

            {loading && (
              <div className="bg-[#151c2e] border border-[#1e293b] text-slate-300 p-3 rounded-lg text-xs self-start mr-auto flex items-center gap-2 font-mono shadow-md">
                <RefreshCw className="animate-spin text-blue-400" size={14} />
                <span>Querying the database…</span>
              </div>
            )}
            <div ref={scrollRef} />
          </div>

          {/* QUICK SUGGESTION PROMPTS */}
          <div className="px-3 py-2 bg-[#0f172a] border-t border-[#1e293b] flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            <Sparkles className="text-amber-400 flex-shrink-0" size={12} />
            {QUICK_PROMPTS.map((p, pIdx) => (
              <button
                key={pIdx}
                onClick={() => handleSend(p.query)}
                disabled={loading}
                className="whitespace-nowrap bg-[#1e293b] hover:bg-blue-600 hover:text-white text-slate-300 border border-[#334155] px-2.5 py-1 rounded-full text-[10px] font-mono font-bold transition-all flex-shrink-0"
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* INPUT FORM */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="bg-[#0f172a] p-3 border-t border-[#1e293b] flex gap-2"
          >
            <input
              type="text"
              placeholder="Ask AI Assistant about suspects, cases, hotspots..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="flex-1 bg-[#1e293b] border border-[#334155] text-slate-100 text-xs rounded-lg px-3.5 py-2 focus:outline-none focus:border-blue-500 font-sans"
            />
            <button
              type="submit"
              disabled={loading || !query.trim()}
              className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg px-3 py-2 flex items-center justify-center transition-colors shadow-md"
            >
              <Send size={14} />
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
