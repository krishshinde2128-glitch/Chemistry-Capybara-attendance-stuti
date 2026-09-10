import React, { useState } from 'react';
import { X, Flame, Mail, Lock, User, AlertCircle, LogIn, UserPlus, ExternalLink } from 'lucide-react';
import { useAuth } from '../firebase/AuthContext';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenConfig: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, onOpenConfig }) => {
  const { loginWithGoogle, loginWithEmail, registerWithEmail, isConfigured } = useAuth();
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState<{ message: string; isProviderDisabled?: boolean } | null>(null);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const parseFirebaseError = (err: any) => {
    const code = err.code || err.message || '';
    if (code.includes('auth/operation-not-allowed')) {
      return {
        message: 'Google Sign-In is not enabled in your Firebase Console yet. Please turn it on in the Authentication > Sign-in method tab.',
        isProviderDisabled: true,
      };
    }
    if (code.includes('auth/unauthorized-domain')) {
      return {
        message: 'This domain (localhost) is not in your Firebase Authorized Domains list.',
      };
    }
    if (code.includes('auth/invalid-credential') || code.includes('auth/wrong-password') || code.includes('auth/user-not-found')) {
      return { message: 'Invalid email or password. Please try again.' };
    }
    if (code.includes('auth/email-already-in-use')) {
      return { message: 'An account with this email already exists. Try signing in instead.' };
    }
    if (code.includes('auth/weak-password')) {
      return { message: 'Password should be at least 6 characters.' };
    }
    return { message: err.message || 'Authentication failed. Please check credentials.' };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (isRegister) {
        if (!displayName.trim()) {
          throw new Error('Please enter your name');
        }
        await registerWithEmail(email.trim(), password, displayName.trim());
      } else {
        await loginWithEmail(email.trim(), password);
      }
      onClose();
    } catch (err: any) {
      setError(parseFirebaseError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError(null);
    setLoading(true);
    try {
      await loginWithGoogle();
      onClose();
    } catch (err: any) {
      setError(parseFirebaseError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md overflow-y-auto animate-fadeIn">
      <div className="relative w-full max-w-md glass-panel rounded-3xl p-6 sm:p-8 shadow-2xl border border-cherry-600/40 my-8">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-cherry-900/50 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-cherry-700 to-rose-500 p-[1px] flex items-center justify-center shadow-cherry-glow">
              <div className="w-full h-full bg-dark-900 rounded-2xl flex items-center justify-center">
                <Flame className="w-5 h-5 text-cherry-400 animate-pulse-subtle" />
              </div>
            </div>
            <div>
              <h2 className="text-xl font-bold text-white flex items-center gap-1.5">
                <span>{isRegister ? 'Join Chemistry Capybara' : 'Welcome to Chemistry Capybara'}</span>
                <span>🦫</span>
              </h2>
              <p className="text-xs text-rose-300/60">
                {isRegister ? 'Create an account to share & sync attendance' : 'Log in to view peer attendance & leaderboard'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-rose-300/60 hover:text-white hover:bg-cherry-900/40 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {!isConfigured ? (
          <div className="p-4 rounded-2xl bg-dark-900/90 border border-amber-500/30 text-amber-200 text-xs space-y-3">
            <p className="font-semibold flex items-center gap-1.5">
              <AlertCircle className="w-4 h-4 text-amber-400" /> Firebase is not configured yet
            </p>
            <p className="text-rose-200/70">
              To enable login, peer attendance sharing, and leaderboards, connect your Firebase project.
            </p>
            <button
              onClick={() => {
                onClose();
                onOpenConfig();
              }}
              className="w-full py-2.5 px-4 rounded-xl bg-cherry-950 hover:bg-cherry-900 text-cherry-300 font-bold border border-cherry-700/50 transition-colors"
            >
              Enter Firebase Config Keys
            </button>
          </div>
        ) : (
          <div>
            {/* Google One-Click Button */}
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={loading}
              className="w-full py-3 px-4 rounded-xl bg-white hover:bg-rose-50 text-slate-900 font-bold text-xs sm:text-sm flex items-center justify-center gap-3 transition-all shadow-md active:scale-95 disabled:opacity-50"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              <span>Continue with Google</span>
            </button>

            <div className="flex items-center gap-3 my-5">
              <div className="flex-1 h-[1px] bg-cherry-900/60" />
              <span className="text-[11px] font-semibold text-rose-300/50 uppercase">Or with email</span>
              <div className="flex-1 h-[1px] bg-cherry-900/60" />
            </div>

            {error && (
              <div className="mb-4 p-3.5 rounded-xl bg-cherry-950 border border-cherry-700 text-rose-200 text-xs space-y-2">
                <div className="flex items-start gap-2 text-cherry-300 font-semibold">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{error.message}</span>
                </div>
                {error.isProviderDisabled && (
                  <a
                    href="https://console.firebase.google.com/project/dietcoke-514f4/authentication/providers"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] text-cherry-400 hover:text-white underline font-bold"
                  >
                    Open Firebase Auth Sign-in Method Console <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-3.5">
              {isRegister && (
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-rose-200 mb-1">
                    Your Name
                  </label>
                  <div className="relative">
                    <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-rose-300/50" />
                    <input
                      type="text"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="e.g. Alex Rivera"
                      className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-dark-950 border border-cherry-900/60 focus:border-cherry-500 text-white text-xs transition-all"
                      required
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-rose-200 mb-1">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-rose-300/50" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="student@college.edu"
                    className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-dark-950 border border-cherry-900/60 focus:border-cherry-500 text-white text-xs transition-all"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-rose-200 mb-1">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-rose-300/50" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    minLength={6}
                    className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-dark-950 border border-cherry-900/60 focus:border-cherry-500 text-white text-xs transition-all"
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full mt-2 py-3 rounded-xl text-xs sm:text-sm font-bold text-white bg-gradient-to-r from-cherry-600 to-rose-600 hover:from-cherry-500 hover:to-rose-500 shadow-cherry-glow active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isRegister ? <UserPlus className="w-4 h-4" /> : <LogIn className="w-4 h-4" />}
                <span>{loading ? 'Processing...' : isRegister ? 'Create Account' : 'Sign In'}</span>
              </button>
            </form>

            {/* Toggle Login / Register */}
            <div className="mt-4 text-center">
              <button
                type="button"
                onClick={() => {
                  setIsRegister(!isRegister);
                  setError(null);
                }}
                className="text-xs text-rose-300/70 hover:text-white transition-colors"
              >
                {isRegister ? 'Already have an account? Sign in' : "Don't have an account? Create one"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
