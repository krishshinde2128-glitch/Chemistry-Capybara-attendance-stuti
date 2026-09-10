import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  query,
  where,
  updateDoc,
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
