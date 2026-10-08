import { useState } from "react";
import { KeyRound, X } from "lucide-react";

interface Props {
  title: string;
  /** When true the dialog asks for the current password too (changing your own password). */
  askCurrent: boolean;
  onSubmit: (currentPassword: string, newPassword: string) => Promise<void>;
  onClose: () => void;
}

const RULES = "At least 8 characters with an uppercase letter, a lowercase letter, a digit and a special character.";

export default function PasswordDialog({ title, askCurrent, onSubmit, onClose }: Props) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (next !== confirm) {
      setError("The two new passwords do not match.");
      return;
    }
    setBusy(true);
    try {
      await onSubmit(current, next);
      setDone(true);
    } catch (err: any) {
      setError(err?.response?.data?.detail || "The password could not be changed.");
    } finally {
      setBusy(false);
    }
  };

  const field = "w-full bg-[#151c2e] border border-[#334155] rounded-lg px-3 py-2 text-slate-100 text-xs font-mono focus:outline-none focus:border-blue-500";

  return (
    <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <form onSubmit={submit} className="bg-[#111827] border border-[#1e293b] rounded-xl w-[420px] p-6 space-y-4 shadow-2xl select-none">
        <div className="flex justify-between items-center border-b border-[#1e293b] pb-3">
          <div className="flex items-center gap-2">
            <KeyRound size={18} className="text-blue-400" />
            <h3 className="text-sm font-bold text-slate-100 font-mono uppercase">{title}</h3>
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-200">
            <X size={18} />
          </button>
        </div>
        {done ? (
          <>
            <p className="text-xs text-emerald-400 font-mono">Password changed.</p>
            <div className="flex justify-end">
              <button type="button" onClick={onClose} className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold px-4 py-2 rounded-lg font-mono">
                Close
              </button>
            </div>
          </>
        ) : (
          <>
            {error && <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded-lg font-mono">{error}</div>}
            {askCurrent && (
              <input type="password" required autoComplete="current-password" placeholder="Current password" className={field} value={current} onChange={(e) => setCurrent(e.target.value)} />
            )}
            <input type="password" required autoComplete="new-password" placeholder="New password" className={field} value={next} onChange={(e) => setNext(e.target.value)} />
            <input type="password" required autoComplete="new-password" placeholder="Repeat the new password" className={field} value={confirm} onChange={(e) => setConfirm(e.target.value)} />
            <p className="text-[10px] text-slate-500">{RULES}</p>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={onClose} className="bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold px-4 py-2 rounded-lg font-mono">
                Cancel
              </button>
              <button type="submit" disabled={busy} className="bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white text-xs font-bold px-4 py-2 rounded-lg font-mono">
                {busy ? "Saving…" : "Save password"}
              </button>
            </div>
          </>
        )}
      </form>
    </div>
  );
}
