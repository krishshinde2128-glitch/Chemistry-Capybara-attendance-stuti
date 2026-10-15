import React, { useState, useEffect, useRef } from 'react';
import { ShieldCheck, Lock, KeyRound, Eye, EyeOff, AlertCircle, ArrowRight, X } from 'lucide-react';
import confetti from 'canvas-confetti';

interface AdminUnlockModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const MASTER_ADMIN_PASSCODE = '2821';

export const AdminUnlockModal: React.FC<AdminUnlockModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [passcode, setPasscode] = useState('');
  const [showPasscode, setShowPasscode] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isShaking, setIsShaking] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setPasscode('');
      setError(null);
      setIsShaking(false);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleVerify = (codeToTest = passcode) => {
    const trimmed = codeToTest.trim();
    if (!trimmed) {
      setError('Please enter the admin passcode');
      return;
    }

    if (trimmed === MASTER_ADMIN_PASSCODE) {
      setError(null);
      confetti({
        particleCount: 50,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#e11d48', '#fb7185', '#10b981', '#34d399'],
      });
      onSuccess();
    } else {
      setError('Incorrect admin passcode. Access denied.');
      setIsShaking(true);
      setTimeout(() => setIsShaking(false), 600);
    }
  };

  const handleKeypadPress = (digit: string) => {
    if (passcode.length < 8) {
      const nextCode = passcode + digit;
      setPasscode(nextCode);
      setError(null);
      if (nextCode === MASTER_ADMIN_PASSCODE) {
        handleVerify(nextCode);
      }
    }
  };

  const handleBackspace = () => {
    setPasscode((prev) => prev.slice(0, -1));
    setError(null);
  };

  const handleClear = () => {
    setPasscode('');
    setError(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-dark-950/85 backdrop-blur-md animate-fadeIn">
      <div
        className={`glass-panel w-full max-w-md rounded-3xl p-6 sm:p-8 border border-cherry-700/60 shadow-2xl relative transition-all ${
          isShaking ? 'animate-[wiggle_0.2s_ease-in-out_infinite]' : ''
        }`}
        style={
          isShaking
            ? {
                animation: 'shake 0.5s cubic-bezier(0.36, 0.07, 0.19, 0.97) both',
                borderColor: '#e11d48',
                boxShadow: '0 0 30px rgba(225, 29, 72, 0.4)',
              }
            : {}
        }
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          id="btn-close-admin-unlock"
          className="absolute top-5 right-5 p-2 rounded-xl text-rose-300/60 hover:text-white hover:bg-cherry-950/60 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex flex-col items-center text-center mb-6">
          <div className="relative mb-3">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-cherry-700 via-cherry-600 to-rose-400 p-[1px] shadow-cherry-glow flex items-center justify-center">
              <div className="w-full h-full bg-dark-900 rounded-2xl flex items-center justify-center">
                <ShieldCheck className="w-8 h-8 text-cherry-400 animate-pulse-subtle" />
              </div>
            </div>
            <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-dark-950 border border-cherry-500 flex items-center justify-center">
              <Lock className="w-3.5 h-3.5 text-cherry-300" />
            </div>
          </div>

          <h3 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
            <span>Admin Authentication</span>
            <span className="text-sm">🦫</span>
          </h3>
          <p className="text-xs text-rose-300/70 mt-1 max-w-xs">
            Enter master passcode to unlock global management and add classes to all users.
          </p>
        </div>

        {/* Passcode Input Field */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleVerify();
          }}
          className="space-y-4"
        >
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
              <KeyRound className="w-4 h-4 text-cherry-400" />
            </div>

            <input
              ref={inputRef}
              type={showPasscode ? 'text' : 'password'}
              id="admin-passcode-input"
              value={passcode}
              onChange={(e) => {
                setPasscode(e.target.value);
                setError(null);
              }}
              placeholder="Enter passcode..."
              autoComplete="off"
              className="w-full pl-10 pr-12 py-3 rounded-2xl bg-dark-950/90 border border-cherry-800/60 focus:border-cherry-500 focus:ring-2 focus:ring-cherry-500/20 text-center tracking-widest text-lg font-bold text-white placeholder:text-rose-300/30 placeholder:tracking-normal transition-all"
            />

            <button
              type="button"
              onClick={() => setShowPasscode(!showPasscode)}
              className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-rose-300/50 hover:text-white transition-colors"
            >
              {showPasscode ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>

          {error && (
            <div className="flex items-center justify-center gap-2 text-xs font-semibold text-rose-400 animate-fadeIn">
              <AlertCircle className="w-3.5 h-3.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Quick Numpad for Touch / Fast Entry */}
          <div className="grid grid-cols-3 gap-2 pt-2">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
              <button
                key={digit}
                type="button"
                onClick={() => handleKeypadPress(digit)}
                className="py-2.5 rounded-xl bg-dark-900/80 hover:bg-cherry-950/70 border border-cherry-900/40 text-base font-bold text-rose-100 hover:text-white transition-all active:scale-95 shadow-sm"
              >
                {digit}
              </button>
            ))}
            <button
              type="button"
              onClick={handleClear}
              className="py-2.5 rounded-xl bg-dark-900/40 hover:bg-cherry-950/40 border border-cherry-950 text-xs font-bold text-rose-300/60 hover:text-rose-200 transition-all active:scale-95"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={() => handleKeypadPress('0')}
              className="py-2.5 rounded-xl bg-dark-900/80 hover:bg-cherry-950/70 border border-cherry-900/40 text-base font-bold text-rose-100 hover:text-white transition-all active:scale-95 shadow-sm"
            >
              0
            </button>
            <button
              type="button"
              onClick={handleBackspace}
              className="py-2.5 rounded-xl bg-dark-900/40 hover:bg-cherry-950/40 border border-cherry-950 text-xs font-bold text-rose-300/60 hover:text-rose-200 transition-all active:scale-95"
            >
              ⌫
            </button>
          </div>

          {/* Unlock Submit Button */}
          <button
            type="submit"
            id="btn-admin-unlock-submit"
            className="w-full mt-2 py-3 rounded-2xl bg-gradient-to-r from-cherry-600 via-cherry-500 to-rose-600 hover:from-cherry-500 hover:to-rose-500 text-white font-bold text-sm shadow-cherry-glow hover:shadow-cherry-glow-lg transition-all flex items-center justify-center gap-2 active:scale-95 border border-cherry-400/30"
          >
            <span>Unlock Admin Panel</span>
            <ArrowRight className="w-4 h-4 stroke-[2.5]" />
          </button>
        </form>

        <p className="text-[11px] text-center text-rose-300/40 mt-4">
          Default Master Code: <span className="font-mono text-rose-200/80 font-bold">2821</span>
        </p>
      </div>

      <style>{`
        @keyframes shake {
          10%, 90% { transform: translate3d(-1px, 0, 0); }
          20%, 80% { transform: translate3d(2px, 0, 0); }
          30%, 50%, 70% { transform: translate3d(-4px, 0, 0); }
          40%, 60% { transform: translate3d(4px, 0, 0); }
        }
      `}</style>
    </div>
  );
};
