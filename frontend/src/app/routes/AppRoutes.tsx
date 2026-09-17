import { Routes, Route, Navigate } from "react-router-dom";
import ProtectedRoute from "./ProtectedRoute";
import AppShell from "../../components/layout/AppShell";

// Modules
import Login from "../../modules/auth";
import Dashboard from "../../modules/dashboard";
import Investigation from "../../modules/investigation";
import Hotspot from "../../modules/hotspot";
import Network from "../../modules/network";
import Predictive from "../../modules/predictive";
import Reports from "../../modules/reports";
import Collaboration from "../../modules/collaboration";
import Admin from "../../modules/admin";
import TaskDelegationModule from "../../modules/delegation";
import CourtCaseMonitoring from "../../modules/court";

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      <Route
        path="/"
        element={
          <ProtectedRoute>
            <AppShell />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard activeTab="executive" />} />
        <Route path="workspace" element={<Dashboard activeTab="workspace" />} />
        
        {/* Cases list and details */}
        <Route path="cases" element={<Investigation />} />
        <Route path="cases/:id" element={<Investigation />} />
        
        {/* GIS Map & Hotspots */}
        <Route path="map" element={<Hotspot activeTab="gis" />} />
        <Route path="hotspots" element={<Hotspot activeTab="dashboard" />} />
        
        {/* Network graph */}
        <Route path="network" element={<Network />} />
        
        {/* Analytics & Predictive */}
        <Route path="predictive" element={<Predictive />} />

        {/* Court Case Monitoring */}
        <Route path="court" element={<CourtCaseMonitoring />} />
        
        {/* Collaboration Requests */}
        <Route path="collaboration" element={<Collaboration />} />
        
        {/* Task Delegation */}
        <Route path="delegation" element={<TaskDelegationModule />} />
        
        {/* Reports */}
        <Route path="reports" element={<Reports />} />
        
        {/* Unified Admin Console */}
        <Route path="admin" element={<Admin activeTab="appointments" />} />
        <Route path="appointments" element={<Navigate to="/admin" replace />} />
        
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Route>
    </Routes>
  );
}

