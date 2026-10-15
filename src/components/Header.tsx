import React from 'react';
import { FlaskConical, Plus, RotateCcw, Users, Trophy, BookOpen, KeyRound, LogIn, ShieldCheck, Lock } from 'lucide-react';
import type { Subject } from '../types/attendance';
import { useAuth } from '../firebase/AuthContext';

export type ActiveTab = 'dashboard' | 'community' | 'leaderboard' | 'admin';

interface HeaderProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  onAddClick: () => void;
  onClearAll: () => void;
  onOpenAuth: () => void;
  onOpenConfig: () => void;
  subjects: Subject[];
  isAdminUnlocked: boolean;
  onOpenAdminUnlock: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  onAddClick,
  onClearAll,
  onOpenAuth,
  onOpenConfig,
  subjects,
  isAdminUnlocked,
  onOpenAdminUnlock,
}) => {
  const { user } = useAuth();

  return (
    <header className="sticky top-0 z-30 w-full border-b border-cherry-900/40 bg-dark-950/90 backdrop-blur-xl transition-all">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="h-20 flex items-center justify-between gap-4">
          {/* Logo & Brand */}
          <div className="flex items-center gap-3">
            <div className="relative group cursor-pointer" onClick={() => setActiveTab('dashboard')}>
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-cherry-700 via-cherry-600 to-rose-400 p-[1px] shadow-cherry-glow transition-transform duration-300 group-hover:scale-105">
                <div className="w-full h-full bg-dark-900 rounded-2xl flex items-center justify-center text-lg">
                  <FlaskConical className="w-5 h-5 text-cherry-400 fill-cherry-500/20 animate-pulse-subtle" />
                </div>
              </div>
              <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-emerald-500 border-2 border-dark-950 rounded-full" title="Active Calculator" />
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white flex items-center gap-1.5">
                  <span>Chemistry</span>
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-cherry-400 via-rose-300 to-white">
                    Capybara
                  </span>
                  <span className="text-sm">🦫</span>
                </h1>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-cherry-950/80 text-cherry-300 border border-cherry-800/60 hidden sm:inline-block">
                  75% Rule
                </span>
              </div>
              <p className="text-xs text-rose-300/60 hidden md:block">
                Stay chill, calculate safe bunks & peer attendance
              </p>
            </div>
          </div>

          {/* Navigation Tabs (Desktop & Tablet) */}
          <nav className="hidden md:flex items-center p-1 rounded-2xl bg-dark-900/80 border border-cherry-900/50">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                activeTab === 'dashboard'
                  ? 'bg-cherry-600 text-white shadow-cherry-glow'
                  : 'text-rose-300/70 hover:text-white hover:bg-dark-800'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>My Subjects</span>
            </button>

            <button
              onClick={() => setActiveTab('community')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                activeTab === 'community'
                  ? 'bg-cherry-600 text-white shadow-cherry-glow'
                  : 'text-rose-300/70 hover:text-white hover:bg-dark-800'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Classmates</span>
            </button>

            <button
              onClick={() => setActiveTab('leaderboard')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                activeTab === 'leaderboard'
                  ? 'bg-cherry-600 text-white shadow-cherry-glow'
                  : 'text-rose-300/70 hover:text-white hover:bg-dark-800'
              }`}
            >
              <Trophy className="w-3.5 h-3.5" />
              <span>Bunk Leaderboard</span>
            </button>

            <button
              onClick={() => {
                if (isAdminUnlocked) {
                  setActiveTab('admin');
                } else {
                  onOpenAdminUnlock();
                }
              }}
              id="btn-nav-admin"
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                activeTab === 'admin'
                  ? 'bg-gradient-to-r from-cherry-700 to-rose-600 text-white shadow-cherry-glow'
                  : 'text-rose-300/70 hover:text-white hover:bg-dark-800'
              }`}
            >
              {isAdminUnlocked ? (
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <Lock className="w-3.5 h-3.5 text-cherry-400" />
              )}
              <span>Admin</span>
              {isAdminUnlocked && (
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              )}
            </button>
          </nav>

          {/* Action Controls & Auth Button */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Firebase Config Trigger */}
            <button
              onClick={onOpenConfig}
              className="p-2 rounded-xl text-rose-300/60 hover:text-white hover:bg-cherry-950/60 border border-cherry-900/40 transition-colors"
              title="Firebase Configuration"
            >
              <KeyRound className="w-4 h-4" />
            </button>

            {/* Login Button if not logged in */}
            {!user ? (
              <button
                onClick={onOpenAuth}
                className="px-3.5 py-2.5 rounded-xl text-xs font-bold text-rose-200 hover:text-white bg-cherry-950/80 hover:bg-cherry-900 border border-cherry-700/50 transition-all flex items-center gap-1.5 shadow-sm active:scale-95"
              >
                <LogIn className="w-3.5 h-3.5 text-cherry-400" />
                <span>Login</span>
              </button>
            ) : null}

            {activeTab === 'dashboard' && (
              <>
                {subjects.length > 0 && (
                  <button
                    onClick={onClearAll}
                    className="px-3 py-2 rounded-xl text-xs font-medium text-rose-300/70 hover:text-rose-100 hover:bg-cherry-950/40 border border-transparent hover:border-cherry-900/40 transition-all hidden sm:flex items-center gap-1.5"
                    title="Clear all subjects"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Reset</span>
                  </button>
                )}

                <button
                  onClick={onAddClick}
                  id="btn-add-subject"
                  className="px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold text-white bg-gradient-to-r from-cherry-600 via-cherry-500 to-rose-600 hover:from-cherry-500 hover:to-rose-500 shadow-cherry-glow hover:shadow-cherry-glow-lg active:scale-95 transition-all flex items-center gap-2 border border-cherry-400/30"
                >
                  <Plus className="w-4 h-4 stroke-[2.5]" />
                  <span className="hidden sm:inline">Add Subject</span>
                  <span className="sm:hidden">Add</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Mobile Navigation Pills */}
        <div className="flex md:hidden items-center justify-around py-2 border-t border-cherry-950/60 gap-1">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`flex-1 py-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
              activeTab === 'dashboard'
                ? 'bg-cherry-600 text-white'
                : 'text-rose-300/70 hover:text-white'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Subjects</span>
          </button>
          <button
            onClick={() => setActiveTab('community')}
            className={`flex-1 py-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
              activeTab === 'community'
                ? 'bg-cherry-600 text-white'
                : 'text-rose-300/70 hover:text-white'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Class</span>
          </button>
          <button
            onClick={() => setActiveTab('leaderboard')}
            className={`flex-1 py-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
              activeTab === 'leaderboard'
                ? 'bg-cherry-600 text-white'
                : 'text-rose-300/70 hover:text-white'
            }`}
          >
            <Trophy className="w-3.5 h-3.5" />
            <span>Ranks</span>
          </button>
          <button
            onClick={() => {
              if (isAdminUnlocked) {
                setActiveTab('admin');
              } else {
                onOpenAdminUnlock();
              }
            }}
            id="btn-nav-admin-mobile"
            className={`flex-1 py-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
              activeTab === 'admin'
                ? 'bg-gradient-to-r from-cherry-700 to-rose-600 text-white'
                : 'text-rose-300/70 hover:text-white'
            }`}
          >
            {isAdminUnlocked ? (
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-300" />
            ) : (
              <Lock className="w-3.5 h-3.5" />
            )}
            <span>Admin</span>
          </button>
        </div>
      </div>
    </header>
  );
};
