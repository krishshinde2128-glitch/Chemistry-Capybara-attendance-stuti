// Comprehensive validation test for Attendance Calculator logic
import assert from 'node:assert';

function calculateSubjectStats(subject) {
  const T = Math.max(1, Number(subject.totalClasses) || 1);
  const C = Math.min(T, Math.max(0, Number(subject.conductedClasses) || 0));
  const A = Math.min(C, Math.max(0, Number(subject.attendedClasses) || 0));

  const targetRequired = Math.ceil(0.75 * T);
  const classesRemaining = T - C;
  const maxAbsencesAllowed = T - targetRequired;
  const absencesTaken = C - A;
  const bunksRemaining = maxAbsencesAllowed - absencesTaken;

  const currentPercentage = C === 0 ? 100 : (A / C) * 100;
  const maxPossibleAttendance = A + classesRemaining;
  const maxPossiblePercentage = T === 0 ? 100 : (maxPossibleAttendance / T) * 100;

  let scenario = 'safe';
  if (maxPossibleAttendance < targetRequired) {
    scenario = 'doomed';
  } else if (bunksRemaining <= 0) {
    scenario = 'borderline';
  } else {
    scenario = 'safe';
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
  };
}

console.log('Testing Attendance Logic Scenarios...');

// Test Scenario 1: Safe Zone
const safeSubject = {
  name: 'Math',
  totalClasses: 60,
  conductedClasses: 20,
  attendedClasses: 18,
};
const stats1 = calculateSubjectStats(safeSubject);
console.log('Safe subject stats:', stats1);
assert.strictEqual(stats1.targetRequired, 45); // 0.75 * 60 = 45
assert.strictEqual(stats1.classesRemaining, 40); // 60 - 20
assert.strictEqual(stats1.maxAbsencesAllowed, 15); // 60 - 45
assert.strictEqual(stats1.absencesTaken, 2); // 20 - 18
assert.strictEqual(stats1.bunksRemaining, 13); // 15 - 2
assert.strictEqual(stats1.scenario, 'safe');
console.log('✔ Scenario 1 (Safe Zone) Passed!');

// Test Scenario 2: Borderline (Bunks Remaining = 0)
const borderlineSubject = {
  name: 'Physics',
  totalClasses: 40,
  conductedClasses: 20,
  attendedClasses: 10,
};
// Target required = 30. Max absences allowed = 10. Absences taken = 10. Bunks remaining = 0.
const stats2 = calculateSubjectStats(borderlineSubject);
console.log('Borderline subject stats:', stats2);
assert.strictEqual(stats2.targetRequired, 30);
assert.strictEqual(stats2.classesRemaining, 20);
assert.strictEqual(stats2.maxAbsencesAllowed, 10);
assert.strictEqual(stats2.absencesTaken, 10);
assert.strictEqual(stats2.bunksRemaining, 0);
assert.strictEqual(stats2.scenario, 'borderline');
console.log('✔ Scenario 2 (Borderline) Passed!');

// Test Scenario 3: Doomed Scenario (Mathematically Impossible)
const doomedSubject = {
  name: 'Chemistry',
  totalClasses: 40,
  conductedClasses: 30,
  attendedClasses: 10,
};
// Target required = 30. Classes remaining = 10. Max possible attendance = 10 + 10 = 20 < 30.
const stats3 = calculateSubjectStats(doomedSubject);
console.log('Doomed subject stats:', stats3);
assert.strictEqual(stats3.targetRequired, 30);
assert.strictEqual(stats3.classesRemaining, 10);
assert.strictEqual(stats3.maxPossibleAttendance, 20);
assert.strictEqual(stats3.maxPossiblePercentage, 50);
assert.strictEqual(stats3.scenario, 'doomed');
console.log('✔ Scenario 3 (Doomed Scenario) Passed!');

// Test Edge Case: C = 0 (Semester just started)
const newSubject = {
  name: 'Biology',
  totalClasses: 50,
  conductedClasses: 0,
  attendedClasses: 0,
};
const stats4 = calculateSubjectStats(newSubject);
assert.strictEqual(stats4.currentPercentage, 100);
assert.strictEqual(stats4.targetRequired, 38); // ceil(0.75 * 50) = 38
assert.strictEqual(stats4.bunksRemaining, 12); // 50 - 38 = 12
assert.strictEqual(stats4.scenario, 'safe');
console.log('✔ Edge Case (Semester Start C=0) Passed!');

console.log('ALL MATH TESTS PASSED 100%!');
