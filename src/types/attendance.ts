export interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  photoURL?: string;
  isPrivate: boolean; // Privacy Toggle: if true, attendance is hidden from other users
  totalBunksRemaining?: number;
  overallPercentage?: number;
  updatedAt: number;
}

export interface Subject {
  id: string;
  userId?: string;          // Owner user ID
  userName?: string;        // Owner display name
  name: string;
  totalClasses: number;     // T: Total classes for the entire semester/year
  conductedClasses: number; // C: Classes conducted/done so far
  attendedClasses: number;  // A: Classes attended so far
  code?: string;            // Optional course code (e.g. CS101)
  lastUpdatedBy?: string;   // Name of peer or user who last updated this
  createdAt: number;
  updatedAt: number;
}

export type AttendanceScenario = 'safe' | 'borderline' | 'doomed';

export interface SubjectStats {
  targetRequired: number;       // Math.ceil(0.75 * T)
  classesRemaining: number;     // T - C
  maxAbsencesAllowed: number;   // T - targetRequired
  absencesTaken: number;        // C - A
  bunksRemaining: number;       // maxAbsencesAllowed - absencesTaken
  currentPercentage: number;    // (A / C) * 100 (or 100 if C === 0)
  maxPossibleAttendance: number;// A + classesRemaining
  maxPossiblePercentage: number;// ((A + classesRemaining) / T) * 100
  scenario: AttendanceScenario;
  classesToRecover: number;     // Consecutive classes to attend to reach 75%
}

export interface OverallSummary {
  totalSubjects: number;
  totalT: number;
  totalC: number;
  totalA: number;
  currentPercentage: number;
  safeCount: number;
  borderlineCount: number;
  doomedCount: number;
  totalBunksRemaining: number;
}

export interface PeerUserWithSubjects {
  user: UserProfile;
  subjects: Subject[];
  summary: OverallSummary;
}
