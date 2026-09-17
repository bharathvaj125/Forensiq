import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { hotspotService } from "../../services/hotspotService";
import { Filter, Layers, Compass, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from "lucide-react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

import { useLanguage } from "../../app/providers/LanguageContext";

interface HotspotProps {
  activeTab?: "gis" | "dashboard";
}

export default function Hotspot({ activeTab = "gis" }: HotspotProps) {
  const { translateData } = useLanguage();
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletMap = useRef<L.Map | null>(null);
  const markerLayerGroup = useRef<L.LayerGroup | null>(null);
  const predictedLayerGroup = useRef<L.LayerGroup | null>(null);
  const patrolRouteLayer = useRef<L.Polyline | null>(null);

  const [selectedHotspot, setSelectedHotspot] = useState<any>(null);
  const timeHour = 24;
  const [filters, setFilters] = useState({
    district: "",
    crimeType: "",
    severity: "",
  });

  const [layers, setLayers] = useState({
    incidents: true,
    stations: true,
    predicted: true,
  });

  const [mapTileStyle, setMapTileStyle] = useState<"osm" | "voyager" | "esri">("osm");
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const [currentLat, setCurrentLat] = useState(14.5204);
  const [currentLng, setCurrentLng] = useState(75.7224);

  const karnatakaDistricts: Record<number, string> = {
    1: "Bagalkot", 2: "Ballari", 3: "Belagavi", 4: "Bengaluru Rural", 5: "Bengaluru Urban",
    6: "Bidar", 7: "Chamarajanagar", 8: "Chikballapur", 9: "Chikkamagaluru", 10: "Chitradurga",
    11: "Dakshina Kannada", 12: "Davanagere", 13: "Dharwad", 14: "Gadag", 15: "Hassan",
    16: "Haveri", 17: "Kalaburagi", 18: "Kodagu", 19: "Kolar", 20: "Koppal",
    21: "Mandya", 22: "Mysuru", 23: "Raichur", 24: "Ramanagara", 25: "Shivamogga",
    26: "Tumakuru", 27: "Udupi", 28: "Uttara Kannada", 29: "Vijayapura", 30: "Yadgir", 31: "Vijayanagara"
  };

  const districtCenterCoords: Record<number, [number, number]> = {
    1: [16.1853, 75.6960], // Bagalkot
    2: [15.1394, 76.9214], // Ballari
    3: [15.8497, 74.4977], // Belagavi
    4: [13.2257, 77.5750], // Bengaluru Rural
    5: [12.9716, 77.5946], // Bengaluru Urban
    6: [17.9104, 77.5199], // Bidar
    7: [11.9261, 76.9437], // Chamarajanagar
    8: [13.4355, 77.7275], // Chikballapur
    9: [13.3161, 75.7720], // Chikkamagaluru
    10: [14.2251, 76.3980], // Chitradurga
    11: [12.9141, 74.8560], // Dakshina Kannada
    12: [14.4644, 75.9218], // Davanagere
    13: [15.4589, 75.0078], // Dharwad
    14: [15.4319, 75.6355], // Gadag
    15: [13.0033, 76.1004], // Hassan
    16: [14.7958, 75.3992], // Haveri
    17: [17.3297, 76.8343], // Kalaburagi
    18: [12.4244, 75.7382], // Kodagu
    19: [13.1367, 78.1292], // Kolar
    20: [15.3503, 76.1554], // Koppal
    21: [12.5218, 76.8951], // Mandya
    22: [12.2958, 76.6394], // Mysuru
    23: [16.2076, 77.3563], // Raichur
    24: [12.7160, 77.2814], // Ramanagara
    25: [13.9299, 75.5681], // Shivamogga
    26: [13.3409, 77.1006], // Tumakuru
    27: [13.3409, 74.7421], // Udupi
    28: [14.8142, 74.1297], // Uttara Kannada
    29: [16.8302, 75.7100], // Vijayapura
    30: [16.7705, 77.1376], // Yadgir
    31: [15.2713, 76.3869], // Vijayanagara
  };

  const crimeCategoryOptions = [
    { value: "", label: "📋 All IPC Crime Classifications" },
    { value: "burglary", label: "🌙 Residential / Night Burglary & House Breaking" },
    { value: "theft", label: "🚗 Motor Vehicle & Property Theft" },
    { value: "cyber", label: "💻 Cyber Crime & Financial Extortion" },
    { value: "assault", label: "🚨 Armed Robbery & Violent Assault" },
    { value: "women", label: "🛡️ Crimes Against Women & Children" },
    { value: "narcotics", label: "📦 NDPS & Illegal Contraband" }
  ];

  // Query live crime coordinates
  const { data: hotspotData } = useQuery({
    queryKey: ["hotspotsData", filters.district, filters.crimeType],
    queryFn: () => hotspotService.getHotspots(filters.district ? Number(filters.district) : undefined, filters.crimeType || undefined),
  });

  // Query predicted AI hotspots
  const { data: predictedData, isLoading: isPredictedLoading } = useQuery({
    queryKey: ["predictedData"],
    queryFn: () => hotspotService.getPredictedHotspots(),
  });

  const points = hotspotData?.points || [];
  const predictedHotspots = predictedData?.hotspots || [];

  // Auto-center map when a district is selected from the dropdown
  useEffect(() => {
    if (!leafletMap.current) return;
    if (filters.district && districtCenterCoords[Number(filters.district)]) {
      const coords = districtCenterCoords[Number(filters.district)];
      leafletMap.current.setView(coords, 12, { animate: true });
    }
  }, [filters.district]);



  // Dynamic Tile Layer Switching (OSM Detailed Streets/Schools vs Voyager vs Esri)
  useEffect(() => {
    if (!leafletMap.current) return;
    if (tileLayerRef.current) {
      leafletMap.current.removeLayer(tileLayerRef.current);
    }
    let url = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
    let subdomains: string | string[] = ["a", "b", "c"];
    if (mapTileStyle === "voyager") {
      url = "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png";
      subdomains = "abcd";
    } else if (mapTileStyle === "esri") {
      url = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}";
      subdomains = [];
    }

    tileLayerRef.current = L.tileLayer(url, {
      maxZoom: 19,
      subdomains: subdomains as any,
      keepBuffer: 6,
      updateWhenZooming: false,
      updateWhenIdle: true,
    }).addTo(leafletMap.current);
  }, [mapTileStyle]);

  // Initialize Map with Canvas Renderer & Fast Instant Zooming
  useEffect(() => {
    if (!mapRef.current || leafletMap.current) return;

    const karnatakaBounds: L.LatLngBoundsExpression = [
      [11.2, 73.8], // Southwest corner
      [18.9, 78.8]  // Northeast corner
    ];

    const map = L.map(mapRef.current, {
      preferCanvas: true,
      zoomControl: false,
      attributionControl: false,
      zoomSnap: 1,
      zoomDelta: 1,
      wheelPxPerZoomLevel: 50,
      zoomAnimation: true,
      fadeAnimation: false,
      markerZoomAnimation: true,
      minZoom: 7,
      maxZoom: 19,
      maxBounds: karnatakaBounds,
      maxBoundsViscosity: 0.8,
    }).setView([14.5204, 75.7224], 8); // Centered over Karnataka

    // Add initial tile layer with buffer preloading
    tileLayerRef.current = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      keepBuffer: 6,
      updateWhenZooming: false,
      updateWhenIdle: true,
    }).addTo(map);

    L.control.zoom({ position: "bottomright" }).addTo(map);

    // Track map center position for vertical and horizontal pan bars
    map.on("moveend", () => {
      const c = map.getCenter();
      setCurrentLat(c.lat);
      setCurrentLng(c.lng);
    });

    leafletMap.current = map;
    markerLayerGroup.current = L.layerGroup().addTo(map);
    predictedLayerGroup.current = L.layerGroup().addTo(map);

    L.control.zoom({ position: "bottomright" }).addTo(map);

    leafletMap.current = map;
    markerLayerGroup.current = L.layerGroup().addTo(map);
    predictedLayerGroup.current = L.layerGroup().addTo(map);

    // Initial dummy polyline for patrol routing
    patrolRouteLayer.current = L.polyline([], { color: "#3b82f6", weight: 3, dashArray: "5, 10" }).addTo(map);

    return () => {
      if (leafletMap.current) {
        leafletMap.current.remove();
        leafletMap.current = null;
      }
    };
  }, []);

  // Update map layers based on time, toggles, and filters
  useEffect(() => {
    const map = leafletMap.current;
    const markerGroup = markerLayerGroup.current;
    const predGroup = predictedLayerGroup.current;
    const routeLine = patrolRouteLayer.current;

    if (!map || !markerGroup || !predGroup || !routeLine) return;

    markerGroup.clearLayers();
    predGroup.clearLayers();
    routeLine.setLatLngs([]);

    // Extract real hour from PostgreSQL timestamp
    const getPointHour = (pt: any): number => {
      if (pt.IncidentFromDate) {
        const d = new Date(pt.IncidentFromDate);
        if (!isNaN(d.getTime())) return d.getHours();
      }
      if (pt.CrimeRegisteredDate) {
        const d = new Date(pt.CrimeRegisteredDate);
        if (!isNaN(d.getTime())) return d.getHours();
      }
      return 12;
    };

    // Filter points by time window: when timeHour === 24, show ALL 5000 cases; otherwise filter by 4-hr shift window
    const filteredPoints = points.filter((pt: any) => {
      if (timeHour === 24) return true;
      const ptHour = getPointHour(pt);
      const minHour = Math.max(0, timeHour - 4);
      return ptHour >= minHour && ptHour <= timeHour;
    });

    if (layers.incidents && filteredPoints.length > 0) {
      filteredPoints.forEach((pt: any) => {
        // District filter
        if (filters.district && pt.DistrictID && pt.DistrictID !== Number(filters.district)) return;

        // Crime Type / Category filter
        if (filters.crimeType) {
          const typeKey = filters.crimeType.toLowerCase();
          const facts = (pt.BriefFacts || "").toLowerCase();
          if (typeKey === "burglary" && !facts.includes("burgla") && !facts.includes("house") && !facts.includes("lurking") && !facts.includes("theft") && pt.CrimeHeadID !== 2) return;
          if (typeKey === "theft" && !facts.includes("theft") && !facts.includes("stolen") && !facts.includes("vehicle") && pt.CrimeHeadID !== 2) return;
          if (typeKey === "cyber" && !facts.includes("cyber") && !facts.includes("bank") && !facts.includes("fraud") && !facts.includes("online") && pt.CrimeHeadID !== 7) return;
          if (typeKey === "assault" && !facts.includes("assault") && !facts.includes("robbery") && !facts.includes("stab") && !facts.includes("murder") && pt.CrimeHeadID !== 1) return;
          if (typeKey === "women" && !facts.includes("dowry") && !facts.includes("molest") && !facts.includes("rape") && !facts.includes("assault") && pt.CrimeHeadID !== 3) return;
          if (typeKey === "narcotics" && !facts.includes("ganja") && !facts.includes("drug") && !facts.includes("ndps") && pt.CrimeHeadID !== 8) return;
        }

        const ptHour = getPointHour(pt);
        const isNightBurglary = filters.crimeType === "burglary";
        const fillColor = isNightBurglary ? "#ef4444" : (pt.AIRiskScore > 0.7 ? "#f97316" : "#3b82f6");
        const radius = isNightBurglary ? 7 : 5;

        const timeStr = `${String(ptHour).padStart(2, '0')}:00 hrs`;
        const marker = L.circleMarker([pt.latitude, pt.longitude], {
          renderer: L.canvas(),
          radius: radius,
          fillColor: fillColor,
          color: "#ffffff",
          weight: 1,
          opacity: 0.9,
          fillOpacity: 0.75,
        }).bindPopup(`
          <div class="text-slate-900 text-xs font-sans p-2">
            <strong class="text-blue-700 text-sm block mb-1">Case #${pt.CaseNo || pt.CaseMasterID || 'Incident'}</strong>
            <p class="leading-relaxed font-semibold mb-1.5 text-slate-800">${pt.BriefFacts || "Crime log incident."}</p>
            <div class="space-y-0.5 border-t border-slate-200 pt-1 text-[11px] font-mono">
              <span class="text-slate-700 block">🕒 Recorded Hour: <strong>${timeStr}</strong></span>
              <span class="text-slate-700 block">🏢 Police Unit: <strong>${pt.PoliceStationName || "KSP Precinct"}</strong></span>
              ${pt.AIRiskScore ? `<span class="text-red-700 font-bold block mt-1">🚨 AI Risk Score: ${pt.AIRiskScore.toFixed(2)}</span>` : ''}
            </div>
          </div>
        `);
        markerGroup.addLayer(marker);
      });
    }

    // 2. Police Stations
    if (layers.stations) {
      const mockStations = [
        { name: "KSP Central Command HQ", lat: 12.9716, lng: 77.5946 },
        { name: "Mysuru Division Police Unit", lat: 12.2958, lng: 76.6394 },
        { name: "Belagavi Circle Station", lat: 15.8497, lng: 74.4977 },
        { name: "Hubballi Sector Station", lat: 15.3647, lng: 75.1240 },
      ];
      mockStations.forEach((st) => {
        const stationIcon = L.divIcon({
          className: "custom-div-icon",
          html: `<div class="text-emerald-400 bg-[#0d1322] border border-emerald-500/50 p-1.5 rounded-full shadow-lg">
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
          </div>`,
          iconSize: [22, 22],
          iconAnchor: [11, 11]
        });
        const marker = L.marker([st.lat, st.lng], { icon: stationIcon })
          .bindPopup(`<strong class="text-slate-900 text-xs">${st.name}</strong>`);
        markerGroup.addLayer(marker);
      });
    }

    // 3. AI hotspots with clear sector names and tactical patrol recommendations
    if (layers.predicted && predictedHotspots.length > 0) {
      const sectorNames = [
        "Sector A - Commercial Market Corridor",
        "Sector B - High-Value Property Zone",
        "Sector C - Highway Bypass Intersection",
        "Sector D - Industrial Transit Hub"
      ];

      predictedHotspots.forEach((h: any, idx: number) => {
        const multiplier = Math.sin((timeHour + idx * 4) / 4) * 0.5 + 1.0; 
        const radius = 600 * multiplier;
        const color = h.confidence > 0.7 ? "#ef4444" : "#f59e0b";
        const sectorName = sectorNames[idx % sectorNames.length];

        const circle = L.circle([h.latitude, h.longitude], {
          color: color,
          fillColor: color,
          fillOpacity: 0.15 + (multiplier * 0.05),
          radius: radius,
          weight: 1.5,
        }).bindPopup(`
          <div class="text-slate-900 text-xs font-sans p-1.5">
            <strong class="text-red-600 block mb-1">${sectorName}</strong>
            <span class="block text-[10px] text-slate-700 font-bold">KDE AI Risk Confidence: ${(h.confidence * 100).toFixed(0)}%</span>
            <span class="block text-[10px] text-slate-500 font-mono mt-0.5">Coverage Radius: ${radius.toFixed(0)}m</span>
            <div class="mt-1.5 p-1 bg-blue-50 border border-blue-200 rounded text-[9.5px] text-blue-800 font-mono">
              Patrol Rec: Deploy 2 Mobile Squad Units (18:00 - 22:00)
            </div>
          </div>
        `);

        circle.on("click", () => {
          setSelectedHotspot(h);
        });

        predGroup.addLayer(circle);

        // Draw animated patrol routes to the active hotspots at this hour
        if (idx === 0 && filteredPoints.length > 0) {
          const routePoints: L.LatLngExpression[] = [
            [12.9716, 77.5946], // From HQ
            [h.latitude, h.longitude] // to Hotspot
          ];
          routeLine.setLatLngs(routePoints);
        }
      });
    }
  }, [points, predictedHotspots, layers, filters, timeHour]);

  const handleHotspotClick = (h: any) => {
    setSelectedHotspot(h);
    if (leafletMap.current) {
      leafletMap.current.setView([h.latitude, h.longitude], 12);
    }
  };

  return (
    <div className="flex h-full w-full gap-5 select-none relative font-sans">
      {/* Side Filters panel */}
      <div className="w-80 bg-[#111827] border border-[#1e293b] rounded flex flex-col h-full overflow-hidden">
        {activeTab === "gis" ? (
          <div className="p-4 flex-1 flex flex-col gap-4 overflow-y-auto">
            <div className="flex items-center gap-2 border-b border-[#1e293b] pb-3">
              <Filter className="text-blue-500" size={16} />
              <h3 className="text-xs font-bold text-slate-300 font-mono uppercase tracking-wider">
                Crime Filters
              </h3>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-[10px] uppercase font-mono text-slate-400 mb-1">District Division</label>
                <select
                  value={filters.district}
                  onChange={(e) => setFilters({ ...filters, district: e.target.value })}
                  className="w-full bg-[#1e293b] border border-[#334155] text-slate-200 text-xs rounded px-2.5 py-1.5 focus:outline-none focus:border-blue-500 font-mono font-bold"
                >
                  <option value="">All Karnataka Districts (31)</option>
                  {Object.entries(karnatakaDistricts).map(([id, name]) => (
                    <option key={id} value={id}>{translateData(name)}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] uppercase font-mono text-slate-400 mb-1">IPC Crime Category</label>
                <select
                  value={filters.crimeType}
                  onChange={(e) => setFilters({ ...filters, crimeType: e.target.value })}
                  className="w-full bg-[#1e293b] border border-[#334155] text-slate-200 text-xs rounded px-2.5 py-1.5 focus:outline-none focus:border-blue-500 font-mono font-bold"
                >
                  {crimeCategoryOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>{translateData(opt.label)}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-center gap-2 border-b border-[#1e293b] pb-3 pt-2">
              <Layers className="text-blue-500" size={16} />
              <h3 className="text-xs font-bold text-slate-300 font-mono uppercase tracking-wider">
                GIS Layer & Basemap Style
              </h3>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-[10px] uppercase font-mono text-slate-400 mb-1">GIS Basemap Style</label>
                <select
                  value={mapTileStyle}
                  onChange={(e) => setMapTileStyle(e.target.value as any)}
                  className="w-full bg-[#1e293b] border border-[#334155] text-slate-200 text-xs rounded px-2.5 py-1.5 focus:outline-none focus:border-blue-500 font-mono font-bold"
                >
                  <option value="osm">🏫 OSM High-Detail Streets & Schools</option>
                  <option value="voyager">🏙️ CartoDB Voyager Bright</option>
                  <option value="esri">🗺️ Esri World Street Precision</option>
                </select>
              </div>

              <div className="space-y-2 pt-1">
                <label className="flex items-center gap-3 text-xs text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={layers.incidents}
                    onChange={(e) => setLayers({ ...layers, incidents: e.target.checked })}
                    className="rounded border-[#1e293b] bg-slate-900 text-blue-600 focus:ring-0 focus:ring-offset-0"
                  />
                  <span>Active Crime Markers</span>
                </label>

                <label className="flex items-center gap-3 text-xs text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={layers.stations}
                    onChange={(e) => setLayers({ ...layers, stations: e.target.checked })}
                    className="rounded border-[#1e293b] bg-slate-900 text-blue-600 focus:ring-0 focus:ring-offset-0"
                  />
                  <span>Police Precinct Stations</span>
                </label>

                <label className="flex items-center gap-3 text-xs text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={layers.predicted}
                    onChange={(e) => setLayers({ ...layers, predicted: e.target.checked })}
                    className="rounded border-[#1e293b] bg-slate-900 text-blue-600 focus:ring-0 focus:ring-offset-0"
                  />
                  <span>AI Predicted Hotspots</span>
                </label>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-4 flex-1 flex flex-col gap-4 overflow-y-auto">
            <div className="flex items-center gap-2 border-b border-[#1e293b] pb-3">
              <Compass className="text-red-400" size={16} />
              <h3 className="text-xs font-bold text-slate-300 font-mono uppercase tracking-wider">
                {translateData("TOP AI RISK HOTSPOTS")}
              </h3>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1 min-h-0">
              {isPredictedLoading ? (
                <div className="text-center text-xs text-slate-500 py-8 font-mono">{translateData("Running KDE engines...")}</div>
              ) : predictedHotspots.length === 0 ? (
                <div className="text-center text-xs text-slate-500 py-8 font-mono">{translateData("No hotspots predicted.")}</div>
              ) : (
                predictedHotspots.map((h: any, idx: number) => {
                  const isHigh = h.confidence > 0.7;
                  const primaryFactor = h.top_factors && h.top_factors[0] ? h.top_factors[0] : "High spatial incident density";

                  return (
                    <div
                      key={idx}
                      onClick={() => handleHotspotClick(h)}
                      className={`p-3 rounded border transition-all cursor-pointer ${
                        selectedHotspot === h
                          ? "bg-blue-600/10 border-blue-500/50"
                          : "bg-[#151c2e] border-transparent hover:border-slate-700"
                      }`}
                    >
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-xs font-bold text-slate-200">{translateData(`Zone #${idx + 1}`)}</span>
                        <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded font-bold ${
                          isHigh ? "text-red-400 bg-red-500/10 border border-red-500/20" :
                          "text-amber-400 bg-amber-500/10 border border-amber-500/20"
                        }`}>
                          {(h.confidence * 100).toFixed(0)}% {translateData("AI Risk Score")}
                        </span>
                      </div>
                      <p className="text-[11px] text-blue-400 font-semibold mb-1 leading-tight">
                        {translateData(primaryFactor)}
                      </p>
                      <p className="text-[10px] text-slate-400 font-mono">
                        {translateData("Nearby FIR Volume")}: <strong className="text-emerald-400">{h.nearby_case_count || translateData("Multi-FIR")} {translateData("cases")}</strong>
                      </p>
                    </div>
                  );
                })
              )}
            </div>

            {selectedHotspot && (
              <div className="border-t border-[#1e293b] pt-3.5 mt-auto space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-200 font-mono uppercase tracking-wider">{translateData("Zone Intelligence Report")}</h4>
                  <span className="text-[10px] bg-blue-500/10 text-blue-400 border border-blue-500/20 px-1.5 py-0.5 rounded font-mono font-bold">
                    KDE Model
                  </span>
                </div>
                <div className="space-y-1.5 text-[11px] leading-relaxed bg-[#151c2e] p-2.5 rounded border border-[#1e293b]">
                  <div className="flex justify-between border-b border-[#1e293b] pb-1">
                    <span className="text-slate-400 font-mono">AI Confidence:</span>
                    <span className="text-emerald-400 font-bold font-mono">{(selectedHotspot.confidence * 100).toFixed(0)}%</span>
                  </div>
                  <div>
                    <span className="text-slate-400 font-mono block mb-0.5">Database Risk Drivers:</span>
                    <ul className="text-slate-300 font-mono text-[10px] list-disc pl-3.5 space-y-0.5">
                      {selectedHotspot.top_factors && selectedHotspot.top_factors.map((factor: string, fIdx: number) => (
                        <li key={fIdx}>{factor}</li>
                      ))}
                      <li>Spatial KDE Cluster Radius: ~2.2 km</li>
                    </ul>
                  </div>
                  <div className="pt-1 border-t border-[#1e293b]">
                    <span className="text-blue-400 font-bold block text-[10px]">Patrol Action Required:</span>
                    <span className="text-slate-300 text-[10px]">Deploy 2 Patrol Vehicles & Night Beat Officers for this primary crime head.</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Main Map with bottom time slider */}
      <div className="flex-1 bg-[#111827] border border-[#1e293b] rounded overflow-hidden relative flex flex-col">
        <div className="flex-1 w-full z-10 relative">
          <div ref={mapRef} className="h-full w-full" />

          {/* Directional Pan Navigation Controls Overlay */}
          <div className="absolute top-4 right-4 z-20 flex flex-col items-center gap-1.5 bg-[#0d1322]/90 border border-[#1e293b] p-2.5 rounded shadow-2xl backdrop-blur select-none">
            <span className="text-[9px] font-mono font-bold text-blue-400 uppercase tracking-widest mb-0.5">
              GIS Navigation Pad
            </span>
            <div className="grid grid-cols-3 gap-1 w-28">
              <div></div>
              <button
                onClick={() => leafletMap.current?.panBy([0, -150])}
                title="Pan North (Up)"
                className="bg-[#1e293b] hover:bg-blue-600 text-slate-200 hover:text-white p-2 rounded flex items-center justify-center transition-colors border border-[#334155]"
              >
                <ChevronUp size={16} />
              </button>
              <div></div>
              <button
                onClick={() => leafletMap.current?.panBy([-150, 0])}
                title="Pan West (Left)"
                className="bg-[#1e293b] hover:bg-blue-600 text-slate-200 hover:text-white p-2 rounded flex items-center justify-center transition-colors border border-[#334155]"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                onClick={() => leafletMap.current?.setView([14.5204, 75.7224], 8)}
                title="Reset Karnataka View"
                className="bg-[#1e293b] hover:bg-blue-600 text-slate-200 hover:text-white p-2 rounded flex items-center justify-center transition-colors border border-[#334155]"
              >
                <Compass size={16} />
              </button>
              <button
                onClick={() => leafletMap.current?.panBy([150, 0])}
                title="Pan East (Right)"
                className="bg-[#1e293b] hover:bg-blue-600 text-slate-200 hover:text-white p-2 rounded flex items-center justify-center transition-colors border border-[#334155]"
              >
                <ChevronRight size={16} />
              </button>
              <div></div>
              <button
                onClick={() => leafletMap.current?.panBy([0, 150])}
                title="Pan South (Down)"
                className="bg-[#1e293b] hover:bg-blue-600 text-slate-200 hover:text-white p-2 rounded flex items-center justify-center transition-colors border border-[#334155]"
              >
                <ChevronDown size={16} />
              </button>
              <div></div>
            </div>
            <div className="flex gap-1.5 w-full mt-1">
              <button
                onClick={() => leafletMap.current?.zoomIn()}
                className="flex-1 bg-[#1e293b] hover:bg-blue-600 text-slate-200 hover:text-white py-1.5 rounded text-[11px] font-mono font-bold flex items-center justify-center gap-1 border border-[#334155]"
              >
                <ZoomIn size={13} /> +
              </button>
              <button
                onClick={() => leafletMap.current?.zoomOut()}
                className="flex-1 bg-[#1e293b] hover:bg-blue-600 text-slate-200 hover:text-white py-1.5 rounded text-[11px] font-mono font-bold flex items-center justify-center gap-1 border border-[#334155]"
              >
                <ZoomOut size={13} /> -
              </button>
            </div>
          </div>

          {/* Vertical (North-South / Latitude) Scrollbar Track matching user's screenshot */}
          <div className="absolute right-3 top-24 bottom-16 w-7 z-20 flex flex-col items-center bg-[#0d1322]/95 border border-[#1e293b] rounded py-1.5 px-1 shadow-2xl backdrop-blur">
            <button
              onClick={() => leafletMap.current?.panBy([0, -120])}
              title="Pan North (Up)"
              className="text-slate-300 hover:text-white hover:bg-blue-600 p-1 rounded transition-colors mb-1"
            >
              <ChevronUp size={14} />
            </button>

            <div className="flex-1 w-full flex items-center justify-center py-1">
              <input
                type="range"
                min="11.2"
                max="18.9"
                step="0.02"
                value={currentLat}
                onChange={(e) => {
                  const newLat = parseFloat(e.target.value);
                  setCurrentLat(newLat);
                  if (leafletMap.current) {
                    leafletMap.current.setView([newLat, currentLng], leafletMap.current.getZoom(), { animate: false });
                  }
                }}
                className="h-full w-3 appearance-none bg-[#151c2e] border border-[#334155] rounded-full cursor-pointer accent-blue-500 shadow-inner"
                style={{ writingMode: "vertical-lr", direction: "rtl" }}
              />
            </div>

            <button
              onClick={() => leafletMap.current?.panBy([0, 120])}
              title="Pan South (Down)"
              className="text-slate-300 hover:text-white hover:bg-blue-600 p-1 rounded transition-colors mt-1"
            >
              <ChevronDown size={14} />
            </button>
          </div>

          {/* Horizontal (West-East / Longitude) Scrollbar Track matching user's screenshot */}
          <div className="absolute bottom-2 left-6 right-24 h-8 z-20 flex items-center bg-[#0d1322]/95 border border-[#1e293b] rounded px-2 py-1 shadow-2xl backdrop-blur">
            <button
              onClick={() => leafletMap.current?.panBy([-120, 0])}
              title="Pan West (Left)"
              className="text-slate-300 hover:text-white hover:bg-blue-600 p-1 rounded transition-colors mr-2"
            >
              <ChevronLeft size={16} />
            </button>

            <input
              type="range"
              min="73.8"
              max="78.8"
              step="0.02"
              value={currentLng}
              onChange={(e) => {
                const newLng = parseFloat(e.target.value);
                setCurrentLng(newLng);
                if (leafletMap.current) {
                  leafletMap.current.setView([currentLat, newLng], leafletMap.current.getZoom(), { animate: false });
                }
              }}
              className="flex-1 h-2.5 appearance-none bg-[#151c2e] border border-[#334155] rounded-full cursor-pointer accent-blue-500 shadow-inner"
            />

            <button
              onClick={() => leafletMap.current?.panBy([120, 0])}
              title="Pan East (Right)"
              className="text-slate-300 hover:text-white hover:bg-blue-600 p-1 rounded transition-colors ml-2"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>

        {/* Bottom sliding intelligence drawer */}
        {selectedHotspot && (
          <div className="absolute bottom-20 left-4 right-4 bg-[#0d1322]/95 border border-blue-500/30 rounded shadow-2xl p-4 z-20 flex justify-between items-center gap-6 animate-slide-up select-none backdrop-blur">
            <div className="flex-1 space-y-1">
              <span className="text-[10px] bg-red-500/10 text-red-400 border border-red-500/20 px-1.5 py-0.5 rounded font-mono font-bold uppercase tracking-wider">
                AI Hotspot Zone Intelligence Match
              </span>
              <span className="text-[10px] bg-blue-500/10 text-blue-400 border border-blue-500/20 px-1.5 py-0.5 rounded font-mono font-bold uppercase tracking-wider ml-2">
                kernel_density · {predictedData?.model_version || "phase4-kde-hotspot-v1"}
              </span>
              <h4 className="text-xs font-bold text-slate-100 font-mono mt-1">
                Location Coordinates: {selectedHotspot.latitude.toFixed(4)} N, {selectedHotspot.longitude.toFixed(4)} E
              </h4>
              <div className="flex flex-wrap gap-2 text-[10px] text-slate-400">
                <span>Confidence Rank: <strong className="text-emerald-400 font-mono">{(selectedHotspot.confidence * 100).toFixed(0)}%</strong></span>
                <span>•</span>
                <span>Contributing Risk Factors: <strong className="text-blue-400 font-mono">{selectedHotspot.top_factors?.join(", ") || "Historical density peaks"}</strong></span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  if (leafletMap.current) {
                    leafletMap.current.setView([selectedHotspot.latitude, selectedHotspot.longitude], 13);
                  }
                }}
                className="bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-bold font-mono px-3 py-1.5 rounded transition-colors"
              >
                Recenter GIS View
              </button>
              <button
                onClick={() => setSelectedHotspot(null)}
                className="text-slate-500 hover:text-slate-300 text-xs font-bold font-mono px-2 py-1"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        {/* Clean Bottom Status Bar */}
        <div className="bg-[#0f1422] border-t border-[#1e293b] px-4 py-2.5 flex items-center justify-between z-20">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse inline-block" />
            <span className="text-xs font-mono font-bold text-slate-300">Live Spatial Hotspot Analytics</span>
          </div>
          <div className="text-[11px] font-mono text-slate-400">
            Real Spatial Kernel Density Incident Mapping (Karnataka State Registry)
          </div>
        </div>
      </div>

      <style>{`
        @keyframes slideUp {
          from { transform: translateY(20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        .animate-slide-up {
          animation: slideUp 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}</style>
    </div>
  );
}
