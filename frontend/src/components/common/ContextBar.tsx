import { useAuth } from "../../app/providers/AuthProvider";
import { MapPin, Eye } from "lucide-react";

const LEVEL_TITLE: Record<string, string> = {
  Statewide: "Statewide intelligence scope",
  District: "District-bounded jurisdiction",
  Station: "Station-bounded jurisdiction",
  "Granted access only": "Shared cases only",
  None: "No jurisdiction assigned",
};

/** The jurisdiction line shows what the server will actually let this account see (see /auth/me). */
export default function ContextBar() {
  const { user } = useAuth();

  return (
    <div className="bg-[#0b101d] border-b border-[#1e293b] px-6 py-2 flex items-center justify-between text-xs text-slate-400 select-none">
      <div className="flex items-center gap-2 min-w-0">
        <MapPin size={12} className="text-blue-500 flex-shrink-0" />
        <span className="font-semibold text-slate-300 uppercase tracking-wider font-mono">Jurisdiction:</span>
        <span className="text-slate-100 font-medium">{user?.ScopeLevel ? LEVEL_TITLE[user.ScopeLevel] ?? user.ScopeLevel : "…"}</span>
        {user?.ScopeDescription && <span className="text-[10px] text-slate-500 truncate">({user.ScopeDescription})</span>}
      </div>
      <div className="flex items-center gap-2 text-[10px] bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2 py-0.5 rounded font-mono uppercase tracking-wider flex-shrink-0">
        <Eye size={10} />
        <span>Audit logging active</span>
      </div>
    </div>
  );
}
