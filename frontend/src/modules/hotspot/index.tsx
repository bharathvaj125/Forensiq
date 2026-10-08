import { useState, useEffect, useRef, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { hotspotService, PredictedHotspot } from "../../services/hotspotService";
import { Filter, Layers, Compass, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from "lucide-react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

import { useLanguage } from "../../app/providers/LanguageContext";

interface HotspotProps {
  activeTab?: "gis" | "dashboard";
}

const RISK_COLOUR: Record<string, string> = { Severe: "#ef4444", High: "#f97316", Medium: "#f59e0b", Low: "#3b82f6" };
const HOTSPOT_COLOUR: Record<string, string> = { Critical: "#ef4444", High: "#f97316", Medium: "#f59e0b", Low: "#3b82f6" };
const BOUNDS_PADDING = 0.6; // degrees of pan room around the data

const escapeHtml = (value: string | number | null | undefined) =>
  String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));

export default function Hotspot({ activeTab = "gis" }: HotspotProps) {
  const { t, translateData } = useLanguage();
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletMap = useRef<L.Map | null>(null);
  const markerLayerGroup = useRef<L.LayerGroup | null>(null);
  const stationLayerGroup = useRef<L.LayerGroup | null>(null);
  const hotspotLayerGroup = useRef<L.LayerGroup | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const framedOnce = useRef(false);

  const [selectedHotspot, setSelectedHotspot] = useState<PredictedHotspot | null>(null);
  const [filters, setFilters] = useState({ district: "", station: "", crimeType: "" });
  const [layers, setLayers] = useState({ incidents: true, stations: true, predicted: true });
  const [mapTileStyle, setMapTileStyle] = useState<"osm" | "voyager" | "esri">("osm");
  const [centre, setCentre] = useState<[number, number]>([0, 0]);

  const apiFilters = {
    districtId: filters.district ? Number(filters.district) : undefined,
    stationId: filters.station ? Number(filters.station) : undefined,
    crimeType: filters.crimeType || undefined,
  };

  const { data: mapLayers } = useQuery({ queryKey: ["mapLayers"], queryFn: () => hotspotService.getLayers() });
  const { data: pointData, isFetching: isPointsLoading } = useQuery({
    queryKey: ["hotspotPoints", filters],
    queryFn: () => hotspotService.getHotspots(apiFilters),
  });
  const { data: predictedData, isLoading: isPredictedLoading } = useQuery({
    queryKey: ["predictedHotspots", filters],
    queryFn: () => hotspotService.getPredictedHotspots(apiFilters),
  });

  const points = useMemo(() => pointData?.points ?? [], [pointData]);
  const predictedHotspots = useMemo(() => predictedData?.hotspots ?? [], [predictedData]);
  const stationsInScope = useMemo(
    () => (mapLayers?.stations ?? []).filter((s) => !filters.district || s.district_id === Number(filters.district)),
    [mapLayers, filters.district],
  );
  const bounds = mapLayers?.bounds ?? null;

  // A selected hotspot belongs to the previous filter result; clear it when the filters change.
  useEffect(() => setSelectedHotspot(null), [filters]);

  // Pan to the chosen district / station, using the medians computed from its FIRs.
  useEffect(() => {
    const map = leafletMap.current;
    if (!map || !mapLayers) return;
    const station = mapLayers.stations.find((s) => s.id === Number(filters.station));
    const district = mapLayers.districts.find((d) => d.id === Number(filters.district));
    if (station) map.setView([station.latitude, station.longitude], 13, { animate: true });
    else if (district) map.setView([district.latitude, district.longitude], 10, { animate: true });
    else if (bounds) map.fitBounds(bounds);
  }, [filters.district, filters.station, mapLayers, bounds]);

  // Basemap switching
  useEffect(() => {
    const map = leafletMap.current;
    if (!map) return;
    if (tileLayerRef.current) map.removeLayer(tileLayerRef.current);
    let url = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
    let subdomains: string | string[] = ["a", "b", "c"];
    if (mapTileStyle === "voyager") {
      url = "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png";
      subdomains = "abcd";
    } else if (mapTileStyle === "esri") {
      url = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}";
      subdomains = [];
    }
    tileLayerRef.current = L.tileLayer(url, { maxZoom: 19, subdomains: subdomains as any, keepBuffer: 6, updateWhenZooming: false, updateWhenIdle: true }).addTo(map);
  }, [mapTileStyle]);

  // Map creation
  useEffect(() => {
    if (!mapRef.current || leafletMap.current) return;
    const map = L.map(mapRef.current, {
      preferCanvas: true, zoomControl: false, attributionControl: false, zoomSnap: 1, zoomDelta: 1, wheelPxPerZoomLevel: 50,
      zoomAnimation: true, fadeAnimation: false, markerZoomAnimation: true, minZoom: 5, maxZoom: 19, maxBoundsViscosity: 0.8,
    }).setView([20, 78], 5);
    tileLayerRef.current = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, keepBuffer: 6, updateWhenZooming: false, updateWhenIdle: true }).addTo(map);
    L.control.zoom({ position: "bottomright" }).addTo(map);
    map.on("moveend", () => {
      const c = map.getCenter();
      setCentre([c.lat, c.lng]);
    });
    leafletMap.current = map;
    stationLayerGroup.current = L.layerGroup().addTo(map);
    markerLayerGroup.current = L.layerGroup().addTo(map);
    hotspotLayerGroup.current = L.layerGroup().addTo(map);
    // The container is laid out after mount; keep Leaflet's idea of its size current so framing and zoom are right.
    const observer = new ResizeObserver(() => map.invalidateSize());
    observer.observe(mapRef.current);
    return () => {
      observer.disconnect();
      map.remove();
      leafletMap.current = null;
    };
  }, []);

  // Frame the map on the data once the layers arrive (extent comes from the FIR coordinates, not from code).
  useEffect(() => {
    const map = leafletMap.current;
    if (!map || !bounds || framedOnce.current) return;
    framedOnce.current = true;
    map.invalidateSize();
    map.fitBounds(bounds);
    map.setMaxBounds([[bounds[0][0] - BOUNDS_PADDING, bounds[0][1] - BOUNDS_PADDING], [bounds[1][0] + BOUNDS_PADDING, bounds[1][1] + BOUNDS_PADDING]]);
    map.setMinZoom(Math.max(5, map.getZoom() - 1));
  }, [bounds]);

  // Incident markers: colour = the risk level the model assigned to the FIR
  useEffect(() => {
    const group = markerLayerGroup.current;
    if (!group) return;
    group.clearLayers();
    if (!layers.incidents) return;
    points.forEach((pt) => {
      const colour = RISK_COLOUR[pt.AIRiskLevel ?? ""] ?? "#64748b";
      L.circleMarker([pt.latitude, pt.longitude], { radius: pt.AIRiskLevel === "Severe" ? 7 : 5, fillColor: colour, color: "#ffffff", weight: 1, opacity: 0.9, fillOpacity: 0.75 })
        .bindPopup(`
          <div class="text-slate-900 text-xs font-sans p-2">
            <strong class="text-blue-700 text-sm block mb-1">FIR ${escapeHtml(pt.CaseNo ?? pt.CaseMasterID)}</strong>
            <p class="leading-relaxed font-semibold mb-1.5 text-slate-800">${escapeHtml(pt.BriefFacts)}</p>
            <div class="space-y-0.5 border-t border-slate-200 pt-1 text-[11px] font-mono">
              ${pt.CrimeHeadName ? `<span class="text-slate-700 block">Crime: <strong>${escapeHtml(pt.CrimeHeadName)}</strong></span>` : ""}
              <span class="text-slate-700 block">Station: <strong>${escapeHtml(pt.PoliceStationName)}</strong></span>
              ${pt.IncidentFromDate ? `<span class="text-slate-700 block">Incident: <strong>${escapeHtml(pt.IncidentFromDate.replace("T", " ").slice(0, 16))}</strong></span>` : ""}
              ${pt.AIRiskLevel ? `<span class="font-bold block mt-1" style="color:${colour}">AI risk: ${escapeHtml(pt.AIRiskLevel)}${pt.AIRiskScore != null ? ` (${pt.AIRiskScore.toFixed(2)})` : ""}</span>` : ""}
            </div>
          </div>`)
        .addTo(group);
    });
  }, [points, layers.incidents]);

  // Police stations: positioned at the median coordinate of the FIRs each one registered
  useEffect(() => {
    const group = stationLayerGroup.current;
    if (!group) return;
    group.clearLayers();
    if (!layers.stations) return;
    stationsInScope.forEach((station) => {
      // Hollow emerald rings drawn beneath the FIR markers so 195 stations don't hide the incidents.
      L.circleMarker([station.latitude, station.longitude], { radius: 8, color: "#10b981", weight: 2, fillColor: "#0d1322", fillOpacity: 0.6 })
        .bindPopup(`<div class="text-slate-900 text-xs p-1"><strong>${escapeHtml(station.name)}</strong><br/>${station.cases} geocoded FIRs<br/><span class="text-[10px] text-slate-500">Position estimated from the FIRs it registered</span></div>`)
        .addTo(group)
        .bringToBack();
    });
  }, [stationsInScope, layers.stations]);

  // KDE hotspots, drawn at the radius used to count their member FIRs
  useEffect(() => {
    const group = hotspotLayerGroup.current;
    if (!group) return;
    group.clearLayers();
    if (!layers.predicted) return;
    predictedHotspots.forEach((h) => {
      const colour = HOTSPOT_COLOUR[h.risk_level] ?? "#f59e0b";
      L.circle([h.latitude, h.longitude], { color: colour, fillColor: colour, fillOpacity: 0.12 + h.relative_density * 0.1, radius: h.radius_m, weight: 1.5 })
        .bindPopup(`
          <div class="text-slate-900 text-xs font-sans p-1.5">
            <strong class="block mb-1" style="color:${colour}">#${h.rank} ${escapeHtml(h.location_name)}</strong>
            <span class="block text-[10px] text-slate-700 font-bold">${h.case_count} FIRs · ${h.open_cases} open · ${h.high_risk_cases} High/Severe</span>
            <span class="block text-[10px] text-slate-500 font-mono mt-0.5">Radius ${(h.radius_m / 1000).toFixed(1)} km · density ${(h.relative_density * 100).toFixed(0)}% of the densest</span>
            ${h.peak_window ? `<span class="block text-[10px] text-slate-600 mt-0.5">Peak incidents ${escapeHtml(h.peak_window)}</span>` : ""}
          </div>`)
        .on("click", () => setSelectedHotspot(h))
        .addTo(group);
    });
  }, [predictedHotspots, layers.predicted]);

  const focusHotspot = (h: PredictedHotspot) => {
    setSelectedHotspot(h);
    leafletMap.current?.setView([h.latitude, h.longitude], 12);
  };

  const selectClass = "w-full bg-[#1e293b] border border-[#334155] text-slate-200 text-xs rounded px-2.5 py-1.5 focus:outline-none focus:border-blue-500 font-mono font-bold";
  const toggle = (key: keyof typeof layers, label: string) => (
    <label className="flex items-center gap-3 text-xs text-slate-300 cursor-pointer">
      <input type="checkbox" checked={layers[key]} onChange={(e) => setLayers({ ...layers, [key]: e.target.checked })}
        className="rounded border-[#1e293b] bg-slate-900 text-blue-600 focus:ring-0 focus:ring-offset-0" />
      <span>{label}</span>
    </label>
  );
  const padButton = "bg-[#1e293b] hover:bg-blue-600 text-slate-200 hover:text-white p-2 rounded flex items-center justify-center transition-colors border border-[#334155]";
  const south = bounds ? bounds[0][0] - BOUNDS_PADDING : 0;
  const north = bounds ? bounds[1][0] + BOUNDS_PADDING : 1;
  const west = bounds ? bounds[0][1] - BOUNDS_PADDING : 0;
  const east = bounds ? bounds[1][1] + BOUNDS_PADDING : 1;

  return (
    <div className="flex h-full w-full gap-5 select-none relative font-sans">
      <div className="w-80 bg-[#111827] border border-[#1e293b] rounded flex flex-col h-full overflow-hidden">
        {activeTab === "gis" ? (
          <div className="p-4 flex-1 flex flex-col gap-4 overflow-y-auto">
            <div className="flex items-center gap-2 border-b border-[#1e293b] pb-3">
              <Filter className="text-blue-500" size={16} />
              <h3 className="text-xs font-bold text-slate-300 font-mono uppercase tracking-wider">{t("Crime Filters", "ಅಪರಾಧ ಫಿಲ್ಟರ್‌ಗಳು")}</h3>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-[10px] uppercase font-mono text-slate-400 mb-1">{t("District", "ಜಿಲ್ಲೆ")}</label>
                <select value={filters.district} onChange={(e) => setFilters({ ...filters, district: e.target.value, station: "" })} className={selectClass}>
                  <option value="">{t("All districts", "ಎಲ್ಲಾ ಜಿಲ್ಲೆಗಳು")} ({mapLayers?.districts.length ?? "…"})</option>
                  {(mapLayers?.districts ?? []).map((d) => <option key={d.id} value={d.id}>{translateData(d.name)} ({d.cases})</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[10px] uppercase font-mono text-slate-400 mb-1">{t("Police station", "ಪೊಲೀಸ್ ಠಾಣೆ")}</label>
                <select value={filters.station} onChange={(e) => setFilters({ ...filters, station: e.target.value })} className={selectClass}>
                  <option value="">{t("All stations", "ಎಲ್ಲಾ ಠಾಣೆಗಳು")} ({stationsInScope.length})</option>
                  {stationsInScope.map((s) => <option key={s.id} value={s.id}>{translateData(s.name)} ({s.cases})</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[10px] uppercase font-mono text-slate-400 mb-1">{t("Crime category", "ಅಪರಾಧ ವರ್ಗ")}</label>
                <select value={filters.crimeType} onChange={(e) => setFilters({ ...filters, crimeType: e.target.value })} className={selectClass}>
                  <option value="">{t("All crime categories", "ಎಲ್ಲಾ ವರ್ಗಗಳು")}</option>
                  {(mapLayers?.crime_heads ?? []).map((c) => <option key={c.id} value={c.id}>{translateData(c.name)} ({c.cases})</option>)}
                </select>
              </div>
            </div>

            <div className="flex items-center gap-2 border-b border-[#1e293b] pb-3 pt-2">
              <Layers className="text-blue-500" size={16} />
              <h3 className="text-xs font-bold text-slate-300 font-mono uppercase tracking-wider">{t("Layers & Basemap", "ಲೇಯರ್ & ಬೇಸ್‌ಮ್ಯಾಪ್")}</h3>
            </div>
            <div className="space-y-3">
              <select value={mapTileStyle} onChange={(e) => setMapTileStyle(e.target.value as typeof mapTileStyle)} className={selectClass}>
                <option value="osm">OpenStreetMap</option>
                <option value="voyager">CartoDB Voyager</option>
                <option value="esri">Esri World Street</option>
              </select>
              <div className="space-y-2 pt-1">
                {toggle("incidents", t("FIR markers (coloured by AI risk level)", "ಎಫ್.ಐ.ಆರ್ ಗುರುತುಗಳು"))}
                {toggle("stations", t("Police stations", "ಪೊಲೀಸ್ ಠಾಣೆಗಳು"))}
                {toggle("predicted", t("KDE hotspots", "KDE ಹಾಟ್‌ಸ್ಪಾಟ್‌ಗಳು"))}
              </div>
            </div>

            <div className="border-t border-[#1e293b] pt-3 space-y-1.5">
              <span className="text-[10px] uppercase font-mono text-slate-400 block">{t("Marker colour = AI risk level", "ಮಾರ್ಕರ್ ಬಣ್ಣ = AI ಅಪಾಯ ಮಟ್ಟ")}</span>
              <div className="flex flex-wrap gap-x-3 gap-y-1">
                {Object.entries(RISK_COLOUR).map(([level, colour]) => (
                  <span key={level} className="flex items-center gap-1.5 text-[10px] text-slate-300 font-mono">
                    <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: colour }} />{level}
                  </span>
                ))}
              </div>
              <p className="text-[10px] text-slate-500 leading-relaxed">
                {pointData ? `${t("Showing", "ತೋರಿಸಲಾಗುತ್ತಿದೆ")} ${pointData.total_points.toLocaleString()} ${t("of", "ರಲ್ಲಿ")} ${pointData.total_matching.toLocaleString()} ${t("geocoded FIRs", "ಜಿಯೋಕೋಡ್ ಎಫ್.ಐ.ಆರ್")}${pointData.total_points < pointData.total_matching ? ` — ${t("the highest-risk ones; filter to see the rest", "ಅತಿ ಹೆಚ್ಚು ಅಪಾಯದವು; ಉಳಿದವನ್ನು ನೋಡಲು ಫಿಲ್ಟರ್ ಮಾಡಿ")}` : ""}.` : "…"}
              </p>
            </div>
          </div>
        ) : (
          <div className="p-4 flex-1 flex flex-col gap-4 overflow-y-auto">
            <div className="flex items-center gap-2 border-b border-[#1e293b] pb-3">
              <Compass className="text-red-400" size={16} />
              <h3 className="text-xs font-bold text-slate-300 font-mono uppercase tracking-wider">{t("Hotspots by incident density", "ಘಟನೆ ಸಾಂದ್ರತೆಯ ಹಾಟ್‌ಸ್ಪಾಟ್‌ಗಳು")}</h3>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1 min-h-0">
              {isPredictedLoading ? (
                <div className="text-center text-xs text-slate-500 py-8 font-mono">{t("Running kernel density estimation…", "ಲೆಕ್ಕಾಚಾರ ನಡೆಯುತ್ತಿದೆ…")}</div>
              ) : predictedHotspots.length === 0 ? (
                <div className="text-center text-xs text-slate-500 py-8 font-mono">{predictedData?.warning || t("No hotspots found.", "ಹಾಟ್‌ಸ್ಪಾಟ್ ಕಂಡುಬಂದಿಲ್ಲ.")}</div>
              ) : (
                predictedHotspots.map((h) => (
                  <div key={h.rank} onClick={() => focusHotspot(h)}
                    className={`p-3 rounded border transition-all cursor-pointer ${selectedHotspot?.rank === h.rank ? "bg-blue-600/10 border-blue-500/50" : "bg-[#151c2e] border-transparent hover:border-slate-700"}`}>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-xs font-bold text-slate-200">#{h.rank} {translateData(h.location_name)}</span>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded font-bold border" style={{ color: HOTSPOT_COLOUR[h.risk_level], borderColor: `${HOTSPOT_COLOUR[h.risk_level]}55`, background: `${HOTSPOT_COLOUR[h.risk_level]}18` }}>
                        {h.risk_level}
                      </span>
                    </div>
                    <p className="text-[11px] text-blue-400 font-semibold mb-1 leading-tight">{h.district_name ? translateData(h.district_name) : ""}</p>
                    <p className="text-[10px] text-slate-400 font-mono">
                      <strong className="text-emerald-400">{h.case_count}</strong> {t("FIRs", "ಎಫ್.ಐ.ಆರ್")} · {h.open_cases} {t("open", "ತೆರೆದಿರುವ")} · {h.high_risk_cases} {t("High/Severe", "ಹೆಚ್ಚು/ತೀವ್ರ")}
                    </p>
                  </div>
                ))
              )}
            </div>

            {selectedHotspot && (
              <div className="border-t border-[#1e293b] pt-3.5 mt-auto space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-200 font-mono uppercase tracking-wider">{t("Hotspot evidence", "ಹಾಟ್‌ಸ್ಪಾಟ್ ಪುರಾವೆ")}</h4>
                  <span className="text-[10px] bg-blue-500/10 text-blue-400 border border-blue-500/20 px-1.5 py-0.5 rounded font-mono font-bold">KDE</span>
                </div>
                <div className="space-y-1.5 text-[11px] leading-relaxed bg-[#151c2e] p-2.5 rounded border border-[#1e293b]">
                  <div className="flex justify-between border-b border-[#1e293b] pb-1">
                    <span className="text-slate-400 font-mono">{t("Density vs densest", "ಸಾಂದ್ರತೆ")}:</span>
                    <span className="text-emerald-400 font-bold font-mono">{(selectedHotspot.relative_density * 100).toFixed(0)}%</span>
                  </div>
                  <ul className="text-slate-300 font-mono text-[10px] list-disc pl-3.5 space-y-0.5">
                    {selectedHotspot.top_factors.map((factor, i) => <li key={i}>{factor}</li>)}
                    {selectedHotspot.repeat_offender_profiles > 0 && <li>{selectedHotspot.repeat_offender_profiles} {t("repeat-offender profile(s) involved", "ಪುನರಾವರ್ತಿತ ಅಪರಾಧಿ ಪ್ರೊಫೈಲ್‌ಗಳು")}</li>}
                  </ul>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex-1 bg-[#111827] border border-[#1e293b] rounded overflow-hidden relative flex flex-col">
        <div className="flex-1 w-full z-10 relative">
          <div ref={mapRef} className="h-full w-full" />

          <div className="absolute top-4 right-4 z-20 flex flex-col items-center gap-1.5 bg-[#0d1322]/90 border border-[#1e293b] p-2.5 rounded shadow-2xl backdrop-blur select-none">
            <span className="text-[9px] font-mono font-bold text-blue-400 uppercase tracking-widest mb-0.5">{t("Map navigation", "ನಕ್ಷೆ ನ್ಯಾವಿಗೇಶನ್")}</span>
            <div className="grid grid-cols-3 gap-1 w-28">
              <div></div>
              <button onClick={() => leafletMap.current?.panBy([0, -150])} title="North" className={padButton}><ChevronUp size={16} /></button>
              <div></div>
              <button onClick={() => leafletMap.current?.panBy([-150, 0])} title="West" className={padButton}><ChevronLeft size={16} /></button>
              <button onClick={() => bounds && leafletMap.current?.fitBounds(bounds)} title={t("Fit all FIRs", "ಎಲ್ಲಾ ಎಫ್.ಐ.ಆರ್ ತೋರಿಸಿ")} className={padButton}><Compass size={16} /></button>
              <button onClick={() => leafletMap.current?.panBy([150, 0])} title="East" className={padButton}><ChevronRight size={16} /></button>
              <div></div>
              <button onClick={() => leafletMap.current?.panBy([0, 150])} title="South" className={padButton}><ChevronDown size={16} /></button>
              <div></div>
            </div>
            <div className="flex gap-1.5 w-full mt-1">
              <button onClick={() => leafletMap.current?.zoomIn()} className="flex-1 bg-[#1e293b] hover:bg-blue-600 text-slate-200 hover:text-white py-1.5 rounded text-[11px] font-mono font-bold flex items-center justify-center gap-1 border border-[#334155]"><ZoomIn size={13} /> +</button>
              <button onClick={() => leafletMap.current?.zoomOut()} className="flex-1 bg-[#1e293b] hover:bg-blue-600 text-slate-200 hover:text-white py-1.5 rounded text-[11px] font-mono font-bold flex items-center justify-center gap-1 border border-[#334155]"><ZoomOut size={13} /> -</button>
            </div>
          </div>

          {bounds && (
            <>
              <div className="absolute right-3 top-24 bottom-16 w-7 z-20 flex flex-col items-center bg-[#0d1322]/95 border border-[#1e293b] rounded py-1.5 px-1 shadow-2xl backdrop-blur">
                <button onClick={() => leafletMap.current?.panBy([0, -120])} title="North" className="text-slate-300 hover:text-white hover:bg-blue-600 p-1 rounded transition-colors mb-1"><ChevronUp size={14} /></button>
                <div className="flex-1 w-full flex items-center justify-center py-1">
                  <input type="range" min={south} max={north} step="0.02" value={Math.min(north, Math.max(south, centre[0]))}
                    onChange={(e) => leafletMap.current?.setView([parseFloat(e.target.value), centre[1]], leafletMap.current.getZoom(), { animate: false })}
                    className="h-full w-3 appearance-none bg-[#151c2e] border border-[#334155] rounded-full cursor-pointer accent-blue-500 shadow-inner" style={{ writingMode: "vertical-lr", direction: "rtl" }} />
                </div>
                <button onClick={() => leafletMap.current?.panBy([0, 120])} title="South" className="text-slate-300 hover:text-white hover:bg-blue-600 p-1 rounded transition-colors mt-1"><ChevronDown size={14} /></button>
              </div>

              <div className="absolute bottom-2 left-6 right-24 h-8 z-20 flex items-center bg-[#0d1322]/95 border border-[#1e293b] rounded px-2 py-1 shadow-2xl backdrop-blur">
                <button onClick={() => leafletMap.current?.panBy([-120, 0])} title="West" className="text-slate-300 hover:text-white hover:bg-blue-600 p-1 rounded transition-colors mr-2"><ChevronLeft size={16} /></button>
                <input type="range" min={west} max={east} step="0.02" value={Math.min(east, Math.max(west, centre[1]))}
                  onChange={(e) => leafletMap.current?.setView([centre[0], parseFloat(e.target.value)], leafletMap.current.getZoom(), { animate: false })}
                  className="flex-1 h-2.5 appearance-none bg-[#151c2e] border border-[#334155] rounded-full cursor-pointer accent-blue-500 shadow-inner" />
                <button onClick={() => leafletMap.current?.panBy([120, 0])} title="East" className="text-slate-300 hover:text-white hover:bg-blue-600 p-1 rounded transition-colors ml-2"><ChevronRight size={16} /></button>
              </div>
            </>
          )}
        </div>

        {selectedHotspot && (
          <div className="absolute bottom-20 left-4 right-4 bg-[#0d1322]/95 border border-blue-500/30 rounded shadow-2xl p-4 z-20 flex justify-between items-center gap-6 select-none backdrop-blur">
            <div className="flex-1 space-y-1">
              <span className="text-[10px] bg-red-500/10 text-red-400 border border-red-500/20 px-1.5 py-0.5 rounded font-mono font-bold uppercase tracking-wider">
                #{selectedHotspot.rank} · {selectedHotspot.risk_level}
              </span>
              <span className="text-[10px] bg-blue-500/10 text-blue-400 border border-blue-500/20 px-1.5 py-0.5 rounded font-mono font-bold uppercase tracking-wider ml-2">
                kernel_density · {predictedData?.model_version}
              </span>
              <h4 className="text-xs font-bold text-slate-100 font-mono mt-1">
                {translateData(selectedHotspot.location_name)} — {selectedHotspot.latitude.toFixed(4)} N, {selectedHotspot.longitude.toFixed(4)} E
              </h4>
              <p className="text-[10px] text-slate-400 leading-relaxed">{selectedHotspot.reason}</p>
            </div>
            <div className="flex items-center gap-3">
              <button onClick={() => leafletMap.current?.setView([selectedHotspot.latitude, selectedHotspot.longitude], 13)}
                className="bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-bold font-mono px-3 py-1.5 rounded transition-colors">{t("Recentre", "ಮರುಕೇಂದ್ರೀಕರಿಸಿ")}</button>
              <button onClick={() => setSelectedHotspot(null)} className="text-slate-500 hover:text-slate-300 text-xs font-bold font-mono px-2 py-1">{t("Dismiss", "ಮುಚ್ಚಿ")}</button>
            </div>
          </div>
        )}

        <div className="bg-[#0f1422] border-t border-[#1e293b] px-4 py-2.5 flex items-center justify-between z-20">
          <div className="flex items-center gap-2">
            <span className={`w-2.5 h-2.5 rounded-full inline-block ${isPointsLoading ? "bg-amber-500 animate-pulse" : "bg-emerald-500"}`} />
            <span className="text-xs font-mono font-bold text-slate-300">{t("Spatial analytics", "ಸ್ಥಳೀಯ ವಿಶ್ಲೇಷಣೆ")}</span>
          </div>
          <div className="text-[11px] font-mono text-slate-400">
            {mapLayers ? `${mapLayers.geocoded_cases.toLocaleString()} ${t("geocoded FIRs registered up to", "ಜಿಯೋಕೋಡ್ ಎಫ್.ಐ.ಆರ್, ದಿನಾಂಕದವರೆಗೆ")} ${mapLayers.as_of_date}` : "…"}
          </div>
        </div>
      </div>
    </div>
  );
}
