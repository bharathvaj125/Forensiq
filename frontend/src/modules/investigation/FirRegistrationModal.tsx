import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle, Plus, Trash2, Upload, X, AlertCircle } from "lucide-react";
import { caseService } from "../../services/caseService";
import { hotspotService } from "../../services/hotspotService";
import { useReferenceOptions } from "../../services/referenceService";
import { useAuth } from "../../app/providers/AuthProvider";
import { useLanguage } from "../../app/providers/LanguageContext";

type Tab = "police" | "complainant" | "incident" | "people" | "property";

interface PersonRow { name: string; age: string; genderId: string; address: string; extra: string }
interface VehicleRow { registration: string; type: string; make: string; model: string; color: string; role: string }

const field = "w-full bg-[#111827] border border-[#334155] text-slate-200 text-xs rounded px-3 py-2 focus:outline-none focus:border-emerald-500";
const label = "text-slate-400 font-mono block mb-1";
const emptyPerson: PersonRow = { name: "", age: "", genderId: "", address: "", extra: "" };
const emptyVehicle: VehicleRow = { registration: "", type: "", make: "", model: "", color: "", role: "" };

const localDateTime = (d: Date) => {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const errorText = (err: any): string => {
  const detail = err?.response?.data?.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) return detail.map((d: any) => `${(d.loc || []).slice(1).join(".")}: ${d.msg}`).join("; ");
  return err?.message || "The FIR could not be registered.";
};

interface Props {
  open: boolean;
  onClose: () => void;
  onRegistered: (caseId: number, caseNo: string) => void;
}

