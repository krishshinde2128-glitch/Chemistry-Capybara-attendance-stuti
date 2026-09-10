import { useState, useMemo, useEffect } from 'react';
import confetti from 'canvas-confetti';
import { 
  Search, 
  CheckCircle2, 
  AlertTriangle, 
  Skull, 
  ArrowUpDown,
} from 'lucide-react';
import type { Subject, AttendanceScenario, PeerUserWithSubjects } from './types/attendance';
import { calculateOverallSummary, calculateSubjectStats } from './utils/calculator';
import { useLocalStorage } from './hooks/useLocalStorage';
import { AuthProvider, useAuth } from './firebase/AuthContext';
import {
  saveSubjectToFirestore,
  deleteSubjectFromFirestore,
  subscribeToUserSubjects,
  subscribeToCommunity,
  updatePeerSubjectAttendance,
} from './firebase/firestoreService';
import { Header, type ActiveTab } from './components/Header';
import { UserBar } from './components/UserBar';
import { StatsOverview } from './components/StatsOverview';
import { SubjectCard } from './components/SubjectCard';
import { SubjectModal } from './components/SubjectModal';
import { EmptyState } from './components/EmptyState';
import { AuthModal } from './components/AuthModal';
import { FirebaseConfigModal } from './components/FirebaseConfigModal';
import { CommunityView } from './components/CommunityView';
import { LeaderboardView } from './components/LeaderboardView';

