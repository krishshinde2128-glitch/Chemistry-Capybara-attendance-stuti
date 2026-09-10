import React from 'react';
import { Eye, EyeOff, LogOut, RefreshCw, User as UserIcon } from 'lucide-react';
import { useAuth } from '../firebase/AuthContext';

interface UserBarProps {
  onOpenConfig: () => void;
  onSyncAll?: () => void;
  isSyncing?: boolean;
}

export const UserBar: React.FC<UserBarProps> = ({ onSyncAll, isSyncing }) => {
  const { user, userProfile, logout, togglePrivacy } = useAuth();

  if (!user) return null;

  const isPrivate = userProfile?.isPrivate ?? false;

  return (
    <div className="glass-panel rounded-2xl p-3.5 sm:p-4 mb-6 border border-cherry-900/50 flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-4 transition-all">
      {/* User Info */}
      <div className="flex items-center gap-3 w-full sm:w-auto">
        <div className="relative">
          {user.photoURL ? (
            <img
              src={user.photoURL}
              alt={user.displayName || 'User'}
              className="w-10 h-10 rounded-full border-2 border-cherry-500/40 shadow-sm object-cover"
            />
          ) : (
            <div className="w-10 h-10 rounded-full bg-cherry-950 border border-cherry-700/50 flex items-center justify-center text-cherry-300 font-bold text-sm">
              <UserIcon className="w-5 h-5" />
            </div>
          )}
          <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-emerald-500 border-2 border-dark-950" title="Online" />
        </div>

        <div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-white">
              {userProfile?.displayName || user.displayName || user.email?.split('@')[0]}
            </span>
            <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-md bg-cherry-950 text-rose-300 border border-cherry-800/40">
              Online
            </span>
          </div>
          <p className="text-xs text-rose-300/50 truncate max-w-[200px] sm:max-w-xs">
            {user.email}
          </p>
        </div>
      </div>

      {/* Controls & Privacy Toggle */}
      <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto justify-between sm:justify-end flex-wrap">
        {onSyncAll && (
          <button
            onClick={onSyncAll}
            disabled={isSyncing}
            className="px-3 py-2 rounded-xl text-xs font-semibold bg-cherry-950/80 hover:bg-cherry-900 text-rose-200 border border-cherry-700/50 transition-all flex items-center gap-1.5 active:scale-95 disabled:opacity-50"
            title="Push your local subjects to cloud so other classmates can see them"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-cherry-400 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{isSyncing ? 'Syncing...' : 'Sync to Cloud'}</span>
          </button>
        )}

        {/* Privacy Toggle Button */}
        <button
          onClick={togglePrivacy}
          className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all border ${
            isPrivate
              ? 'bg-dark-900 text-rose-300/80 border-cherry-900 hover:border-cherry-700 hover:text-white'
              : 'bg-emerald-950/70 text-emerald-300 border-emerald-500/40 shadow-[0_0_15px_rgba(16,185,129,0.2)]'
          }`}
          title={isPrivate ? 'Your attendance is hidden from other classmates' : 'Your attendance is visible to classmates'}
        >
          {isPrivate ? (
            <>
              <EyeOff className="w-4 h-4 text-rose-400" />
              <span>Attendance: <strong>Private (Hidden)</strong></span>
            </>
          ) : (
            <>
              <Eye className="w-4 h-4 text-emerald-400" />
              <span>Attendance: <strong>Public to Peers</strong></span>
            </>
          )}
        </button>

        {/* Sign Out Button */}
        <button
          onClick={logout}
          className="p-2 sm:px-3 sm:py-2 rounded-xl text-xs font-medium text-rose-300/60 hover:text-white hover:bg-cherry-950/50 transition-colors flex items-center gap-1.5"
          title="Sign Out"
        >
          <LogOut className="w-4 h-4" />
          <span className="hidden sm:inline">Logout</span>
        </button>
      </div>
    </div>
  );
};
