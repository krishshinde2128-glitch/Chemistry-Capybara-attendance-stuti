import React, { useState, useMemo } from 'react';
import { 
  Trophy, 
  Crown, 
  Medal, 
  BedDouble, 
  Skull, 
  AlertTriangle, 
  CheckCircle2, 
  Filter,
  User as UserIcon
} from 'lucide-react';
import type { PeerUserWithSubjects } from '../types/attendance';
import { calculateSubjectStats } from '../utils/calculator';

interface LeaderboardViewProps {
  peers: PeerUserWithSubjects[];
}

export const LeaderboardView: React.FC<LeaderboardViewProps> = ({ peers }) => {
  const [selectedSubject, setSelectedSubject] = useState<string>('all');

  // Extract all unique subject names across all classmates
  const uniqueSubjectNames = useMemo(() => {
    const names = new Set<string>();
    peers.forEach((p) => {
      p.subjects.forEach((s) => names.add(s.name));
    });
    return Array.from(names);
  }, [peers]);

  // Overall user ranking by total bunks remaining
  const userRankings = useMemo(() => {
    return [...peers].sort((a, b) => {
      const bunksA = a.summary.totalBunksRemaining;
      const bunksB = b.summary.totalBunksRemaining;
      if (bunksB !== bunksA) return bunksB - bunksA;
      return b.summary.currentPercentage - a.summary.currentPercentage;
    });
  }, [peers]);

  // Subject-level entries for the granular breakdown table
  const subjectRankings = useMemo(() => {
    const rows: {
      userId: string;
      userName: string;
      userPhoto?: string;
      subjectName: string;
      subjectCode?: string;
      currentPercentage: number;
      bunksRemaining: number;
      scenario: 'safe' | 'borderline' | 'doomed';
      conducted: number;
      attended: number;
    }[] = [];

    peers.forEach((p) => {
      p.subjects.forEach((s) => {
        if (selectedSubject !== 'all' && s.name !== selectedSubject) return;
        const stats = calculateSubjectStats(s);
        rows.push({
          userId: p.user.uid,
          userName: p.user.displayName,
          userPhoto: p.user.photoURL,
          subjectName: s.name,
          subjectCode: s.code,
          currentPercentage: stats.currentPercentage,
          bunksRemaining: stats.bunksRemaining,
          scenario: stats.scenario,
          conducted: s.conductedClasses,
          attended: s.attendedClasses,
        });
      });
    });

    // Sort by bunks remaining descending
    return rows.sort((a, b) => b.bunksRemaining - a.bunksRemaining);
  }, [peers, selectedSubject]);

  const getRankBadge = (index: number) => {
    if (index === 0) {
      return (
        <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-amber-500 to-yellow-300 text-slate-950 font-black flex items-center justify-center shadow-[0_0_15px_rgba(245,158,11,0.5)]">
          <Crown className="w-4 h-4" />
        </div>
      );
    }
    if (index === 1) {
      return (
        <div className="w-8 h-8 rounded-full bg-slate-300 text-slate-950 font-bold flex items-center justify-center">
          <Medal className="w-4 h-4" />
        </div>
      );
    }
    if (index === 2) {
      return (
        <div className="w-8 h-8 rounded-full bg-amber-700 text-white font-bold flex items-center justify-center">
          <Medal className="w-4 h-4" />
        </div>
      );
    }
    return (
      <div className="w-8 h-8 rounded-full bg-dark-900 border border-cherry-900/60 text-rose-300/80 text-xs font-bold flex items-center justify-center">
        #{index + 1}
      </div>
    );
  };

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Header Banner */}
      <div className="glass-panel rounded-3xl p-6 sm:p-8 border border-cherry-900/40 relative overflow-hidden">
        <div className="flex items-center gap-2 text-cherry-400 text-xs font-bold uppercase tracking-wider mb-2">
          <Trophy className="w-4 h-4" />
          <span>Campus Hall of Bunks</span>
        </div>
        <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
          The Bunk Leaderboard
        </h2>
        <p className="text-xs sm:text-sm text-rose-300/70 mt-2 max-w-2xl leading-relaxed">
          Who has the most safe bunks left? Compare subject by subject, find out who is walking on the borderline edge, and who is already doomed.
        </p>
      </div>

      {/* Top Podium Cards (Top 3 Bunk Masters) */}
      {userRankings.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {userRankings.slice(0, 3).map((peer, idx) => (
            <div
              key={peer.user.uid}
              className={`glass-panel rounded-3xl p-6 border relative overflow-hidden flex flex-col justify-between transition-all ${
                idx === 0
                  ? 'border-amber-500/50 shadow-[0_0_25px_rgba(245,158,11,0.2)] bg-gradient-to-b from-amber-950/20 to-dark-950'
                  : 'border-cherry-900/50'
              }`}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  {peer.user.photoURL ? (
                    <img
                      src={peer.user.photoURL}
                      alt={peer.user.displayName}
                      className="w-12 h-12 rounded-full border-2 border-cherry-500/40 object-cover"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-cherry-950 border border-cherry-700/50 flex items-center justify-center text-cherry-300 font-bold">
                      <UserIcon className="w-6 h-6" />
                    </div>
                  )}
                  <div>
                    <h3 className="font-bold text-white text-base">
                      {peer.user.displayName}
                    </h3>
                    <span className="text-xs text-rose-300/60 font-medium">
                      {idx === 0 ? '👑 Supreme Bunk King' : idx === 1 ? '🥈 Bunk Strategist' : '🥉 Campus Rover'}
                    </span>
                  </div>
                </div>
                {getRankBadge(idx)}
              </div>

              <div className="bg-dark-950/80 rounded-2xl p-4 border border-cherry-950/80 mt-2">
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-rose-300/70 font-semibold">Total Safe Bunks:</span>
                  <span className="text-xl font-black text-emerald-400">
                    {peer.summary.totalBunksRemaining}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-rose-300/70">Overall Attendance:</span>
                  <span className="font-bold text-white">
                    {peer.summary.totalC === 0 ? '100' : peer.summary.currentPercentage.toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Subject-Wise Bunk Table */}
      <div className="glass-panel rounded-3xl p-5 sm:p-7 border border-cherry-900/50">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <div>
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <BedDouble className="w-5 h-5 text-cherry-400" />
              <span>Subject Bunk Breakdown</span>
            </h3>
            <p className="text-xs text-rose-300/60">
              Ranked list of who can bunk the most in each subject
            </p>
          </div>

          {/* Subject Filter */}
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Filter className="w-4 h-4 text-rose-300/60" />
            <select
              value={selectedSubject}
              onChange={(e) => setSelectedSubject(e.target.value)}
              className="bg-dark-950 border border-cherry-900/60 rounded-xl px-3 py-1.5 text-xs font-semibold text-white focus:border-cherry-500 cursor-pointer"
            >
              <option value="all">All Subjects ({uniqueSubjectNames.length})</option>
              {uniqueSubjectNames.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Table */}
        {subjectRankings.length === 0 ? (
          <p className="text-xs text-rose-300/50 text-center py-8">
            No subjects data available on the leaderboard yet.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-200">
              <thead className="bg-dark-950/90 text-rose-300/70 uppercase text-[10px] tracking-wider border-b border-cherry-900/40">
                <tr>
                  <th className="px-4 py-3 rounded-l-xl">Rank</th>
                  <th className="px-4 py-3">Student</th>
                  <th className="px-4 py-3">Subject</th>
                  <th className="px-4 py-3">Attendance</th>
                  <th className="px-4 py-3">Safe Bunks Left</th>
                  <th className="px-4 py-3 rounded-r-xl">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-cherry-950/60">
                {subjectRankings.map((row, idx) => (
                  <tr key={`${row.userId}-${row.subjectName}-${idx}`} className="hover:bg-cherry-950/20 transition-colors">
                    <td className="px-4 py-3 font-bold text-rose-300">
                      #{idx + 1}
                    </td>
                    <td className="px-4 py-3 font-semibold text-white">
                      {row.userName}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-rose-100 font-medium">{row.subjectName}</span>
                      {row.subjectCode && (
                        <span className="ml-1.5 text-[10px] font-mono px-1.5 py-0.5 rounded bg-dark-950 text-rose-300/70 border border-cherry-900">
                          {row.subjectCode}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-bold text-white">
                        {row.conducted === 0 ? '100' : row.currentPercentage.toFixed(1)}%
                      </span>
                      <span className="text-rose-300/50 ml-1">
                        ({row.attended}/{row.conducted})
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-black ${
                        row.bunksRemaining > 0
                          ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-500/40 shadow-sm'
                          : row.scenario === 'borderline'
                          ? 'bg-amber-950/80 text-amber-300 border border-amber-500/40'
                          : 'bg-cherry-950 text-cherry-400 border border-cherry-600/50'
                      }`}>
                        {row.bunksRemaining} Bunks
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {row.scenario === 'safe' && (
                        <span className="text-emerald-400 font-semibold flex items-center gap-1 text-[11px]">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Safe Zone
                        </span>
                      )}
                      {row.scenario === 'borderline' && (
                        <span className="text-amber-400 font-semibold flex items-center gap-1 text-[11px]">
                          <AlertTriangle className="w-3.5 h-3.5" /> Borderline Edge
                        </span>
                      )}
                      {row.scenario === 'doomed' && (
                        <span className="text-cherry-400 font-bold flex items-center gap-1 text-[11px]">
                          <Skull className="w-3.5 h-3.5" /> Doomed Gang
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
