import { useAuth } from "../../app/providers/AuthProvider";
import { MapPin, Eye } from "lucide-react";

export default function ContextBar() {
  const { user } = useAuth();
  
  const roleName = user?.role?.RoleName || "Officer";
  let scopeText = "District Bounded Jurisdiction";
  let description = "Restricted to active district bounds.";

  if (roleName === "Admin" || roleName === "SCRB_Officer") {
    scopeText = "Statewide Intelligence Scope";
    description = "Full read access across all districts and divisions.";
  } else if (roleName === "SHO") {
    scopeText = "Station Jurisdictional Bounds";
    description = "Restricted to local police station incident maps.";
  } else if (roleName === "Constable") {
    scopeText = "Beat/Constable Scope";
    description = "Restricted to assigned beat coordinates.";
  }

  return (
    <div className="bg-[#0b101d] border-b border-[#1e293b] px-6 py-2 flex items-center justify-between text-xs text-slate-400 select-none">
      <div className="flex items-center gap-2">
        <MapPin size={12} className="text-blue-500" />
        <span className="font-semibold text-slate-300 uppercase tracking-wider font-mono">
          Jurisdiction:
        </span>
        <span className="text-slate-100 font-medium">{scopeText}</span>
        <span className="text-[10px] text-slate-500">({description})</span>
      </div>
      <div className="flex items-center gap-2 text-[10px] bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2 py-0.5 rounded font-mono uppercase tracking-wider">
        <Eye size={10} />
        <span>Audit Logging Active</span>
      </div>
    </div>
  );
}
