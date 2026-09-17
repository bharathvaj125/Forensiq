import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../app/providers/AuthProvider";
import { Lock, User, AlertCircle, ShieldCheck, ArrowRight, Eye, EyeOff, KeyRound, Fingerprint } from "lucide-react";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) return;

    setError("");
    setLoading(true);

    try {
      await login(username, password);
      const u = username.toLowerCase();
      if (u.includes("cbi") || u.includes("fsl") || u.includes("ed")) {
        navigate("/collaboration");
      } else {
        navigate("/dashboard");
      }
    } catch (err: any) {
      console.error("Login error details:", err);
      const detail = err.response?.data?.detail;
      if (typeof detail === "string") {
        setError(detail);
      } else if (Array.isArray(detail)) {
        setError(detail.map((d: any) => d.msg).join(", "));
      } else if (err.response?.status === 401) {
        setError("Invalid User ID or Password. Please verify your officer credentials.");
      } else if (err.response?.status === 500) {
        setError("Backend server initializing or database error (Status 500). Please retry in a few seconds.");
      } else if (err.message) {
        setError(`Connection Error (${err.message}). Ensure backend API is active.`);
      } else {
        setError("Invalid User ID or Password. Please verify your officer credentials.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen w-screen items-center justify-center bg-[#050811] p-4 select-none font-sans overflow-hidden">
      {/* Dynamic Background Ambient Light Gradients */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-600/10 rounded-full blur-[140px] pointer-events-none"></div>
      <div className="absolute bottom-10 right-10 w-[400px] h-[400px] bg-indigo-600/10 rounded-full blur-[120px] pointer-events-none"></div>

      {/* Main High-End Login Glassmorphism Card */}
      <div className="w-full max-w-md bg-[#0a0f1d]/90 backdrop-blur-2xl border border-blue-500/20 rounded-2xl p-8 shadow-[0_0_60px_rgba(15,23,42,0.8)] relative space-y-6 z-10 font-sans">
        
        {/* Top Header Badge & Insignia */}
        <div className="flex flex-col items-center text-center space-y-3">
          <div className="relative">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-blue-700 via-blue-600 to-indigo-500 flex items-center justify-center font-extrabold text-white text-2xl tracking-widest shadow-xl shadow-blue-600/30 border border-blue-400/30">
              KSP
            </div>
            <div className="absolute -bottom-1 -right-1 bg-amber-500 text-black rounded-full p-1 border-2 border-[#0a0f1d]">
              <ShieldCheck size={12} />
            </div>
          </div>

          <div>
            <span className="text-[10px] text-blue-400 font-mono tracking-[0.2em] uppercase font-semibold">
              Government of Karnataka
            </span>
            <h1 className="text-base font-bold text-slate-100 tracking-tight uppercase font-mono mt-0.5">
              Police Crime Intelligence Platform
            </h1>
            <p className="text-[11px] text-slate-400 mt-1 font-mono">
              Unified Officer Command & Control Telemetry
            </p>
          </div>
        </div>

        {/* Error Notification Bar */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-400 p-3.5 rounded-xl text-xs flex items-start gap-2.5 leading-relaxed font-mono animate-in fade-in zoom-in-95 duration-150">
            <AlertCircle size={16} className="flex-shrink-0 mt-0.5 text-red-400" />
            <span>{error}</span>
          </div>
        )}

        {/* High-End Login Form */}
        <form onSubmit={handleSubmit} autoComplete="off" className="space-y-4">
          {/* User ID Field */}
          <div>
            <label className="block text-[10px] uppercase font-bold font-mono tracking-wider text-slate-300 mb-1.5 flex items-center gap-1.5">
              <User size={13} className="text-blue-400" />
              <span>Officer User ID</span>
            </label>
            <div className="relative">
              <input
                type="text"
                required
                name="ksp_officer_user_id"
                autoComplete="off"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter Official User ID"
                className="w-full bg-[#111827]/80 border border-[#1e293b] focus:border-blue-500 text-slate-100 text-xs rounded-xl pl-9 pr-4 py-3 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all font-mono placeholder:text-slate-600"
              />
              <User className="absolute left-3 top-3.5 text-slate-500" size={15} />
            </div>
          </div>

          {/* Password Field */}
          <div>
            <label className="block text-[10px] uppercase font-bold font-mono tracking-wider text-slate-300 mb-1.5 flex items-center gap-1.5">
              <KeyRound size={13} className="text-blue-400" />
              <span>Password</span>
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                required
                name="ksp_officer_security_password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter Secure Password"
                className="w-full bg-[#111827]/80 border border-[#1e293b] focus:border-blue-500 text-slate-100 text-xs rounded-xl pl-9 pr-10 py-3 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all font-mono placeholder:text-slate-600"
              />
              <Lock className="absolute left-3 top-3.5 text-slate-500" size={15} />
              
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-3.5 text-slate-500 hover:text-slate-300 transition-colors"
              >
                {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>

          {/* Secure Biometric / SSL Status Line */}
          <div className="flex items-center justify-between text-[10px] font-mono text-slate-500 pt-1">
            <span className="flex items-center gap-1">
              <Fingerprint size={12} className="text-emerald-400" />
              256-Bit Encrypted Portal
            </span>
            <span className="text-slate-500">Restricted Access</span>
          </div>

          {/* Submit Action Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-blue-600 via-blue-500 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-mono font-bold text-xs py-3.5 rounded-xl transition-all shadow-lg shadow-blue-600/30 flex items-center justify-center gap-2 border border-blue-400/20 disabled:opacity-50"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                Authenticating Officer...
              </span>
            ) : (
              <>
                <span>Authenticate & Access Platform</span>
                <ArrowRight size={15} />
              </>
            )}
          </button>
        </form>

        {/* Footer Security Notice */}
        <div className="border-t border-[#1e293b] pt-4 text-center">
          <p className="text-[10px] text-slate-500 font-mono leading-relaxed">
            Authorized for Karnataka State Police personnel and appointed Inter-Agency Officers. Unlawful access attempts are logged under IT Act & BNSS regulations.
          </p>
        </div>
      </div>
    </div>
  );
}