function AttendanceApp() {
  const { user, userProfile, isConfigured } = useAuth();
  
  // Scoped local storage key per user account so accounts don't overwrite each other
  const localKey = user ? `chem_capy_subjects_${user.uid}` : 'chem_capy_subjects_v2';
  const [localSubjects, setLocalSubjects] = useLocalStorage<Subject[]>(
    localKey,
    []
  );

  const [cloudSubjects, setCloudSubjects] = useState<Subject[]>([]);
  const [cloudPeers, setCloudPeers] = useState<PeerUserWithSubjects[]>([]);
  const [firestoreError, setFirestoreError] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  // Active dataset: merges cloud and local subjects
  const subjects = useMemo(() => {
    if (user && isConfigured && cloudSubjects.length > 0) {
      return cloudSubjects;
    }
    return localSubjects;
  }, [user, isConfigured, cloudSubjects, localSubjects]);

  // Overall summary metrics for current user
  const summary = useMemo(() => calculateOverallSummary(subjects), [subjects]);

  // Combined peers list
  const allPeers = useMemo(() => {
    let baseList = [...cloudPeers];

    // If current user is logged in and not private, make sure their subjects are visible in the list
    if (user && userProfile && !userProfile.isPrivate && subjects.length > 0) {
      const existingIdx = baseList.findIndex((p) => p.user.uid === user.uid);
      const currentUserEntry: PeerUserWithSubjects = {
        user: {
          ...userProfile,
          totalBunksRemaining: summary.totalBunksRemaining,
          overallPercentage: summary.currentPercentage,
        },
        subjects,
        summary,
      };

      if (existingIdx >= 0) {
        baseList[existingIdx] = currentUserEntry;
      } else {
        baseList = [currentUserEntry, ...baseList];
      }
    }

    return baseList;
  }, [cloudPeers, user, userProfile, subjects, summary]);

  // UI State
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [scenarioFilter, setScenarioFilter] = useState<AttendanceScenario | 'all'>('all');
  const [sortBy, setSortBy] = useState<'name' | 'percentage' | 'bunks'>('percentage');

  // Real-time Firestore Subscriptions
  useEffect(() => {
    if (!user || !isConfigured) return;

    // Listen to user's subjects
    const unsubUser = subscribeToUserSubjects(user.uid, (subs) => {
      setCloudSubjects(subs);
      if (subs.length > 0) {
        setLocalSubjects(subs);
      }
    });

    // Listen to community
    const unsubCommunity = subscribeToCommunity(user.uid, (peerList) => {
      setCloudPeers(peerList);
    });

    return () => {
      unsubUser();
      unsubCommunity();
    };
  }, [user, isConfigured]);

  // Sync all current subjects to Firestore on login
  const handleSyncAllToCloud = async () => {
    if (!user || !isConfigured) return;
    setIsSyncing(true);
    setFirestoreError(null);
    const userName = userProfile?.displayName || user.displayName || 'Student';

    try {
      for (const subj of subjects) {
        await saveSubjectToFirestore(user.uid, userName, {
          ...subj,
          userId: user.uid,
          userName,
        });
      }
      alert('Successfully synchronized your subjects to the cloud! Your classmates can now see them.');
    } catch (err: any) {
      console.error('Sync failed:', err);
      setFirestoreError(err.message || 'Firestore write permission denied. Please check Firestore Rules.');
    } finally {
      setIsSyncing(false);
    }
  };

  // Filter and sort subjects
  const filteredSubjects = useMemo(() => {
    return subjects
      .filter((sub) => {
        const matchesQuery =
          sub.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (sub.code && sub.code.toLowerCase().includes(searchQuery.toLowerCase()));

        if (!matchesQuery) return false;
        if (scenarioFilter === 'all') return true;
        const stats = calculateSubjectStats(sub);
        return stats.scenario === scenarioFilter;
      })
      .sort((a, b) => {
        if (sortBy === 'name') {
          return a.name.localeCompare(b.name);
        }
        if (sortBy === 'bunks') {
          const bunksA = calculateSubjectStats(a).bunksRemaining;
          const bunksB = calculateSubjectStats(b).bunksRemaining;
          return bunksA - bunksB;
        }
        const statA = calculateSubjectStats(a);
        const statB = calculateSubjectStats(b);
        return statA.currentPercentage - statB.currentPercentage;
      });
  }, [subjects, searchQuery, scenarioFilter, sortBy]);

  // Handlers
  const handleOpenAdd = () => {
    setEditingSubject(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (subject: Subject) => {
    setEditingSubject(subject);
    setIsModalOpen(true);
  };

  const handleSaveSubject = async (
    data: Omit<Subject, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }
  ) => {
    setFirestoreError(null);
    const userName = userProfile?.displayName || user?.displayName || 'Student';
    const subjectId = data.id || `sub_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    
    const subjectToSave: Subject = {
      ...data,
      id: subjectId,
      userId: user?.uid,
      userName,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    // 1. Instant Optimistic Local Update
    if (data.id) {
      setLocalSubjects((prev) =>
        prev.map((s) => (s.id === data.id ? { ...s, ...subjectToSave } : s))
      );
      setCloudSubjects((prev) =>
        prev.map((s) => (s.id === data.id ? { ...s, ...subjectToSave } : s))
      );
    } else {
      setLocalSubjects((prev) => [subjectToSave, ...prev]);
      setCloudSubjects((prev) => [subjectToSave, ...prev]);

      const stats = calculateSubjectStats(subjectToSave);
      if (stats.scenario === 'safe' && stats.bunksRemaining > 2) {
        confetti({
          particleCount: 40,
          spread: 60,
          origin: { y: 0.8 },
          colors: ['#f43f5e', '#e11d48', '#10b981', '#34d399'],
        });
      }
    }

    // 2. Cloud Sync (if logged in and Firestore active)
    if (user && isConfigured) {
      try {
        await saveSubjectToFirestore(user.uid, userName, subjectToSave);
      } catch (err: any) {
        console.warn('Could not sync subject to Firestore:', err);
        setFirestoreError(err.message || 'Firestore write error');
      }
    }
  };

  const handleDeleteSubject = async (id: string) => {
    setLocalSubjects((prev) => prev.filter((s) => s.id !== id));
    setCloudSubjects((prev) => prev.filter((s) => s.id !== id));

    if (user && isConfigured) {
      try {
        await deleteSubjectFromFirestore(id);
      } catch (err) {
        console.warn('Could not delete from Firestore:', err);
      }
    }
  };

  const handleQuickUpdate = async (
    id: string,
    deltaAttended: number,
    deltaConducted: number
  ) => {
    const updater = (prevList: Subject[]) =>
      prevList.map((s) => {
        if (s.id !== id) return s;
        const newConducted = Math.min(s.totalClasses, s.conductedClasses + deltaConducted);
        const newAttended = Math.min(newConducted, s.attendedClasses + deltaAttended);
        return {
          ...s,
          conductedClasses: newConducted,
          attendedClasses: newAttended,
          updatedAt: Date.now(),
        };
      });

    setLocalSubjects(updater);
    setCloudSubjects(updater);

    if (user && isConfigured) {
      const current = subjects.find((s) => s.id === id);
      if (current) {
        const userName = userProfile?.displayName || user.displayName || 'Me';
        try {
          await updatePeerSubjectAttendance(id, deltaAttended, deltaConducted, current, userName);
        } catch (err) {
          console.warn('Could not update Firestore subject:', err);
        }
      }
    }
  };

  // Peer update handler (called from Community view)
  const handlePeerUpdate = async (
    targetSubject: Subject,
    deltaAttended: number,
    deltaConducted: number
  ) => {
    const updaterName = userProfile?.displayName || user?.displayName || user?.email?.split('@')[0] || 'Peer';

    // 1. Update cloud if configured
    if (user && isConfigured) {
      try {
        await updatePeerSubjectAttendance(targetSubject.id, deltaAttended, deltaConducted, targetSubject, updaterName);
      } catch (err: any) {
        console.warn('Could not update peer attendance in Firestore:', err);
        alert('Firestore permission error: ensure your Firestore Rules allow read and write.');
      }
    }
  };

  const handleClearAll = () => {
    if (window.confirm('Are you sure you want to clear all subjects?')) {
      if (user && isConfigured) {
        subjects.forEach((s) => {
          try {
            deleteSubjectFromFirestore(s.id);
          } catch (e) {
            console.warn(e);
          }
        });
      }
      setLocalSubjects([]);
      setCloudSubjects([]);
    }
  };

  return (
    <div className="min-h-screen flex flex-col text-slate-100 selection:bg-cherry-600 selection:text-white pb-16">
      {/* Top Navigation */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onAddClick={handleOpenAdd}
        onClearAll={handleClearAll}
        onOpenAuth={() => setIsAuthOpen(true)}
        onOpenConfig={() => setIsConfigOpen(true)}
        subjects={subjects}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        {/* Firestore Rules Alert Banner */}
        {firestoreError && (
          <div className="mb-6 p-4 rounded-2xl bg-cherry-950 border-2 border-cherry-600 text-xs text-rose-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-cherry-glow">
            <div>
              <strong className="text-white font-bold block mb-0.5">⚠️ Firestore Permission Notice:</strong>
              <span>{firestoreError}. In your Firebase Console, make sure Firestore Rules allow read/write for testing.</span>
            </div>
            <a
              href="https://console.firebase.google.com/project/dietcoke-514f4/firestore/rules"
              target="_blank"
              rel="noreferrer"
              className="px-3 py-1.5 rounded-xl bg-cherry-600 hover:bg-cherry-500 text-white font-bold shrink-0 transition-colors"
            >
              Open Firestore Rules
            </a>
          </div>
        )}

        {/* User Account Bar (When Logged In) */}
        {user && (
          <UserBar
            onOpenConfig={() => setIsConfigOpen(true)}
            onSyncAll={handleSyncAllToCloud}
            isSyncing={isSyncing}
          />
        )}

        {/* Tab 1: My Subjects Dashboard */}
        {activeTab === 'dashboard' && (
          <div>
            {subjects.length > 0 && <StatsOverview summary={summary} />}

            {/* Filter, Search & Controls Bar */}
            {subjects.length > 0 && (
              <div className="glass-panel-subtle rounded-2xl p-3 sm:p-4 mb-8 flex flex-col md:flex-row items-center justify-between gap-3 sm:gap-4 border border-cherry-900/40">
                {/* Search Input */}
                <div className="relative w-full md:w-80">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-rose-300/50" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search subject or course code..."
                    className="w-full pl-10 pr-4 py-2 rounded-xl bg-dark-950/80 border border-cherry-900/50 focus:border-cherry-500 focus:ring-2 focus:ring-cherry-500/20 text-xs sm:text-sm text-white placeholder-rose-300/40 transition-all"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-rose-300/50 hover:text-white"
                    >
                      Clear
                    </button>
                  )}
                </div>

                {/* Scenario Filter Pills */}
                <div className="flex items-center gap-1.5 w-full md:w-auto overflow-x-auto pb-1 md:pb-0 scrollbar-none">
                  <button
                    onClick={() => setScenarioFilter('all')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                      scenarioFilter === 'all'
                        ? 'bg-cherry-600 text-white shadow-cherry-glow'
                        : 'bg-dark-900/80 text-rose-300/70 hover:text-white hover:bg-dark-800'
                    }`}
                  >
                    All ({subjects.length})
                  </button>
                  <button
                    onClick={() => setScenarioFilter('safe')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap flex items-center gap-1 transition-all ${
                      scenarioFilter === 'safe'
                        ? 'bg-emerald-600 text-white shadow-[0_0_15px_rgba(16,185,129,0.3)]'
                        : 'bg-dark-900/80 text-emerald-400/80 hover:text-emerald-300 hover:bg-dark-800'
                    }`}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Safe ({summary.safeCount})</span>
                  </button>
                  <button
                    onClick={() => setScenarioFilter('borderline')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap flex items-center gap-1 transition-all ${
                      scenarioFilter === 'borderline'
                        ? 'bg-amber-600 text-white shadow-[0_0_15px_rgba(245,158,11,0.3)]'
                        : 'bg-dark-900/80 text-amber-400/80 hover:text-amber-300 hover:bg-dark-800'
                    }`}
                  >
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>Borderline ({summary.borderlineCount})</span>
                  </button>
                  <button
                    onClick={() => setScenarioFilter('doomed')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap flex items-center gap-1 transition-all ${
                      scenarioFilter === 'doomed'
                        ? 'bg-cherry-800 text-white shadow-cherry-glow'
                        : 'bg-dark-900/80 text-cherry-400 hover:text-rose-300 hover:bg-dark-800'
                    }`}
                  >
                    <Skull className="w-3.5 h-3.5" />
                    <span>Doomed ({summary.doomedCount})</span>
                  </button>
                </div>

                {/* Sort Dropdown */}
                <div className="flex items-center gap-2 w-full md:w-auto justify-end">
                  <ArrowUpDown className="w-3.5 h-3.5 text-rose-300/50" />
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as any)}
                    className="bg-dark-950/80 border border-cherry-900/50 rounded-xl px-3 py-1.5 text-xs font-semibold text-rose-200 focus:border-cherry-500 focus:outline-none cursor-pointer"
                  >
                    <option value="percentage">Lowest Attendance % First</option>
                    <option value="bunks">Fewest Bunks Left First</option>
                    <option value="name">Subject Name (A-Z)</option>
                  </select>
                </div>
              </div>
            )}

            {/* Subject Cards Grid */}
            {subjects.length === 0 ? (
              <EmptyState
                onAddClick={handleOpenAdd}
              />
            ) : filteredSubjects.length === 0 ? (
              <div className="glass-panel rounded-3xl p-8 text-center max-w-md mx-auto my-12 border border-cherry-900/40">
                <p className="text-rose-200 font-semibold mb-2">No subjects match the filter</p>
                <p className="text-xs text-rose-300/60 mb-4">Try adjusting your search query or scenario category filter.</p>
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setScenarioFilter('all');
                  }}
                  className="px-4 py-2 rounded-xl bg-cherry-950 text-rose-300 hover:text-white border border-cherry-800/40 text-xs font-semibold transition-all"
                >
                  Reset Filters
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
                {filteredSubjects.map((subject) => (
                  <SubjectCard
                    key={subject.id}
                    subject={subject}
                    onEdit={handleOpenEdit}
                    onDelete={handleDeleteSubject}
                    onQuickUpdate={handleQuickUpdate}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Classmates Live Attendance Hub */}
        {activeTab === 'community' && (
          <CommunityView
            peers={allPeers}
            onPeerUpdate={handlePeerUpdate}
            onOpenAuth={() => setIsAuthOpen(true)}
            onSyncAll={handleSyncAllToCloud}
            isSyncing={isSyncing}
          />
        )}

        {/* Tab 3: Bunk Leaderboard */}
        {activeTab === 'leaderboard' && (
          <LeaderboardView peers={allPeers} />
        )}
      </main>

      {/* Add / Edit Modal */}
      <SubjectModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveSubject}
        initialSubject={editingSubject}
      />

      {/* Auth Modal */}
      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        onOpenConfig={() => setIsConfigOpen(true)}
      />

      {/* Firebase Config Modal */}
      <FirebaseConfigModal
        isOpen={isConfigOpen}
        onClose={() => setIsConfigOpen(false)}
      />

      {/* Footer */}
      <footer className="mt-20 border-t border-cherry-950/80 pt-8 text-center text-xs text-rose-300/50">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p>© {new Date().getFullYear()} Chemistry Capybara 🦫 • Multi-User Attendance & Bunk Predictor</p>
          <div className="flex items-center gap-4 text-rose-300/60">
            <span>Target: 75.0% strictly</span>
            <span>•</span>
            <button onClick={() => setIsConfigOpen(true)} className="hover:text-cherry-300 underline">
              Firebase Config
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}

export function App() {
  return (
    <AuthProvider>
      <AttendanceApp />
    </AuthProvider>
  );
}

export default App;
