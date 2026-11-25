import React, { useState, useEffect, useMemo } from 'react';
import {
  Calendar,
  Clock,
  Link,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Users,
  Search,
  Check,
  X,
  FileSpreadsheet,
  Send,
  Sparkles,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import type { Subject, UserProfile, TimetableClass, DayOfWeek } from '../types/attendance';
import {
  fetchGoogleSheetCsv,
  parseCsv,
  extractTimetableForBatch,
  DEFAULT_LARRYPAGE_TIMETABLE,
  DAYS_OF_WEEK,
} from '../utils/googleSheetsParser';
import {
  batchUpdateSubjectsAttendanceInFirestore,
  type BatchAttendanceUpdateItem,
  cleanFirestoreData,
} from '../firebase/firestoreService';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { calculateSubjectStats } from '../utils/calculator';

interface TimetableAttendanceManagerProps {
  allUsers: UserProfile[];
  allSubjects: Subject[];
  isConfigured: boolean;
  currentUser: { uid: string; displayName?: string | null } | null;
  onUpdateSubjects?: (updatedSubjects: Subject[]) => void;
  onRefreshData: () => Promise<void>;
}

export const TimetableAttendanceManager: React.FC<TimetableAttendanceManagerProps> = ({
  allUsers,
  allSubjects,
  isConfigured,
  currentUser,
  onUpdateSubjects,
  onRefreshData,
}) => {
  // Current Day of Week
  const todayDayName: DayOfWeek = useMemo(() => {
    const dayNames: DayOfWeek[] = [
      'Sunday',
      'Monday',
      'Tuesday',
      'Wednesday',
      'Thursday',
      'Friday',
      'Saturday',
    ];
    return dayNames[new Date().getDay()] || 'Monday';
  }, []);

  // Today's Date String for tracking session logs (YYYY-MM-DD)
  const todayDateStr = useMemo(() => {
    return new Date().toISOString().split('T')[0];
  }, []);

  // Active Selected Day tab
  const [selectedDay, setSelectedDay] = useState<DayOfWeek | 'all'>(
    todayDayName === 'Sunday' ? 'Monday' : todayDayName
  );

  // Google Sheet Link State
  const [sheetUrl, setSheetUrl] = useState<string>(() => {
    try {
      return localStorage.getItem('chem_timetable_sheet_url') || '';
    } catch {
      return '';
    }
  });

  const [targetBatch, setTargetBatch] = useState<string>('Larry Page');

  // Timetable Classes State
  const [timetableClasses, setTimetableClasses] = useState<TimetableClass[]>(() => {
    try {
      const saved = localStorage.getItem('chem_timetable_classes');
      if (saved) return JSON.parse(saved);
    } catch {
      // fallback
    }
    return DEFAULT_LARRYPAGE_TIMETABLE;
  });

  // Track which class sessions were marked today: map of classId -> { date: string; presentCount: number }
  const [markedTodayMap, setMarkedTodayMap] = useState<
    Record<string, { date: string; presentCount: number; timestamp: number }>
  >(() => {
    try {
      const saved = localStorage.getItem('chem_timetable_marked_today');
      if (saved) return JSON.parse(saved);
    } catch {
      // fallback
    }
    return {};
  });

  // Fetching & Parsing State
  const [isFetchingSheet, setIsFetchingSheet] = useState(false);
  const [sheetFetchError, setSheetFetchError] = useState<string | null>(null);
  const [showDirectPasteModal, setShowDirectPasteModal] = useState(false);
  const [directPasteText, setDirectPasteText] = useState('');

  // Selected Class for Roll-Call Modal
  const [activeRollCallClass, setActiveRollCallClass] = useState<TimetableClass | null>(null);
  // Roll Call state: map of userUid -> isPresent (boolean)
  const [rosterAttendance, setRosterAttendance] = useState<Record<string, boolean>>({});
  const [rosterSearch, setRosterSearch] = useState('');

  // Execution state
  const [isLoggingAttendance, setIsLoggingAttendance] = useState(false);
  const [logProgressMessage, setLogProgressMessage] = useState<string | null>(null);
  const [lastLogSuccess, setLastLogSuccess] = useState<{
    className: string;
    presentCount: number;
    absentCount: number;
    totalUpdated: number;
  } | null>(null);

  // Save timetable to local storage on change
  useEffect(() => {
    try {
      localStorage.setItem('chem_timetable_classes', JSON.stringify(timetableClasses));
      if (sheetUrl) {
        localStorage.setItem('chem_timetable_sheet_url', sheetUrl);
      }
      localStorage.setItem('chem_timetable_marked_today', JSON.stringify(markedTodayMap));
    } catch {
      // ignore
    }
  }, [timetableClasses, sheetUrl, markedTodayMap]);

  // Filter classes for selected day
  const filteredClasses = useMemo(() => {
    if (selectedDay === 'all') return timetableClasses;
    return timetableClasses.filter((c) => c.day === selectedDay);
  }, [timetableClasses, selectedDay]);

  // Today's classes count
  const todayClassesCount = useMemo(() => {
    return timetableClasses.filter((c) => c.day === todayDayName).length;
  }, [timetableClasses, todayDayName]);

  // Helper to fetch and parse Google Sheet
  const handleFetchAndParseSheet = async (urlToFetch = sheetUrl) => {
    if (!urlToFetch.trim()) {
      alert('Please enter a Google Sheet URL first');
      return;
    }

    setIsFetchingSheet(true);
    setSheetFetchError(null);

    try {
      const csvText = await fetchGoogleSheetCsv(urlToFetch.trim());
      const matrix = parseCsv(csvText);
      const extracted = extractTimetableForBatch(matrix, targetBatch);

      if (extracted.length === 0) {
        throw new Error(`Could not find classes for batch "${targetBatch}" in this Google Sheet.`);
      }

      setTimetableClasses(extracted);
      setSheetUrl(urlToFetch.trim());

      confetti({
        particleCount: 70,
        spread: 80,
        origin: { y: 0.6 },
        colors: ['#38bdf8', '#10b981', '#f43f5e', '#a855f7'],
      });

      alert(
        `Successfully imported ${extracted.length} classes for batch "${targetBatch}" from Google Sheet!`
      );
    } catch (err: any) {
      console.error('Google Sheet fetch error:', err);
      setSheetFetchError(
        err.message ||
          'Failed to load Google Sheet. Please check the sharing settings or paste the sheet content directly.'
      );
    } finally {
      setIsFetchingSheet(false);
    }
  };

  // Helper to parse directly pasted CSV / TSV text
  const handleParseDirectPaste = () => {
    if (!directPasteText.trim()) return;

    try {
      const matrix = parseCsv(directPasteText);
      const extracted = extractTimetableForBatch(matrix, targetBatch);

      if (extracted.length === 0) {
        alert(`No classes matching batch "${targetBatch}" could be extracted.`);
        return;
      }

      setTimetableClasses(extracted);
      setShowDirectPasteModal(false);
      setDirectPasteText('');

      confetti({
        particleCount: 60,
        spread: 70,
        origin: { y: 0.6 },
      });

      alert(`Imported ${extracted.length} classes for "${targetBatch}"!`);
    } catch (err: any) {
      alert(`Parsing failed: ${err.message}`);
    }
  };

  // Open Roll Call Modal for a class
  const handleOpenRollCall = (c: TimetableClass) => {
    setActiveRollCallClass(c);
    // Default all users to Present
    const initialMap: Record<string, boolean> = {};
    allUsers.forEach((u) => {
      initialMap[u.uid] = true;
    });
    setRosterAttendance(initialMap);
  };

  // Toggle present/absent for user in active roll call
  const handleToggleUserAttendance = (uid: string) => {
    setRosterAttendance((prev) => ({
      ...prev,
      [uid]: !prev[uid],
    }));
  };

  const handleSetAllUsersAttendance = (isPresent: boolean) => {
    const next: Record<string, boolean> = {};
    allUsers.forEach((u) => {
      next[u.uid] = isPresent;
    });
    setRosterAttendance(next);
  };

  // Quick One-Click Attendance Logging (All Present or All Absent)
  const handleQuickLogClassAttendance = async (
    targetClass: TimetableClass,
    type: 'all_present' | 'all_absent'
  ) => {
    const attendanceMap: Record<string, boolean> = {};
    allUsers.forEach((u) => {
      attendanceMap[u.uid] = type === 'all_present';
    });
    await submitAttendanceForClass(targetClass, attendanceMap);
  };

  // Submit Attendance to Personal Dashboards of All Users
  const submitAttendanceForClass = async (
    cls: TimetableClass,
    attendanceByUser: Record<string, boolean>
  ) => {
    setIsLoggingAttendance(true);
    setLogProgressMessage(`Updating attendance for "${cls.subjectName}" across all students...`);
    setLastLogSuccess(null);

    const targetUsers = allUsers;
    const normalizedName = cls.subjectName.trim().toLowerCase();
    const normalizedCode = (cls.courseCode || '').trim().toLowerCase();

    const updates: BatchAttendanceUpdateItem[] = [];
    const updatedSubjectsList: Subject[] = [];
    let presentCount = 0;
    let absentCount = 0;

    for (const stu of targetUsers) {
      const isPresent = attendanceByUser[stu.uid] ?? true;
      if (isPresent) presentCount++;
      else absentCount++;

      // Find if this student already has this subject in allSubjects
      const existingSub = allSubjects.find((s) => {
        if (s.userId !== stu.uid) return false;
        const sameName = s.name.trim().toLowerCase() === normalizedName;
        const sameCode =
          normalizedCode && s.code && s.code.trim().toLowerCase() === normalizedCode;
        return sameName || sameCode;
      });

      if (existingSub) {
        // Increment existing subject
        const newConducted = Math.min(
          existingSub.totalClasses,
          existingSub.conductedClasses + 1
        );
        const newAttended = isPresent
          ? Math.min(newConducted, existingSub.attendedClasses + 1)
          : Math.min(newConducted, existingSub.attendedClasses);

        const updated: Subject = {
          ...existingSub,
          conductedClasses: newConducted,
          attendedClasses: newAttended,
          lastUpdatedBy: `Timetable Log (${currentUser?.displayName || 'Admin'})`,
          updatedAt: Date.now(),
        };

        updatedSubjectsList.push(updated);
        updates.push({
          subjectId: existingSub.id,
          userId: stu.uid,
          userName: stu.displayName,
          subjectName: existingSub.name,
          conductedClasses: newConducted,
          attendedClasses: newAttended,
        });
      } else {
        // Auto-create subject for this user so it appears on their personal dashboard
        const newSubId = `sub_${stu.uid}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
        const created: Subject = {
          id: newSubId,
          userId: stu.uid,
          userName: stu.displayName,
          name: cls.subjectName.trim(),
          code: cls.courseCode?.trim() || '',
          totalClasses: 50,
          conductedClasses: 1,
          attendedClasses: isPresent ? 1 : 0,
          lastUpdatedBy: `Timetable Log (${currentUser?.displayName || 'Admin'})`,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };

        updatedSubjectsList.push(created);

        // If Firestore connected, create the subject doc
        if (isConfigured && db) {
          try {
            const subjectRef = doc(db, 'subjects', newSubId);
            await setDoc(subjectRef, cleanFirestoreData(created), { merge: true });
          } catch (err) {
            console.warn(`Could not create subject for student ${stu.uid}:`, err);
          }
        }
      }
    }

    try {
      // 1. If existing subjects were updated, commit batch
      if (isConfigured && updates.length > 0) {
        await batchUpdateSubjectsAttendanceInFirestore(
          updates,
          `Timetable Roll Call (${currentUser?.displayName || 'Admin'})`
        );
      }

      // 2. Propagate to parent state
      if (onUpdateSubjects) {
        onUpdateSubjects(updatedSubjectsList);
      }

      // 3. Mark class as logged today
      setMarkedTodayMap((prev) => ({
        ...prev,
        [cls.id]: {
          date: todayDateStr,
          presentCount,
          timestamp: Date.now(),
        },
      }));

      // 4. Close modal and set feedback
      setActiveRollCallClass(null);
      setLastLogSuccess({
        className: cls.subjectName,
        presentCount,
        absentCount,
        totalUpdated: targetUsers.length,
      });

      confetti({
        particleCount: 80,
        spread: 90,
        origin: { y: 0.6 },
        colors: ['#10b981', '#f43f5e', '#38bdf8', '#fbbf24', '#a855f7'],
      });

      await onRefreshData();
    } catch (err: any) {
      console.error('Failed to log timetable attendance:', err);
      alert(`Attendance logging failed: ${err.message || 'Database write error'}`);
    } finally {
      setIsLoggingAttendance(false);
      setLogProgressMessage(null);
    }
  };

  // Filtered users for roll call modal
  const filteredModalUsers = useMemo(() => {
    if (!rosterSearch.trim()) return allUsers;
    const q = rosterSearch.toLowerCase();
    return allUsers.filter(
      (u) => u.displayName.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
    );
  }, [allUsers, rosterSearch]);

  return (
    <div className="space-y-6">
      {/* Google Sheets Timetable Header & Link Bar */}
      <div className="glass-panel rounded-3xl p-6 sm:p-7 border border-cherry-700/60 shadow-xl relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-cherry-950/80">
          <div className="flex items-start gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-sky-600 via-indigo-600 to-rose-400 p-[1px] shadow-lg shrink-0">
              <div className="w-full h-full bg-dark-900 rounded-2xl flex items-center justify-center">
                <FileSpreadsheet className="w-5 h-5 text-sky-400" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-xl font-black text-white tracking-tight flex items-center gap-2">
                  <span>Google Sheet Timetable & Daily Roll Call</span>
                  <span className="text-base">📅</span>
                </h3>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] uppercase font-black bg-sky-950 text-sky-300 border border-sky-700/60 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-pulse" />
                  <span>Batch: {targetBatch}</span>
                </span>
              </div>
              <p className="text-xs text-rose-300/70 mt-1 max-w-2xl leading-relaxed">
                Connect your college Google Sheet timetable. The app extracts all classes for{' '}
                <strong className="text-white font-bold">{targetBatch}</strong>, displays them on your
                dashboard, and lets you mark attendance for everyone in one click.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start md:self-center shrink-0">
            <button
              type="button"
              onClick={() => setShowDirectPasteModal(true)}
              className="px-3 py-2 rounded-xl bg-dark-900 hover:bg-dark-800 border border-cherry-900/60 text-xs font-bold text-rose-200 hover:text-white transition-all shadow-sm"
              title="Paste CSV or copied table text"
            >
              📋 Paste Sheet Data
            </button>
          </div>
        </div>

        {/* Google Sheet URL Input Row */}
        <div className="mt-4 flex flex-col sm:flex-row items-stretch gap-2.5">
          <div className="relative flex-1">
            <Link className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-rose-300/40" />
            <input
              type="url"
              value={sheetUrl}
              onChange={(e) => setSheetUrl(e.target.value)}
              placeholder="Paste Google Sheet URL (e.g. https://docs.google.com/spreadsheets/d/...)"
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-dark-950/90 border border-cherry-900/70 focus:border-sky-500 text-xs sm:text-sm text-white placeholder-rose-300/30 transition-all font-mono shadow-inner"
            />
          </div>

          <div className="flex items-center gap-2">
            <div className="w-36 shrink-0">
              <input
                type="text"
                value={targetBatch}
                onChange={(e) => setTargetBatch(e.target.value)}
                placeholder="Batch name"
                title="Batch name to filter from timetable"
                className="w-full px-3 py-2.5 rounded-xl bg-dark-950/90 border border-cherry-900/70 focus:border-sky-500 text-xs font-bold text-white text-center"
              />
            </div>

            <button
              type="button"
              onClick={() => handleFetchAndParseSheet()}
              disabled={isFetchingSheet || !sheetUrl.trim()}
              id="btn-fetch-google-sheet"
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-sky-600 via-sky-500 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 text-white font-bold text-xs sm:text-sm shadow-md transition-all active:scale-95 disabled:opacity-50 flex items-center gap-1.5 shrink-0"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isFetchingSheet ? 'animate-spin' : ''}`} />
              <span>{isFetchingSheet ? 'Fetching...' : 'Fetch & Sync Timetable'}</span>
            </button>
          </div>
        </div>

        {sheetFetchError && (
          <div className="mt-3 p-3 rounded-xl bg-amber-950/50 border border-amber-600/50 text-amber-200 text-xs flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
              <span>{sheetFetchError}</span>
            </div>
            <button
              type="button"
              onClick={() => setShowDirectPasteModal(true)}
              className="text-xs underline font-bold hover:text-white"
            >
              Paste Copied Table Instead
            </button>
          </div>
        )}
      </div>

      {/* Attendance Logging Progress Banner */}
      {isLoggingAttendance && (
        <div className="p-4 rounded-2xl bg-sky-950/80 border border-sky-600/70 text-sky-200 text-xs sm:text-sm flex items-center gap-3 animate-pulse">
          <RefreshCw className="w-5 h-5 text-sky-400 animate-spin shrink-0" />
          <div>
            <div className="font-bold text-white">Updating Student Personal Dashboards...</div>
            <div className="text-sky-300/80 text-xs">{logProgressMessage}</div>
          </div>
        </div>
      )}

      {/* Days of Week Navigation Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
        {/* Today Quick Tab */}
        <button
          type="button"
          onClick={() => setSelectedDay(todayDayName === 'Sunday' ? 'Monday' : todayDayName)}
          className={`px-4 py-2.5 rounded-2xl font-black text-xs sm:text-sm flex items-center gap-2 transition-all shrink-0 ${
            selectedDay === todayDayName
              ? 'bg-gradient-to-r from-cherry-600 via-cherry-500 to-rose-600 text-white shadow-cherry-glow border border-cherry-400/50'
              : 'bg-dark-950/80 text-rose-200/70 hover:text-white hover:bg-cherry-950/60 border border-cherry-900/50'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5 text-cherry-300" />
          <span>🌟 Today ({todayDayName})</span>
          <span className="px-1.5 py-0.2 rounded-md bg-dark-900/80 text-[10px] text-cherry-300">
            {todayClassesCount} classes
          </span>
        </button>

        {DAYS_OF_WEEK.map((day) => {
          const count = timetableClasses.filter((c) => c.day === day).length;
          const isToday = day === todayDayName;
          const isSelected = selectedDay === day;

          return (
            <button
              key={day}
              type="button"
              onClick={() => setSelectedDay(day)}
              className={`px-3.5 py-2.5 rounded-2xl font-bold text-xs transition-all shrink-0 flex items-center gap-1.5 ${
                isSelected
                  ? 'bg-cherry-600 text-white shadow-cherry-glow border border-cherry-400/50'
                  : 'bg-dark-950/80 text-rose-200/70 hover:text-white hover:bg-cherry-950/60 border border-cherry-900/50'
              }`}
            >
              <span>{day}</span>
              {isToday && (
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              )}
              <span className="px-1.5 py-0.2 rounded-md bg-dark-900/80 text-[10px] text-rose-300/80">
                {count}
              </span>
            </button>
          );
        })}

        <button
          type="button"
          onClick={() => setSelectedDay('all')}
          className={`px-3.5 py-2.5 rounded-2xl font-bold text-xs transition-all shrink-0 flex items-center gap-1.5 ${
            selectedDay === 'all'
              ? 'bg-cherry-600 text-white shadow-cherry-glow border border-cherry-400/50'
              : 'bg-dark-950/80 text-rose-200/70 hover:text-white hover:bg-cherry-950/60 border border-cherry-900/50'
          }`}
        >
          <span>All Days</span>
          <span className="px-1.5 py-0.2 rounded-md bg-dark-900/80 text-[10px] text-rose-300/80">
            {timetableClasses.length}
          </span>
        </button>
      </div>

      {/* Attendance Log Feedback Banner */}
      {lastLogSuccess && (
        <div className="p-4 rounded-2xl bg-emerald-950/80 border border-emerald-600/70 text-emerald-100 text-xs sm:text-sm animate-fadeIn shadow-xl flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-emerald-600/30 border border-emerald-500/50 flex items-center justify-center text-emerald-300 shrink-0">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <div className="font-bold text-white text-sm">
                Attendance Successfully Logged for "{lastLogSuccess.className}"! 🚀
              </div>
              <div className="text-emerald-300/80 text-xs">
                Updated personal dashboards of all {lastLogSuccess.totalUpdated} students (
                {lastLogSuccess.presentCount} Present, {lastLogSuccess.absentCount} Absent).
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setLastLogSuccess(null)}
            className="text-xs text-emerald-300 hover:text-white underline font-bold"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Classes Grid for the Selected Day */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-cherry-400" />
            <h4 className="text-base font-bold text-white tracking-tight">
              {selectedDay === 'all' ? 'All Scheduled Classes' : `${selectedDay}'s Class Schedule`}
            </h4>
            <span className="text-xs text-rose-300/60 font-mono">
              ({filteredClasses.length} classes for {targetBatch})
            </span>
          </div>

          <span className="text-[11px] text-rose-300/60">
            Targeting all {allUsers.length} students in {targetBatch}
          </span>
        </div>

        {filteredClasses.length === 0 ? (
          <div className="glass-panel rounded-3xl p-8 text-center border border-cherry-900/50 text-rose-300/60 text-xs sm:text-sm">
            <p>No classes scheduled for {selectedDay} for batch "{targetBatch}".</p>
            <p className="mt-1 text-xs text-rose-300/40">
              Select another day tab above or click "Fetch & Sync Timetable" to update.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredClasses.map((cls) => {
              const markedInfo = markedTodayMap[cls.id];
              const isMarkedToday = markedInfo && markedInfo.date === todayDateStr;

              return (
                <div
                  key={cls.id}
                  className={`glass-panel rounded-3xl p-5 border transition-all flex flex-col justify-between gap-4 relative overflow-hidden shadow-lg ${
                    isMarkedToday
                      ? 'border-emerald-700/60 bg-gradient-to-br from-emerald-950/30 to-dark-950/80'
                      : 'border-cherry-900/50 hover:border-cherry-700/60 bg-dark-950/70'
                  }`}
                >
                  <div>
                    {/* Top row: Day + Time + Mark Badge */}
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-sky-300">
                        <Clock className="w-3.5 h-3.5 text-sky-400" />
                        <span>{cls.timeSlot}</span>
                        {selectedDay === 'all' && (
                          <span className="text-rose-300/50">• {cls.day}</span>
                        )}
                      </div>

                      {isMarkedToday ? (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-emerald-950 text-emerald-300 border border-emerald-700 flex items-center gap-1">
                          <Check className="w-3 h-3 stroke-[3]" />
                          <span>Logged Today ({markedInfo.presentCount} Present)</span>
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-dark-900 text-rose-300/60 border border-cherry-950">
                          Pending Session
                        </span>
                      )}
                    </div>

                    {/* Subject Title & Code */}
                    <div className="flex items-baseline justify-between gap-2">
                      <h5 className="text-base font-black text-white tracking-tight">
                        {cls.subjectName}
                      </h5>
                      {cls.courseCode && (
                        <span className="px-2 py-0.5 rounded-md bg-dark-900 border border-cherry-900 font-mono text-[11px] font-bold text-cherry-300 shrink-0">
                          {cls.courseCode}
                        </span>
                      )}
                    </div>

                    {/* Venue & Faculty Details */}
                    <div className="flex items-center gap-3 mt-1.5 text-xs text-rose-300/60">
                      {cls.room && <span>📍 {cls.room}</span>}
                      {cls.instructor && <span>👨‍🏫 {cls.instructor}</span>}
                      <span>👥 Batch: {cls.batch}</span>
                    </div>
                  </div>

                  {/* Action Buttons Row */}
                  <div className="pt-3 border-t border-cherry-950/80 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleQuickLogClassAttendance(cls, 'all_present')}
                      disabled={isLoggingAttendance}
                      className="flex-1 py-2 px-3 rounded-xl bg-emerald-950 hover:bg-emerald-900 text-emerald-300 hover:text-white border border-emerald-800/60 font-bold text-xs flex items-center justify-center gap-1.5 transition-all active:scale-95 shadow-sm disabled:opacity-50"
                      title="Conduct 1 class and mark all students present"
                    >
                      <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                      <span>All Present (+1/+1)</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleQuickLogClassAttendance(cls, 'all_absent')}
                      disabled={isLoggingAttendance}
                      className="py-2 px-3 rounded-xl bg-rose-950/80 hover:bg-rose-900 text-rose-300 hover:text-white border border-rose-900/60 font-bold text-xs flex items-center justify-center gap-1.5 transition-all active:scale-95 shadow-sm disabled:opacity-50"
                      title="Class held, but no one was present"
                    >
                      <X className="w-3.5 h-3.5 stroke-[2.5]" />
                      <span>All Absent (+0/+1)</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleOpenRollCall(cls)}
                      disabled={isLoggingAttendance}
                      className="py-2 px-3 rounded-xl bg-dark-900 hover:bg-cherry-950 text-rose-200 hover:text-white border border-cherry-900 font-bold text-xs flex items-center justify-center gap-1.5 transition-all active:scale-95 shadow-sm"
                      title="Select individual present/absent students"
                    >
                      <Users className="w-3.5 h-3.5 text-cherry-400" />
                      <span>Roll Call (Roster)</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ========================================================== */}
      {/* MODAL: INTERACTIVE STUDENT ROLL CALL FOR A TIMETABLE CLASS */}
      {/* ========================================================== */}
      {activeRollCallClass && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-dark-950/85 backdrop-blur-md animate-fadeIn">
          <div className="glass-panel rounded-3xl p-6 sm:p-7 border border-cherry-700/70 shadow-2xl max-w-2xl w-full relative max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-start justify-between pb-4 border-b border-cherry-950/80 shrink-0">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-sky-950 text-sky-300 border border-sky-800">
                    {activeRollCallClass.day} • {activeRollCallClass.timeSlot}
                  </span>
                  {activeRollCallClass.courseCode && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-dark-900 text-cherry-300 border border-cherry-900">
                      {activeRollCallClass.courseCode}
                    </span>
                  )}
                </div>
                <h4 className="text-xl font-black text-white tracking-tight">
                  Take Roll Call: {activeRollCallClass.subjectName}
                </h4>
                <p className="text-xs text-rose-300/60 mt-0.5">
                  Mark individual students Present or Absent. Once submitted, each student's personal dashboard will be updated immediately.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setActiveRollCallClass(null)}
                className="p-1.5 rounded-xl text-rose-300/60 hover:text-white hover:bg-cherry-950 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Roster Controls: Search & Batch Buttons */}
            <div className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-rose-300/40" />
                <input
                  type="text"
                  value={rosterSearch}
                  onChange={(e) => setRosterSearch(e.target.value)}
                  placeholder="Search students..."
                  className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-dark-950/80 border border-cherry-900/50 text-xs text-white placeholder-rose-300/40"
                />
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => handleSetAllUsersAttendance(true)}
                  className="px-2.5 py-1.5 rounded-xl bg-emerald-950 text-emerald-300 hover:bg-emerald-900 border border-emerald-800 text-xs font-bold transition-all"
                >
                  All Present
                </button>
                <button
                  type="button"
                  onClick={() => handleSetAllUsersAttendance(false)}
                  className="px-2.5 py-1.5 rounded-xl bg-rose-950 text-rose-300 hover:bg-rose-900 border border-rose-800 text-xs font-bold transition-all"
                >
                  All Absent
                </button>
              </div>
            </div>

            {/* Student Roster List */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1 my-2">
              {filteredModalUsers.map((stu) => {
                const isPresent = rosterAttendance[stu.uid] ?? true;

                // Find student's current subject stats if they already have it
                const existingSub = allSubjects.find(
                  (s) =>
                    s.userId === stu.uid &&
                    (s.name.trim().toLowerCase() ===
                      activeRollCallClass.subjectName.trim().toLowerCase() ||
                      (activeRollCallClass.courseCode &&
                        s.code &&
                        s.code.trim().toLowerCase() ===
                          activeRollCallClass.courseCode.trim().toLowerCase()))
                );

                const currentStats = existingSub ? calculateSubjectStats(existingSub) : null;
                const nextC = existingSub ? existingSub.conductedClasses + 1 : 1;
                const nextA = existingSub
                  ? isPresent
                    ? existingSub.attendedClasses + 1
                    : existingSub.attendedClasses
                  : isPresent
                  ? 1
                  : 0;
                const nextPct = nextC > 0 ? (nextA / nextC) * 100 : 100;

                return (
                  <div
                    key={stu.uid}
                    onClick={() => handleToggleUserAttendance(stu.uid)}
                    className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 select-none ${
                      isPresent
                        ? 'bg-emerald-950/40 hover:bg-emerald-950/60 border-emerald-700/50'
                        : 'bg-rose-950/40 hover:bg-rose-950/60 border-rose-700/50'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-xs text-white shrink-0 ${
                          isPresent
                            ? 'bg-gradient-to-tr from-emerald-700 to-teal-500'
                            : 'bg-gradient-to-tr from-rose-800 to-cherry-600'
                        }`}
                      >
                        {stu.displayName.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="font-bold text-xs sm:text-sm text-white truncate flex items-center gap-2">
                          <span>{stu.displayName}</span>
                          {stu.uid === currentUser?.uid && (
                            <span className="px-1.5 py-0.2 rounded text-[10px] bg-cherry-950 text-cherry-300 border border-cherry-800">
                              You
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-rose-300/60">
                          {existingSub ? (
                            <>
                              Current: {existingSub.attendedClasses}/{existingSub.conductedClasses} (
                              {currentStats?.currentPercentage.toFixed(0)}%) • Next:{' '}
                              <strong className={isPresent ? 'text-emerald-300' : 'text-rose-300'}>
                                {nextA}/{nextC} ({nextPct.toFixed(0)}%)
                              </strong>
                            </>
                          ) : (
                            <span className="text-sky-300">New course enrollment on dashboard</span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="shrink-0">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleUserAttendance(stu.uid);
                        }}
                        className={`px-3 py-1.5 rounded-xl font-black text-xs flex items-center gap-1.5 transition-all shadow-md ${
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
              })}
            </div>

            {/* Modal Bottom Actions */}
            <div className="pt-3 border-t border-cherry-950/80 flex items-center gap-3 shrink-0">
              <button
                type="button"
                onClick={() => setActiveRollCallClass(null)}
                className="px-4 py-3 rounded-2xl bg-dark-900 hover:bg-dark-800 border border-cherry-900 text-rose-300 hover:text-white font-bold text-xs sm:text-sm"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={() => submitAttendanceForClass(activeRollCallClass, rosterAttendance)}
                disabled={isLoggingAttendance}
                className="flex-1 py-3 rounded-2xl bg-gradient-to-r from-cherry-600 via-cherry-500 to-rose-600 hover:from-cherry-500 hover:to-rose-500 text-white font-black text-xs sm:text-sm shadow-cherry-glow transition-all flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50"
              >
                {isLoggingAttendance ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Updating Personal Dashboards...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4 stroke-[2.5]" />
                    <span>Apply Attendance to Every Student's Dashboard 🚀</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================== */}
      {/* MODAL: DIRECT PASTE / MANUAL TSV CSV PASTE */}
      {/* ========================================================== */}
      {showDirectPasteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-dark-950/85 backdrop-blur-md animate-fadeIn">
          <div className="glass-panel rounded-3xl p-6 sm:p-7 border border-cherry-700/70 shadow-2xl max-w-lg w-full relative">
            <div className="flex items-center justify-between pb-3 border-b border-cherry-950/80 mb-4">
              <div>
                <h4 className="font-bold text-white text-base">Paste Timetable from Google Sheets</h4>
                <p className="text-xs text-rose-300/60">
                  Select the timetable in Google Sheets, copy it (Ctrl+C), and paste it directly here.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowDirectPasteModal(false)}
                className="p-1.5 rounded-xl text-rose-300/60 hover:text-white hover:bg-cherry-950"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4">
              <textarea
                value={directPasteText}
                onChange={(e) => setDirectPasteText(e.target.value)}
                placeholder="Paste copied cells from Google Sheets (or CSV / TSV text) here..."
                rows={8}
                className="w-full px-3.5 py-2.5 rounded-2xl bg-dark-950/90 border border-cherry-900/60 focus:border-sky-500 text-xs font-mono text-white placeholder-rose-300/30"
              />

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setShowDirectPasteModal(false)}
                  className="flex-1 py-2.5 rounded-xl bg-dark-900 text-rose-300 hover:text-white border border-cherry-900 text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleParseDirectPaste}
                  disabled={!directPasteText.trim()}
                  className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 text-white font-bold text-xs shadow-md disabled:opacity-50"
                >
                  Import Classes for {targetBatch}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