export default function FirRegistrationModal({ open, onClose, onRegistered }: Props) {
  const { user } = useAuth();
  const { t, translateData } = useLanguage();
  const queryClient = useQueryClient();
  const reference = useReferenceOptions();
  const { data: mapLayers } = useQuery({ queryKey: ["mapLayers"], queryFn: () => hotspotService.getLayers(), enabled: open });

  const [tab, setTab] = useState<Tab>("police");
  const [districtId, setDistrictId] = useState("");
  const [stationId, setStationId] = useState("");
  const [headId, setHeadId] = useState("");
  const [subheadId, setSubheadId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [gravityId, setGravityId] = useState("");

  const [victim, setVictim] = useState<PersonRow>({ ...emptyPerson });
  const [victimInjury, setVictimInjury] = useState("");

  const [incidentAt, setIncidentAt] = useState(localDateTime(new Date()));
  const [place, setPlace] = useState("");
  const [facts, setFacts] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [coordsTouched, setCoordsTouched] = useState(false);

  const [accused, setAccused] = useState<PersonRow[]>([]);
  const [witnesses, setWitnesses] = useState<PersonRow[]>([]);
  const [vehicles, setVehicles] = useState<VehicleRow[]>([]);
  const [propertyItems, setPropertyItems] = useState("");
  const [propertyValue, setPropertyValue] = useState("");
  const [evidenceFile, setEvidenceFile] = useState<File | null>(null);
  const [evidenceType, setEvidenceType] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Sensible first choices from the data (the most common category, the first gravity level) once reference data loads.
  useEffect(() => {
    if (!categoryId && reference.case_categories.length) setCategoryId(String(reference.case_categories[0].id));
    if (!gravityId && reference.gravity_levels.length) setGravityId(String(reference.gravity_levels[reference.gravity_levels.length - 1].id));
  }, [reference.case_categories, reference.gravity_levels, categoryId, gravityId]);

  const stations = useMemo(
    () => reference.stations.filter((s) => !districtId || s.district_id === Number(districtId)),
    [reference.stations, districtId],
  );
  const subheads = useMemo(() => reference.crime_subheads.filter((s) => !headId || s.head_id === Number(headId)), [reference.crime_subheads, headId]);

  // The station's location is estimated from the FIRs it registered; the officer can correct it.
  useEffect(() => {
    if (coordsTouched || !stationId || !mapLayers) return;
    const station = mapLayers.stations.find((s) => s.id === Number(stationId));
    if (station) {
      setLatitude(station.latitude.toFixed(6));
      setLongitude(station.longitude.toFixed(6));
    }
  }, [stationId, mapLayers, coordsTouched]);

  const register = useMutation({
    mutationFn: async () => {
      const person = (p: PersonRow) => ({
        ...(p.age ? { AgeYear: Number(p.age) } : {}), ...(p.genderId ? { GenderID: Number(p.genderId) } : {}), ...(p.address ? { Address: p.address } : {}),
      });
      const payload = {
        PoliceStationID: Number(stationId), CrimeMajorHeadID: Number(headId), CrimeMinorHeadID: Number(subheadId),
        CaseCategoryID: Number(categoryId), GravityOffenceID: Number(gravityId),
        IncidentFromDate: incidentAt.length === 16 ? `${incidentAt}:00` : incidentAt,
        latitude: Number(latitude), longitude: Number(longitude),
        BriefFacts: place.trim() ? `${facts.trim()} (Place of occurrence: ${place.trim()})` : facts.trim(),
        Victims: victim.name.trim() ? [{ VictimName: victim.name.trim(), ...person(victim), ...(victim.extra ? { RelationshipToAccused: victim.extra } : {}), ...(victimInjury ? { InjurySeverity: victimInjury } : {}) }] : [],
        Accused: accused.filter((a) => a.name.trim()).map((a) => ({ AccusedName: a.name.trim(), ...person(a) })),
        Witnesses: witnesses.filter((w) => w.name.trim()).map((w) => ({ WitnessName: w.name.trim(), ...person(w), ...(w.extra ? { StatementSummary: w.extra } : {}) })),
        Vehicles: vehicles.filter((v) => v.registration.trim() || v.type || v.make).map((v) => ({
          ...(v.registration ? { RegistrationNumber: v.registration } : {}), ...(v.type ? { VehicleType: v.type } : {}), ...(v.make ? { Make: v.make } : {}),
          ...(v.model ? { Model: v.model } : {}), ...(v.color ? { Color: v.color } : {}), ...(v.role ? { InvolvementRole: v.role } : {}),
        })),
      };
      const created = await caseService.registerCase(payload);
      const notes: string[] = [];
      if (propertyItems.trim()) {
        try {
          await caseService.addEvidence(created.CaseMasterID, {
            EvidenceType: "Stolen Property",
            Description: `${propertyItems.trim()}${propertyValue ? ` (estimated value ₹${Number(propertyValue).toLocaleString("en-IN")})` : ""}`,
          });
        } catch { notes.push("the stolen-property entry"); }
      }
      if (evidenceFile) {
        try {
          const form = new FormData();
          form.append("file", evidenceFile);
          form.append("evidence_type", evidenceType || "Document / Report");
          form.append("description", `Attached at registration of FIR ${created.CaseNo}`);
          await caseService.uploadEvidenceFile(created.CaseMasterID, form);
        } catch { notes.push("the evidence file"); }
      }
      return { created, notes };
    },
    onSuccess: ({ created, notes }) => {
      queryClient.invalidateQueries({ queryKey: ["casesList"] });
      queryClient.invalidateQueries({ queryKey: ["dashboardSummary"] });
      reset();
      onRegistered(created.CaseMasterID, created.CaseNo + (notes.length ? ` (FIR saved, but ${notes.join(" and ")} could not be attached)` : ""));
    },
    onError: (err) => setError(errorText(err)),
  });

  const reset = () => {
    setTab("police"); setDistrictId(""); setStationId(""); setHeadId(""); setSubheadId(""); setVictim({ ...emptyPerson }); setVictimInjury("");
    setIncidentAt(localDateTime(new Date())); setPlace(""); setFacts(""); setLatitude(""); setLongitude(""); setCoordsTouched(false);
    setAccused([]); setWitnesses([]); setVehicles([]); setPropertyItems(""); setPropertyValue(""); setEvidenceFile(null); setEvidenceType(""); setError(null);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const missing = !stationId ? "Choose the police station." : !headId ? "Choose the type of offence." : !subheadId ? "Choose the offence sub-type."
      : facts.trim().length < 10 ? "Describe what happened (at least 10 characters)." : !latitude || !longitude ? "Enter the location of the incident."
      : new Date(incidentAt) > new Date() ? "The incident cannot be in the future." : null;
    if (missing) {
      setError(missing);
      setTab(!stationId || !headId || !subheadId ? "police" : "incident");
      return;
    }
    register.mutate();
  };

  if (!open) return null;

  const personFields = (rows: PersonRow[], set: (rows: PersonRow[]) => void, extraLabel: string, addLabel: string, tone: string, single = false) => (
    <div className="space-y-3">
      {rows.map((row, i) => {
        const update = (patch: Partial<PersonRow>) => set(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
        return (
          <div key={i} className="bg-[#111827] border border-[#1e293b] p-3 rounded-xl space-y-2">
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
              <input className={`${field} sm:col-span-2`} placeholder={t("Full name", "ಪೂರ್ಣ ಹೆಸರು")} value={row.name} onChange={(e) => update({ name: e.target.value })} />
              <input className={field} type="number" min={0} max={120} placeholder={t("Age", "ವಯಸ್ಸು")} value={row.age} onChange={(e) => update({ age: e.target.value })} />
              <select className={field} value={row.genderId} onChange={(e) => update({ genderId: e.target.value })}>
                <option value="">{t("Gender", "ಲಿಂಗ")}</option>
                {reference.genders.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <input className={field} placeholder={t("Address", "ವಿಳಾಸ")} value={row.address} onChange={(e) => update({ address: e.target.value })} />
              <input className={field} placeholder={extraLabel} value={row.extra} onChange={(e) => update({ extra: e.target.value })} />
            </div>
            {!single && (
              <button type="button" onClick={() => set(rows.filter((_, j) => j !== i))} className="text-[11px] text-red-400 hover:text-red-300 flex items-center gap-1 font-mono">
                <Trash2 size={12} />{t("Remove", "ತೆಗೆದುಹಾಕಿ")}
              </button>
            )}
          </div>
        );
      })}
      {!single && (
        <button type="button" onClick={() => set([...rows, { ...emptyPerson }])} className={`text-xs font-mono font-bold flex items-center gap-1.5 ${tone}`}>
          <Plus size={14} />{addLabel}
        </button>
      )}
    </div>
  );

  const tabs: { id: Tab; label: string }[] = [
    { id: "police", label: t("🏛️ Station & offence", "🏛️ ಠಾಣೆ & ಅಪರಾಧ") },
    { id: "complainant", label: t("👤 Complainant", "👤 ದೂರುದಾರ") },
    { id: "incident", label: t("📍 Incident", "📍 ಘಟನೆ") },
    { id: "people", label: t("👥 Accused & witnesses", "👥 ಆರೋಪಿ & ಸಾಕ್ಷಿ") },
    { id: "property", label: t("🚗 Property & files", "🚗 ಆಸ್ತಿ & ಫೈಲ್") },
  ];

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50">
      <form onSubmit={submit} className="bg-[#0b1324] border border-emerald-500/40 rounded-2xl max-w-3xl w-full flex flex-col shadow-[0_0_50px_rgba(16,185,129,0.15)] select-none font-sans overflow-hidden max-h-[90vh]">
        <div className="p-5 border-b border-[#1e293b] flex justify-between items-center bg-[#0f172a]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center font-bold font-mono">FIR</div>
            <div>
              <h3 className="text-sm font-bold text-slate-100 font-mono uppercase tracking-wider">{t("Register an FIR", "ಎಫ್.ಐ.ಆರ್ ನೋಂದಣಿ")}</h3>
              <p className="text-[11px] text-slate-400 font-mono">{t("The case number, registration date, status, risk score and priority are assigned on submission.", "ಪ್ರಕರಣ ಸಂಖ್ಯೆ, ದಿನಾಂಕ, ಸ್ಥಿತಿ ಮತ್ತು ಅಪಾಯ ಅಂಕ ಸಲ್ಲಿಕೆಯ ನಂತರ ನಿಗದಿಯಾಗುತ್ತದೆ.")}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-200 p-1.5 rounded-lg hover:bg-[#1e293b]"><X size={18} /></button>
        </div>

        <div className="flex bg-[#0f172a] border-b border-[#1e293b] px-4 pt-2 gap-2 overflow-x-auto font-mono text-xs">
          {tabs.map((item) => (
            <button key={item.id} type="button" onClick={() => setTab(item.id)}
              className={`px-3 py-2 border-b-2 font-bold whitespace-nowrap transition-all ${tab === item.id ? "border-emerald-400 text-emerald-400 bg-emerald-500/5" : "border-transparent text-slate-400 hover:text-slate-200"}`}>
              {item.label}
            </button>
          ))}
        </div>

        <div className="p-6 overflow-y-auto space-y-4 text-xs flex-1 max-h-[60vh]">
          {tab === "police" && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={label}>{t("District", "ಜಿಲ್ಲೆ")}</label>
                  <select className={field} value={districtId} onChange={(e) => { setDistrictId(e.target.value); setStationId(""); }}>
                    <option value="">{t("All districts", "ಎಲ್ಲಾ ಜಿಲ್ಲೆಗಳು")}</option>
                    {reference.districts.map((d) => <option key={d.id} value={d.id}>{translateData(d.name)}</option>)}
                  </select>
                </div>
                <div>
                  <label className={label}>{t("Police station *", "ಪೊಲೀಸ್ ಠಾಣೆ *")}</label>
                  <select className={field} value={stationId} onChange={(e) => { setStationId(e.target.value); setCoordsTouched(false); }}>
                    <option value="">{t("Select a station", "ಠಾಣೆ ಆಯ್ಕೆಮಾಡಿ")} ({stations.length})</option>
                    {stations.map((s) => <option key={s.id} value={s.id}>{translateData(s.name)}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={label}>{t("Type of offence *", "ಅಪರಾಧದ ವಿಧ *")}</label>
                  <select className={field} value={headId} onChange={(e) => { setHeadId(e.target.value); setSubheadId(""); }}>
                    <option value="">{t("Select", "ಆಯ್ಕೆಮಾಡಿ")}</option>
                    {reference.crime_heads.map((c) => <option key={c.id} value={c.id}>{translateData(c.name)}</option>)}
                  </select>
                </div>
                <div>
                  <label className={label}>{t("Offence sub-type *", "ಉಪ ವಿಧ *")}</label>
                  <select className={field} value={subheadId} onChange={(e) => setSubheadId(e.target.value)} disabled={!headId}>
                    <option value="">{headId ? t("Select", "ಆಯ್ಕೆಮಾಡಿ") : t("Choose the offence type first", "ಮೊದಲು ಅಪರಾಧದ ವಿಧ ಆಯ್ಕೆಮಾಡಿ")}</option>
                    {subheads.map((c) => <option key={c.id} value={c.id}>{translateData(c.name)}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={label}>{t("Gravity of offence", "ಅಪರಾಧದ ಗಂಭೀರತೆ")}</label>
                  <select className={field} value={gravityId} onChange={(e) => setGravityId(e.target.value)}>
                    {reference.gravity_levels.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                  </select>
                  <p className="text-[10px] text-slate-500 mt-1">{t("Heinous offences have a 90-day investigation window, others 60 (BNSS 187).", "ಗಂಭೀರ ಅಪರಾಧಗಳಿಗೆ ೯೦ ದಿನ, ಇತರೆ ೬೦ ದಿನ (BNSS 187).")}</p>
                </div>
                <div>
                  <label className={label}>{t("Case category", "ಪ್ರಕರಣ ವರ್ಗ")}</label>
                  <select className={field} value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
                    {reference.case_categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                  <p className="text-[10px] text-slate-500 mt-1">{t("Category names are not part of the source data; ids are shown.", "ವರ್ಗದ ಹೆಸರುಗಳು ಡೇಟಾದಲ್ಲಿ ಇಲ್ಲ.")}</p>
                </div>
              </div>
              <div className="bg-[#0f172a] border border-[#1e293b] rounded px-3 py-2 font-mono text-slate-400">
                {t("Registering officer", "ನೋಂದಣಿ ಅಧಿಕಾರಿ")}: <span className="text-amber-400 font-bold">{user?.Username}</span>{user?.Rank ? ` (${user.Rank})` : ""}
              </div>
            </div>
          )}

          {tab === "complainant" && (
            <div className="space-y-3">
              <p className="text-slate-500">{t("The complainant is recorded as the victim of the case.", "ದೂರುದಾರರನ್ನು ಪ್ರಕರಣದ ಬಲಿಪಶುವಾಗಿ ದಾಖಲಿಸಲಾಗುತ್ತದೆ.")}</p>
              {personFields([victim], (rows) => setVictim(rows[0] ?? { ...emptyPerson }), t("Relationship to the accused", "ಆರೋಪಿಯೊಂದಿಗಿನ ಸಂಬಂಧ"), "", "", true)}
              <div>
                <label className={label}>{t("Injury", "ಗಾಯ")}</label>
                <select className={field} value={victimInjury} onChange={(e) => setVictimInjury(e.target.value)}>
                  <option value="">{t("Not applicable / not recorded", "ಅನ್ವಯಿಸುವುದಿಲ್ಲ")}</option>
                  {reference.vocabulary?.injury_severity.map((v) => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>
            </div>
          )}

          {tab === "incident" && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={label}>{t("Date and time of incident *", "ಘಟನೆಯ ದಿನಾಂಕ ಮತ್ತು ಸಮಯ *")}</label>
                  <input type="datetime-local" className={field} value={incidentAt} max={localDateTime(new Date())} onChange={(e) => setIncidentAt(e.target.value)} />
                </div>
                <div>
                  <label className={label}>{t("Place of occurrence", "ಘಟನೆ ನಡೆದ ಸ್ಥಳ")}</label>
                  <input className={field} value={place} onChange={(e) => setPlace(e.target.value)} placeholder={t("Street, landmark, area", "ರಸ್ತೆ, ಹೆಗ್ಗುರುತು")} />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={label}>{t("Latitude *", "ಅಕ್ಷಾಂಶ *")}</label>
                  <input type="number" step="any" className={`${field} font-mono`} value={latitude} onChange={(e) => { setLatitude(e.target.value); setCoordsTouched(true); }} />
                </div>
                <div>
                  <label className={label}>{t("Longitude *", "ರೇಖಾಂಶ *")}</label>
                  <input type="number" step="any" className={`${field} font-mono`} value={longitude} onChange={(e) => { setLongitude(e.target.value); setCoordsTouched(true); }} />
                </div>
              </div>
              <p className="text-[10px] text-slate-500">
                {t("Pre-filled with the station's approximate location (the centre of the FIRs it has registered); correct it to the actual place if known.", "ಠಾಣೆಯ ಅಂದಾಜು ಸ್ಥಳದೊಂದಿಗೆ ಭರ್ತಿ ಮಾಡಲಾಗಿದೆ; ನಿಜವಾದ ಸ್ಥಳ ತಿಳಿದಿದ್ದರೆ ಸರಿಪಡಿಸಿ.")}
              </p>
              <div>
                <label className={label}>{t("What happened *", "ಏನು ನಡೆಯಿತು *")}</label>
                <textarea rows={5} className={field} value={facts} onChange={(e) => setFacts(e.target.value)}
                  placeholder={t("Describe the incident: sequence of events, method used, items involved, anything known about the suspects.", "ಘಟನೆಯನ್ನು ವಿವರಿಸಿ.")} />
              </div>
            </div>
          )}

          {tab === "people" && (
            <div className="space-y-5">
              <div>
                <span className="text-xs font-mono font-bold text-amber-400 uppercase tracking-wider block mb-2">{t("Accused / suspects (if known)", "ಆರೋಪಿಗಳು (ತಿಳಿದಿದ್ದರೆ)")}</span>
                {personFields(accused, setAccused, t("Occupation / description", "ವೃತ್ತಿ / ವಿವರಣೆ"), t("Add an accused", "ಆರೋಪಿಯನ್ನು ಸೇರಿಸಿ"), "text-amber-400")}
              </div>
              <div>
                <span className="text-xs font-mono font-bold text-blue-400 uppercase tracking-wider block mb-2">{t("Witnesses (if any)", "ಸಾಕ್ಷಿಗಳು (ಇದ್ದರೆ)")}</span>
                {personFields(witnesses, setWitnesses, t("What they saw (summary)", "ಅವರು ಕಂಡದ್ದು"), t("Add a witness", "ಸಾಕ್ಷಿಯನ್ನು ಸೇರಿಸಿ"), "text-blue-400")}
              </div>
            </div>
          )}

          {tab === "property" && (
            <div className="space-y-5">
              <div className="bg-[#111827] border border-[#1e293b] p-4 rounded-xl space-y-3">
                <span className="text-xs font-mono font-bold text-emerald-400 uppercase tracking-wider block">{t("Stolen or damaged property", "ಕಳವಾದ / ಹಾನಿಯಾದ ಆಸ್ತಿ")}</span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <input className={`${field} sm:col-span-2`} placeholder={t("Items (e.g. gold chain 24 g, mobile phone)", "ವಸ್ತುಗಳು")} value={propertyItems} onChange={(e) => setPropertyItems(e.target.value)} />
                  <input className={`${field} font-mono`} type="number" min={0} placeholder={t("Estimated value (₹)", "ಅಂದಾಜು ಮೌಲ್ಯ (₹)")} value={propertyValue} onChange={(e) => setPropertyValue(e.target.value)} />
                </div>
              </div>

              <div className="space-y-3">
                <span className="text-xs font-mono font-bold text-emerald-400 uppercase tracking-wider block">{t("Vehicles involved", "ಒಳಗೊಂಡ ವಾಹನಗಳು")}</span>
                {vehicles.map((v, i) => {
                  const update = (patch: Partial<VehicleRow>) => setVehicles(vehicles.map((r, j) => (j === i ? { ...r, ...patch } : r)));
                  return (
                    <div key={i} className="bg-[#111827] border border-[#1e293b] p-3 rounded-xl space-y-2">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <input className={`${field} font-mono`} placeholder={t("Registration no.", "ನೋಂದಣಿ ಸಂಖ್ಯೆ")} value={v.registration} onChange={(e) => update({ registration: e.target.value.toUpperCase() })} />
                        <select className={field} value={v.type} onChange={(e) => update({ type: e.target.value })}>
                          <option value="">{t("Vehicle type", "ವಾಹನ ವಿಧ")}</option>
                          {reference.vocabulary?.vehicle_type.map((x) => <option key={x} value={x}>{x}</option>)}
                        </select>
                        <select className={field} value={v.role} onChange={(e) => update({ role: e.target.value })}>
                          <option value="">{t("Role in the incident", "ಪಾತ್ರ")}</option>
                          {reference.vocabulary?.vehicle_role.map((x) => <option key={x} value={x}>{x}</option>)}
                        </select>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <input className={field} placeholder={t("Make", "ತಯಾರಕ")} value={v.make} onChange={(e) => update({ make: e.target.value })} />
                        <input className={field} placeholder={t("Model", "ಮಾದರಿ")} value={v.model} onChange={(e) => update({ model: e.target.value })} />
                        <input className={field} placeholder={t("Colour", "ಬಣ್ಣ")} value={v.color} onChange={(e) => update({ color: e.target.value })} />
                      </div>
                      <button type="button" onClick={() => setVehicles(vehicles.filter((_, j) => j !== i))} className="text-[11px] text-red-400 hover:text-red-300 flex items-center gap-1 font-mono">
                        <Trash2 size={12} />{t("Remove", "ತೆಗೆದುಹಾಕಿ")}
                      </button>
                    </div>
                  );
                })}
                <button type="button" onClick={() => setVehicles([...vehicles, { ...emptyVehicle }])} className="text-xs font-mono font-bold flex items-center gap-1.5 text-emerald-400">
                  <Plus size={14} />{t("Add a vehicle", "ವಾಹನವನ್ನು ಸೇರಿಸಿ")}
                </button>
              </div>

              <div className="bg-[#111827] border border-blue-500/30 p-4 rounded-xl space-y-3">
                <span className="text-xs font-mono font-bold text-blue-400 uppercase tracking-wider flex items-center gap-2"><Upload size={14} />{t("Attach an evidence file", "ಸಾಕ್ಷ್ಯ ಫೈಲ್ ಸೇರಿಸಿ")}</span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <select className={field} value={evidenceType} onChange={(e) => setEvidenceType(e.target.value)}>
                    <option value="">{t("Evidence type", "ಸಾಕ್ಷ್ಯದ ವಿಧ")}</option>
                    {reference.vocabulary?.evidence_type.map((x) => <option key={x} value={x}>{x}</option>)}
                  </select>
                  <input type="file" onChange={(e) => setEvidenceFile(e.target.files?.[0] || null)} className="w-full bg-[#0f172a] border border-[#334155] text-slate-300 text-xs rounded px-2 py-1.5 font-mono" />
                </div>
                {evidenceFile && (
                  <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 p-2.5 rounded text-xs font-mono flex items-center gap-2">
                    <CheckCircle size={14} />
                    <span>{evidenceFile.name} ({(evidenceFile.size / 1024).toFixed(1)} KB)</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {error && (
          <div className="mx-6 mb-3 bg-red-500/10 border border-red-500/30 text-red-300 p-3 rounded text-xs font-mono flex items-start gap-2">
            <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="p-4 border-t border-[#1e293b] flex justify-end items-center gap-3 bg-[#0f172a]">
          <button type="button" onClick={onClose} className="bg-[#1e293b] hover:bg-[#334155] text-slate-300 text-xs px-4 py-2 rounded-lg font-mono font-bold">{t("Cancel", "ರದ್ದುಗೊಳಿಸಿ")}</button>
          <button type="submit" disabled={register.isPending} className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-mono text-xs px-6 py-2.5 rounded-lg font-bold flex items-center gap-2">
            <Plus size={16} />
            <span>{register.isPending ? t("Registering…", "ನೋಂದಾಯಿಸಲಾಗುತ್ತಿದೆ…") : t("Register FIR", "ಎಫ್.ಐ.ಆರ್ ನೋಂದಾಯಿಸಿ")}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
