import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Clock, Shield, CheckCircle2, Loader2, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ReviewOverlay() {
  const { onboardedAt, refreshOnboarding, signOut } = useAuth();
  const navigate = useNavigate();
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [progress, setProgress] = useState<number>(0);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    if (!onboardedAt) return;

    const onboardTime = new Date(onboardedAt).getTime();
    const targetTime = onboardTime + 24 * 60 * 60 * 1000;

    const updateTimer = () => {
      const now = Date.now();
      const remaining = targetTime - now;

      if (remaining <= 0) {
        setTimeLeft(0);
        setProgress(100);
        void refreshOnboarding();
      } else {
        setTimeLeft(remaining);
        const elapsed = now - onboardTime;
        const total = 24 * 60 * 60 * 1000;
        const pct = Math.min(100, Math.max(0, (elapsed / total) * 100));
        setProgress(pct);
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [onboardedAt, refreshOnboarding]);

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await signOut();
      navigate("/");
    } catch (err) {
      console.error("Failed to sign out", err);
    } finally {
      setLoggingOut(false);
    }
  };

  if (!onboardedAt) return null;

  const formatTime = (ms: number) => {
    const totalSecs = Math.floor(ms / 1000);
    const hours = Math.floor(totalSecs / 3600);
    const minutes = Math.floor((totalSecs % 3600) / 60);
    const seconds = totalSecs % 60;

    return {
      hours: String(hours).padStart(2, "0"),
      minutes: String(minutes).padStart(2, "0"),
      seconds: String(seconds).padStart(2, "0"),
    };
  };

  const { hours, minutes, seconds } = formatTime(timeLeft);

  return (
    <div className="absolute inset-0 z-50 flex flex-col items-center justify-start bg-slate-950/70 backdrop-blur-md p-4 py-8 sm:py-12 overflow-y-auto select-none">
      {/* Background radial glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-indigo-500/10 rounded-full blur-[100px] pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="relative w-full max-w-md bg-[#0F1422]/90 border border-slate-800/80 rounded-3xl p-6 sm:p-8 shadow-2xl flex flex-col gap-6 my-auto"
      >
        {/* Header Section */}
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-400">
            <Shield className="h-7 w-7" />
          </div>
          <div className="space-y-1">
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
              System Activation Pending
            </h2>
            <p className="text-slate-400 text-xs sm:text-sm leading-relaxed max-w-sm mx-auto">
              Your onboarding profile has been submitted. Our team is warming up your dedicated outbound sender infrastructure.
            </p>
          </div>
        </div>

        {/* Time Remaining Widget */}
        <div className="bg-[#0B0E17] border border-slate-800 rounded-2xl p-5 space-y-4">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest text-center">
            Estimated Release
          </p>
          
          <div className="flex items-center justify-center gap-4 font-mono text-3xl font-extrabold text-white tracking-tight">
            <div className="flex flex-col items-center min-w-[48px]">
              <span>{hours}</span>
              <span className="text-[9px] font-sans font-medium text-slate-500 uppercase tracking-wider mt-1">hours</span>
            </div>
            <span className="text-slate-700 font-sans mb-5">:</span>
            <div className="flex flex-col items-center min-w-[48px]">
              <span>{minutes}</span>
              <span className="text-[9px] font-sans font-medium text-slate-500 uppercase tracking-wider mt-1">mins</span>
            </div>
            <span className="text-slate-700 font-sans mb-5">:</span>
            <div className="flex flex-col items-center min-w-[48px]">
              <span>{seconds}</span>
              <span className="text-[9px] font-sans font-medium text-slate-500 uppercase tracking-wider mt-1">secs</span>
            </div>
          </div>

          {/* Progress Slider */}
          <div className="space-y-1.5 pt-1">
            <div className="h-1.5 w-full bg-slate-800/60 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-indigo-500"
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.5 }}
              />
            </div>
            <div className="flex justify-between text-[9px] text-slate-500 font-semibold tracking-wide">
              <span>Onboarding submitted</span>
              <span>{Math.round(progress)}% Complete</span>
            </div>
          </div>
        </div>

        {/* Steps Cards List */}
        <div className="flex flex-col gap-2">
          {/* Step 1 */}
          <div className="flex items-center gap-3 p-3 bg-emerald-500/5 border border-emerald-500/20 rounded-xl">
            <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-slate-200">Onboarding Completed</p>
              <p className="text-[10px] text-slate-400 truncate">Your target configuration and campaign details are verified.</p>
            </div>
          </div>
          
          {/* Step 2 */}
          <div className="flex items-center gap-3 p-3 bg-indigo-500/5 border border-indigo-500/20 rounded-xl">
            <Loader2 className="h-4 w-4 text-indigo-400 shrink-0 animate-spin" />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-indigo-300">Provisioning Outbound Pipeline</p>
              <p className="text-[10px] text-slate-400 truncate">Setting up custom mailboxes and warm-up sending groups.</p>
            </div>
          </div>

          {/* Step 3 */}
          <div className="flex items-center gap-3 p-3 border border-slate-800/40 rounded-xl opacity-40">
            <Clock className="h-4 w-4 text-slate-500 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-slate-400">Compliance Release Check</p>
              <p className="text-[10px] text-slate-500 truncate">Final delivery release and full dashboard activation.</p>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex flex-col items-center gap-4 pt-2 border-t border-slate-850">
          <p className="text-[10px] text-slate-500 text-center leading-normal max-w-[280px]">
            Dashboard tabs are currently locked. System will release automatically when verification concludes.
          </p>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => void handleLogout()}
            disabled={loggingOut}
            className="text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 gap-2 h-9 px-4 text-xs font-semibold"
          >
            {loggingOut ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <LogOut className="h-3.5 w-3.5" />
            )}
            Sign out to switch accounts
          </Button>
        </div>
      </motion.div>
    </div>
  );
}
