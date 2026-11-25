export interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  photoURL?: string;
  isPrivate: boolean; // Privacy Toggle: if true, attendance is hidden from other users
  totalBunksRemaining?: number;
  overallPercentage?: number;
  batch?: string; // e.g. 'larrypage'
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

export type DayOfWeek = 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday' | 'Sunday';

export interface TimetableClass {
  id: string;
  day: DayOfWeek;
  startTime: string; // e.g. "09:00 AM"
  endTime: string;   // e.g. "10:00 AM"
  timeSlot: string;  // e.g. "09:00 - 10:00"
  subjectName: string;
  courseCode?: string;
  batch: string;     // e.g. "larrypage"
  room?: string;
  instructor?: string;
  lastMarkedDate?: string; // YYYY-MM-DD
}

export interface TimetableConfig {
  sheetUrl: string;
  targetBatch: string; // default "larrypage"
  lastSyncedAt?: number;
  classes: TimetableClass[];
}
