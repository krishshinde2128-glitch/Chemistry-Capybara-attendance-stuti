import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  query,
  where,
  updateDoc,
  getDocs,
} from 'firebase/firestore';
import { db } from './config';
import type { Subject, UserProfile, PeerUserWithSubjects } from '../types/attendance';
import { calculateOverallSummary } from '../utils/calculator';

/**
 * Strips undefined values from an object so Firestore does not reject it
 */
function cleanFirestoreData<T extends Record<string, any>>(obj: T): Record<string, any> {
  const result: Record<string, any> = {};
  for (const key of Object.keys(obj)) {
    const val = obj[key];
    if (val !== undefined) {
      result[key] = val;
    }
  }
  return result;
}

/**
 * Ensures or updates a user profile document in Firestore
 */
export async function syncUserProfile(user: {
  uid: string;
  displayName: string | null;
  email: string | null;
  photoURL?: string | null;
}, isPrivateDefault = false): Promise<UserProfile> {
  if (!db) throw new Error('Firestore is not initialized');

  const userRef = doc(db, 'users', user.uid);
  const userProfile: UserProfile = {
    uid: user.uid,
    displayName: user.displayName || user.email?.split('@')[0] || 'Student',
    email: user.email || '',
    photoURL: user.photoURL || undefined,
    isPrivate: isPrivateDefault,
    updatedAt: Date.now(),
  };

  await setDoc(userRef, cleanFirestoreData(userProfile), { merge: true });
  return userProfile;
}

/**
 * Toggles a user's privacy (Hide/Show attendance to others)
 */
export async function updateUserPrivacy(uid: string, isPrivate: boolean): Promise<void> {
  if (!db) throw new Error('Firestore is not initialized');
  const userRef = doc(db, 'users', uid);
  await updateDoc(userRef, { isPrivate, updatedAt: Date.now() });
}

/**
 * Saves or updates a subject for a specific user
 */
export async function saveSubjectToFirestore(userId: string, userName: string, subject: Subject): Promise<void> {
  if (!db) throw new Error('Firestore is not initialized');
  const subjectDoc = doc(db, 'subjects', subject.id);
  
  const dataToSave = cleanFirestoreData({
    ...subject,
    userId,
    userName,
    code: subject.code || '',
    lastUpdatedBy: subject.lastUpdatedBy || userName,
    updatedAt: Date.now(),
  });

  await setDoc(subjectDoc, dataToSave, { merge: true });
}

/**
 * Deletes a subject from Firestore
 */
export async function deleteSubjectFromFirestore(subjectId: string): Promise<void> {
  if (!db) throw new Error('Firestore is not initialized');
  const subjectDoc = doc(db, 'subjects', subjectId);
  await deleteDoc(subjectDoc);
}

/**
 * Peer Update: Allows one classmate to update attendance numbers for another user's subject
 */
export async function updatePeerSubjectAttendance(
  subjectId: string,
  deltaAttended: number,
  deltaConducted: number,
  currentSubject: Subject,
  updaterName: string
): Promise<void> {
  if (!db) throw new Error('Firestore is not initialized');
  const subjectDoc = doc(db, 'subjects', subjectId);

  const newConducted = Math.min(currentSubject.totalClasses, currentSubject.conductedClasses + deltaConducted);
  const newAttended = Math.min(newConducted, currentSubject.attendedClasses + deltaAttended);

  await updateDoc(subjectDoc, cleanFirestoreData({
    conductedClasses: newConducted,
    attendedClasses: newAttended,
    lastUpdatedBy: updaterName,
    updatedAt: Date.now(),
  }));
}

/**
 * Subscribes in real-time to the current logged-in user's subjects
 */
export function subscribeToUserSubjects(userId: string, onUpdate: (subjects: Subject[]) => void) {
  if (!db) return () => {};

  const q = query(collection(db, 'subjects'), where('userId', '==', userId));
  return onSnapshot(q, (snapshot) => {
    const list: Subject[] = [];
    snapshot.forEach((docSnap) => {
      list.push(docSnap.data() as Subject);
    });
    list.sort((a, b) => b.updatedAt - a.updatedAt);
    onUpdate(list);
  }, (err) => {
    console.warn('Error subscribing to user subjects:', err);
  });
}

