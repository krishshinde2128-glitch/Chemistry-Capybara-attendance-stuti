import React, { useState, useEffect, useMemo } from 'react';
import {
  ShieldCheck,
  Lock,
  Trash2,
  Users,
  BookOpen,
  Sparkles,
  RefreshCw,
  Search,
  CheckCircle2,
  AlertTriangle,
  Send,
  Package,
  Layers,
  ChevronDown,
  ChevronUp,
  Award,
  Zap,
  Calendar,
  Edit2,
  X,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import type { Subject, UserProfile, PeerUserWithSubjects } from '../types/attendance';
import {
  getAllUsersAndSubjectsForAdmin,
  broadcastClassToUsers,
  removeClassFromAllUsers,
  deleteSubjectFromFirestore,
  updateSingleSubjectAttendanceInFirestore,
  type BroadcastClassPayload,
  type BroadcastResult,
} from '../firebase/firestoreService';
import { calculateOverallSummary, calculateSubjectStats } from '../utils/calculator';
import { useAuth } from '../firebase/AuthContext';
import { MassAttendanceUpdater } from './MassAttendanceUpdater';
import { TimetableAttendanceManager } from './TimetableAttendanceManager';

interface AdminViewProps {
  isUnlocked: boolean;
  onLock: () => void;
  onUnlockRequest: () => void;
  peers: PeerUserWithSubjects[];
  currentLocalSubjects: Subject[];
  onAddLocalSubject: (subject: Subject) => void;
  onDeleteLocalSubject: (id: string) => void;
  onUpdateSubjects?: (updatedSubjects: Subject[]) => void;
}

// Preset course templates
const PRESET_SUBJECTS = [
  { name: 'Organic Chemistry II', code: 'CH-202', total: 50, conducted: 14, attended: 12 },
  { name: 'Physical Chemistry', code: 'CH-201', total: 45, conducted: 12, attended: 11 },
  { name: 'Inorganic Chemistry & Coordination', code: 'CH-203', total: 40, conducted: 10, attended: 9 },
  { name: 'Analytical Spectroscopy Lab', code: 'CH-204L', total: 30, conducted: 8, attended: 8 },
  { name: 'Engineering Mathematics III', code: 'MATH-301', total: 55, conducted: 16, attended: 14 },
  { name: 'Thermodynamics & Heat Transfer', code: 'ME-205', total: 45, conducted: 12, attended: 10 },
  { name: 'Data Structures & Algorithms', code: 'CS-201', total: 48, conducted: 14, attended: 13 },
  { name: 'Chemical Reaction Engineering', code: 'CH-305', total: 42, conducted: 11, attended: 10 },
];

const SEMESTER_PACKAGES = [
  {
    title: '🧪 Chemistry Core Honors Pack',
    description: '4 essential semester subjects with realistic conduct/attendance baselines.',
    subjects: [
      { name: 'Organic Chemistry II', code: 'CH-202', totalClasses: 50, conductedClasses: 12, attendedClasses: 11 },
      { name: 'Physical Chemistry', code: 'CH-201', totalClasses: 45, conductedClasses: 10, attendedClasses: 9 },
      { name: 'Inorganic Chemistry', code: 'CH-203', totalClasses: 40, conductedClasses: 8, attendedClasses: 7 },
      { name: 'Analytical Lab Practice', code: 'CH-204L', totalClasses: 30, conductedClasses: 6, attendedClasses: 6 },
    ],
  },
  {
    title: '💻 Computer Science Core Pack',
    description: 'Foundation syllabus for computer science & engineering cohorts.',
    subjects: [
      { name: 'Data Structures & Algorithms', code: 'CS-201', totalClasses: 48, conductedClasses: 14, attendedClasses: 12 },
      { name: 'Operating Systems & Kernels', code: 'CS-202', totalClasses: 45, conductedClasses: 12, attendedClasses: 10 },
      { name: 'Database Management Systems', code: 'CS-203', totalClasses: 42, conductedClasses: 10, attendedClasses: 9 },
      { name: 'Discrete Mathematics', code: 'MATH-202', totalClasses: 40, conductedClasses: 10, attendedClasses: 8 },
    ],
  },
];

// Fallback demo users if no cloud users are registered yet
const DEMO_STUDENTS: UserProfile[] = [
  {
    uid: 'demo_user_1',
    displayName: 'Aarav Patel',
    email: 'aarav.chem@campus.edu',
    isPrivate: false,
    updatedAt: Date.now(),
  },
  {
    uid: 'demo_user_2',
    displayName: 'Priya Sharma',
    email: 'priya.s@campus.edu',
    isPrivate: false,
    updatedAt: Date.now(),
  },
  {
    uid: 'demo_user_3',
    displayName: 'Marie Curie 🦫',
    email: 'marie.curie@radium.edu',
    isPrivate: false,
    updatedAt: Date.now(),
  },
  {
    uid: 'demo_user_4',
    displayName: 'Rohan Verma',
    email: 'rohan.v@campus.edu',
    isPrivate: false,
    updatedAt: Date.now(),
  },
];

export const AdminView: React.FC<AdminViewProps> = ({
  isUnlocked,
  onLock,
  onUnlockRequest,
  peers,
  currentLocalSubjects,
  onAddLocalSubject,
  onDeleteLocalSubject,
  onUpdateSubjects,
}) => {
  const { user, isConfigured } = useAuth();

  // Admin space active section: 'timetable' | 'mass-attendance' | 'broadcast' | 'directory'
  const [adminSection, setAdminSection] = useState<'timetable' | 'mass-attendance' | 'broadcast' | 'directory'>('timetable');

  // Single-subject inline edit state in directory inspector
  const [editingSubjectData, setEditingSubjectData] = useState<{
    subject: Subject;
    studentName: string;
    total: number;
    conducted: number;
    attended: number;
  } | null>(null);

  // Firestore admin state
  const [dbUsers, setDbUsers] = useState<UserProfile[]>([]);
  const [dbSubjects, setDbSubjects] = useState<Subject[]>([]);
  const [isLoadingDb, setIsLoadingDb] = useState(false);
  const [dbError, setDbError] = useState<string | null>(null);

  // Form State for Broadcast Class
  const [subjectName, setSubjectName] = useState('');
  const [courseCode, setCourseCode] = useState('');
  const [totalClasses, setTotalClasses] = useState<number | ''>(50);
  const [conductedClasses, setConductedClasses] = useState<number | ''>(10);
  const [attendedClasses, setAttendedClasses] = useState<number | ''>(10);
  const [skipDuplicates, setSkipDuplicates] = useState(true);
  const [includeMe, setIncludeMe] = useState(true);

  // Target audience selection
  const [targetMode, setTargetMode] = useState<'all' | 'custom'>('all');
  const [selectedUserUids, setSelectedUserUids] = useState<Set<string>>(new Set());

  // Broadcast execution state
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [broadcastProgress, setBroadcastProgress] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<BroadcastResult | null>(null);

  // Student directory search & expand state
  const [directorySearch, setDirectorySearch] = useState('');
  const [expandedUserUid, setExpandedUserUid] = useState<string | null>(null);

  // Global class deletion state
  const [isDeletingGlobal, setIsDeletingGlobal] = useState<string | null>(null);

  // Refresh admin data from Firestore
  const fetchAdminData = async () => {
    if (!isConfigured) return;
    setIsLoadingDb(true);
    setDbError(null);
    try {
      const data = await getAllUsersAndSubjectsForAdmin();
      setDbUsers(data.users);
      setDbSubjects(data.allSubjects);
    } catch (err: any) {
      console.warn('Admin fetch notice:', err);
      setDbError(err.message || 'Could not fetch cloud users. Showing available directory.');
    } finally {
      setIsLoadingDb(false);
    }
  };

  useEffect(() => {
    if (isUnlocked && isConfigured) {
      fetchAdminData();
    }
  }, [isUnlocked, isConfigured]);

  // Combined users list: cloud users + community peers + fallback demos if empty
  const allSystemUsers = useMemo(() => {
    const map = new Map<string, UserProfile>();

    // 1. Current logged in user
    if (user) {
      map.set(user.uid, {
        uid: user.uid,
        displayName: user.displayName || user.email?.split('@')[0] || 'Admin (You)',
        email: user.email || '',
        isPrivate: false,
        updatedAt: Date.now(),
      });
    }

    // 2. Add users from Firestore admin fetch
    dbUsers.forEach((u) => map.set(u.uid, u));

    // 3. Add users from peer community
    peers.forEach((p) => {
      if (!map.has(p.user.uid)) {
        map.set(p.user.uid, p.user);
      }
    });

    // 4. If list is very small or offline, provide demo classmates so admin can test
    if (map.size <= 1) {
      DEMO_STUDENTS.forEach((demo) => {
        if (!map.has(demo.uid)) {
          map.set(demo.uid, demo);
        }
      });
    }

    return Array.from(map.values());
  }, [user, dbUsers, peers]);

  // Combined subjects list
  const allSystemSubjects = useMemo(() => {
    const list = [...dbSubjects];
    // Add current local subjects if not already in list
    currentLocalSubjects.forEach((local) => {
      if (!list.some((s) => s.id === local.id)) {
        list.push({
          ...local,
          userId: user?.uid || 'local_admin',
          userName: user?.displayName || 'Admin (You)',
        });
      }
    });
    return list;
  }, [dbSubjects, currentLocalSubjects, user]);

  // Initialize selected users with all users when user list changes
  useEffect(() => {
    if (targetMode === 'all') {
      setSelectedUserUids(new Set(allSystemUsers.map((u) => u.uid)));
    }
  }, [allSystemUsers, targetMode]);

  // Distinct global class catalog (unique subjects across all users)
  const distinctGlobalClasses = useMemo(() => {
    const grouped = new Map<string, { name: string; code?: string; count: number; userIds: string[] }>();
    allSystemSubjects.forEach((s) => {
      const key = s.name.trim().toLowerCase();
      const existing = grouped.get(key);
      if (existing) {
        existing.count += 1;
        if (s.userId && !existing.userIds.includes(s.userId)) {
          existing.userIds.push(s.userId);
        }
      } else {
        grouped.set(key, {
          name: s.name.trim(),
          code: s.code,
          count: 1,
          userIds: s.userId ? [s.userId] : [],
        });
      }
    });
    return Array.from(grouped.values()).sort((a, b) => b.count - a.count);
  }, [allSystemSubjects]);

  // Summary statistics
  const adminStats = useMemo(() => {
    const totalStudents = allSystemUsers.length;
    const totalSubjectEntries = allSystemSubjects.length;
    const distinctCourses = distinctGlobalClasses.length;

    let overallT = 0;
    let overallC = 0;
    let overallA = 0;

    allSystemSubjects.forEach((s) => {
      overallT += s.totalClasses || 0;
      overallC += s.conductedClasses || 0;
      overallA += s.attendedClasses || 0;
    });

    const averagePct = overallC > 0 ? (overallA / overallC) * 100 : 100;

    return {
      totalStudents,
      totalSubjectEntries,
      distinctCourses,
      averagePct,
    };
  }, [allSystemUsers, allSystemSubjects, distinctGlobalClasses]);

  // If locked, render lock screen
  if (!isUnlocked) {
    return (
      <div className="glass-panel rounded-3xl p-8 sm:p-12 text-center max-w-lg mx-auto my-12 border border-cherry-700/60 shadow-2xl relative overflow-hidden animate-fadeIn">
        <div className="w-20 h-20 rounded-3xl bg-dark-900 border border-cherry-600/50 flex items-center justify-center mx-auto mb-5 shadow-cherry-glow">
          <Lock className="w-10 h-10 text-cherry-400 animate-pulse-subtle" />
        </div>
        <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight mb-2">
          Admin Portal Locked
        </h2>
        <p className="text-xs sm:text-sm text-rose-300/70 mb-6 leading-relaxed">
          The administrator control center is protected by master passcode <strong className="text-rose-200">2821</strong>.
          Unlock to broadcast classes and manage student curricula.
        </p>
        <button
          onClick={onUnlockRequest}
          id="btn-trigger-unlock-screen"
          className="px-6 py-3 rounded-2xl bg-gradient-to-r from-cherry-600 via-cherry-500 to-rose-600 hover:from-cherry-500 hover:to-rose-500 text-white font-bold text-sm shadow-cherry-glow hover:shadow-cherry-glow-lg transition-all active:scale-95 border border-cherry-400/30 inline-flex items-center gap-2"
        >
          <ShieldCheck className="w-4 h-4 stroke-[2.5]" />
          <span>Unlock Admin Panel (2821)</span>
        </button>
      </div>
    );
  }

  // Handle Quick Preset Click
  const handleSelectPreset = (p: typeof PRESET_SUBJECTS[0]) => {
    setSubjectName(p.name);
    setCourseCode(p.code);
    setTotalClasses(p.total);
    setConductedClasses(p.conducted);
    setAttendedClasses(p.attended);
  };

  // Toggle user in target selection
  const handleToggleUserUid = (uid: string) => {
    setSelectedUserUids((prev) => {
      const next = new Set(prev);
      if (next.has(uid)) {
        next.delete(uid);
      } else {
        next.add(uid);
      }
      return next;
    });
  };

  // Select / Deselect All Users
  const handleSelectAllUsers = (select: boolean) => {
    if (select) {
      setSelectedUserUids(new Set(allSystemUsers.map((u) => u.uid)));
    } else {
      setSelectedUserUids(new Set());
    }
  };

  // Broadcast single class to all selected users
  const handleBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    const tNum = totalClasses === '' ? 0 : Number(totalClasses);
    const cNum = conductedClasses === '' ? 0 : Number(conductedClasses);
    const aNum = attendedClasses === '' ? 0 : Number(attendedClasses);

    if (!subjectName.trim()) {
      alert('Please enter a subject name');
      return;
    }
    if (tNum <= 0) {
      alert('Total classes (T) must be greater than 0');
      return;
    }

    const targetUsers = allSystemUsers.filter((u) =>
      targetMode === 'all' ? true : selectedUserUids.has(u.uid)
    );

    if (targetUsers.length === 0) {
      alert('Please select at least one user to broadcast to');
      return;
    }

    setIsBroadcasting(true);
    setBroadcastProgress(`Broadcasting "${subjectName.trim()}" to ${targetUsers.length} users...`);
    setLastResult(null);

    const classPayload: BroadcastClassPayload = {
      name: subjectName.trim(),
      code: courseCode.trim() || undefined,
      totalClasses: Math.max(1, tNum),
      conductedClasses: Math.max(0, cNum),
      attendedClasses: Math.min(Math.max(0, cNum), Math.max(0, aNum)),
    };

    try {
      let result: BroadcastResult = {
        totalTargeted: targetUsers.length,
        addedCount: 0,
        skippedCount: 0,
        details: [],
      };

      // 1. If Firestore configured, broadcast to Cloud Firestore
      if (isConfigured) {
        result = await broadcastClassToUsers(targetUsers, classPayload, skipDuplicates);
      } else {
        // Local mode fallback
        targetUsers.forEach((u) => {
          result.addedCount++;
          result.details.push({
            uid: u.uid,
            displayName: u.displayName,
            status: 'added',
          });
        });
      }

      // 2. Also add to current local subjects if checked
      if (includeMe) {
        const localSubjectId = `sub_local_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
        const localSub: Subject = {
          id: localSubjectId,
          userId: user?.uid || 'admin_user',
          userName: user?.displayName || 'Admin',
          name: classPayload.name,
          code: classPayload.code || '',
          totalClasses: classPayload.totalClasses,
          conductedClasses: classPayload.conductedClasses,
          attendedClasses: classPayload.attendedClasses,
          lastUpdatedBy: 'Admin Broadcast',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        onAddLocalSubject(localSub);
      }

      setLastResult(result);
      confetti({
        particleCount: 70,
        spread: 80,
        origin: { y: 0.6 },
        colors: ['#e11d48', '#10b981', '#38bdf8', '#fb7185'],
      });

      // Refresh data
      await fetchAdminData();
    } catch (err: any) {
      console.error('Broadcast failed:', err);
      alert(`Broadcast failed: ${err.message || 'Error writing to database'}`);
    } finally {
      setIsBroadcasting(false);
      setBroadcastProgress(null);
    }
  };

  // Deploy an entire semester package
  const handleDeployPackage = async (pkg: typeof SEMESTER_PACKAGES[0]) => {
    if (!window.confirm(`Deploy entire "${pkg.title}" (${pkg.subjects.length} subjects) to all ${allSystemUsers.length} users?`)) {
      return;
    }

    setIsBroadcasting(true);
    setLastResult(null);

    let totalAdded = 0;
    let totalSkipped = 0;

    try {
      for (let i = 0; i < pkg.subjects.length; i++) {
        const sub = pkg.subjects[i];
        setBroadcastProgress(`Deploying subject ${i + 1}/${pkg.subjects.length}: ${sub.name}...`);

        if (isConfigured) {
          const res = await broadcastClassToUsers(allSystemUsers, sub, true);
          totalAdded += res.addedCount;
          totalSkipped += res.skippedCount;
        }

        // Also add locally
        if (includeMe) {
          const localId = `pkg_${Date.now()}_${i}`;
          onAddLocalSubject({
            id: localId,
            userId: user?.uid || 'admin_user',
            userName: user?.displayName || 'Admin',
            name: sub.name,
            code: sub.code,
            totalClasses: sub.totalClasses,
            conductedClasses: sub.conductedClasses,
            attendedClasses: sub.attendedClasses,
            lastUpdatedBy: 'Semester Pack Deploy',
            createdAt: Date.now(),
            updatedAt: Date.now(),
          });
        }
      }

      confetti({
        particleCount: 90,
        spread: 90,
        origin: { y: 0.5 },
      });

      alert(`Successfully deployed "${pkg.title}" to all users! Added ${totalAdded} classes (${totalSkipped} skipped as existing).`);
      await fetchAdminData();
    } catch (err: any) {
      console.error('Package deployment failed:', err);
      alert(`Package deployment failed: ${err.message}`);
    } finally {
      setIsBroadcasting(false);
      setBroadcastProgress(null);
    }
  };

  // Remove a global class across all users
  const handleRemoveGlobalClass = async (className: string) => {
    if (!window.confirm(`Are you sure you want to delete "${className}" from ALL users in the entire database? This cannot be undone.`)) {
      return;
    }

    setIsDeletingGlobal(className);
    try {
      if (isConfigured) {
        const deletedCount = await removeClassFromAllUsers(className);
        alert(`Successfully removed "${className}" from all users (${deletedCount} documents deleted).`);
      }

      // Also remove matching local classes
      const matchingLocal = currentLocalSubjects.filter(
        (s) => s.name.trim().toLowerCase() === className.trim().toLowerCase()
      );
      matchingLocal.forEach((s) => onDeleteLocalSubject(s.id));

      await fetchAdminData();
    } catch (err: any) {
      console.error('Failed to remove global class:', err);
      alert(`Error removing global class: ${err.message}`);
    } finally {
      setIsDeletingGlobal(null);
    }
  };

  // Delete a specific subject for a user
  const handleDeleteUserSubject = async (subjectId: string, subjectName: string) => {
    if (!window.confirm(`Delete "${subjectName}" for this user?`)) return;

    try {
      if (isConfigured) {
        await deleteSubjectFromFirestore(subjectId);
      }
      onDeleteLocalSubject(subjectId);
      await fetchAdminData();
    } catch (err: any) {
      alert(`Failed to delete subject: ${err.message}`);
    }
  };

  // Quick inline +/- attendance adjust for single subject in inspector
  const handleQuickInlineAttendance = async (
    subject: Subject,
    deltaAttended: number,
    deltaConducted: number
  ) => {
    const newConducted = Math.max(0, Math.min(subject.totalClasses, subject.conductedClasses + deltaConducted));
    const newAttended = Math.max(0, Math.min(newConducted, subject.attendedClasses + deltaAttended));

    const updated: Subject = {
      ...subject,
      conductedClasses: newConducted,
      attendedClasses: newAttended,
      lastUpdatedBy: `Admin (${user?.displayName || 'Admin'})`,
      updatedAt: Date.now(),
    };

    try {
      if (isConfigured) {
        await updateSingleSubjectAttendanceInFirestore(
          subject.id,
          newAttended,
          newConducted,
          undefined,
          `Admin (${user?.displayName || 'Admin'})`
        );
      }
      if (onUpdateSubjects) {
        onUpdateSubjects([updated]);
      }
      setDbSubjects((prev) => prev.map((s) => (s.id === subject.id ? updated : s)));
      await fetchAdminData();
    } catch (err: any) {
      alert(`Could not update attendance: ${err.message}`);
    }
  };

  // Save exact modal edit for single subject in inspector
  const handleSaveInlineEditSubject = async () => {
    if (!editingSubjectData) return;
    const { subject, total, conducted, attended } = editingSubjectData;
    const newT = Math.max(1, total);
    const newC = Math.max(0, Math.min(newT, conducted));
    const newA = Math.max(0, Math.min(newC, attended));

    const updated: Subject = {
      ...subject,
      totalClasses: newT,
      conductedClasses: newC,
      attendedClasses: newA,
      lastUpdatedBy: `Admin (${user?.displayName || 'Admin'})`,
      updatedAt: Date.now(),
    };

    try {
      if (isConfigured) {
        await updateSingleSubjectAttendanceInFirestore(
          subject.id,
          newA,
          newC,
          newT,
          `Admin (${user?.displayName || 'Admin'})`
        );
      }
      if (onUpdateSubjects) {
        onUpdateSubjects([updated]);
      }
      setDbSubjects((prev) => prev.map((s) => (s.id === subject.id ? updated : s)));
      setEditingSubjectData(null);
      await fetchAdminData();
    } catch (err: any) {
      alert(`Failed to save attendance: ${err.message}`);
    }
  };


  // Filtered users for the student directory
  const filteredUsers = allSystemUsers.filter((u) => {
    const q = directorySearch.toLowerCase();
    return u.displayName.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
  });

  return (
    <div className="space-y-8 animate-fadeIn pb-12">
      {/* Admin Header Banner */}
      <div className="glass-panel rounded-3xl p-6 sm:p-8 border border-cherry-700/60 relative overflow-hidden shadow-2xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-cherry-700 via-cherry-600 to-rose-400 p-[1px] shadow-cherry-glow shrink-0">
              <div className="w-full h-full bg-dark-900 rounded-2xl flex items-center justify-center">
                <ShieldCheck className="w-7 h-7 text-cherry-400" />
              </div>
            </div>

            <div>
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] uppercase font-black tracking-wider bg-emerald-950/80 text-emerald-300 border border-emerald-700/60 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span>Authenticated • Passcode 2821</span>
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] uppercase font-bold tracking-wider bg-cherry-950/80 text-cherry-300 border border-cherry-800/60">
                  {isConfigured ? '⚡ Cloud Firestore Connected' : '💾 Local Storage Mode'}
                </span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight flex items-center gap-2">
                <span>Master Admin Control Portal</span>
                <span className="text-lg">🦫👑</span>
              </h2>
              <p className="text-xs sm:text-sm text-rose-300/70 mt-1 max-w-2xl leading-relaxed">
                Broadcast classes and syllabi simultaneously to all students, manage global subjects, and oversee campus attendance records.
              </p>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex items-center gap-2 shrink-0 self-start md:self-center">
            <button
              onClick={fetchAdminData}
              disabled={isLoadingDb}
              id="btn-refresh-admin-db"
              className="p-2.5 rounded-xl bg-dark-900/80 hover:bg-cherry-950 border border-cherry-900/50 text-rose-300 hover:text-white transition-all shadow-sm"
              title="Refresh database records"
            >
              <RefreshCw className={`w-4 h-4 ${isLoadingDb ? 'animate-spin' : ''}`} />
            </button>

            <button
              onClick={onLock}
              id="btn-lock-admin"
              className="px-4 py-2.5 rounded-xl bg-cherry-950 hover:bg-cherry-900 text-rose-200 hover:text-white border border-cherry-800/60 text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm active:scale-95"
            >
              <Lock className="w-3.5 h-3.5 text-cherry-400" />
              <span>Lock Admin</span>
            </button>
          </div>
        </div>

        {dbError && (
          <div className="mt-4 p-3 rounded-xl bg-amber-950/40 border border-amber-600/40 text-amber-200 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{dbError}</span>
          </div>
        )}
      </div>

      {/* Metrics Highlights Bar */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass-panel-subtle rounded-2xl p-4 border border-cherry-900/40 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-cherry-950/80 border border-cherry-800/50 flex items-center justify-center text-cherry-400 shrink-0">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <div className="text-2xl font-black text-white">{adminStats.totalStudents}</div>
            <div className="text-[11px] font-semibold text-rose-300/60 uppercase tracking-wider">
              Target Students
            </div>
          </div>
        </div>

        <div className="glass-panel-subtle rounded-2xl p-4 border border-cherry-900/40 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-cherry-950/80 border border-cherry-800/50 flex items-center justify-center text-rose-400 shrink-0">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <div className="text-2xl font-black text-white">{adminStats.distinctCourses}</div>
            <div className="text-[11px] font-semibold text-rose-300/60 uppercase tracking-wider">
              Active Courses
            </div>
          </div>
        </div>

        <div className="glass-panel-subtle rounded-2xl p-4 border border-cherry-900/40 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-cherry-950/80 border border-cherry-800/50 flex items-center justify-center text-emerald-400 shrink-0">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <div className="text-2xl font-black text-white">{adminStats.totalSubjectEntries}</div>
            <div className="text-[11px] font-semibold text-rose-300/60 uppercase tracking-wider">
              Enrolled Slots
            </div>
          </div>
        </div>

        <div className="glass-panel-subtle rounded-2xl p-4 border border-cherry-900/40 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-cherry-950/80 border border-cherry-800/50 flex items-center justify-center text-amber-400 shrink-0">
            <Award className="w-5 h-5" />
          </div>
          <div>
            <div className="text-2xl font-black text-white">
              {adminStats.averagePct.toFixed(1)}%
            </div>
            <div className="text-[11px] font-semibold text-rose-300/60 uppercase tracking-wider">
              Global Average
            </div>
          </div>
        </div>
      </div>

      {/* Admin Space Section Navigation */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 p-1.5 rounded-2xl bg-dark-950/80 border border-cherry-900/60 backdrop-blur-md">
        <button
          type="button"
          onClick={() => setAdminSection('timetable')}
          id="tab-admin-timetable"
          className={`py-3.5 px-3 rounded-xl font-black text-xs sm:text-sm flex items-center justify-center gap-1.5 transition-all ${
            adminSection === 'timetable'
              ? 'bg-gradient-to-r from-sky-600 via-sky-500 to-indigo-600 text-white shadow-md border border-sky-400/40'
              : 'text-rose-200/70 hover:text-white hover:bg-cherry-950/50'
          }`}
        >
          <Calendar className="w-4 h-4 text-sky-300" />
          <span>📅 Timetable Roll Call</span>
          <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-sky-950 text-sky-200 border border-sky-800">
            LP Batch
          </span>
        </button>

        <button
          type="button"
          onClick={() => setAdminSection('mass-attendance')}
          id="tab-admin-mass-attendance"
          className={`py-3.5 px-3 rounded-xl font-black text-xs sm:text-sm flex items-center justify-center gap-1.5 transition-all ${
            adminSection === 'mass-attendance'
              ? 'bg-gradient-to-r from-cherry-600 via-cherry-500 to-rose-600 text-white shadow-cherry-glow'
              : 'text-rose-200/70 hover:text-white hover:bg-cherry-950/50'
          }`}
        >
          <Zap className="w-4 h-4 text-cherry-300" />
          <span>⚡ Mass Attendance</span>
          <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-dark-900/60 text-white border border-white/20">
            All Courses
          </span>
        </button>

        <button
          type="button"
          onClick={() => setAdminSection('broadcast')}
          id="tab-admin-broadcast"
          className={`py-3.5 px-3 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 transition-all ${
            adminSection === 'broadcast'
              ? 'bg-gradient-to-r from-cherry-600 via-cherry-500 to-rose-600 text-white shadow-cherry-glow'
              : 'text-rose-200/70 hover:text-white hover:bg-cherry-950/50'
          }`}
        >
          <Send className="w-4 h-4 text-rose-300" />
          <span>📢 Broadcast Classes</span>
        </button>

        <button
          type="button"
          onClick={() => setAdminSection('directory')}
          id="tab-admin-directory"
          className={`py-3.5 px-3 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 transition-all ${
            adminSection === 'directory'
              ? 'bg-gradient-to-r from-cherry-600 via-cherry-500 to-rose-600 text-white shadow-cherry-glow'
              : 'text-rose-200/70 hover:text-white hover:bg-cherry-950/50'
          }`}
        >
          <Users className="w-4 h-4 text-amber-300" />
          <span>👥 Student Directory</span>
          <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-dark-900/60 text-white border border-white/20">
            {allSystemUsers.length}
          </span>
        </button>
      </div>

      {/* Tab 1: Google Sheet Timetable & Daily Roll Call for Larry Page Batch */}
      {adminSection === 'timetable' && (
        <TimetableAttendanceManager
          allUsers={allSystemUsers}
          allSubjects={allSystemSubjects}
          isConfigured={isConfigured}
          currentUser={user}
          onUpdateSubjects={onUpdateSubjects}
          onRefreshData={fetchAdminData}
        />
      )}

      {/* Tab 2: Mass Attendance Updater (Update Everyone's Attendance at Once) */}
      {adminSection === 'mass-attendance' && (
        <MassAttendanceUpdater
          allUsers={allSystemUsers}
          allSubjects={allSystemSubjects}
          isConfigured={isConfigured}
          currentUser={user}
          onUpdateSubjects={onUpdateSubjects}
          onRefreshData={fetchAdminData}
        />
      )}

      {/* Tab 3: Broadcast Classes & Preset Semester Packs */}
      {adminSection === 'broadcast' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-fadeIn">
        {/* Left Column: Broadcast Class to All Users (Cols 7) */}
        <div className="lg:col-span-7 space-y-6">
          <div className="glass-panel rounded-3xl p-6 sm:p-7 border border-cherry-700/50 shadow-xl relative">
            <div className="flex items-center justify-between pb-4 border-b border-cherry-950/80 mb-5">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-cherry-600/30 border border-cherry-500/50 flex items-center justify-center text-cherry-400">
                  <Send className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white tracking-tight">
                    Add Class to All Users
                  </h3>
                  <p className="text-xs text-rose-300/60">
                    Instantly push a course to every student's attendance calculator.
                  </p>
                </div>
              </div>

              <span className="text-[11px] font-bold px-2.5 py-1 rounded-xl bg-cherry-950 text-rose-300 border border-cherry-900">
                {targetMode === 'all' ? `Broadcasting to All (${allSystemUsers.length})` : `Selected (${selectedUserUids.size})`}
              </span>
            </div>

            {/* Quick Fill Preset Chips */}
            <div className="mb-5">
              <div className="text-[11px] font-bold text-rose-300/70 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-cherry-400" />
                <span>Quick-Fill Subject Presets</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {PRESET_SUBJECTS.map((preset) => (
                  <button
                    key={preset.name}
                    type="button"
                    onClick={() => handleSelectPreset(preset)}
                    className="px-2.5 py-1 rounded-lg bg-dark-900/90 hover:bg-cherry-900/70 border border-cherry-900/50 hover:border-cherry-600 text-xs text-rose-200 hover:text-white transition-all active:scale-95"
                  >
                    {preset.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Broadcast Form */}
            <form onSubmit={handleBroadcast} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-rose-200 mb-1">
                    Subject Name <span className="text-cherry-400">*</span>
                  </label>
                  <input
                    type="text"
                    id="input-broadcast-subject-name"
                    value={subjectName}
                    onChange={(e) => setSubjectName(e.target.value)}
                    placeholder="e.g. Physical Chemistry II"
                    required
                    className="w-full px-3.5 py-2.5 rounded-xl bg-dark-950/80 border border-cherry-900/60 focus:border-cherry-500 text-xs sm:text-sm text-white placeholder-rose-300/30 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-rose-200 mb-1">
                    Course Code
                  </label>
                  <input
                    type="text"
                    id="input-broadcast-course-code"
                    value={courseCode}
                    onChange={(e) => setCourseCode(e.target.value)}
                    placeholder="e.g. CH-202"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-dark-950/80 border border-cherry-900/60 focus:border-cherry-500 text-xs sm:text-sm text-white placeholder-rose-300/30 transition-all uppercase"
                  />
                </div>
              </div>

              {/* Class Parameters Grid */}
              <div className="grid grid-cols-3 gap-3 pt-1">
                <div>
                  <label className="block text-[11px] font-bold text-rose-300 mb-1">
                    Total Classes (T) <span className="text-cherry-400">*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    id="input-broadcast-total"
                    value={totalClasses}
                    onChange={(e) => setTotalClasses(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl bg-dark-950/80 border border-cherry-900/60 focus:border-cherry-500 text-xs sm:text-sm font-bold text-white transition-all text-center"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-rose-300 mb-1">
                    Conducted (C)
                  </label>
                  <input
                    type="number"
                    min="0"
                    id="input-broadcast-conducted"
                    value={conductedClasses}
                    onChange={(e) => setConductedClasses(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl bg-dark-950/80 border border-cherry-900/60 focus:border-cherry-500 text-xs sm:text-sm font-bold text-white transition-all text-center"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-rose-300 mb-1">
                    Default Attended (A)
                  </label>
                  <input
                    type="number"
                    min="0"
                    id="input-broadcast-attended"
                    value={attendedClasses}
                    onChange={(e) => setAttendedClasses(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl bg-dark-950/80 border border-cherry-900/60 focus:border-cherry-500 text-xs sm:text-sm font-bold text-white transition-all text-center"
                  />
                </div>
              </div>

              {/* Audience & Duplicate Options */}
              <div className="p-3.5 rounded-2xl bg-dark-950/60 border border-cherry-950 space-y-2.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-rose-200">Target Audience:</span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setTargetMode('all')}
                      className={`px-3 py-1 rounded-lg font-bold text-xs transition-all ${
                        targetMode === 'all'
                          ? 'bg-cherry-600 text-white shadow-cherry-glow'
                          : 'bg-dark-900 text-rose-300 hover:text-white'
                      }`}
                    >
                      All Users ({allSystemUsers.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setTargetMode('custom')}
                      className={`px-3 py-1 rounded-lg font-bold text-xs transition-all ${
                        targetMode === 'custom'
                          ? 'bg-cherry-600 text-white shadow-cherry-glow'
                          : 'bg-dark-900 text-rose-300 hover:text-white'
                      }`}
                    >
                      Selective Users
                    </button>
                  </div>
                </div>

                {/* If Selective Mode, show User Checkboxes */}
                {targetMode === 'custom' && (
                  <div className="mt-2 pt-2 border-t border-cherry-950/80">
                    <div className="flex items-center justify-between mb-2 text-[11px]">
                      <span className="text-rose-300/70">Select who gets this subject:</span>
                      <div className="space-x-2">
                        <button
                          type="button"
                          onClick={() => handleSelectAllUsers(true)}
                          className="text-cherry-400 hover:underline font-semibold"
                        >
                          Select All
                        </button>
                        <span>•</span>
                        <button
                          type="button"
                          onClick={() => handleSelectAllUsers(false)}
                          className="text-rose-300/60 hover:underline font-semibold"
                        >
                          Clear
                        </button>
                      </div>
                    </div>

                    <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1">
                      {allSystemUsers.map((u) => {
                        const isChecked = selectedUserUids.has(u.uid);
                        return (
                          <label
                            key={u.uid}
                            className={`flex items-center justify-between p-2 rounded-xl text-xs cursor-pointer transition-colors ${
                              isChecked ? 'bg-cherry-950/70 border border-cherry-800/40 text-white' : 'bg-dark-900/60 text-rose-300/60 hover:bg-dark-900'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => handleToggleUserUid(u.uid)}
                                className="rounded text-cherry-600 focus:ring-cherry-500 bg-dark-900 border-cherry-800"
                              />
                              <span className="font-semibold">{u.displayName}</span>
                            </div>
                            <span className="text-[10px] text-rose-300/50">{u.email || 'offline'}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Checkboxes */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1 border-t border-cherry-950 text-xs">
                  <label className="flex items-center gap-2 cursor-pointer text-rose-200">
                    <input
                      type="checkbox"
                      checked={skipDuplicates}
                      onChange={(e) => setSkipDuplicates(e.target.checked)}
                      className="rounded text-cherry-600 focus:ring-cherry-500 bg-dark-900 border-cherry-800"
                    />
                    <span>Skip users who already have this class</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer text-rose-200">
                    <input
                      type="checkbox"
                      checked={includeMe}
                      onChange={(e) => setIncludeMe(e.target.checked)}
                      className="rounded text-cherry-600 focus:ring-cherry-500 bg-dark-900 border-cherry-800"
                    />
                    <span>Add to my dashboard too</span>
                  </label>
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isBroadcasting}
                id="btn-broadcast-to-all"
                className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-cherry-600 via-cherry-500 to-rose-600 hover:from-cherry-500 hover:to-rose-500 text-white font-black text-sm shadow-cherry-glow hover:shadow-cherry-glow-lg transition-all flex items-center justify-center gap-2 active:scale-95 border border-cherry-400/40 disabled:opacity-50"
              >
                {isBroadcasting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>{broadcastProgress || 'Broadcasting to all users...'}</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4 stroke-[2.5]" />
                    <span>Broadcast Class to All Users ({targetMode === 'all' ? allSystemUsers.length : selectedUserUids.size}) 🚀</span>
                  </>
                )}
              </button>
            </form>

            {/* Post Broadcast Feedback */}
            {lastResult && (
              <div className="mt-4 p-4 rounded-2xl bg-emerald-950/60 border border-emerald-700/60 text-xs text-emerald-200 animate-fadeIn">
                <div className="flex items-center gap-2 font-bold text-emerald-100 text-sm mb-1">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>Broadcast Complete!</span>
                </div>
                <p>
                  Successfully added to <strong>{lastResult.addedCount}</strong> users.
                  {lastResult.skippedCount > 0 && ` (${lastResult.skippedCount} users skipped because class already existed)`}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: 1-Click Semester Packages & Quick Global Actions (Cols 5) */}
        <div className="lg:col-span-5 space-y-6">
          {/* Semester Syllabus Bundles */}
          <div className="glass-panel rounded-3xl p-6 border border-cherry-900/50">
            <div className="flex items-center gap-2.5 pb-3 border-b border-cherry-950/80 mb-4">
              <Package className="w-5 h-5 text-rose-400" />
              <div>
                <h3 className="text-base font-bold text-white tracking-tight">
                  1-Click Semester Packages
                </h3>
                <p className="text-xs text-rose-300/60">
                  Deploy multiple standard courses across all users at once.
                </p>
              </div>
            </div>

            <div className="space-y-3">
              {SEMESTER_PACKAGES.map((pkg) => (
                <div
                  key={pkg.title}
                  className="p-4 rounded-2xl bg-dark-950/70 border border-cherry-900/40 hover:border-cherry-700/60 transition-all flex flex-col justify-between gap-3"
                >
                  <div>
                    <h4 className="text-xs font-bold text-white mb-1 flex items-center justify-between">
                      <span>{pkg.title}</span>
                      <span className="text-[10px] text-cherry-400 font-normal">
                        {pkg.subjects.length} subjects
                      </span>
                    </h4>
                    <p className="text-[11px] text-rose-300/70 mb-2">{pkg.description}</p>
                    <div className="flex flex-wrap gap-1">
                      {pkg.subjects.map((s) => (
                        <span
                          key={s.name}
                          className="px-2 py-0.5 rounded-md bg-dark-900 text-[10px] font-semibold text-rose-200 border border-cherry-950"
                        >
                          {s.name} ({s.code})
                        </span>
                      ))}
                    </div>
                  </div>

                  <button
                    onClick={() => handleDeployPackage(pkg)}
                    disabled={isBroadcasting}
                    className="w-full py-2 rounded-xl bg-cherry-950 hover:bg-cherry-900 border border-cherry-700/50 text-xs font-bold text-rose-200 hover:text-white transition-all flex items-center justify-center gap-1.5 shadow-sm active:scale-95 disabled:opacity-50"
                  >
                    <Send className="w-3.5 h-3.5 text-cherry-400" />
                    <span>Deploy Full Pack to All Students</span>
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Global Classes Inventory */}
          <div className="glass-panel rounded-3xl p-6 border border-cherry-900/50">
            <div className="flex items-center justify-between pb-3 border-b border-cherry-950/80 mb-3">
              <div className="flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-cherry-400" />
                <h3 className="text-base font-bold text-white tracking-tight">
                  Global Class Inventory
                </h3>
              </div>
              <span className="text-[11px] text-rose-300/60">
                {distinctGlobalClasses.length} distinct courses
              </span>
            </div>

            <p className="text-xs text-rose-300/60 mb-3">
              Remove a mistakenly broadcasted class from all users simultaneously:
            </p>

            <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
              {distinctGlobalClasses.length === 0 ? (
                <p className="text-xs text-center text-rose-300/50 py-4">No classes in database yet.</p>
              ) : (
                distinctGlobalClasses.map((item) => (
                  <div
                    key={item.name}
                    className="p-3 rounded-xl bg-dark-950/60 border border-cherry-950 flex items-center justify-between gap-2"
                  >
                    <div>
                      <div className="text-xs font-bold text-white flex items-center gap-1.5">
                        <span>{item.name}</span>
                        {item.code && (
                          <span className="text-[10px] text-rose-300/60 font-normal">
                            ({item.code})
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-rose-300/50">
                        Assigned to {item.count} student account{item.count > 1 ? 's' : ''}
                      </div>
                    </div>

                    <button
                      onClick={() => handleRemoveGlobalClass(item.name)}
                      disabled={isDeletingGlobal === item.name}
                      title="Delete from all students"
                      className="px-2.5 py-1.5 rounded-lg bg-cherry-950/80 hover:bg-rose-950 text-rose-300 hover:text-white border border-rose-900/50 text-[11px] font-bold flex items-center gap-1 transition-colors shrink-0"
                    >
                      <Trash2 className="w-3 h-3 text-rose-400" />
                      <span>{isDeletingGlobal === item.name ? 'Removing...' : 'Delete All'}</span>
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
        </div>
      )}

      {/* Tab 3: Full Students & Classes Directory */}
      {adminSection === 'directory' && (
        <div className="glass-panel rounded-3xl p-6 sm:p-8 border border-cherry-900/50 animate-fadeIn">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-cherry-950/80 mb-6">
          <div>
            <h3 className="text-xl font-black text-white tracking-tight flex items-center gap-2">
              <Users className="w-5 h-5 text-cherry-400" />
              <span>Campus Students Directory & Class Inspector</span>
            </h3>
            <p className="text-xs text-rose-300/70 mt-0.5">
              Inspect student profiles, review their enrolled subjects, and manage individual classes.
            </p>
          </div>

          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-rose-300/40" />
            <input
              type="text"
              value={directorySearch}
              onChange={(e) => setDirectorySearch(e.target.value)}
              placeholder="Search students..."
              className="w-full pl-10 pr-4 py-2 rounded-xl bg-dark-950/80 border border-cherry-900/50 focus:border-cherry-500 text-xs text-white placeholder-rose-300/40 transition-all"
            />
          </div>
        </div>

        {/* Students Accordion List */}
        <div className="space-y-3">
          {filteredUsers.length === 0 ? (
            <div className="text-center py-8 text-rose-300/60 text-xs">
              No students match "{directorySearch}"
            </div>
          ) : (
            filteredUsers.map((stu) => {
              const userSubjects = allSystemSubjects.filter((s) => s.userId === stu.uid);
              const summary = calculateOverallSummary(userSubjects);
              const isExpanded = expandedUserUid === stu.uid;

              return (
                <div
                  key={stu.uid}
                  className="rounded-2xl bg-dark-950/60 border border-cherry-900/40 overflow-hidden transition-all"
                >
                  <div
                    onClick={() => setExpandedUserUid(isExpanded ? null : stu.uid)}
                    className="p-4 flex items-center justify-between gap-4 cursor-pointer hover:bg-cherry-950/30 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cherry-800 to-rose-700 flex items-center justify-center text-white font-black text-sm shrink-0">
                        {stu.displayName.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="font-bold text-sm text-white flex items-center gap-2">
                          <span>{stu.displayName}</span>
                          {stu.uid === user?.uid && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-cherry-950 text-cherry-300 border border-cherry-800">
                              You
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-rose-300/50">
                          {stu.email || 'offline student'} • {userSubjects.length} subjects assigned
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="hidden sm:block text-right">
                        <div className="text-sm font-black text-rose-200">
                          {summary.currentPercentage.toFixed(1)}% Attendance
                        </div>
                        <div className="text-[11px] text-rose-300/50">
                          {summary.totalBunksRemaining} bunks left
                        </div>
                      </div>

                      <div className="p-1.5 rounded-lg text-rose-300/60 hover:text-white">
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </div>
                    </div>
                  </div>

                  {/* Expanded Subjects for this Student */}
                  {isExpanded && (
                    <div className="p-4 border-t border-cherry-950 bg-dark-900/40 space-y-3 animate-fadeIn">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-rose-200">Classes Enrolled:</span>
                        <span className="text-rose-300/60">{userSubjects.length} subjects</span>
                      </div>

                      {userSubjects.length === 0 ? (
                        <p className="text-xs text-rose-300/50 italic py-2">
                          No subjects assigned to this student yet. Use "Broadcast Class to All Users" above to add classes.
                        </p>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                          {userSubjects.map((sub) => {
                            const stats = calculateSubjectStats(sub);
                            return (
                              <div
                                key={sub.id}
                                className="p-3 rounded-xl bg-dark-950/80 border border-cherry-900/40 flex flex-col justify-between gap-2"
                              >
                                <div>
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="font-bold text-xs text-white truncate">
                                      {sub.name}
                                    </span>
                                    {sub.code && (
                                      <span className="text-[10px] text-cherry-400 font-mono">
                                        {sub.code}
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-[11px] text-rose-300/60 mt-1 flex items-center justify-between">
                                    <span>
                                      Attended: {sub.attendedClasses}/{sub.conductedClasses} (Total: {sub.totalClasses})
                                    </span>
                                    <span className="font-bold text-rose-200">
                                      {stats.currentPercentage.toFixed(0)}%
                                    </span>
                                  </div>
                                </div>

                                <div className="flex items-center justify-between pt-2 border-t border-cherry-950 text-[10px]">
                                  <span className={stats.scenario === 'safe' ? 'text-emerald-400 font-bold' : stats.scenario === 'borderline' ? 'text-amber-400 font-bold' : 'text-rose-400 font-bold'}>
                                    {stats.bunksRemaining} bunks left ({stats.scenario})
                                  </span>

                                  {/* Inline Attendance Quick Buttons */}
                                  <div className="flex items-center gap-1">
                                    <button
                                      type="button"
                                      onClick={() => handleQuickInlineAttendance(sub, 1, 1)}
                                      title="Mark Present (+1 Attended, +1 Conducted)"
                                      className="px-1.5 py-0.5 rounded bg-emerald-950/80 hover:bg-emerald-900 text-emerald-300 font-bold border border-emerald-800/50 text-[10px] transition-colors"
                                    >
                                      +1 Att
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleQuickInlineAttendance(sub, -1, -1)}
                                      title="Undo Attendance (-1 Attended, -1 Conducted)"
                                      className="px-1.5 py-0.5 rounded bg-dark-900 hover:bg-rose-950 text-rose-300 font-bold border border-cherry-900/50 text-[10px] transition-colors"
                                    >
                                      -1 Att
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setEditingSubjectData({
                                          subject: sub,
                                          studentName: stu.displayName,
                                          total: sub.totalClasses,
                                          conducted: sub.conductedClasses,
                                          attended: sub.attendedClasses,
                                        })
                                      }
                                      title="Edit exact counts for this student"
                                      className="p-1 rounded text-rose-300/60 hover:text-white hover:bg-cherry-950 transition-colors"
                                    >
                                      <Edit2 className="w-3 h-3 text-rose-300" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteUserSubject(sub.id, sub.name)}
                                      title="Delete this class for this user"
                                      className="p-1 rounded text-rose-300/50 hover:text-rose-200 hover:bg-rose-950/50 transition-colors"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </button>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
      )}

      {/* Mini Edit Modal for single student subject in directory inspector */}
      {editingSubjectData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-dark-950/80 backdrop-blur-md animate-fadeIn">
          <div className="glass-panel rounded-3xl p-6 sm:p-7 border border-cherry-700/60 shadow-2xl max-w-md w-full relative">
            <div className="flex items-center justify-between pb-3 border-b border-cherry-950/80 mb-4">
              <div>
                <h4 className="font-bold text-white text-base">
                  Edit Attendance for {editingSubjectData.studentName}
                </h4>
                <p className="text-xs text-rose-300/60">{editingSubjectData.subject.name}</p>
              </div>
              <button
                type="button"
                onClick={() => setEditingSubjectData(null)}
                className="p-1.5 rounded-xl text-rose-300/60 hover:text-white hover:bg-cherry-950"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-rose-200 mb-1">Total Classes (T)</label>
                <input
                  type="number"
                  min="1"
                  value={editingSubjectData.total}
                  onChange={(e) =>
                    setEditingSubjectData({ ...editingSubjectData, total: Number(e.target.value) })
                  }
                  className="w-full px-3 py-2 rounded-xl bg-dark-950/90 border border-cherry-900/60 text-white font-bold text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-rose-200 mb-1">Conducted Classes (C)</label>
                  <input
                    type="number"
                    min="0"
                    value={editingSubjectData.conducted}
                    onChange={(e) =>
                      setEditingSubjectData({ ...editingSubjectData, conducted: Number(e.target.value) })
                    }
                    className="w-full px-3 py-2 rounded-xl bg-dark-950/90 border border-cherry-900/60 text-white font-bold text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-rose-200 mb-1">Attended Classes (A)</label>
                  <input
                    type="number"
                    min="0"
                    value={editingSubjectData.attended}
                    onChange={(e) =>
                      setEditingSubjectData({ ...editingSubjectData, attended: Number(e.target.value) })
                    }
                    className="w-full px-3 py-2 rounded-xl bg-dark-950/90 border border-cherry-900/60 text-white font-bold text-sm"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3 pt-3 border-t border-cherry-950">
                <button
                  type="button"
                  onClick={() => setEditingSubjectData(null)}
                  className="flex-1 py-2.5 rounded-xl bg-dark-900 text-rose-300 hover:text-white border border-cherry-900 font-bold text-xs"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveInlineEditSubject}
                  className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-cherry-600 to-rose-600 hover:from-cherry-500 hover:to-rose-500 text-white font-bold text-xs shadow-cherry-glow"
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
