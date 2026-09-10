import React, { useState } from 'react';
import { X, Flame, KeyRound, ExternalLink, HelpCircle } from 'lucide-react';
import { getStoredFirebaseConfig, saveStoredFirebaseConfig, clearStoredFirebaseConfig, isFirebaseConfigured } from '../firebase/config';

interface FirebaseConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const FirebaseConfigModal: React.FC<FirebaseConfigModalProps> = ({ isOpen, onClose }) => {
  const current = getStoredFirebaseConfig();
  const [apiKey, setApiKey] = useState(current?.apiKey || '');
  const [authDomain, setAuthDomain] = useState(current?.authDomain || '');
  const [projectId, setProjectId] = useState(current?.projectId || '');
  const [appId, setAppId] = useState(current?.appId || '');

  if (!isOpen) return null;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiKey || !projectId || !appId) {
      alert('Please fill in at least API Key, Project ID, and App ID.');
      return;
    }
    saveStoredFirebaseConfig({
      apiKey: apiKey.trim(),
      authDomain: authDomain.trim() || `${projectId.trim()}.firebaseapp.com`,
      projectId: projectId.trim(),
      appId: appId.trim(),
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md overflow-y-auto animate-fadeIn">
      <div className="relative w-full max-w-2xl glass-panel rounded-3xl p-6 sm:p-8 shadow-2xl border border-cherry-600/40 my-8">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-cherry-900/50 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-cherry-700 to-rose-500 p-[1px] flex items-center justify-center shadow-cherry-glow">
              <div className="w-full h-full bg-dark-900 rounded-2xl flex items-center justify-center">
                <Flame className="w-5 h-5 text-cherry-400" />
              </div>
            </div>
            <div>
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <span>Firebase Setup & Configuration</span>
                <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full border ${
                  isFirebaseConfigured
                    ? 'bg-emerald-950 text-emerald-300 border-emerald-500/40'
                    : 'bg-amber-950 text-amber-300 border-amber-500/40'
                }`}>
                  {isFirebaseConfigured ? 'Connected' : 'Not Connected'}
                </span>
              </h2>
              <p className="text-xs text-rose-300/60">
                Connect your Firebase project for multi-user authentication, cloud sync, and leaderboards
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-rose-300/60 hover:text-white hover:bg-cherry-900/40 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Instructions Accordion / Steps */}
        <div className="mb-6 p-4 rounded-2xl bg-dark-900/90 border border-cherry-950 space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-cherry-400 flex items-center gap-1.5">
            <HelpCircle className="w-4 h-4" /> Steps to create your Firebase project
          </h3>
          <ol className="text-xs text-rose-200/80 space-y-2 list-decimal list-inside leading-relaxed">
            <li>
              Go to <a href="https://console.firebase.google.com" target="_blank" rel="noreferrer" className="text-cherry-400 underline inline-flex items-center gap-0.5">Firebase Console <ExternalLink className="w-3 h-3" /></a> and click <strong>Add Project</strong>.
            </li>
            <li>
              In <strong>Authentication</strong> &gt; <strong>Sign-in method</strong>, enable <strong>Google</strong> and <strong>Email/Password</strong>.
            </li>
            <li>
              In <strong>Firestore Database</strong>, click <strong>Create database</strong> (choose Start in Test Mode or Production Mode).
            </li>
            <li>
              In <strong>Project Settings</strong> (gear icon) &gt; <strong>General</strong> &gt; <strong>Your apps</strong>, click Web (<code>&lt;/&gt;</code>) to register an app.
            </li>
            <li>
              Copy the keys from <code>firebaseConfig</code> and paste them below (or put them in a <code>.env.local</code> file).
            </li>
          </ol>
        </div>

        {/* Form */}
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-rose-200 mb-1">
                API Key (apiKey) *
              </label>
              <input
                type="text"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="AIzaSy..."
                className="w-full px-3.5 py-2 rounded-xl bg-dark-950 border border-cherry-900/60 focus:border-cherry-500 text-white font-mono text-xs transition-all"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-rose-200 mb-1">
                Project ID (projectId) *
              </label>
              <input
                type="text"
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                placeholder="my-attendance-app"
                className="w-full px-3.5 py-2 rounded-xl bg-dark-950 border border-cherry-900/60 focus:border-cherry-500 text-white font-mono text-xs transition-all"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-rose-200 mb-1">
                App ID (appId) *
              </label>
              <input
                type="text"
                value={appId}
                onChange={(e) => setAppId(e.target.value)}
                placeholder="1:123456:web:abcd..."
                className="w-full px-3.5 py-2 rounded-xl bg-dark-950 border border-cherry-900/60 focus:border-cherry-500 text-white font-mono text-xs transition-all"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-rose-200 mb-1">
                Auth Domain (Optional)
              </label>
              <input
                type="text"
                value={authDomain}
                onChange={(e) => setAuthDomain(e.target.value)}
                placeholder="my-app.firebaseapp.com"
                className="w-full px-3.5 py-2 rounded-xl bg-dark-950 border border-cherry-900/60 focus:border-cherry-500 text-white font-mono text-xs transition-all"
              />
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-between pt-4 border-t border-cherry-900/40 mt-6">
            {current ? (
              <button
                type="button"
                onClick={clearStoredFirebaseConfig}
                className="text-xs text-cherry-400 hover:text-cherry-300 underline"
              >
                Disconnect / Reset Config
              </button>
            ) : <span />}

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-rose-300/70 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-6 py-2.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-cherry-600 to-rose-600 hover:from-cherry-500 hover:to-rose-500 shadow-cherry-glow active:scale-95 transition-all flex items-center gap-1.5"
              >
                <KeyRound className="w-3.5 h-3.5" />
                <span>Save & Connect</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