/**
 * Subscribes in real-time to all public community members and their subjects
 */
export function subscribeToCommunity(_currentUserId: string, onUpdate: (peers: PeerUserWithSubjects[]) => void) {
  if (!db) return () => {};

  const usersQuery = query(collection(db, 'users'), where('isPrivate', '==', false));
  const subjectsQuery = collection(db, 'subjects');

  let publicUsersMap = new Map<string, UserProfile>();
  let allSubjects: Subject[] = [];

  const updateMerged = () => {
    const peerList: PeerUserWithSubjects[] = [];

    publicUsersMap.forEach((user, uid) => {
      const userSubs = allSubjects.filter((s) => s.userId === uid);
      const summary = calculateOverallSummary(userSubs);
      peerList.push({
        user: {
          ...user,
          totalBunksRemaining: summary.totalBunksRemaining,
          overallPercentage: summary.currentPercentage,
        },
        subjects: userSubs,
        summary,
      });
    });

    peerList.sort((a, b) => (b.user.totalBunksRemaining || 0) - (a.user.totalBunksRemaining || 0));
    onUpdate(peerList);
  };

  const unsubUsers = onSnapshot(usersQuery, (snapshot) => {
    publicUsersMap = new Map<string, UserProfile>();
    snapshot.forEach((docSnap) => {
      const data = docSnap.data() as UserProfile;
      publicUsersMap.set(data.uid, data);
    });
    updateMerged();
  }, (err) => {
    console.warn('Error listening to public users:', err);
  });

  const unsubSubjects = onSnapshot(subjectsQuery, (snapshot) => {
    allSubjects = [];
    snapshot.forEach((docSnap) => {
      allSubjects.push(docSnap.data() as Subject);
    });
    updateMerged();
  }, (err) => {
    console.warn('Error listening to subjects:', err);
  });

  return () => {
    unsubUsers();
    unsubSubjects();
  };
}

/**
 * ADMIN: Fetches all registered users and all subjects from Firestore
 */
export async function getAllUsersAndSubjectsForAdmin(): Promise<{
  users: UserProfile[];
  allSubjects: Subject[];
  userSubjectsMap: Record<string, Subject[]>;
}> {
  if (!db) {
    return { users: [], allSubjects: [], userSubjectsMap: {} };
  }

  try {
    const [usersSnap, subjectsSnap] = await Promise.all([
      getDocs(collection(db, 'users')),
      getDocs(collection(db, 'subjects')),
    ]);

    const usersMap = new Map<string, UserProfile>();
    usersSnap.forEach((docSnap) => {
      const data = docSnap.data() as UserProfile;
      usersMap.set(data.uid, data);
    });

    const allSubjects: Subject[] = [];
    const userSubjectsMap: Record<string, Subject[]> = {};

    subjectsSnap.forEach((docSnap) => {
      const s = docSnap.data() as Subject;
      allSubjects.push(s);
      if (s.userId) {
        if (!userSubjectsMap[s.userId]) {
          userSubjectsMap[s.userId] = [];
        }
        userSubjectsMap[s.userId].push(s);

        // If user wasn't in users collection, add a placeholder so they appear in admin directory
        if (!usersMap.has(s.userId)) {
          usersMap.set(s.userId, {
            uid: s.userId,
            displayName: s.userName || 'Student',
            email: '',
            isPrivate: false,
            updatedAt: s.updatedAt || Date.now(),
          });
        }
      }
    });

    const users = Array.from(usersMap.values());
    return { users, allSubjects, userSubjectsMap };
  } catch (err) {
    console.error('Error fetching admin data from Firestore:', err);
    throw err;
  }
}

export interface BroadcastClassPayload {
  name: string;
  code?: string;
  totalClasses: number;
  conductedClasses: number;
  attendedClasses: number;
}

