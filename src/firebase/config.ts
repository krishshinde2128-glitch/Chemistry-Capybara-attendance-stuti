import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';

export interface FirebaseConfigParams {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket?: string;
  messagingSenderId?: string;
  appId: string;
}

const STORAGE_KEY = 'cherry_firebase_runtime_config_v1';

// Default project configuration provided by user
const DEFAULT_FIREBASE_CONFIG: FirebaseConfigParams = {
  apiKey: "AIzaSyDkt-0bu_gJS-XTzCl4Gn-7lb07YxR-wmA",
  authDomain: "dietcoke-514f4.firebaseapp.com",
  projectId: "dietcoke-514f4",
  storageBucket: "dietcoke-514f4.firebasestorage.app",
  messagingSenderId: "499774229828",
  appId: "1:499774229828:web:63e471ecfd2aa4b3189b11"
};

export function getStoredFirebaseConfig(): FirebaseConfigParams {
  try {
    const item = localStorage.getItem(STORAGE_KEY);
    if (item) return JSON.parse(item);
  } catch (e) {
    console.warn('Error reading stored Firebase config', e);
  }

  // Check Vite env variables
  if (import.meta.env.VITE_FIREBASE_API_KEY && import.meta.env.VITE_FIREBASE_PROJECT_ID) {
    return {
      apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
      authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || `${import.meta.env.VITE_FIREBASE_PROJECT_ID}.firebaseapp.com`,
      projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
      storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
      appId: import.meta.env.VITE_FIREBASE_APP_ID || '',
    };
  }

  return DEFAULT_FIREBASE_CONFIG;
}

export function saveStoredFirebaseConfig(config: FirebaseConfigParams) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  window.location.reload();
}

export function clearStoredFirebaseConfig() {
  localStorage.removeItem(STORAGE_KEY);
  window.location.reload();
}

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;

const initialConfig = getStoredFirebaseConfig();

if (initialConfig && initialConfig.apiKey && initialConfig.projectId) {
  try {
    app = getApps().length > 0 ? getApp() : initializeApp(initialConfig);
    auth = getAuth(app);
    db = getFirestore(app);
  } catch (err) {
    console.error('Failed to initialize Firebase with current config:', err);
  }
}

export { app, auth, db };
export const isFirebaseConfigured = Boolean(auth && db);
