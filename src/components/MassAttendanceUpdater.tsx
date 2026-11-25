import React, { useState, useMemo, useEffect } from 'react';
import {
  Zap,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Users,
  Search,
  BookOpen,
  Check,
  X,
  Sliders,
  TrendingUp,
  Award,
  Sparkles,
  RefreshCw,
  Send,
  GraduationCap,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import type { Subject, UserProfile } from '../types/attendance';
import {
  batchUpdateSubjectsAttendanceInFirestore,
  type BatchAttendanceUpdateItem,
  type BatchAttendanceUpdateResult,
} from '../firebase/firestoreService';
import { calculateSubjectStats } from '../utils/calculator';

interface MassAttendanceUpdaterProps {
  allUsers?: UserProfile[];
  allSubjects: Subject[];
  isConfigured: boolean;
  currentUser: { uid: string; displayName?: string | null } | null;
  onUpdateSubjects?: (updatedSubjects: Subject[]) => void;
  onRefreshData: () => Promise<void>;
}

export const MassAttendanceUpdater: React.FC<MassAttendanceUpdaterProps> = ({
  allSubjects,
  isConfigured,
  currentUser,
  onUpdateSubjects,
  onRefreshData,
}) => {
  // Distinct courses with student enrollment stats
  const distinctCourses = useMemo(() => {
    const grouped = new Map<
      string,
      {
        name: string;
        code?: string;
        subjects: Subject[];
        count: number;
        totalC: number;
        totalA: number;
        safe: number;
        borderline: number;
        doomed: number;
      }
    >();

    allSubjects.forEach((s) => {
      const key = s.name.trim().toLowerCase();
      const stats = calculateSubjectStats(s);
      const existing = grouped.get(key);

      if (existing) {
        existing.subjects.push(s);
        existing.count += 1;
        existing.totalC += s.conductedClasses || 0;
        existing.totalA += s.attendedClasses || 0;
        if (stats.scenario === 'safe') existing.safe += 1;
        else if (stats.scenario === 'borderline') existing.borderline += 1;
        else existing.doomed += 1;
      } else {
        grouped.set(key, {
          name: s.name.trim(),
          code: s.code,
          subjects: [s],
          count: 1,
          totalC: s.conductedClasses || 0,
          totalA: s.attendedClasses || 0,
          safe: stats.scenario === 'safe' ? 1 : 0,
          borderline: stats.scenario === 'borderline' ? 1 : 0,
          doomed: stats.scenario === 'doomed' ? 1 : 0,
        });
      }
    });

    return Array.from(grouped.values()).sort((a, b) => b.count - a.count);
  }, [allSubjects]);

  // Selected course state
  const [selectedCourseName, setSelectedCourseName] = useState<string>('');

  // Default to first course if none selected
  useEffect(() => {
    if (distinctCourses.length > 0 && !selectedCourseName) {
      setSelectedCourseName(distinctCourses[0].name);
    }
  }, [distinctCourses, selectedCourseName]);

  // Active enrolled subjects for the selected course
  const enrolledSubjects = useMemo(() => {
    if (!selectedCourseName) return [];
    if (selectedCourseName === '__ALL_COURSES__') {
      return allSubjects;
    }
    const targetNorm = selectedCourseName.trim().toLowerCase();
    return allSubjects.filter((s) => s.name.trim().toLowerCase() === targetNorm);
  }, [allSubjects, selectedCourseName]);

  // Selected Course Stats summary
  const courseStats = useMemo(() => {
    const count = enrolledSubjects.length;
    if (count === 0) {
      return { count: 0, avgPct: 0, safe: 0, borderline: 0, doomed: 0, totalC: 0, totalA: 0 };
    }
    let totalC = 0;
    let totalA = 0;
    let safe = 0;
    let borderline = 0;
    let doomed = 0;

    enrolledSubjects.forEach((s) => {
      totalC += s.conductedClasses || 0;
      totalA += s.attendedClasses || 0;
      const st = calculateSubjectStats(s);
      if (st.scenario === 'safe') safe++;
      else if (st.scenario === 'borderline') borderline++;
      else doomed++;
    });

    const avgPct = totalC > 0 ? (totalA / totalC) * 100 : 100;

    return { count, avgPct, safe, borderline, doomed, totalC, totalA };
  }, [enrolledSubjects]);

  // Mode switcher: 'rollcall' | 'batch' | 'recovery'
  const [activeMode, setActiveMode] = useState<'rollcall' | 'batch' | 'recovery'>('rollcall');

  // Roll-Call Roster State (subjectId -> isPresent: boolean, default true)
  const [rollCallMap, setRollCallMap] = useState<Record<string, boolean>>({});
  const [rosterSearch, setRosterSearch] = useState('');

  // Sync rollCallMap whenever enrolledSubjects change
  useEffect(() => {
    setRollCallMap((prev) => {
      const next: Record<string, boolean> = { ...prev };
      enrolledSubjects.forEach((s) => {
        if (next[s.id] === undefined) {
          next[s.id] = true; // default present
        }
      });
      return next;
    });
  }, [enrolledSubjects]);

  // Batch Delta & Exact State
  const [batchType, setBatchType] = useState<'delta' | 'exact'>('delta');
  const [deltaConducted, setDeltaConducted] = useState<number>(1);
  const [deltaAttended, setDeltaAttended] = useState<number>(1);
  const [exactTotal, setExactTotal] = useState<number | ''>('');
  const [exactConducted, setExactConducted] = useState<number | ''>(10);
  const [exactAttended, setExactAttended] = useState<number | ''>(8);

  // Audience Scope
  const [targetScope, setTargetScope] = useState<'all' | 'selective'>('all');
  const [selectedStudentUids, setSelectedStudentUids] = useState<Set<string>>(new Set());

  useEffect(() => {
    // Default selective to all enrolled student UIDs
    setSelectedStudentUids(new Set(enrolledSubjects.map((s) => s.userId || s.id)));
  }, [enrolledSubjects]);

  // Execution state
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionMessage, setExecutionMessage] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<BatchAttendanceUpdateResult | null>(null);
  const [showResultDetails, setShowResultDetails] = useState(false);

  // Roll Call Helpers
  const handleToggleRollCall = (subjectId: string) => {
    setRollCallMap((prev) => ({
      ...prev,
      [subjectId]: !prev[subjectId],
    }));
  };

  const handleSetAllRollCall = (isPresent: boolean) => {
    const next: Record<string, boolean> = {};
    enrolledSubjects.forEach((s) => {
      next[s.id] = isPresent;
    });
    setRollCallMap(next);
  };

  const handleInvertRollCall = () => {
    const next: Record<string, boolean> = {};
    enrolledSubjects.forEach((s) => {
      next[s.id] = !rollCallMap[s.id];
    });
    setRollCallMap(next);
  };

  // Roll-Call Counts
  const rollCallStats = useMemo(() => {
    let presentCount = 0;
    let absentCount = 0;
    enrolledSubjects.forEach((s) => {
      if (rollCallMap[s.id] ?? true) {
        presentCount++;
      } else {
        absentCount++;
      }
    });
    return { presentCount, absentCount, total: enrolledSubjects.length };
  }, [enrolledSubjects, rollCallMap]);

  // Core Execution Function: applies attendance change to all targeted subjects
  const executeAttendanceUpdate = async (
    action:
      | 'quick_all_present'
      | 'quick_all_absent'
      | 'quick_undo_class'
      | 'roster_submit'
      | 'batch_delta'
      | 'batch_exact'
      | 'recovery_boost'
  ) => {
    const targetSubjects = enrolledSubjects.filter((s) => {
      if (targetScope === 'selective') {
        const uid = s.userId || s.id;
        return selectedStudentUids.has(uid);
      }
      return true;
    });

    if (targetSubjects.length === 0) {
      alert('No students selected for this update. Please select at least one student.');
      return;
    }

    setIsExecuting(true);
    setLastResult(null);
    setShowResultDetails(false);

    let progressText = `Updating attendance for ${targetSubjects.length} students...`;
    if (action === 'quick_all_present') progressText = `Marking all ${targetSubjects.length} students present (+1/+1)...`;
    if (action === 'quick_all_absent') progressText = `Marking class conducted for ${targetSubjects.length} students (+0/+1)...`;
    if (action === 'quick_undo_class') progressText = `Rolling back 1 class for ${targetSubjects.length} students (-1/-1)...`;
    if (action === 'recovery_boost') progressText = `Applying 75% attendance recovery boost...`;

    setExecutionMessage(progressText);

    const updates: BatchAttendanceUpdateItem[] = [];
    const updatedSubjectsList: Subject[] = [];

    for (const s of targetSubjects) {
      let newConducted = s.conductedClasses;
      let newAttended = s.attendedClasses;
      let newTotal = s.totalClasses;

      if (action === 'quick_all_present') {
        newConducted = Math.min(s.totalClasses, s.conductedClasses + 1);
        newAttended = Math.min(newConducted, s.attendedClasses + 1);
      } else if (action === 'quick_all_absent') {
        newConducted = Math.min(s.totalClasses, s.conductedClasses + 1);
        newAttended = Math.min(newConducted, s.attendedClasses);
      } else if (action === 'quick_undo_class') {
        newConducted = Math.max(0, s.conductedClasses - 1);
        newAttended = Math.min(newConducted, Math.max(0, s.attendedClasses - 1));
      } else if (action === 'roster_submit') {
        const isPresent = rollCallMap[s.id] ?? true;
        newConducted = Math.min(s.totalClasses, s.conductedClasses + 1);
        newAttended = isPresent
          ? Math.min(newConducted, s.attendedClasses + 1)
          : Math.min(newConducted, s.attendedClasses);
      } else if (action === 'batch_delta') {
        const dc = Number(deltaConducted) || 0;
        const da = Number(deltaAttended) || 0;
        newConducted = Math.max(0, Math.min(s.totalClasses, s.conductedClasses + dc));
        newAttended = Math.max(0, Math.min(newConducted, s.attendedClasses + da));
      } else if (action === 'batch_exact') {
        if (exactTotal !== '' && Number(exactTotal) > 0) {
          newTotal = Number(exactTotal);
        }
        const c = exactConducted === '' ? s.conductedClasses : Number(exactConducted);
        const a = exactAttended === '' ? s.attendedClasses : Number(exactAttended);
        newConducted = Math.max(0, Math.min(newTotal, c));
        newAttended = Math.max(0, Math.min(newConducted, a));
      } else if (action === 'recovery_boost') {
        const required = Math.ceil(0.75 * s.conductedClasses);
        if (s.attendedClasses < required) {
          newAttended = Math.min(s.conductedClasses, required);
        }
      }

      const updatedSub: Subject = {
        ...s,
        totalClasses: newTotal,
        conductedClasses: newConducted,
        attendedClasses: newAttended,
        lastUpdatedBy: `Admin Update (${currentUser?.displayName || 'Admin'})`,
        updatedAt: Date.now(),
      };

      updatedSubjectsList.push(updatedSub);
      updates.push({
        subjectId: s.id,
        userId: s.userId,
        userName: s.userName,
        subjectName: s.name,
        conductedClasses: newConducted,
        attendedClasses: newAttended,
        totalClasses: newTotal !== s.totalClasses ? newTotal : undefined,
      });
    }

    try {
      let result: BatchAttendanceUpdateResult;

      if (isConfigured) {
        result = await batchUpdateSubjectsAttendanceInFirestore(
          updates,
          `Admin (${currentUser?.displayName || 'Admin'})`
        );
      } else {
        // Local mode fallback
        result = {
          totalTargeted: updates.length,
          updatedCount: updates.length,
          failedCount: 0,
          details: updates.map((u) => ({
            subjectId: u.subjectId,
            userId: u.userId,
            userName: u.userName,
            subjectName: u.subjectName,
            status: 'updated',
          })),
        };
      }

      // Propagate to local state in parent
      if (onUpdateSubjects) {
        onUpdateSubjects(updatedSubjectsList);
      }

      setLastResult(result);

      confetti({
        particleCount: 85,
        spread: 90,
        origin: { y: 0.6 },
        colors: ['#10b981', '#f43f5e', '#38bdf8', '#fbbf24', '#a855f7'],
      });

      // Refresh data from cloud
      await onRefreshData();
    } catch (err: any) {
      console.error('Batch attendance update failed:', err);
      alert(`Attendance update failed: ${err.message || 'Firestore database error'}`);
    } finally {
      setIsExecuting(false);
      setExecutionMessage(null);
    }
  };

  // Filter roster by search
  const filteredRoster = useMemo(() => {
    if (!rosterSearch.trim()) return enrolledSubjects;
    const q = rosterSearch.toLowerCase();
    return enrolledSubjects.filter((s) => {
      const name = (s.userName || '').toLowerCase();
      const subName = s.name.toLowerCase();
      const code = (s.code || '').toLowerCase();
      return name.includes(q) || subName.includes(q) || code.includes(q);
    });
  }, [enrolledSubjects, rosterSearch]);

  // Struggling students for Recovery Booster
  const strugglingStudents = useMemo(() => {
    return enrolledSubjects
      .map((s) => {
        const stats = calculateSubjectStats(s);
        const required = Math.ceil(0.75 * s.conductedClasses);
        const deficit = Math.max(0, required - s.attendedClasses);
        return {
          subject: s,
          stats,
          deficit,
        };
      })
      .filter((item) => item.stats.currentPercentage < 75 || item.deficit > 0);
  }, [enrolledSubjects]);

  return (
    <div className="space-y-6">
      {/* Course Selector & Live Overview Panel */}
      <div className="glass-panel rounded-3xl p-6 sm:p-7 border border-cherry-700/60 shadow-xl relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-cherry-950/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-cherry-700 via-cherry-600 to-rose-400 p-[1px] shadow-cherry-glow shrink-0">
              <div className="w-full h-full bg-dark-900 rounded-2xl flex items-center justify-center">
                <Zap className="w-5 h-5 text-cherry-400" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xl font-black text-white tracking-tight">
                  Update Everyone's Attendance at Once
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] uppercase font-black bg-emerald-950 text-emerald-300 border border-emerald-700/60 animate-pulse">
                  Batch Sync
                </span>
              </div>
              <p className="text-xs text-rose-300/70 mt-0.5">
                Conduct lectures, log live roll-call sessions, or adjust attendance numbers across all student accounts simultaneously.
              </p>
            </div>
          </div>

          {/* Quick Course Dropdown */}
          <div className="flex items-center gap-2 self-start md:self-center w-full md:w-auto">
            <label className="text-xs font-bold text-rose-200 shrink-0">Select Course:</label>
            <select
              value={selectedCourseName}
              onChange={(e) => setSelectedCourseName(e.target.value)}
              className="w-full md:w-64 px-3.5 py-2.5 rounded-xl bg-dark-950/90 border border-cherry-800 focus:border-cherry-500 text-xs font-bold text-white transition-all shadow-inner"
            >
              {distinctCourses.map((c) => (
                <option key={c.name} value={c.name}>
                  {c.name} {c.code ? `(${c.code})` : ''} • {c.count} students
                </option>
              ))}
              <option value="__ALL_COURSES__">
                🌐 ALL COURSES ACROSS CAMPUS ({allSubjects.length} total records)
              </option>
            </select>
          </div>
        </div>

        {/* Quick Select Chips */}
        {distinctCourses.length > 0 && (
          <div className="pt-4 flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
            <span className="text-[11px] font-bold text-rose-300/60 uppercase tracking-wider shrink-0 flex items-center gap-1">
              <BookOpen className="w-3.5 h-3.5 text-cherry-400" />
              <span>Active Courses:</span>
            </span>
            {distinctCourses.slice(0, 6).map((c) => (
              <button
                key={c.name}
                type="button"
                onClick={() => setSelectedCourseName(c.name)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 ${
                  selectedCourseName.trim().toLowerCase() === c.name.trim().toLowerCase()
                    ? 'bg-cherry-600 text-white shadow-cherry-glow border border-cherry-400/50'
                    : 'bg-dark-950/80 text-rose-200/70 hover:text-white hover:bg-cherry-950/60 border border-cherry-900/50'
                }`}
              >
                <span>{c.name}</span>
                <span className="px-1.5 py-0.2 rounded-md bg-dark-900/80 text-[10px] text-cherry-300">
                  {c.count}
                </span>
              </button>
            ))}
          </div>
        )}

        {/* Selected Course Overview Banner */}
        <div className="mt-4 p-4 rounded-2xl bg-dark-950/70 border border-cherry-900/50 grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div>
            <div className="text-[11px] font-bold text-rose-300/60 uppercase tracking-wider">
              Enrolled Students
            </div>
            <div className="text-xl font-black text-white flex items-center gap-1.5 mt-0.5">
              <Users className="w-4 h-4 text-cherry-400" />
              <span>{courseStats.count} students</span>
            </div>
          </div>

          <div>
            <div className="text-[11px] font-bold text-rose-300/60 uppercase tracking-wider">
              Course Average
            </div>
            <div className="text-xl font-black text-white flex items-center gap-1.5 mt-0.5">
              <Award className="w-4 h-4 text-emerald-400" />
              <span>{courseStats.avgPct.toFixed(1)}%</span>
            </div>
          </div>

          <div>
            <div className="text-[11px] font-bold text-rose-300/60 uppercase tracking-wider">
              Safe Zone (≥75%)
            </div>
            <div className="text-xl font-black text-emerald-400 flex items-center gap-1.5 mt-0.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>{courseStats.safe} students</span>
            </div>
          </div>

          <div>
            <div className="text-[11px] font-bold text-rose-300/60 uppercase tracking-wider">
              At Risk (&lt;75%)
            </div>
            <div className="text-xl font-black text-rose-400 flex items-center gap-1.5 mt-0.5">
              <AlertTriangle className="w-4 h-4 text-rose-400" />
              <span>{courseStats.borderline + courseStats.doomed} students</span>
            </div>
          </div>
        </div>
      </div>

      {/* Mode Navigation Tabs */}
      <div className="grid grid-cols-3 gap-2 p-1.5 rounded-2xl bg-dark-950/80 border border-cherry-900/60 backdrop-blur-md">
        <button
          type="button"
          onClick={() => setActiveMode('rollcall')}
          className={`py-3 px-3 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all ${
            activeMode === 'rollcall'
              ? 'bg-gradient-to-r from-cherry-600 via-cherry-500 to-rose-600 text-white shadow-cherry-glow'
              : 'text-rose-200/70 hover:text-white hover:bg-cherry-950/50'
          }`}
        >
          <Zap className="w-4 h-4" />
          <span>Daily Roll Call / Session</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveMode('batch')}
          className={`py-3 px-3 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all ${
            activeMode === 'batch'
              ? 'bg-gradient-to-r from-cherry-600 via-cherry-500 to-rose-600 text-white shadow-cherry-glow'
              : 'text-rose-200/70 hover:text-white hover:bg-cherry-950/50'
          }`}
        >
          <Sliders className="w-4 h-4" />
          <span>Batch Delta & Fixed Numbers</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveMode('recovery')}
          className={`py-3 px-3 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all ${
            activeMode === 'recovery'
              ? 'bg-gradient-to-r from-cherry-600 via-cherry-500 to-rose-600 text-white shadow-cherry-glow'
              : 'text-rose-200/70 hover:text-white hover:bg-cherry-950/50'
          }`}
        >
          <GraduationCap className="w-4 h-4" />
          <span>75% Recovery Booster</span>
          {strugglingStudents.length > 0 && (
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-rose-950 text-rose-300 border border-rose-800">
              {strugglingStudents.length}
            </span>
          )}
        </button>
      </div>

      {/* Execution Progress Banner */}
      {isExecuting && (
        <div className="p-4 rounded-2xl bg-cherry-950/80 border border-cherry-600/70 text-rose-200 text-xs sm:text-sm flex items-center gap-3 animate-pulse">
          <RefreshCw className="w-5 h-5 text-cherry-400 animate-spin shrink-0" />
          <div>
            <div className="font-bold text-white">Updating Cloud Database...</div>
            <div className="text-rose-300/80 text-xs">{executionMessage}</div>
          </div>
        </div>
      )}

      {/* Success / Result Feedback Banner */}
      {lastResult && (
        <div className="p-5 rounded-2xl bg-emerald-950/70 border border-emerald-600/70 text-emerald-100 text-xs sm:text-sm animate-fadeIn shadow-xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-emerald-600/30 border border-emerald-500/50 flex items-center justify-center text-emerald-300 shrink-0">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-white text-sm">
                  Successfully Updated Everyone's Attendance! 🎉
                </h4>
                <p className="text-emerald-300/80 text-xs">
                  Committed {lastResult.updatedCount} subject records in Cloud Firestore. All students will see their new attendance counts in real-time.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowResultDetails(!showResultDetails)}
              className="text-xs text-emerald-300 hover:text-white underline font-semibold flex items-center gap-1"
            >
              <span>{showResultDetails ? 'Hide Details' : 'View Audit Details'}</span>
              {showResultDetails ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          </div>

          {showResultDetails && (
            <div className="mt-4 pt-4 border-t border-emerald-900/60 max-h-48 overflow-y-auto space-y-1 pr-1 text-xs">
              {lastResult.details.map((d) => (
                <div
                  key={d.subjectId}
                  className="flex items-center justify-between p-2 rounded-lg bg-emerald-900/30 text-[11px]"
                >
                  <span className="font-semibold text-emerald-200">{d.userName || 'Student'}</span>
                  <span className="text-emerald-300/80">{d.subjectName}</span>
                  <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 font-bold">
                    ✓ Updated
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ======================================================== */}
      {/* MODE 1: DAILY CLASS ROLL CALL / LIVE SESSION LOG */}
      {/* ======================================================== */}
      {activeMode === 'rollcall' && (
        <div className="space-y-6 animate-fadeIn">
          {/* Quick 1-Click Mass Actions */}
          <div className="glass-panel rounded-3xl p-6 sm:p-7 border border-cherry-700/50 shadow-xl">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="w-4 h-4 text-cherry-400" />
              <h4 className="text-base font-bold text-white tracking-tight">
                Quick 1-Click Session Actions
              </h4>
            </div>
            <p className="text-xs text-rose-300/60 mb-5">
              Conducted a class today? Update every enrolled student with a single click.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Option 1: Mark ALL Present */}
              <button
                type="button"
                onClick={() => executeAttendanceUpdate('quick_all_present')}
                disabled={isExecuting || enrolledSubjects.length === 0}
                id="btn-mark-all-present"
                className="p-4 rounded-2xl bg-gradient-to-tr from-emerald-950/80 to-emerald-900/40 hover:from-emerald-900 hover:to-emerald-800/60 border border-emerald-600/50 hover:border-emerald-400 text-left transition-all active:scale-95 group shadow-lg disabled:opacity-50"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-emerald-900 text-emerald-300 border border-emerald-500/50">
                    +1 Attended • +1 Conducted
                  </span>
                  <Check className="w-4 h-4 text-emerald-400 group-hover:scale-125 transition-transform" />
                </div>
                <div className="font-black text-white text-sm group-hover:text-emerald-200 transition-colors">
                  🌟 Mark Everyone Present
                </div>
                <p className="text-[11px] text-emerald-300/70 mt-1">
                  Class held today. Every student was present. Increments both conducted and attended.
                </p>
              </button>

              {/* Option 2: Class Held / All Absent */}
              <button
                type="button"
                onClick={() => executeAttendanceUpdate('quick_all_absent')}
                disabled={isExecuting || enrolledSubjects.length === 0}
                id="btn-mark-all-absent"
                className="p-4 rounded-2xl bg-gradient-to-tr from-rose-950/80 to-rose-900/40 hover:from-rose-900 hover:to-rose-800/60 border border-rose-600/50 hover:border-rose-400 text-left transition-all active:scale-95 group shadow-lg disabled:opacity-50"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-rose-900 text-rose-300 border border-rose-500/50">
                    +0 Attended • +1 Conducted
                  </span>
                  <AlertTriangle className="w-4 h-4 text-rose-400 group-hover:scale-125 transition-transform" />
                </div>
                <div className="font-black text-white text-sm group-hover:text-rose-200 transition-colors">
                  ⚠️ Class Held / All Absent
                </div>
                <p className="text-[11px] text-rose-300/70 mt-1">
                  Class took place, but no student attended. Increments conducted only.
                </p>
              </button>

              {/* Option 3: Undo Last Class */}
              <button
                type="button"
                onClick={() => executeAttendanceUpdate('quick_undo_class')}
                disabled={isExecuting || enrolledSubjects.length === 0}
                id="btn-undo-last-class"
                className="p-4 rounded-2xl bg-gradient-to-tr from-dark-950 to-dark-900/60 hover:from-dark-900 hover:to-cherry-950/60 border border-cherry-900/60 hover:border-cherry-700 text-left transition-all active:scale-95 group shadow-lg disabled:opacity-50"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-dark-900 text-rose-300 border border-cherry-900">
                    -1 Attended • -1 Conducted
                  </span>
                  <RotateCcw className="w-4 h-4 text-cherry-400 group-hover:-rotate-45 transition-transform" />
                </div>
                <div className="font-black text-white text-sm group-hover:text-rose-200 transition-colors">
                  ↩️ Undo Last Class Session
                </div>
                <p className="text-[11px] text-rose-300/70 mt-1">
                  Mistakenly logged a session? Rolls back 1 class from all enrolled accounts.
                </p>
              </button>
            </div>
          </div>

          {/* Interactive Live Student Roll Call Roster */}
          <div className="glass-panel rounded-3xl p-6 sm:p-7 border border-cherry-700/50 shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-cherry-950/80 mb-5">
              <div>
                <h4 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                  <span>Interactive Class Roll Call Roster</span>
                  <span className="text-xs text-rose-300/60">
                    ({enrolledSubjects.length} enrolled)
                  </span>
                </h4>
                <p className="text-xs text-rose-300/60 mt-0.5">
                  Toggle individual students Present or Absent for today's session, then submit all at once.
                </p>
              </div>

              {/* Roster Search & Quick Batch Buttons */}
              <div className="flex items-center gap-2 flex-wrap">
                <div className="relative w-48">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-rose-300/40" />
                  <input
                    type="text"
                    value={rosterSearch}
                    onChange={(e) => setRosterSearch(e.target.value)}
                    placeholder="Filter student..."
                    className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-dark-950/80 border border-cherry-900/50 text-xs text-white placeholder-rose-300/40"
                  />
                </div>

                <button
                  type="button"
                  onClick={() => handleSetAllRollCall(true)}
                  className="px-2.5 py-1.5 rounded-xl bg-emerald-950 text-emerald-300 hover:bg-emerald-900 border border-emerald-800 text-xs font-bold transition-all"
                >
                  All Present
                </button>
                <button
                  type="button"
                  onClick={() => handleSetAllRollCall(false)}
                  className="px-2.5 py-1.5 rounded-xl bg-rose-950 text-rose-300 hover:bg-rose-900 border border-rose-800 text-xs font-bold transition-all"
                >
                  All Absent
                </button>
                <button
                  type="button"
                  onClick={handleInvertRollCall}
                  className="px-2.5 py-1.5 rounded-xl bg-dark-900 text-rose-300 hover:bg-dark-800 border border-cherry-900 text-xs font-bold transition-all"
                >
                  Invert
                </button>
              </div>
            </div>

            {/* Roster Live Counter Bar */}
            <div className="mb-4 p-3 rounded-2xl bg-dark-950/80 border border-cherry-950 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-4">
                <span className="font-bold text-white">Today's Roll Call Status:</span>
                <span className="text-emerald-400 font-bold flex items-center gap-1">
                  <Check className="w-3.5 h-3.5" />
                  <span>{rollCallStats.presentCount} Present (+1/+1)</span>
                </span>
                <span className="text-rose-400 font-bold flex items-center gap-1">
                  <X className="w-3.5 h-3.5" />
                  <span>{rollCallStats.absentCount} Absent (+0/+1)</span>
                </span>
              </div>

              <div className="text-[11px] text-rose-300/50">
                Click any student pill below to toggle their status.
              </div>
            </div>

            {/* Student Roll Call Grid */}
            <div className="max-h-96 overflow-y-auto space-y-2 pr-1">
              {filteredRoster.length === 0 ? (
                <div className="text-center py-8 text-rose-300/50 text-xs">
                  No enrolled students match your search filter.
                </div>
              ) : (
                filteredRoster.map((sub) => {
                  const isPresent = rollCallMap[sub.id] ?? true;
                  const currentStats = calculateSubjectStats(sub);

                  // Preview stats after this roll call
                  const nextC = sub.conductedClasses + 1;
                  const nextA = isPresent ? sub.attendedClasses + 1 : sub.attendedClasses;
                  const nextPct = nextC > 0 ? (nextA / nextC) * 100 : 100;

                  return (
                    <div
                      key={sub.id}
                      onClick={() => handleToggleRollCall(sub.id)}
                      className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-4 select-none ${
                        isPresent
                          ? 'bg-emerald-950/40 hover:bg-emerald-950/60 border-emerald-700/50 shadow-sm'
                          : 'bg-rose-950/40 hover:bg-rose-950/60 border-rose-700/50 shadow-sm'
                      }`}
                    >
                      {/* Left: Student Name & Email */}
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-xs text-white shrink-0 ${
                            isPresent
                              ? 'bg-gradient-to-tr from-emerald-700 to-teal-500'
                              : 'bg-gradient-to-tr from-rose-800 to-cherry-600'
                          }`}
                        >
                          {(sub.userName || 'S').charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div className="font-bold text-xs sm:text-sm text-white flex items-center gap-2 truncate">
                            <span>{sub.userName || 'Student'}</span>
                            {sub.userId === currentUser?.uid && (
                              <span className="px-1.5 py-0.2 rounded text-[10px] bg-cherry-950 text-cherry-300 border border-cherry-800">
                                You
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-rose-300/60 flex items-center gap-2">
                            <span>
                              Current: {sub.attendedClasses}/{sub.conductedClasses} (
                              {currentStats.currentPercentage.toFixed(1)}%)
                            </span>
                            <span>•</span>
                            <span
                              className={
                                isPresent ? 'text-emerald-300 font-semibold' : 'text-rose-300 font-semibold'
                              }
                            >
                              After: {nextA}/{nextC} ({nextPct.toFixed(1)}%)
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Right: Toggle Button */}
                      <div className="shrink-0 flex items-center gap-2">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleRollCall(sub.id);
                          }}
                          className={`px-3 py-1.5 rounded-xl font-black text-xs flex items-center gap-1.5 transition-all shadow-md active:scale-95 ${
                            isPresent
                              ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-glow'
                              : 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-glow'
                          }`}
                        >
                          {isPresent ? (
                            <>
                              <Check className="w-3.5 h-3.5 stroke-[3]" />
                              <span>PRESENT</span>
                            </>
                          ) : (
                            <>
                              <X className="w-3.5 h-3.5 stroke-[3]" />
                              <span>ABSENT</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Bottom Submit Button */}
            <div className="mt-5 pt-4 border-t border-cherry-950/80">
              <button
                type="button"
                onClick={() => executeAttendanceUpdate('roster_submit')}
                disabled={isExecuting || enrolledSubjects.length === 0}
                id="btn-submit-roll-call"
                className="w-full py-4 rounded-2xl bg-gradient-to-r from-cherry-600 via-cherry-500 to-rose-600 hover:from-cherry-500 hover:to-rose-500 text-white font-black text-sm sm:text-base shadow-cherry-glow hover:shadow-cherry-glow-lg transition-all flex items-center justify-center gap-2 active:scale-95 border border-cherry-400/40 disabled:opacity-50"
              >
                {isExecuting ? (
                  <>
                    <RefreshCw className="w-5 h-5 animate-spin" />
                    <span>Saving Roll Call to Cloud...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4 stroke-[2.5]" />
                    <span>
                      Apply Roll Call to All {enrolledSubjects.length} Students ({rollCallStats.presentCount} Present,{' '}
                      {rollCallStats.absentCount} Absent) 🚀
                    </span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODE 2: BATCH DELTA & EXACT NUMBERS */}
      {/* ======================================================== */}
      {activeMode === 'batch' && (
        <div className="glass-panel rounded-3xl p-6 sm:p-7 border border-cherry-700/50 shadow-xl space-y-6 animate-fadeIn">
          <div className="flex items-center justify-between pb-4 border-b border-cherry-950/80">
            <div>
              <h4 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                <Sliders className="w-4 h-4 text-cherry-400" />
                <span>Batch Numerical Adjuster</span>
              </h4>
              <p className="text-xs text-rose-300/60 mt-0.5">
                Apply custom delta offsets (+/-) or overwrite exact attendance numbers for all students taking this course.
              </p>
            </div>

            {/* Sub-mode toggle: Delta vs Exact */}
            <div className="flex items-center gap-1.5 p-1 rounded-xl bg-dark-950 border border-cherry-900/60">
              <button
                type="button"
                onClick={() => setBatchType('delta')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                  batchType === 'delta'
                    ? 'bg-cherry-600 text-white shadow-cherry-glow'
                    : 'text-rose-300/70 hover:text-white'
                }`}
              >
                Δ Offset (+/-)
              </button>
              <button
                type="button"
                onClick={() => setBatchType('exact')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                  batchType === 'exact'
                    ? 'bg-cherry-600 text-white shadow-cherry-glow'
                    : 'text-rose-300/70 hover:text-white'
                }`}
              >
                Set Exact Values
              </button>
            </div>
          </div>

          {/* DELTA OFFSET MODE */}
          {batchType === 'delta' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-rose-200 mb-1">
                    Δ Conducted Classes (C)
                  </label>
                  <input
                    type="number"
                    value={deltaConducted}
                    onChange={(e) => setDeltaConducted(Number(e.target.value))}
                    className="w-full px-4 py-3 rounded-xl bg-dark-950/80 border border-cherry-900/60 focus:border-cherry-500 text-base font-black text-white text-center"
                  />
                  <span className="text-[10px] text-rose-300/50 mt-1 block">
                    Use negative numbers (-1) to reduce conducted classes.
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-rose-200 mb-1">
                    Δ Attended Classes (A)
                  </label>
                  <input
                    type="number"
                    value={deltaAttended}
                    onChange={(e) => setDeltaAttended(Number(e.target.value))}
                    className="w-full px-4 py-3 rounded-xl bg-dark-950/80 border border-cherry-900/60 focus:border-cherry-500 text-base font-black text-white text-center"
                  />
                  <span className="text-[10px] text-rose-300/50 mt-1 block">
                    Use negative numbers (-1) to reduce attended classes.
                  </span>
                </div>
              </div>

              {/* Quick Delta Presets */}
              <div>
                <span className="text-[11px] font-bold text-rose-300/60 uppercase tracking-wider block mb-2">
                  Quick Delta Presets:
                </span>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setDeltaConducted(1);
                      setDeltaAttended(1);
                    }}
                    className="px-3 py-1.5 rounded-xl bg-dark-900/80 hover:bg-cherry-950 border border-cherry-900/50 text-xs font-bold text-rose-200"
                  >
                    +1 Att / +1 Cond (Regular Class)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setDeltaConducted(2);
                      setDeltaAttended(2);
                    }}
                    className="px-3 py-1.5 rounded-xl bg-dark-900/80 hover:bg-cherry-950 border border-cherry-900/50 text-xs font-bold text-rose-200"
                  >
                    +2 Att / +2 Cond (Double Lab)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setDeltaConducted(1);
                      setDeltaAttended(0);
                    }}
                    className="px-3 py-1.5 rounded-xl bg-dark-900/80 hover:bg-cherry-950 border border-cherry-900/50 text-xs font-bold text-rose-200"
                  >
                    +0 Att / +1 Cond (Unattended Class)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setDeltaConducted(0);
                      setDeltaAttended(1);
                    }}
                    className="px-3 py-1.5 rounded-xl bg-dark-900/80 hover:bg-cherry-950 border border-cherry-900/50 text-xs font-bold text-rose-200"
                  >
                    +1 Att / +0 Cond (Bonus Point)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setDeltaConducted(-1);
                      setDeltaAttended(-1);
                    }}
                    className="px-3 py-1.5 rounded-xl bg-dark-900/80 hover:bg-cherry-950 border border-cherry-900/50 text-xs font-bold text-rose-200"
                  >
                    -1 Att / -1 Cond (Rollback)
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* EXACT TARGET MODE */}
          {batchType === 'exact' && (
            <div className="space-y-4">
              <div className="p-3.5 rounded-2xl bg-amber-950/40 border border-amber-700/50 text-amber-200 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>
                  Exact mode overwrites the attendance numbers for ALL targeted students with these specific values.
                </span>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-rose-200 mb-1">
                    Set Conducted (C) *
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={exactConducted}
                    onChange={(e) => setExactConducted(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full px-3 py-2.5 rounded-xl bg-dark-950/80 border border-cherry-900/60 focus:border-cherry-500 text-sm font-bold text-white text-center"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-rose-200 mb-1">
                    Set Attended (A) *
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={exactAttended}
                    onChange={(e) => setExactAttended(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full px-3 py-2.5 rounded-xl bg-dark-950/80 border border-cherry-900/60 focus:border-cherry-500 text-sm font-bold text-white text-center"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-rose-200 mb-1">
                    Total Classes (T) <span className="text-rose-300/50 font-normal">(optional)</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    placeholder="Keep current"
                    value={exactTotal}
                    onChange={(e) => setExactTotal(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full px-3 py-2.5 rounded-xl bg-dark-950/80 border border-cherry-900/60 focus:border-cherry-500 text-sm font-bold text-white text-center"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Target Audience Scope Toggle */}
          <div className="p-4 rounded-2xl bg-dark-950/70 border border-cherry-950 space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-rose-200">Target Audience:</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setTargetScope('all')}
                  className={`px-3 py-1 rounded-lg font-bold text-xs transition-all ${
                    targetScope === 'all'
                      ? 'bg-cherry-600 text-white shadow-cherry-glow'
                      : 'bg-dark-900 text-rose-300'
                  }`}
                >
                  All Enrolled Students ({enrolledSubjects.length})
                </button>
                <button
                  type="button"
                  onClick={() => setTargetScope('selective')}
                  className={`px-3 py-1 rounded-lg font-bold text-xs transition-all ${
                    targetScope === 'selective'
                      ? 'bg-cherry-600 text-white shadow-cherry-glow'
                      : 'bg-dark-900 text-rose-300'
                  }`}
                >
                  Selective Students ({selectedStudentUids.size})
                </button>
              </div>
            </div>

            {targetScope === 'selective' && (
              <div className="mt-2 pt-2 border-t border-cherry-950 max-h-36 overflow-y-auto space-y-1.5 pr-1">
                {enrolledSubjects.map((s) => {
                  const uid = s.userId || s.id;
                  const isChecked = selectedStudentUids.has(uid);
                  return (
                    <label
                      key={s.id}
                      className="flex items-center justify-between p-2 rounded-xl bg-dark-900/80 text-xs cursor-pointer hover:bg-dark-900 text-rose-200"
                    >
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {
                            setSelectedStudentUids((prev) => {
                              const next = new Set(prev);
                              if (next.has(uid)) next.delete(uid);
                              else next.add(uid);
                              return next;
                            });
                          }}
                          className="rounded text-cherry-600 focus:ring-cherry-500 bg-dark-900 border-cherry-800"
                        />
                        <span className="font-bold text-white">{s.userName || 'Student'}</span>
                      </div>
                      <span className="text-[11px] text-rose-300/60">
                        {s.attendedClasses}/{s.conductedClasses}
                      </span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>

          {/* Submit Action */}
          <button
            type="button"
            onClick={() => executeAttendanceUpdate(batchType === 'delta' ? 'batch_delta' : 'batch_exact')}
            disabled={isExecuting || enrolledSubjects.length === 0}
            id="btn-apply-batch-adjustment"
            className="w-full py-4 rounded-2xl bg-gradient-to-r from-cherry-600 via-cherry-500 to-rose-600 hover:from-cherry-500 hover:to-rose-500 text-white font-black text-sm sm:text-base shadow-cherry-glow hover:shadow-cherry-glow-lg transition-all flex items-center justify-center gap-2 active:scale-95 border border-cherry-400/40 disabled:opacity-50"
          >
            {isExecuting ? (
              <>
                <RefreshCw className="w-5 h-5 animate-spin" />
                <span>Applying batch adjustment...</span>
              </>
            ) : (
              <>
                <Sliders className="w-4 h-4 stroke-[2.5]" />
                <span>
                  Apply {batchType === 'delta' ? 'Delta Offset' : 'Exact Values'} to All Enrolled Students (
                  {targetScope === 'all' ? enrolledSubjects.length : selectedStudentUids.size}) 🚀
                </span>
              </>
            )}
          </button>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODE 3: 75% ATTENDANCE RECOVERY BOOSTER */}
      {/* ======================================================== */}
      {activeMode === 'recovery' && (
        <div className="glass-panel rounded-3xl p-6 sm:p-7 border border-cherry-700/50 shadow-xl space-y-6 animate-fadeIn">
          <div className="flex items-center gap-3 pb-4 border-b border-cherry-950/80">
            <div className="w-10 h-10 rounded-2xl bg-amber-950 border border-amber-600/50 flex items-center justify-center text-amber-400 shrink-0">
              <GraduationCap className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-base font-bold text-white tracking-tight">
                75% Attendance Eligibility Booster
              </h4>
              <p className="text-xs text-rose-300/60 mt-0.5">
                Automatically calculate and grant extra attendance points to all students currently falling below the 75% threshold.
              </p>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-dark-950/80 border border-cherry-950 flex items-center justify-between">
            <div>
              <div className="font-bold text-sm text-white">
                {strugglingStudents.length === 0 ? (
                  <span className="text-emerald-400">🎉 Every student is already at or above 75%!</span>
                ) : (
                  <span>
                    Found <strong className="text-amber-400">{strugglingStudents.length}</strong> students
                    below the mandatory 75% attendance threshold.
                  </span>
                )}
              </div>
              <p className="text-xs text-rose-300/60 mt-0.5">
                Granting this bonus will adjust their attended classes count so their percentage reaches exactly 75.0%.
              </p>
            </div>

            <button
              type="button"
              onClick={() => executeAttendanceUpdate('recovery_boost')}
              disabled={isExecuting || strugglingStudents.length === 0}
              id="btn-apply-recovery-boost"
              className="px-5 py-3 rounded-2xl bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-white font-black text-xs sm:text-sm shadow-lg transition-all active:scale-95 disabled:opacity-50 flex items-center gap-2"
            >
              <TrendingUp className="w-4 h-4" />
              <span>Grant 75% Pass to All ({strugglingStudents.length})</span>
            </button>
          </div>

          {/* List of struggling students */}
          {strugglingStudents.length > 0 && (
            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {strugglingStudents.map(({ subject, stats, deficit }) => (
                <div
                  key={subject.id}
                  className="p-3.5 rounded-2xl bg-dark-950/60 border border-cherry-950 flex items-center justify-between gap-3 text-xs"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-amber-950 border border-amber-800/50 flex items-center justify-center font-bold text-amber-300">
                      {(subject.userName || 'S').charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="font-bold text-white">{subject.userName || 'Student'}</div>
                      <div className="text-[11px] text-rose-300/60">
                        Current: {subject.attendedClasses}/{subject.conductedClasses} (
                        {stats.currentPercentage.toFixed(1)}%) • Scenario: {stats.scenario}
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="px-2.5 py-1 rounded-xl bg-emerald-950 text-emerald-300 border border-emerald-800 font-bold text-xs inline-block">
                      +{deficit} attendance classes will be granted
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