export interface BroadcastResult {
  totalTargeted: number;
  addedCount: number;
  skippedCount: number;
  details: Array<{
    uid: string;
    displayName: string;
    status: 'added' | 'skipped' | 'error';
    message?: string;
  }>;
}

/**
 * ADMIN: Adds a class / subject to all targeted users in Firestore
 */
export async function broadcastClassToUsers(
  targetUsers: Array<{ uid: string; displayName?: string; email?: string }>,
  classData: BroadcastClassPayload,
  skipIfExists = true
): Promise<BroadcastResult> {
  if (!db) {
    throw new Error('Firestore is not initialized');
  }

  // Pre-fetch all subjects to quickly check for duplicates
  const subjectsSnap = await getDocs(collection(db, 'subjects'));
  const existingUserSubjectsMap = new Map<string, Subject[]>();
  
  subjectsSnap.forEach((docSnap) => {
    const s = docSnap.data() as Subject;
    if (s.userId) {
      if (!existingUserSubjectsMap.has(s.userId)) {
        existingUserSubjectsMap.set(s.userId, []);
      }
      existingUserSubjectsMap.get(s.userId)!.push(s);
    }
  });

  const normalizedNewName = classData.name.trim().toLowerCase();
  const normalizedNewCode = (classData.code || '').trim().toLowerCase();

  const details: BroadcastResult['details'] = [];
  let addedCount = 0;
  let skippedCount = 0;

  for (const user of targetUsers) {
    const userName = user.displayName || user.email?.split('@')[0] || 'Student';
    const userExisting = existingUserSubjectsMap.get(user.uid) || [];

    // Check duplicate
    if (skipIfExists) {
      const isDuplicate = userExisting.some((s) => {
        const sameName = s.name.trim().toLowerCase() === normalizedNewName;
        const sameCode = normalizedNewCode && s.code && s.code.trim().toLowerCase() === normalizedNewCode;
        return sameName || sameCode;
      });

      if (isDuplicate) {
        skippedCount++;
        details.push({
          uid: user.uid,
          displayName: userName,
          status: 'skipped',
          message: 'Already has a class with this name/code',
        });
        continue;
      }
    }

    try {
      const subjectId = `sub_${user.uid}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      const newSubject: Subject = {
        id: subjectId,
        userId: user.uid,
        userName,
        name: classData.name.trim(),
        code: classData.code?.trim() || '',
        totalClasses: Number(classData.totalClasses),
        conductedClasses: Number(classData.conductedClasses),
        attendedClasses: Number(classData.attendedClasses),
        lastUpdatedBy: 'Admin Broadcast',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const docRef = doc(db, 'subjects', subjectId);
      await setDoc(docRef, cleanFirestoreData(newSubject), { merge: true });

      addedCount++;
      details.push({
        uid: user.uid,
        displayName: userName,
        status: 'added',
      });
    } catch (err: any) {
      console.error(`Failed to add class to user ${user.uid}:`, err);
      details.push({
        uid: user.uid,
        displayName: userName,
        status: 'error',
        message: err.message || 'Firestore write error',
      });
    }
  }

  return {
    totalTargeted: targetUsers.length,
    addedCount,
    skippedCount,
    details,
  };
}

/**
 * ADMIN: Removes any subject matching the given name from all users in Firestore
 */
export async function removeClassFromAllUsers(subjectName: string): Promise<number> {
  if (!db) throw new Error('Firestore is not initialized');

  const subjectsSnap = await getDocs(collection(db, 'subjects'));
  const normalizedTarget = subjectName.trim().toLowerCase();
  const toDeleteIds: string[] = [];

  subjectsSnap.forEach((docSnap) => {
    const s = docSnap.data() as Subject;
    if (s.name.trim().toLowerCase() === normalizedTarget) {
      toDeleteIds.push(docSnap.id);
    }
  });

  for (const id of toDeleteIds) {
    await deleteDoc(doc(db, 'subjects', id));
  }

  return toDeleteIds.length;
}

