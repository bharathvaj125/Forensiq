import { useState, useEffect, useRef } from "react";
import { useAuth } from "../../app/providers/AuthProvider";
import { useLanguage } from "../../app/providers/LanguageContext";
import { notificationService } from "../../services/notificationService";
import { searchService } from "../../services/searchService";
import { Bell, Search, CheckCircle, Clock } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";

export default function TopBar() {
  const { user } = useAuth();
  const { language, setLanguage, t } = useLanguage();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [isLoadingNotifications, setIsLoadingNotifications] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [showWalkthrough, setShowWalkthrough] = useState(false);
  const [isDemoMode, setIsDemoMode] = useState(false);

  const notificationRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Check if demo query param is set or was previously toggled
    const params = new URLSearchParams(window.location.search);
    if (params.get("demo") === "true") {
      setIsDemoMode(true);
      localStorage.setItem("demo_mode", "true");
    } else if (localStorage.getItem("demo_mode") === "true") {
      setIsDemoMode(true);
    }
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowSearchResults(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    setIsLoadingNotifications(true);
    notificationService.getNotifications()
      .then((data) => setNotifications(data))
      .catch((err) => console.error("Failed to load notifications", err))
      .finally(() => setIsLoadingNotifications(false));
  }, []);

  useEffect(() => {
    if (searchQuery.trim().length < 2) {
      setSearchResults(null);
      setShowSearchResults(false);
      return;
    }

    const delayDebounce = setTimeout(async () => {
      setIsSearching(true);
      setShowSearchResults(true);
      try {
        const data = await searchService.unifiedSearch(searchQuery);
        setSearchResults(data);
      } catch (err) {
        console.error("Search failed", err);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(delayDebounce);
  }, [searchQuery]);

  const handleMarkAsRead = async (id: number) => {
    try {
      await notificationService.markAsRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
      );
    } catch (err) {
      console.error("Failed to mark notification as read", err);
    }
  };

  const handleDeleteNotification = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await notificationService.deleteNotification(id);
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    } catch (err) {
      console.error("Failed to delete notification", err);
    }
  };

  const handleClearAllNotifications = async () => {
    try {
      await notificationService.clearAll();
      setNotifications([]);
    } catch (err) {
      console.error("Failed to clear notifications", err);
    }
  };

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  return (
    <header className="h-16 bg-[#090d16] border-b border-[#1e293b] flex items-center justify-between px-6 select-none relative z-40">
      <div ref={searchRef} className="w-96 relative">
        <div className="relative">
          <input
            type="text"
            placeholder={t("search_placeholder")}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#111827] border border-[#1e293b] text-slate-200 text-xs rounded pl-9 pr-4 py-2 focus:outline-none focus:border-blue-500 transition-colors"
          />
          <Search className="absolute left-3 top-2.5 text-slate-500" size={14} />
        </div>

        {showSearchResults && (
          <div className="absolute top-12 left-0 w-[480px] bg-[#0d1322] border border-[#1e293b] rounded shadow-2xl p-4 max-h-[400px] overflow-y-auto z-50">
            <h3 className="text-[10px] text-blue-500 font-mono uppercase tracking-wider mb-2">
              Unified Search Results
            </h3>
            {isSearching ? (
              <div className="space-y-3 py-2">
                <div className="flex flex-col gap-2 animate-pulse">
                  <div className="h-3.5 bg-slate-800 rounded w-1/4 mb-1"></div>
                  <div className="h-10 bg-slate-800/60 rounded w-full"></div>
                  <div className="h-10 bg-slate-800/60 rounded w-full"></div>
                </div>
              </div>
            ) : !searchResults || (searchResults.cases?.length === 0 && searchResults.accused?.length === 0 && searchResults.evidence?.length === 0) ? (
              <div className="text-center py-4 text-xs text-slate-500 font-mono">No matching records found.</div>
            ) : (
              <div className="space-y-3">
                {searchResults.cases?.length > 0 && (
                  <div>
                    <h4 className="text-xs font-bold text-slate-300 mb-1 border-b border-[#1e293b] pb-1 font-mono">Cases</h4>
                    <ul className="space-y-1">
                      {searchResults.cases.map((c: any) => (
                        <li key={c.CaseMasterID}>
                          <Link
                            to={`/cases/${c.CaseMasterID}`}
                            onClick={() => setShowSearchResults(false)}
                            className="block hover:bg-[#151c2e] p-1.5 rounded transition-colors"
                          >
                            <span className="text-blue-400 font-semibold text-xs">{c.CaseNo}</span>
                            <p className="text-[10px] text-slate-400 truncate">{c.BriefFacts}</p>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {searchResults.accused?.length > 0 && (
                  <div>
                    <h4 className="text-xs font-bold text-slate-300 mb-1 border-b border-[#1e293b] pb-1 font-mono">Accused Persons</h4>
                    <ul className="space-y-1">
                      {searchResults.accused.map((a: any) => (
                        <li key={a.AccusedMasterID}>
                          <Link
                            to={`/cases/${a.CaseMasterID}`}
                            onClick={() => setShowSearchResults(false)}
                            className="block hover:bg-[#151c2e] p-1.5 rounded transition-colors"
                          >
                            <span className="text-amber-400 font-semibold text-xs">{a.AccusedName}</span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {searchResults.evidence?.length > 0 && (
                  <div>
                    <h4 className="text-xs font-bold text-slate-300 mb-1 border-b border-[#1e293b] pb-1 font-mono">Evidence Items</h4>
                    <ul className="space-y-1">
                      {searchResults.evidence.map((e: any) => (
                        <li key={e.EvidenceID}>
                          <Link
                            to={`/cases/${e.CaseMasterID}`}
                            onClick={() => setShowSearchResults(false)}
                            className="block hover:bg-[#151c2e] p-1.5 rounded transition-colors"
                          >
                            <span className="text-emerald-400 font-semibold text-xs">{e.EvidenceType}</span>
                            <p className="text-[10px] text-slate-400 truncate">{e.Description}</p>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center gap-4">
        {/* LANGUAGE SWITCHER TOGGLE */}
        <div className="flex items-center bg-[#111827] border border-[#1e293b] rounded-lg p-1 font-mono text-xs shadow-inner">
          <button
            onClick={() => setLanguage("en")}
            className={`px-2.5 py-1 rounded text-[11px] font-bold transition-all flex items-center gap-1.5 ${
              language === "en"
                ? "bg-blue-600 text-white shadow-md"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <span>🇬🇧</span>
            <span>English</span>
          </button>
          <button
            onClick={() => setLanguage("kn")}
            className={`px-2.5 py-1 rounded text-[11px] font-bold transition-all flex items-center gap-1.5 ${
              language === "kn"
                ? "bg-emerald-600 text-white shadow-md font-sans"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <span>🇮🇳</span>
            <span>ಕನ್ನಡ</span>
          </button>
        </div>

        {isDemoMode && (
          <button
            onClick={() => setShowWalkthrough(!showWalkthrough)}
            className={`flex items-center gap-1.5 border rounded px-2.5 py-1 text-xs font-mono transition-colors ${
              showWalkthrough
                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30 animate-pulse font-bold"
                : "bg-slate-800/40 text-slate-400 border-slate-700/60 hover:text-slate-200"
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
            <span>Walkthrough Guide</span>
          </button>
        )}

        <div ref={notificationRef} className="relative">
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="text-slate-400 hover:text-slate-200 relative p-1 transition-colors focus:outline-none"
          >
            <Bell size={18} />
            {unreadCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-blue-600 rounded-full flex items-center justify-center text-[10px] font-bold text-white leading-none shadow font-mono">
                {unreadCount}
              </span>
            )}
          </button>

          {showNotifications && (
            <div className="absolute right-0 top-8 w-80 bg-[#0d1322] border border-[#1e293b] rounded shadow-2xl max-h-[380px] overflow-y-auto z-50">
              <div className="p-3 border-b border-[#1e293b] flex items-center justify-between">
                <span className="text-xs font-bold text-slate-200 font-mono">Notifications</span>
                <div className="flex items-center gap-2 font-mono">
                  {notifications.length > 0 && (
                    <button
                      onClick={handleClearAllNotifications}
                      className="text-[10px] text-slate-400 hover:text-red-400 underline transition-colors"
                    >
                      Clear All
                    </button>
                  )}
                  <span className="text-[10px] bg-blue-500/10 text-blue-400 px-1.5 py-0.5 rounded border border-blue-500/20 font-bold">
                    {unreadCount} unread
                  </span>
                </div>
              </div>

              <div className="divide-y divide-[#1e293b]">
                {isLoadingNotifications ? (
                  <div className="p-3 space-y-3">
                    <div className="flex gap-2.5 animate-pulse">
                      <div className="w-4 h-4 rounded-full bg-slate-800"></div>
                      <div className="flex-1 space-y-2">
                        <div className="h-3 bg-slate-800 rounded w-1/3"></div>
                        <div className="h-2 bg-slate-800 rounded w-5/6"></div>
                      </div>
                    </div>
                  </div>
                ) : notifications.length === 0 ? (
                  <div className="text-center py-8 text-xs text-slate-500 font-mono italic">
                    No active notifications.
                  </div>
                ) : (
                  notifications.map((n) => (
                    <div
                      key={n.id}
                      onClick={() => handleMarkAsRead(n.id)}
                      className={`p-3 hover:bg-[#151c2e] transition-colors cursor-pointer group flex items-start justify-between gap-2 ${
                        !n.is_read ? "bg-[#0f172a]" : ""
                      }`}
                    >
                      <div className="flex items-start gap-2.5 flex-1 min-w-0">
                        {!n.is_read ? (
                          <div className="w-2 h-2 rounded-full bg-blue-500 mt-1.5 flex-shrink-0 animate-pulse" />
                        ) : (
                          <CheckCircle className="text-slate-600 flex-shrink-0 mt-0.5" size={14} />
                        )}
                        <div className="flex-1 min-w-0">
                          <h4 className={`text-xs font-semibold ${!n.is_read ? "text-slate-100 font-bold" : "text-slate-400"}`}>
                            {n.title}
                          </h4>
                          <p className="text-[10px] text-slate-400 leading-normal mt-0.5 truncate">{n.message}</p>
                          <div className="flex items-center gap-1 text-[10px] text-[#38bdf8] font-mono mt-1 font-bold">
                            <Clock size={10} />
                            <span>{new Date(n.created_at).toLocaleDateString()}</span>
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={(e) => handleDeleteNotification(n.id, e)}
                        className="text-slate-600 hover:text-red-400 p-1 rounded opacity-60 hover:opacity-100 transition-all font-bold text-xs"
                        title="Dismiss notification"
                      >
                        ✕
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 border-l border-[#1e293b] pl-6">
          <div className="text-right">
            <span className="block text-xs font-bold text-slate-200">{user?.Username}</span>
            <span className="text-[10px] text-slate-500 font-mono tracking-wider uppercase">
              {user?.role?.RoleName || "Officer"}
            </span>
          </div>
          <div className="w-8 h-8 rounded bg-gradient-to-br from-blue-700 to-indigo-900 border border-blue-500/30 flex items-center justify-center font-bold text-xs text-white">
            {user?.Username?.substring(0, 2).toUpperCase() || "SI"}
          </div>
        </div>
      </div>

      {showWalkthrough && (
        <div className="fixed right-4 top-20 w-80 bg-[#0d1322] border border-[#1e293b] rounded shadow-2xl p-5 z-50 animate-slide-in select-none">
          <div className="flex items-center justify-between border-b border-[#1e293b] pb-3 mb-4">
            <div>
              <span className="text-[10px] text-emerald-400 font-mono uppercase font-bold tracking-widest">Presenter Console</span>
              <h4 className="text-xs font-bold text-slate-200">Command Center Walkthrough</h4>
            </div>
            <button
              onClick={() => setShowWalkthrough(false)}
              className="text-slate-500 hover:text-slate-300 text-xs font-bold font-mono"
            >
              Close
            </button>
          </div>

          <div className="space-y-3.5">
            {[
              { title: "Landing Page: AI Briefing", desc: "Showcase live situation briefings, critical alert lists, and operational health.", target: "/dashboard" },
              { title: "GIS Mapping: Hotspot Playback", desc: "Open the GIS map, drag the playback slider to watch hotspots shift.", target: "/map" },
              { title: "Investigation: pgvector Similarities", desc: "Check dossier indexes and trigger side-by-side similarities.", target: "/cases" },
              { title: "Accused Networks: Louvain Clusters", desc: "Animate suspect relationships and highlight linked communities.", target: "/network" },
            ].map((step, idx) => (
              <div
                key={idx}
                onClick={() => {
                  navigate(step.target);
                }}
                className="p-3 bg-[#111827] border border-[#1e293b] hover:border-emerald-500/40 rounded transition-all cursor-pointer flex gap-3 text-xs"
              >
                <div className="w-5 h-5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold font-mono text-[10px] flex-shrink-0 mt-0.5">
                  {idx + 1}
                </div>
                <div>
                  <h5 className="font-bold text-slate-200">{step.title}</h5>
                  <p className="text-[10px] text-slate-400 mt-0.5 leading-relaxed font-sans">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </header>
  );
}
