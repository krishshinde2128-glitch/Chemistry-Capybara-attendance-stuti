import React from 'react';
import { ShieldCheck, AlertTriangle, Skull, BedDouble, TrendingUp } from 'lucide-react';
import type { OverallSummary } from '../types/attendance';

interface StatsOverviewProps {
  summary: OverallSummary;
}

export const StatsOverview: React.FC<StatsOverviewProps> = ({ summary }) => {
  const isHealthy = summary.currentPercentage >= 75;

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-4 mb-8">
      {/* Aggregate Attendance Card */}
      <div className="col-span-2 sm:col-span-2 glass-panel rounded-2xl p-4 sm:p-5 relative overflow-hidden group hover:border-cherry-500/40 transition-all">
        <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-cherry-500/10 to-transparent rounded-bl-full pointer-events-none" />
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-rose-300/70">
            Overall Attendance
          </span>
          <div className={`p-1.5 rounded-lg ${isHealthy ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-cherry-500/10 text-cherry-400 border border-cherry-500/20'}`}>
            <TrendingUp className="w-4 h-4" />
          </div>
        </div>

        <div className="flex items-baseline gap-2">
          <span className={`text-3xl sm:text-4xl font-black tracking-tight ${isHealthy ? 'text-white' : 'text-cherry-300'}`}>
            {summary.totalC === 0 ? '100' : summary.currentPercentage.toFixed(1)}%
          </span>
          <span className="text-xs font-medium text-rose-300/60">
            ({summary.totalA}/{summary.totalC} attended)
          </span>
        </div>

        {/* Progress bar with 75% target marker */}
        <div className="mt-3 relative pt-1">
          <div className="flex mb-1 items-center justify-between text-[11px] text-rose-300/60 font-medium">
            <span>Overall Pace</span>
            <span className="text-cherry-400 font-semibold">Target: 75%</span>
          </div>
          <div className="relative h-2 w-full bg-dark-900 rounded-full overflow-hidden border border-cherry-900/40">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                isHealthy
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-400'
                  : 'bg-gradient-to-r from-cherry-600 via-rose-500 to-amber-500'
              }`}
              style={{ width: `${Math.min(100, Math.max(0, summary.currentPercentage))}%` }}
            />
            {/* Target 75% tick marker */}
            <div
              className="absolute top-0 bottom-0 w-[2px] bg-white shadow-[0_0_8px_white]"
              style={{ left: '75%' }}
              title="75% Requirement"
            />
          </div>
        </div>
      </div>

      {/* Total Bunks Remaining */}
      <div className="col-span-1 glass-panel rounded-2xl p-4 sm:p-5 flex flex-col justify-between hover:border-cherry-500/40 transition-all">
        <div className="flex items-center justify-between text-rose-300/70">
          <span className="text-xs font-semibold uppercase tracking-wider">Total Bunks</span>
          <div className="p-1.5 rounded-lg bg-cherry-950/80 text-rose-300 border border-cherry-800/40">
            <BedDouble className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-2">
          <div className="text-2xl sm:text-3xl font-black text-white">
            {summary.totalBunksRemaining}
          </div>
          <p className="text-[11px] text-rose-300/60 mt-0.5">
            Safe skips remaining
          </p>
        </div>
      </div>

      {/* Safe Subjects Count */}
      <div className="col-span-1 glass-panel rounded-2xl p-4 sm:p-5 flex flex-col justify-between hover:border-emerald-500/40 transition-all">
        <div className="flex items-center justify-between text-emerald-400/80">
          <span className="text-xs font-semibold uppercase tracking-wider text-rose-300/70">Safe Zone</span>
          <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <ShieldCheck className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-2">
          <div className="text-2xl sm:text-3xl font-black text-emerald-400">
            {summary.safeCount}
          </div>
          <p className="text-[11px] text-rose-300/60 mt-0.5">
            Subjects &gt; 75%
          </p>
        </div>
      </div>

      {/* Borderline Subjects Count */}
      <div className="col-span-1 glass-panel rounded-2xl p-4 sm:p-5 flex flex-col justify-between hover:border-amber-500/40 transition-all">
        <div className="flex items-center justify-between text-amber-400/80">
          <span className="text-xs font-semibold uppercase tracking-wider text-rose-300/70">Borderline</span>
          <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <AlertTriangle className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-2">
          <div className="text-2xl sm:text-3xl font-black text-amber-400">
            {summary.borderlineCount}
          </div>
          <p className="text-[11px] text-rose-300/60 mt-0.5">
            0 bunks left / on edge
          </p>
        </div>
      </div>

      {/* Doomed Subjects Count */}
      <div className="col-span-1 glass-panel rounded-2xl p-4 sm:p-5 flex flex-col justify-between hover:border-cherry-600 transition-all">
        <div className="flex items-center justify-between text-rose-300/70">
          <span className="text-xs font-semibold uppercase tracking-wider text-cherry-400">Doomed</span>
          <div className="p-1.5 rounded-lg bg-cherry-900/40 text-cherry-400 border border-cherry-700/40">
            <Skull className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-2">
          <div className={`text-2xl sm:text-3xl font-black ${summary.doomedCount > 0 ? 'text-cherry-400 animate-pulse' : 'text-white'}`}>
            {summary.doomedCount}
          </div>
          <p className="text-[11px] text-rose-300/60 mt-0.5">
            Mathematically doomed
          </p>
        </div>
      </div>
    </div>
  );
};
