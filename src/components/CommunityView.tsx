import React, { useState } from 'react';
import { 
  Users, 
  CalendarCheck, 
  CalendarX, 
  Skull, 
  User as UserIcon,
  Search,
  RefreshCw,
} from 'lucide-react';
import type { PeerUserWithSubjects, Subject } from '../types/attendance';
import { calculateSubjectStats } from '../utils/calculator';
import { useAuth } from '../firebase/AuthContext';

interface CommunityViewProps {
  peers: PeerUserWithSubjects[];
  onPeerUpdate: (subject: Subject, deltaAttended: number, deltaConducted: number) => void;
  onOpenAuth: () => void;
  onSyncAll?: () => void;
  isSyncing?: boolean;
}

export const CommunityView: React.FC<CommunityViewProps> = ({
  peers,
  onPeerUpdate,
  onOpenAuth,
  onSyncAll,
  isSyncing,
}) => {
  const { user } = useAuth();
  const [search, setSearch] = useState('');

  const filteredPeers = peers.filter((p) => {
    const nameMatch = p.user.displayName.toLowerCase().includes(search.toLowerCase()) ||
                      p.user.email.toLowerCase().includes(search.toLowerCase());
    return nameMatch;
  });

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Community Header Banner */}
      <div className="glass-panel rounded-3xl p-6 sm:p-8 border border-cherry-900/40 relative overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="max-w-2xl">
            <div className="flex items-center gap-2 text-cherry-400 text-xs font-bold uppercase tracking-wider mb-2">
              <Users className="w-4 h-4" />
              <span>Classmates Live Attendance Hub</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              Peer Attendance & Collaborative Logging
            </h2>
            <p className="text-xs sm:text-sm text-rose-300/70 mt-2 leading-relaxed">
              See how your fellow classmates are pacing against the 75% rule. You can also help friends log classes they attended or missed today.
            </p>
          </div>

          {user && onSyncAll && (
            <button
              onClick={onSyncAll}
              disabled={isSyncing}
              className="px-4 py-2.5 rounded-xl bg-cherry-950/90 hover:bg-cherry-900 border border-cherry-600/50 text-rose-200 text-xs font-bold flex items-center gap-2 shrink-0 self-start sm:self-center shadow-sm active:scale-95 transition-all"
            >
              <RefreshCw className={`w-4 h-4 text-cherry-400 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{isSyncing ? 'Syncing...' : 'Publish My Subjects'}</span>
            </button>
          )}
        </div>

        {/* Search */}
        <div className="mt-6 max-w-md">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-rose-300/50" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search classmates by name..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-dark-950/80 border border-cherry-900/60 focus:border-cherry-500 text-xs sm:text-sm text-white placeholder-rose-300/40 transition-all"
            />
          </div>
        </div>
      </div>

      {!user && (
        <div className="p-4 rounded-2xl bg-cherry-950/60 border border-cherry-800/40 flex items-center justify-between gap-4">
          <div className="text-xs text-rose-200">
            <strong>Login Required</strong>: Sign in to sync your subjects and update attendance for classmates.
          </div>
          <button
            onClick={onOpenAuth}
            className="px-4 py-2 rounded-xl bg-cherry-600 hover:bg-cherry-500 text-white font-bold text-xs shadow-sm transition-all"
          >
            Sign In
          </button>
        </div>
      )}

      {/* Classmates Grid */}
      {filteredPeers.length === 0 ? (
        <div className="glass-panel rounded-3xl p-10 text-center max-w-md mx-auto my-8 border border-cherry-900/40">
          <Users className="w-12 h-12 text-cherry-400/60 mx-auto mb-3" />
          <h4 className="text-lg font-bold text-white mb-1">No Public Classmates Found</h4>
          <p className="text-xs text-rose-300/60">
            Classmates who have public attendance enabled will appear here in real-time.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {filteredPeers.map(({ user: peerUser, subjects: peerSubjects, summary: peerSummary }) => {
            const isSelf = peerUser.uid === user?.uid;

            return (
              <div
                key={peerUser.uid}
                className="glass-panel rounded-3xl p-5 sm:p-7 border border-cherry-900/50 transition-all hover:border-cherry-700/50"
              >
                {/* Peer Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-cherry-950/80">
                  <div className="flex items-center gap-3">
                    {peerUser.photoURL ? (
                      <img
                        src={peerUser.photoURL}
                        alt={peerUser.displayName}
                        className="w-12 h-12 rounded-full border-2 border-cherry-500/40 object-cover"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-cherry-950 border border-cherry-700/50 flex items-center justify-center text-cherry-300 font-bold">
                        <UserIcon className="w-6 h-6" />
                      </div>
                    )}
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-lg font-bold text-white">
                          {peerUser.displayName}
                        </h3>
                        {isSelf && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-cherry-900 text-rose-200 border border-cherry-700/40">
                            You
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-rose-300/60 truncate">
                        {peerSubjects.length} {peerSubjects.length === 1 ? 'subject' : 'subjects'} tracked
                      </p>
                    </div>
                  </div>

                  {/* Summary Badges for Peer */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="px-3 py-1.5 rounded-xl bg-dark-950 border border-cherry-900/50 text-xs font-bold text-white flex items-center gap-1.5">
                      <span className="text-rose-300/60 font-medium">Overall:</span>
                      <span className={peerSummary.currentPercentage >= 75 ? 'text-emerald-400' : 'text-cherry-400'}>
                        {peerSummary.totalC === 0 ? '100' : peerSummary.currentPercentage.toFixed(1)}%
                      </span>
                    </div>

                    <div className="px-3 py-1.5 rounded-xl bg-dark-950 border border-cherry-900/50 text-xs font-bold text-emerald-300">
                      {peerSummary.totalBunksRemaining} Safe Bunks
                    </div>

                    {peerSummary.doomedCount > 0 && (
                      <div className="px-3 py-1.5 rounded-xl bg-cherry-950 border border-cherry-600/50 text-xs font-bold text-cherry-400 flex items-center gap-1">
                        <Skull className="w-3.5 h-3.5" />
                        <span>{peerSummary.doomedCount} Doomed</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Peer's Subjects Grid */}
                {peerSubjects.length === 0 ? (
                  <p className="text-xs text-rose-300/40 italic py-4">No subjects added yet by this classmate.</p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-5">
                    {peerSubjects.map((subj) => {
                      const stats = calculateSubjectStats(subj);

                      return (
                        <div
                          key={subj.id}
                          className="bg-dark-950/80 rounded-2xl p-4 border border-cherry-950 flex flex-col justify-between"
                        >
                          <div>
                            <div className="flex items-start justify-between gap-2 mb-2">
                              <div>
                                <h4 className="text-sm font-bold text-white">{subj.name}</h4>
                                {subj.code && (
                                  <span className="text-[10px] font-mono text-rose-300/60">
                                    {subj.code}
                                  </span>
                                )}
                              </div>
                              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                                stats.scenario === 'safe'
                                  ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/30'
                                  : stats.scenario === 'borderline'
                                  ? 'bg-amber-950 text-amber-300 border border-amber-500/30'
                                  : 'bg-cherry-950 text-cherry-300 border border-cherry-600/50'
                              }`}>
                                {subj.conductedClasses === 0 ? '100' : stats.currentPercentage.toFixed(1)}%
                              </span>
                            </div>

                            {/* Attended / Conducted info */}
                            <div className="text-xs text-rose-300/70 mb-3 flex items-center justify-between">
                              <span>{subj.attendedClasses} / {subj.conductedClasses} attended</span>
                              <span className="font-semibold text-white">
                                {stats.scenario === 'safe' && `${stats.bunksRemaining} bunks left`}
                                {stats.scenario === 'borderline' && '0 bunks left'}
                                {stats.scenario === 'doomed' && 'Doomed (<75%)'}
                              </span>
                            </div>

                            {subj.lastUpdatedBy && (
                              <p className="text-[10px] text-rose-300/50 mb-2 truncate">
                                Last logged by: <strong className="text-rose-200">{subj.lastUpdatedBy}</strong>
                              </p>
                            )}
                          </div>

                          {/* Peer Action: Update Attendance for Peer */}
                          <div className="pt-2 border-t border-cherry-950">
                            <div className="text-[10px] font-bold text-rose-300/60 uppercase mb-1.5 flex items-center justify-between">
                              <span>Log Attendance for {peerUser.displayName.split(' ')[0]}</span>
                            </div>
                            <div className="grid grid-cols-2 gap-1.5">
                              <button
                                onClick={() => onPeerUpdate(subj, 1, 1)}
                                disabled={!user || subj.conductedClasses >= subj.totalClasses}
                                className="py-1.5 px-2 rounded-lg bg-emerald-950/70 hover:bg-emerald-900 border border-emerald-600/30 text-emerald-300 text-[11px] font-bold flex items-center justify-center gap-1 active:scale-95 disabled:opacity-40 transition-all"
                                title="Mark +1 Attended for classmate"
                              >
                                <CalendarCheck className="w-3.5 h-3.5" />
                                <span>+1 Attended</span>
                              </button>
                              <button
                                onClick={() => onPeerUpdate(subj, 0, 1)}
                                disabled={!user || subj.conductedClasses >= subj.totalClasses}
                                className="py-1.5 px-2 rounded-lg bg-cherry-950/70 hover:bg-cherry-900 border border-cherry-700/30 text-rose-300 text-[11px] font-bold flex items-center justify-center gap-1 active:scale-95 disabled:opacity-40 transition-all"
                                title="Mark +1 Missed for classmate"
                              >
                                <CalendarX className="w-3.5 h-3.5" />
                                <span>+1 Missed</span>
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
