import { useEffect, useRef, useState } from "react";
import cytoscape from "cytoscape";
import {
  Shield,
  AlertTriangle,
  FileText,
  User,
  Car,
  Building2,
  Phone,
  CreditCard,
  Crosshair,
  MapPin,
  Search,
  Download,
  Share2,
  Sparkles,
} from "lucide-react";

interface NetworkGraphCanvasProps {
  graphData: {
    nodes: any[];
    edges: any[];
    total_nodes: number;
    total_edges: number;
    gang_count: number;
  };
  isLoading: boolean;
  refetch?: () => void;
  onRefresh?: () => void;
}

export default function NetworkGraphCanvas({ graphData, isLoading }: NetworkGraphCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<any>(null);
  const [selectedNode, setSelectedNode] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [shortestPathMode, setShortestPathMode] = useState(false);
  const [sourceNodeId, setSourceNodeId] = useState<string | null>(null);
  const [targetNodeId, setTargetNodeId] = useState<string | null>(null);
  const [pathResult, setPathResult] = useState<string[]>([]);

  useEffect(() => {
    if (!containerRef.current) return;

    const rawNodes = graphData?.nodes || [];
    const rawEdges = graphData?.edges || [];

    // Map Cytoscape elements
    const cyNodes = rawNodes.map((n: any) => {
      // Dynamic centrality sizing calculation (28px to 64px)
      const centrality = n.centrality || 1;
      const size = Math.min(64, Math.max(28, 28 + (centrality - 1) * 6));

      return {
        data: {
          id: n.id,
          label: n.label,
          node_type: n.node_type,
          sub_type: n.sub_type || "Standard",
          centrality: centrality,
          case_count: n.case_count || 1,
          risk_score: n.risk_score || 0.5,
          details: n.details,
          ai_summary: n.ai_summary,
          age: n.age,
          occupation: n.occupation,
          address: n.address,
          registration_no: n.registration_no,
          nodeSize: size,
        },
      };
    });

    const cyEdges = rawEdges.map((e: any) => ({
      data: {
        id: e.id,
        source: e.source,
        target: e.target,
        relationship: e.relationship,
        confidence: e.confidence || 1.0,
        evidence_source: e.evidence_source || "KSP Registry",
      },
    }));

    const cy = cytoscape({
      container: containerRef.current,
      elements: [...cyNodes, ...cyEdges],
      wheelSensitivity: 0.15,
      minZoom: 0.1,
      maxZoom: 3.5,
      pixelRatio: "auto",
      hideLabelsOnViewport: true,
      style: [
        // Base Node Style
        {
          selector: "node",
          style: {
            "background-color": "#3b82f6",
            label: "data(label)",
            color: "#f8fafc",
            "font-size": "10px",
            "font-family": "monospace",
            "font-weight": "bold",
            "text-valign": "bottom",
            "text-halign": "center",
            "text-margin-y": 6,
            width: "data(nodeSize)",
            height: "data(nodeSize)",
            "border-width": "2px",
            "border-color": "#60a5fa",
            "overlay-color": "#3b82f6",
            "overlay-padding": 4,
            "overlay-opacity": 0.15,
          },
        },
        // Person (Suspect / Accused)
        {
          selector: 'node[node_type="Person"]',
          style: {
            "background-color": "#2563eb",
            "border-color": "#93c5fd",
            shape: "ellipse",
          },
        },
        // Repeat Offender / High Risk Suspect
        {
          selector: 'node[sub_type="Repeat Offender"]',
          style: {
            "background-color": "#ef4444",
            "border-color": "#fca5a5",
            "border-width": "3px",
            "overlay-color": "#ef4444",
            "overlay-padding": 6,
            "overlay-opacity": 0.35,
          },
        },
        // Syndicate Leader
        {
          selector: 'node[sub_type="Syndicate Leader"]',
          style: {
            "background-color": "#dc2626",
            "border-color": "#fef08a",
            "border-width": "4px",
            "overlay-color": "#dc2626",
            "overlay-padding": 8,
            "overlay-opacity": 0.5,
          },
        },
        // Organization / Gang Syndicate Hub
        {
          selector: 'node[node_type="Organization"]',
          style: {
            "background-color": "#f59e0b",
            "border-color": "#fde047",
            "border-width": "4px",
            shape: "hexagon",
            "overlay-color": "#f59e0b",
            "overlay-padding": 8,
            "overlay-opacity": 0.4,
          },
        },
        // FIR Case Node
        {
          selector: 'node[node_type="FIR"]',
          style: {
            "background-color": "#6366f1",
            "border-color": "#a5b4fc",
            shape: "octagon",
          },
        },
        // Police Station Precinct Command
        {
          selector: 'node[node_type="PoliceStation"]',
          style: {
            "background-color": "#06b6d4",
            "border-color": "#67e8f9",
            shape: "barrel",
          },
        },
        // Vehicle
        {
          selector: 'node[node_type="Vehicle"]',
          style: {
            "background-color": "#d97706",
            "border-color": "#fcd34d",
            shape: "round-tag",
          },
        },
        // Weapon
        {
          selector: 'node[node_type="Weapon"]',
          style: {
            "background-color": "#991b1b",
            "border-color": "#f87171",
            shape: "diamond",
          },
        },
        // Bank Account
        {
          selector: 'node[node_type="BankAccount"]',
          style: {
            "background-color": "#059669",
            "border-color": "#6ee7b7",
            shape: "rectangle",
          },
        },
        // Phone Number
        {
          selector: 'node[node_type="PhoneNumber"]',
          style: {
            "background-color": "#0d9488",
            "border-color": "#5eead4",
            shape: "round-rectangle",
          },
        },
        // Physical Evidence
        {
          selector: 'node[node_type="Evidence"]',
          style: {
            "background-color": "#8b5cf6",
            "border-color": "#c4b5fd",
            shape: "rectangle",
          },
        },
        // Victim Node
        {
          selector: 'node[node_type="Victim"]',
          style: {
            "background-color": "#10b981",
            "border-color": "#a7f3d0",
            shape: "ellipse",
          },
        },
        // Address Node
        {
          selector: 'node[node_type="Address"]',
          style: {
            "background-color": "#ea580c",
            "border-color": "#ffedd5",
            shape: "tag",
          },
        },
        // Base Edge Style
        {
          selector: "edge",
          style: {
            width: 2.5,
            "line-color": "#475569",
            "target-arrow-color": "#38bdf8",
            "target-arrow-shape": "triangle",
            "curve-style": "bezier",
            label: "data(relationship)",
            "font-size": "8px",
            "font-family": "monospace",
            color: "#cbd5e1",
            "text-rotation": "autorotate",
            "text-background-color": "#0d1322",
            "text-background-opacity": 0.85,
            "text-background-padding": "2px",
          },
        },
        // Selected Node Highlight
        {
          selector: "node:selected",
          style: {
            "border-color": "#ffffff",
            "border-width": "4px",
            "overlay-color": "#ffffff",
            "overlay-opacity": 0.4,
          },
        },
        // Dimmed nodes when isolated
        {
          selector: ".dimmed",
          style: {
            opacity: 0.15,
          },
        },
        // Shortest Path Highlight Style
        {
          selector: ".path-highlight",
          style: {
            "line-color": "#facc15",
            "target-arrow-color": "#facc15",
            width: 5,
            "border-color": "#facc15",
            "overlay-color": "#facc15",
            "overlay-opacity": 0.5,
          },
        },
      ],
      layout: {
        name: "cose",
        animate: false,
        padding: 50,
        nodeRepulsion: () => 3000000,
        idealEdgeLength: () => 140,
        edgeElasticity: () => 100,
        nestingFactor: 1.2,
        gravity: 0.25,
        numIter: 500,
      },
    });

    cy.ready(() => {
      cy.fit(undefined, 60);
      cy.center();
    });

    // Node Select Listener
    cy.on("select", "node", (evt) => {
      const node = evt.target;
      const data = node.data();
      setSelectedNode(data);

      if (shortestPathMode) {
        if (!sourceNodeId) {
          setSourceNodeId(data.id);
        } else if (!targetNodeId && data.id !== sourceNodeId) {
          setTargetNodeId(data.id);
          // Calculate Shortest Path using Cytoscape Dijkstra
          const dijkstra = cy.elements().dijkstra({ root: `#${sourceNodeId}` });
          const path = dijkstra.pathTo(node);
          cy.elements().removeClass("path-highlight");
          path.addClass("path-highlight");
          setPathResult(path.map((el: any) => el.data("label") || el.data("relationship")));
        }
      } else {
        cy.elements().addClass("dimmed");
        node.removeClass("dimmed");
        node.neighborhood().removeClass("dimmed");
      }
    });

    cy.on("unselect", "node", () => {
      setSelectedNode(null);
      cy.elements().removeClass("dimmed");
    });

    cyRef.current = cy;

    return () => {
      if (cyRef.current) {
        cyRef.current.destroy();
        cyRef.current = null;
      }
    };
  }, [graphData]);

  // Search Node and Auto-Zoom Fit
  const handleSearchNode = () => {
    if (!cyRef.current || !searchQuery.trim()) return;
    const term = searchQuery.trim().toLowerCase();

    const matchedNode = cyRef.current.nodes().filter((n: any) => {
      const label = (n.data("label") || "").toLowerCase();
      const details = (n.data("details") || "").toLowerCase();
      const id = (n.data("id") || "").toLowerCase();
      return label.includes(term) || details.includes(term) || id.includes(term);
    });

    if (matchedNode.length > 0) {
      cyRef.current.elements().addClass("dimmed");
      matchedNode.removeClass("dimmed");
      matchedNode.neighborhood().removeClass("dimmed");
      cyRef.current.animate({
        center: { eles: matchedNode },
        zoom: 1.8,
        duration: 500,
      });
      setSelectedNode(matchedNode[0].data());
    }
  };

  // Export High-Res PNG
  const exportPNG = () => {
    if (!cyRef.current) return;
    const png64 = cyRef.current.png({ full: true, scale: 2 });
    const link = document.createElement("a");
    link.download = `KSP_Criminal_Network_${new Date().toISOString().slice(0, 10)}.png`;
    link.href = png64;
    link.click();
  };

  const handlePan = (dx: number, dy: number) => {
    if (cyRef.current) {
      cyRef.current.panBy({ x: dx, y: dy });
    }
  };

  const handleZoomIn = () => {
    if (cyRef.current) {
      cyRef.current.zoom({
        level: cyRef.current.zoom() * 1.35,
        renderedPosition: { x: cyRef.current.width() / 2, y: cyRef.current.height() / 2 },
      });
    }
  };

  const handleZoomOut = () => {
    if (cyRef.current) {
      cyRef.current.zoom({
        level: cyRef.current.zoom() / 1.35,
        renderedPosition: { x: cyRef.current.width() / 2, y: cyRef.current.height() / 2 },
      });
    }
  };

  // Export JSON Topology
  const exportJSON = () => {
    if (!cyRef.current) return;
    const jsonStr = JSON.stringify(cyRef.current.json(), null, 2);
    const blob = new Blob([jsonStr], { type: "application/json" });
    const link = document.createElement("a");
    link.download = `KSP_Graph_Topology_${new Date().toISOString().slice(0, 10)}.json`;
    link.href = URL.createObjectURL(blob);
    link.click();
  };

  const getNodeIcon = (type: string) => {
    switch (type) {
      case "Person":
        return <User className="text-blue-400" size={16} />;
      case "Organization":
        return <UsersIcon className="text-amber-400" size={16} />;
      case "FIR":
        return <FileText className="text-indigo-400" size={16} />;
      case "PoliceStation":
        return <Building2 className="text-cyan-400" size={16} />;
      case "Vehicle":
        return <Car className="text-amber-500" size={16} />;
      case "Weapon":
        return <Crosshair className="text-red-500" size={16} />;
      case "BankAccount":
        return <CreditCard className="text-emerald-400" size={16} />;
      case "PhoneNumber":
        return <Phone className="text-teal-400" size={16} />;
      case "Address":
        return <MapPin className="text-orange-400" size={16} />;
      default:
        return <Shield className="text-purple-400" size={16} />;
    }
  };

  return (
    <div className="flex flex-col h-full w-full bg-[#0b0f19] select-none overflow-hidden rounded border border-[#1e293b]">
      {/* 1. SOLID TOP CONTROL BAR (OUTSIDE GRAPH CANVAS) */}
      <div className="w-full bg-[#0d1322] border-b border-[#1e293b] p-2.5 flex flex-wrap items-center justify-between gap-3 flex-shrink-0 z-10">
        {/* Left Controls: Node Search & Traversal */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <input
              type="text"
              placeholder="Search suspect, FIR #, vehicle plate, address..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearchNode()}
              className="w-64 bg-[#151c2e] border border-[#1e293b] text-slate-200 text-xs px-3 py-1.5 rounded pl-8 focus:outline-none focus:border-blue-500 font-mono"
            />
            <Search className="absolute left-2.5 top-2 text-slate-400" size={13} />
          </div>

          <button
            onClick={handleSearchNode}
            className="bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded text-xs font-mono font-bold transition-colors"
          >
            Locate Node
          </button>

          <div className="h-4 w-px bg-[#1e293b] mx-1" />

          <button
            onClick={() => setShortestPathMode(!shortestPathMode)}
            className={`px-3 py-1.5 rounded text-xs font-mono font-bold border transition-colors flex items-center gap-1.5 ${
              shortestPathMode
                ? "bg-amber-500/20 text-amber-400 border-amber-500/40"
                : "bg-[#151c2e] text-slate-300 border-[#1e293b] hover:bg-slate-800"
            }`}
            title="Trace shortest connection path between two nodes"
          >
            <Crosshair size={13} />
            <span>{shortestPathMode ? "Path Active" : "Path Analysis"}</span>
          </button>
        </div>

        {/* Right Controls: Pan, Zoom Buttons & Export */}
        <div className="flex items-center gap-2 font-mono">
          {/* Pan Navigation Controls */}
          <div className="flex items-center gap-1 bg-[#151c2e] border border-[#1e293b] p-0.5 rounded text-[11px]">
            <span className="text-[9px] text-slate-500 px-1 font-bold">PAN:</span>
            <button
              onClick={() => handlePan(0, 150)}
              className="w-6 h-6 bg-[#1e293b] hover:bg-blue-600 text-white rounded flex items-center justify-center font-bold"
              title="Pan Up"
            >
              ▲
            </button>
            <button
              onClick={() => handlePan(0, -150)}
              className="w-6 h-6 bg-[#1e293b] hover:bg-blue-600 text-white rounded flex items-center justify-center font-bold"
              title="Pan Down"
            >
              ▼
            </button>
            <button
              onClick={() => handlePan(150, 0)}
              className="w-6 h-6 bg-[#1e293b] hover:bg-blue-600 text-white rounded flex items-center justify-center font-bold"
              title="Pan Left"
            >
              ◀
            </button>
            <button
              onClick={() => handlePan(-150, 0)}
              className="w-6 h-6 bg-[#1e293b] hover:bg-blue-600 text-white rounded flex items-center justify-center font-bold"
              title="Pan Right"
            >
              ▶
            </button>
          </div>

          {/* Zoom & Fit Controls */}
          <div className="flex items-center gap-1 bg-[#151c2e] border border-[#1e293b] p-0.5 rounded">
            <button
              onClick={handleZoomIn}
              className="w-7 h-7 bg-[#1e293b] hover:bg-blue-600 text-white rounded flex items-center justify-center font-bold text-sm transition-colors"
              title="Zoom In (+)"
            >
              +
            </button>
            <button
              onClick={handleZoomOut}
              className="w-7 h-7 bg-[#1e293b] hover:bg-blue-600 text-white rounded flex items-center justify-center font-bold text-sm transition-colors"
              title="Zoom Out (-)"
            >
              -
            </button>
            <button
              onClick={() => {
                if (cyRef.current) {
                  cyRef.current.fit(undefined, 60);
                  cyRef.current.center();
                }
              }}
              className="px-2.5 py-1 text-xs text-slate-300 hover:text-white hover:bg-slate-700 rounded transition-colors font-bold"
              title="Fit View & Center Graph"
            >
              🎯 Center
            </button>
            <button
              onClick={() => {
                if (cyRef.current) {
                  cyRef.current
                    .layout({
                      name: "cose",
                      animate: true,
                      animationDuration: 300,
                      nodeRepulsion: () => 2000000,
                      idealEdgeLength: () => 140,
                      numIter: 50,
                    })
                    .run();
                }
              }}
              className="px-2.5 py-1 text-xs text-slate-300 hover:text-white hover:bg-slate-700 rounded transition-colors font-bold"
              title="Auto-Spread Force Layout"
            >
              🕸️ Auto Layout
            </button>
          </div>

          <div className="h-4 w-px bg-[#1e293b] mx-1" />

          <button
            onClick={exportJSON}
            className="p-1.5 bg-[#151c2e] hover:bg-slate-800 text-slate-300 rounded border border-[#1e293b] transition-colors"
            title="Export Network Graph JSON"
          >
            <Download size={14} />
          </button>
          <button
            onClick={exportPNG}
            className="p-1.5 bg-[#151c2e] hover:bg-slate-800 text-slate-300 rounded border border-[#1e293b] transition-colors"
            title="Export Network Canvas Image"
          >
            <Share2 size={14} />
          </button>
        </div>
      </div>

      {/* 2. MAIN CENTER GRAPH VIEWPORT (100% UNOBSTRUCTED) */}
      <div className="flex-1 w-full min-h-0 relative flex bg-[#0b0f19]">
        {/* Main Cytoscape Canvas */}
        <div ref={containerRef} className="flex-1 h-full w-full" />

        {/* Loading Overlay */}
        {isLoading && (
          <div className="absolute inset-0 bg-[#0b0f19]/80 backdrop-blur-sm z-30 flex items-center justify-center flex-col gap-2 font-mono">
            <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-xs text-blue-400 font-bold">Extracting Criminal Intelligence Network Topology...</span>
          </div>
        )}

        {/* Shortest Path Bar Notification */}
        {shortestPathMode && (
          <div className="absolute top-3 left-3 z-20 bg-amber-500/10 border border-amber-500/30 p-2.5 rounded text-xs font-mono text-amber-300 max-w-lg flex flex-col gap-1 shadow-2xl backdrop-blur">
            <div className="flex items-center justify-between">
              <p className="font-bold">Shortest Link Traversal Analyzer</p>
              {(sourceNodeId || targetNodeId) && (
                <button
                  onClick={() => {
                    setSourceNodeId(null);
                    setTargetNodeId(null);
                    setPathResult([]);
                    if (cyRef.current) cyRef.current.elements().removeClass("path-highlight");
                  }}
                  className="text-[10px] bg-amber-500/20 hover:bg-amber-500/40 text-amber-200 px-2 py-0.5 rounded"
                >
                  Reset Path
                </button>
              )}
            </div>
            <p className="text-[10px] text-amber-200/70">
              {!sourceNodeId
                ? "Click 1st Node on Canvas (Source Entity)"
                : !targetNodeId
                ? "Click 2nd Node on Canvas (Target Entity)"
                : `Path Found (${pathResult.length} hops)`}
            </p>
            {pathResult.length > 0 && (
              <div className="text-[10px] text-amber-300 font-mono bg-[#0d1322] p-1.5 rounded border border-amber-500/30 overflow-x-auto whitespace-nowrap">
                {pathResult.join(" ➔ ")}
              </div>
            )}
          </div>
        )}

        {/* Side Intelligence Node Dossier */}
        {selectedNode && (
          <div className="w-88 bg-[#0d1322] border-l border-[#1e293b] p-5 flex flex-col gap-4 z-30 absolute right-0 top-0 h-full overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#1e293b] pb-3">
              <div className="flex items-center gap-2">
                {getNodeIcon(selectedNode.node_type)}
                <h3 className="text-xs font-bold text-slate-200 font-mono uppercase tracking-wider">
                  KSP Intelligence Dossier
                </h3>
              </div>
              <button
                onClick={() => {
                  setSelectedNode(null);
                  if (cyRef.current) cyRef.current.elements().removeClass("dimmed");
                }}
                className="bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 px-2.5 py-1 rounded text-xs font-mono font-bold transition-colors flex items-center gap-1"
                title="Close Dossier & Return to Full Graph"
              >
                <span>✕</span>
                <span>Back to Graph</span>
              </button>
            </div>

            <div className="space-y-3.5 text-xs">
              <div>
                <span className="text-[10px] text-slate-500 uppercase tracking-wide font-mono block">Entity Title</span>
                <span className="text-slate-100 font-bold block mt-0.5 text-sm font-mono">{selectedNode.label}</span>
                <span className="text-[10px] text-blue-400 font-mono italic">{selectedNode.sub_type}</span>
              </div>

              <div className="grid grid-cols-2 gap-2 bg-[#151c2e] p-2.5 rounded border border-[#1e293b] font-mono text-[11px]">
                <div>
                  <span className="text-slate-500 text-[9px] block">CENTRALITY INDEX</span>
                  <span className="text-slate-200 font-bold">{selectedNode.centrality} Degree Links</span>
                </div>
                <div>
                  <span className="text-slate-500 text-[9px] block">LINKED CASES</span>
                  <span className="text-emerald-400 font-bold">{selectedNode.case_count} FIR Records</span>
                </div>
                <div>
                  <span className="text-slate-500 text-[9px] block">AI RISK SEVERITY</span>
                  <span className="text-red-400 font-bold">{((selectedNode.risk_score || 0.5) * 100).toFixed(0)}% Score</span>
                </div>
                <div>
                  <span className="text-slate-500 text-[9px] block">DATA SOURCE</span>
                  <span className="text-slate-300 font-bold">KSP Database</span>
                </div>
              </div>

              {selectedNode.ai_summary && (
                <div className="bg-blue-500/5 border border-blue-500/20 p-3 rounded space-y-1">
                  <div className="flex items-center gap-1 text-blue-400 font-bold text-[10px] font-mono">
                    <Sparkles size={12} />
                    <span>AI Investigation Summary</span>
                  </div>
                  <p className="text-[11px] text-slate-300 leading-relaxed font-sans">{selectedNode.ai_summary}</p>
                </div>
              )}

              <div>
                <span className="text-[10px] text-slate-500 uppercase tracking-wide font-mono block mb-1">
                  Database Dossier Details
                </span>
                <p className="text-slate-300 leading-relaxed text-[11px] font-mono bg-[#151c2e] p-3 rounded border border-[#1e293b] whitespace-pre-wrap">
                  {selectedNode.details}
                </p>
              </div>

              {selectedNode.sub_type === "Repeat Offender" && (
                <div className="p-3 bg-red-500/10 border border-red-500/25 rounded flex items-start gap-2">
                  <AlertTriangle className="text-red-400 mt-0.5 flex-shrink-0" size={15} />
                  <div>
                    <span className="font-bold text-red-300 block text-xs">High-Risk Repeat Suspect Warning</span>
                    <p className="text-[10px] text-slate-300 mt-0.5 leading-normal">
                      This individual appears across multiple FIR case files. High co-offending centrality score.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 3. SOLID BOTTOM ENTITY KEY LEGEND BAR (OUTSIDE GRAPH CANVAS) */}
      <div className="w-full bg-[#0d1322] border-t border-[#1e293b] p-2 flex flex-wrap items-center justify-between gap-4 text-[10px] font-mono flex-shrink-0 z-10">
        <div className="flex items-center gap-4 flex-wrap">
          <span className="text-slate-400 text-[9px] uppercase tracking-wider font-bold">KSP Entity Key:</span>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500 border border-red-300"></span>
            <span className="text-slate-200">Repeat Suspect</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-500 border border-blue-300"></span>
            <span className="text-slate-300">Accused Person</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 bg-amber-500 transform rotate-45 border border-amber-300" style={{ width: 7, height: 7 }}></span>
            <span className="text-slate-300">Syndicate Ring</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 bg-indigo-500 border border-indigo-300"></span>
            <span className="text-slate-300">FIR Case</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 bg-cyan-500 border border-cyan-300"></span>
            <span className="text-slate-300">Police Station</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 bg-emerald-500 border border-emerald-300"></span>
            <span className="text-slate-300">Vehicle</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 bg-purple-500 border border-purple-300"></span>
            <span className="text-slate-300">Evidence</span>
          </div>
        </div>

        <span className="text-slate-500 text-[9px]">Use Mouse Wheel or Zoom Buttons to Nav Graph</span>
      </div>
    </div>
  );
}

function UsersIcon(props: any) {
  return (
    <svg {...props} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
  );
}
