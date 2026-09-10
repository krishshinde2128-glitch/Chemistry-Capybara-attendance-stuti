import type { Subject, SubjectStats, AttendanceScenario, OverallSummary, PeerUserWithSubjects } from '../types/attendance';

/**
 * Calculates all attendance metrics for a single subject strictly following 75% target rules.
 */
export function calculateSubjectStats(subject: Subject): SubjectStats {
  const T = Math.max(1, Number(subject.totalClasses) || 1);
  const C = Math.min(T, Math.max(0, Number(subject.conductedClasses) || 0));
  const A = Math.min(C, Math.max(0, Number(subject.attendedClasses) || 0));

  // The Math & Logic (Per Subject)
  const targetRequired = Math.ceil(0.75 * T);
  const classesRemaining = T - C;
  const maxAbsencesAllowed = T - targetRequired;
  const absencesTaken = C - A;
  const bunksRemaining = maxAbsencesAllowed - absencesTaken;

  const currentPercentage = C === 0 ? 100 : (A / C) * 100;
  const maxPossibleAttendance = A + classesRemaining;
  const maxPossiblePercentage = T === 0 ? 100 : (maxPossibleAttendance / T) * 100;

  // Determine Scenario
  let scenario: AttendanceScenario = 'safe';
  if (maxPossibleAttendance < targetRequired) {
    scenario = 'doomed';
  } else if (bunksRemaining <= 0) {
    scenario = 'borderline';
  } else {
    scenario = 'safe';
  }

  // Consecutive classes needed to recover to 75% if currently below 75%
  let classesToRecover = 0;
  if (currentPercentage < 75 && scenario !== 'doomed') {
    classesToRecover = Math.max(1, Math.ceil(3 * C - 4 * A));
    classesToRecover = Math.min(classesToRecover, classesRemaining);
  }

  return {
    targetRequired,
    classesRemaining,
    maxAbsencesAllowed,
    absencesTaken,
    bunksRemaining: Math.max(0, bunksRemaining),
    currentPercentage,
    maxPossibleAttendance,
    maxPossiblePercentage,
    scenario,
    classesToRecover,
  };
}

/**
 * Computes global overview metrics across all subjects
 */
export function calculateOverallSummary(subjects: Subject[]): OverallSummary {
  if (subjects.length === 0) {
    return {
      totalSubjects: 0,
      totalT: 0,
      totalC: 0,
      totalA: 0,
      currentPercentage: 100,
      safeCount: 0,
      borderlineCount: 0,
      doomedCount: 0,
      totalBunksRemaining: 0,
    };
  }

  let totalT = 0;
  let totalC = 0;
  let totalA = 0;
  let safeCount = 0;
  let borderlineCount = 0;
  let doomedCount = 0;
  let totalBunksRemaining = 0;

  for (const subject of subjects) {
    const stats = calculateSubjectStats(subject);
    totalT += subject.totalClasses;
    totalC += subject.conductedClasses;
    totalA += subject.attendedClasses;
    totalBunksRemaining += stats.bunksRemaining;

    if (stats.scenario === 'safe') safeCount++;
    else if (stats.scenario === 'borderline') borderlineCount++;
    else if (stats.scenario === 'doomed') doomedCount++;
  }

  const currentPercentage = totalC === 0 ? 100 : (totalA / totalC) * 100;

  return {
    totalSubjects: subjects.length,
    totalT,
    totalC,
    totalA,
    currentPercentage,
    safeCount,
    borderlineCount,
    doomedCount,
    totalBunksRemaining,
  };
}

/**
 * Default sample subject dataset (Empty for fresh production deployment)
 */
export const SAMPLE_SUBJECTS: Subject[] = [];

/**
 * Default sample peers dataset (Empty for fresh production deployment)
 */
export const SAMPLE_PEERS: PeerUserWithSubjects[] = [];

