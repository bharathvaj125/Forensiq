import { Outlet } from "react-router-dom";
import Sidebar from "../common/Sidebar";
import TopBar from "../common/TopBar";
import ContextBar from "../common/ContextBar";
import AssistantPanel from "../../modules/assistant";

export default function AppShell() {
  return (
    <div className="flex h-screen w-screen bg-[#0b0f19] overflow-hidden text-slate-100 font-sans">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <TopBar />
        <ContextBar />
        <main className="flex-1 overflow-auto p-6 relative">
          <Outlet />
        </main>
      </div>
      <AssistantPanel />
    </div>
  );
}
