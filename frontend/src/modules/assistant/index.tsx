import { useState, useRef, useEffect } from "react";
import { assistantService } from "../../services/assistantService";
import { X, Send, ShieldCheck, FileText, Sparkles, Maximize2, Minimize2, RefreshCw } from "lucide-react";
import { Link } from "react-router-dom";

export default function AssistantPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [query, setQuery] = useState("");
  const [messages, setMessages] = useState<any[]>([
    {
      sender: "bot",
      text: "### 👮 Karnataka Police AI Intelligence Command\nGreetings Officer! I am your KSP Crime Intelligence Assistant powered by Gemini 2.5 Flash / Advanced RAG Engine.\n\nI have indexed all **5,000 FIR Records**, suspect graphs, evidence, and GIS hotspots in your jurisdiction. How can I assist your investigation today?",
      modelVersion: "Gemini 2.5 Flash Engine",
    },
  ]);
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

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
          modelVersion: data.model_version || "Gemini 2.5 Flash RAG",
        },
      ]);
    } catch (err) {
      console.error(err);
      setMessages((prev) => [
        ...prev,
        { sender: "bot", text: "Communication timeout. Ensure the KSP AI Engine is online." },
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

  const quickPrompts = [
    { label: "📊 Crime Statistics", query: "Analyze overall dataset crime statistics and top district crime volumes" },
    { label: "👤 Suspect Linkages", query: "Show repeat offender suspect linkages and multi-FIR gang networks" },
    { label: "🚨 High-Risk Hotspots", query: "Which police station zones have the highest AI risk scores?" },
    { label: "📑 Compile PDF Dossier", query: "Compile official KSP PDF dossier for Case 1" },
  ];

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
                    KSP AI Intelligence Assistant
                  </span>
                  <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[9px] px-1.5 py-0.2 rounded font-mono font-bold">
                    ONLINE
                  </span>
                </div>
                <p className="text-[10px] text-blue-400 font-mono">
                  Gemini 2.5 Flash / Advanced RAG Engine
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
                  <a
                    href={`http://localhost:8000${m.downloadUrl}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-3 inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-3.5 py-1.5 rounded text-xs font-bold font-mono transition-all w-fit shadow-lg shadow-emerald-600/20"
                  >
                    <FileText size={14} />
                    <span>Download Official KSP PDF Dossier</span>
                  </a>
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

                {m.sender === "bot" && (
                  <div className="text-[9px] text-slate-500 font-mono mt-1.5 text-right uppercase tracking-wider">
                    {m.modelVersion || "Gemini 2.5 Flash RAG"}
                  </div>
                )}
              </div>
            ))}

            {loading && (
              <div className="bg-[#151c2e] border border-[#1e293b] text-slate-300 p-3 rounded-lg text-xs self-start mr-auto flex items-center gap-2 font-mono shadow-md">
                <RefreshCw className="animate-spin text-blue-400" size={14} />
                <span>Gemini 2.5 Flash Analyzing PostgreSQL Dataset...</span>
              </div>
            )}
            <div ref={scrollRef} />
          </div>

          {/* QUICK SUGGESTION PROMPTS */}
          <div className="px-3 py-2 bg-[#0f172a] border-t border-[#1e293b] flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            <Sparkles className="text-amber-400 flex-shrink-0" size={12} />
            {quickPrompts.map((p, pIdx) => (
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
