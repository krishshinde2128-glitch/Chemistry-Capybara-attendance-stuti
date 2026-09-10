import React, { useState } from 'react';
import { 
  CheckCircle2, 
  AlertTriangle, 
  Skull, 
  Edit3, 
  Trash2, 
  CalendarCheck,
  CalendarX,
} from 'lucide-react';
import type { Subject } from '../types/attendance';
import { calculateSubjectStats } from '../utils/calculator';

interface SubjectCardProps {
  subject: Subject;
  onEdit: (subject: Subject) => void;
  onDelete: (id: string) => void;
  onQuickUpdate: (id: string, deltaAttended: number, deltaConducted: number) => void;
}

export const SubjectCard: React.FC<SubjectCardProps> = ({
  subject,
  onEdit,
  onDelete,
  onQuickUpdate,
}) => {
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const stats = calculateSubjectStats(subject);

  // Border & Glow styling based on scenario
  const getScenarioTheme = () => {
    switch (stats.scenario) {
      case 'safe':
        return {
          border: 'border-emerald-500/30 hover:border-emerald-500/60',
          badgeBg: 'bg-emerald-950/70 text-emerald-300 border-emerald-500/40',
          icon: <CheckCircle2 className="w-4 h-4 text-emerald-400" />,
          title: 'Safe Zone',
          progressColor: 'bg-gradient-to-r from-emerald-500 to-teal-400',
        };
      case 'borderline':
        return {
          border: 'border-amber-500/40 hover:border-amber-500/70 shadow-[0_0_20px_-5px_rgba(245,158,11,0.2)]',
          badgeBg: 'bg-amber-950/80 text-amber-300 border-amber-500/50',
          icon: <AlertTriangle className="w-4 h-4 text-amber-400" />,
          title: 'Borderline Edge',
          progressColor: 'bg-gradient-to-r from-amber-500 to-orange-500',
        };
      case 'doomed':
        return {
          border: 'border-cherry-600/80 hover:border-cherry-500 animate-doomed-pulse',
          badgeBg: 'bg-cherry-950/90 text-cherry-300 border-cherry-600/60',
          icon: <Skull className="w-4 h-4 text-cherry-400 animate-bounce" />,
          title: 'Mathematically Doomed',
          progressColor: 'bg-gradient-to-r from-cherry-700 via-rose-600 to-cherry-500',
        };
    }
  };

  const theme = getScenarioTheme();
  const percentageFormatted = stats.currentPercentage.toFixed(1);
  const maxPossibleFormatted = stats.maxPossiblePercentage.toFixed(1);

  return (
    <div
      className={`glass-panel rounded-3xl p-5 sm:p-6 transition-all duration-300 relative flex flex-col justify-between group ${theme.border}`}
    >
      {/* Top Header */}
      <div>
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-lg sm:text-xl font-bold text-white tracking-tight group-hover:text-rose-100 transition-colors">
                {subject.name}
              </h3>
              {subject.code && (
                <span className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded-md bg-cherry-950/80 text-rose-300 border border-cherry-800/50">
                  {subject.code}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5 mt-1.5">
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${theme.badgeBg}`}>
                {theme.icon}
                {theme.title}
              </span>
              <span className="text-xs text-rose-300/60 font-medium">
                Target: {stats.targetRequired}/{subject.totalClasses} (75%)
              </span>
            </div>
          </div>

          {/* Action Icons */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => onEdit(subject)}
              className="p-2 rounded-xl text-rose-300/70 hover:text-white hover:bg-cherry-900/40 transition-colors"
              title="Edit Subject"
            >
              <Edit3 className="w-4 h-4" />
            </button>
            <button
              onClick={() => setShowConfirmDelete(true)}
              className="p-2 rounded-xl text-rose-300/70 hover:text-cherry-400 hover:bg-cherry-950/60 transition-colors"
              title="Delete Subject"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Delete Confirmation Overlay */}
        {showConfirmDelete && (
          <div className="mb-4 p-3.5 rounded-2xl bg-dark-900/95 border border-cherry-700/60 text-xs flex items-center justify-between gap-2">
            <span className="text-rose-200 font-medium">Delete this subject?</span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => onDelete(subject.id)}
                className="px-2.5 py-1 rounded-lg bg-cherry-600 hover:bg-cherry-500 text-white font-semibold transition-colors"
              >
                Yes, Delete
              </button>
              <button
                onClick={() => setShowConfirmDelete(false)}
                className="px-2.5 py-1 rounded-lg bg-dark-800 text-rose-300 hover:text-white transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Attendance Percentage & Progress Bar */}
        <div className="my-4 bg-dark-900/70 p-4 rounded-2xl border border-cherry-950/80">
          <div className="flex items-end justify-between mb-2">
            <div>
              <span className="text-3xl sm:text-4xl font-black text-white tracking-tight">
                {subject.conductedClasses === 0 ? '100' : percentageFormatted}%
              </span>
              <span className="text-xs text-rose-300/60 ml-2 font-medium">
                Current Attendance
              </span>
            </div>
            <div className="text-right">
              <div className="text-xs font-bold text-rose-200">
                {subject.attendedClasses} <span className="text-rose-400/60">/</span> {subject.conductedClasses}
              </div>
              <span className="text-[11px] text-rose-300/60 font-medium">
                Classes Held
              </span>
            </div>
          </div>

          {/* Linear Bar with 75% Benchmark */}
          <div className="relative h-3 w-full bg-dark-950 rounded-full overflow-hidden border border-cherry-900/50">
            <div
              className={`h-full rounded-full transition-all duration-500 ${theme.progressColor}`}
              style={{ width: `${Math.min(100, Math.max(0, stats.currentPercentage))}%` }}
            />
            {/* 75% Threshold Line */}
            <div
              className="absolute top-0 bottom-0 w-[2px] bg-white shadow-[0_0_10px_white] z-10"
              style={{ left: '75%' }}
              title="75% Minimum Required Threshold"
            />
          </div>
          <div className="flex justify-between items-center text-[10px] text-rose-300/50 mt-1.5 font-semibold">
            <span>0%</span>
            <span className="text-white font-bold">75% Target Marker</span>
            <span>100%</span>
          </div>
        </div>

        {/* Class Metrics Grid */}
        <div className="grid grid-cols-3 gap-2 text-center my-3.5">
          <div className="p-2.5 rounded-xl bg-dark-950/60 border border-cherry-950">
            <div className="text-[10px] uppercase font-bold text-rose-300/60">Attended (A)</div>
            <div className="text-base sm:text-lg font-black text-emerald-400 mt-0.5">
              {subject.attendedClasses}
            </div>
          </div>
          <div className="p-2.5 rounded-xl bg-dark-950/60 border border-cherry-950">
            <div className="text-[10px] uppercase font-bold text-rose-300/60">Remaining</div>
            <div className="text-base sm:text-lg font-black text-rose-200 mt-0.5">
              {stats.classesRemaining}
            </div>
          </div>
          <div className="p-2.5 rounded-xl bg-dark-950/60 border border-cherry-950">
            <div className="text-[10px] uppercase font-bold text-rose-300/60">Total (T)</div>
            <div className="text-base sm:text-lg font-black text-white mt-0.5">
              {subject.totalClasses}
            </div>
          </div>
        </div>

        {/* Dynamic Scenario Output Banner */}
        <div className="mt-4">
          {stats.scenario === 'safe' && (
            <div className="p-4 rounded-2xl bg-emerald-950/40 border border-emerald-500/30 text-emerald-300 shadow-sm">
              <div className="flex items-start gap-2.5">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs sm:text-sm font-semibold text-emerald-200 leading-relaxed">
                    You can safely bunk <span className="underline decoration-emerald-400 underline-offset-2 font-black text-emerald-300 text-sm sm:text-base">{stats.bunksRemaining}</span> more {stats.bunksRemaining === 1 ? 'class' : 'classes'} and still maintain 75%.
                  </p>
                  <p className="text-[11px] text-emerald-400/70 mt-1">
                    Absences taken so far: {stats.absencesTaken} / {stats.maxAbsencesAllowed} max allowed.
                  </p>
                </div>
              </div>
            </div>
          )}

          {stats.scenario === 'borderline' && (
            <div className="p-4 rounded-2xl bg-amber-950/50 border border-amber-500/40 text-amber-200 shadow-sm">
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs sm:text-sm font-bold text-amber-100 leading-relaxed">
                    You cannot bunk any more classes! You are exactly at the edge.
                  </p>
                  {stats.classesToRecover > 0 ? (
                    <p className="text-[11px] text-amber-300/80 mt-1 font-medium">
                      Attend next <span className="font-bold text-white">{stats.classesToRecover}</span> consecutive classes to recover 75% attendance.
                    </p>
                  ) : (
                    <p className="text-[11px] text-amber-300/80 mt-1 font-medium">
                      Every remaining class is mandatory. Missing 1 more drops you below 75%.
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {stats.scenario === 'doomed' && (
            <div className="p-4 rounded-2xl bg-cherry-950/80 border-2 border-cherry-600 text-rose-100 shadow-cherry-glow">
              <div className="flex items-start gap-3">
                <Skull className="w-6 h-6 text-cherry-400 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-base sm:text-lg font-black text-cherry-400 uppercase tracking-wide">
                    you fucked gang
                  </h4>
                  <p className="text-xs sm:text-sm text-rose-200 font-medium mt-1 leading-relaxed">
                    Even if you attend all <span className="font-bold text-white">{stats.classesRemaining}</span> remaining classes, your total attendance will only be <span className="font-bold text-white">{stats.maxPossibleAttendance}/{subject.totalClasses}</span>, which is <span className="font-bold text-cherry-400">{maxPossibleFormatted}%</span>. You need <span className="font-bold text-white">{stats.targetRequired}</span> classes for 75%.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Quick Daily Attendance Logger */}
      <div className="mt-5 pt-4 border-t border-cherry-950/90">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-rose-300/60">
            Quick Today Log
          </span>
          <span className="text-[11px] text-rose-300/50">
            {subject.conductedClasses}/{subject.totalClasses} done
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => onQuickUpdate(subject.id, 1, 1)}
            disabled={subject.conductedClasses >= subject.totalClasses}
            className="py-2.5 px-3 rounded-xl bg-emerald-950/60 hover:bg-emerald-900/70 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed border border-emerald-600/30 text-emerald-300 hover:text-emerald-100 text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-sm"
          >
            <CalendarCheck className="w-4 h-4 text-emerald-400" />
            <span>+1 Attended</span>
          </button>

          <button
            onClick={() => onQuickUpdate(subject.id, 0, 1)}
            disabled={subject.conductedClasses >= subject.totalClasses}
            className="py-2.5 px-3 rounded-xl bg-cherry-950/60 hover:bg-cherry-900/70 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed border border-cherry-700/30 text-rose-300 hover:text-rose-100 text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-sm"
          >
            <CalendarX className="w-4 h-4 text-cherry-400" />
            <span>+1 Missed</span>
          </button>
        </div>
      </div>
    </div>
  );
};
