import React, { useState, useEffect } from 'react';
import { X, Sparkles, AlertCircle, Calculator } from 'lucide-react';
import type { Subject } from '../types/attendance';
import { calculateSubjectStats } from '../utils/calculator';

interface SubjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (subjectData: Omit<Subject, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }) => void;
  initialSubject?: Subject | null;
}

export const SubjectModal: React.FC<SubjectModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialSubject,
}) => {
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [totalClasses, setTotalClasses] = useState<number | ''>(50);
  const [conductedClasses, setConductedClasses] = useState<number | ''>(20);
  const [attendedClasses, setAttendedClasses] = useState<number | ''>(18);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (initialSubject) {
      setName(initialSubject.name);
      setCode(initialSubject.code || '');
      setTotalClasses(initialSubject.totalClasses);
      setConductedClasses(initialSubject.conductedClasses);
      setAttendedClasses(initialSubject.attendedClasses);
    } else {
      setName('');
      setCode('');
      setTotalClasses(50);
      setConductedClasses(20);
      setAttendedClasses(18);
    }
    setErrors({});
  }, [initialSubject, isOpen]);

  if (!isOpen) return null;

  const tNum = totalClasses === '' ? 0 : Number(totalClasses);
  const cNum = conductedClasses === '' ? 0 : Number(conductedClasses);
  const aNum = attendedClasses === '' ? 0 : Number(attendedClasses);

  // Live preview calculations
  const previewStats = calculateSubjectStats({
    id: 'preview',
    name: name || 'Subject Preview',
    code,
    totalClasses: Math.max(1, tNum || 1),
    conductedClasses: Math.min(Math.max(1, tNum || 1), Math.max(0, cNum)),
    attendedClasses: Math.min(Math.max(0, cNum), Math.max(0, aNum)),
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });

  const validate = (): boolean => {
    const errs: Record<string, string> = {};

    if (!name.trim()) {
      errs.name = 'Subject name is required';
    }

    if (tNum <= 0) {
      errs.totalClasses = 'Total classes (T) must be greater than 0';
    }

    if (cNum < 0) {
      errs.conductedClasses = 'Conducted classes (C) cannot be negative';
    } else if (tNum > 0 && cNum > tNum) {
      errs.conductedClasses = `Conducted (${cNum}) cannot exceed Total classes (${tNum})`;
    }

    if (aNum < 0) {
      errs.attendedClasses = 'Attended classes (A) cannot be negative';
    } else if (aNum > cNum) {
      errs.attendedClasses = `Attended (${aNum}) cannot exceed Conducted classes (${cNum})`;
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    onSave({
      id: initialSubject ? initialSubject.id : undefined,
      name: name.trim(),
      code: code.trim() || undefined,
      totalClasses: Math.max(1, tNum),
      conductedClasses: Math.max(0, cNum),
      attendedClasses: Math.max(0, aNum),
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md overflow-y-auto animate-fadeIn">
      <div className="relative w-full max-w-lg glass-panel rounded-3xl p-6 sm:p-8 shadow-2xl border border-cherry-600/30 my-8">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-cherry-900/50 mb-6">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-cherry-950/80 border border-cherry-700/50 flex items-center justify-center text-cherry-400">
              <Calculator className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">
                {initialSubject ? 'Edit Subject' : 'Add New Subject'}
              </h2>
              <p className="text-xs text-rose-300/60">
                Enter class totals to calculate safe bunks and threshold
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

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Subject Name & Code */}
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-rose-200 mb-1.5">
                Subject Name *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (errors.name) setErrors((prev) => ({ ...prev, name: '' }));
                }}
                placeholder="e.g., Mathematics"
                className="w-full px-3.5 py-2.5 rounded-xl bg-dark-900/90 border border-cherry-900/60 focus:border-cherry-500 focus:ring-2 focus:ring-cherry-500/20 text-white placeholder-rose-400/30 text-sm transition-all"
                required
              />
              {errors.name && (
                <p className="text-xs text-cherry-400 mt-1 flex items-center gap-1 font-semibold">
                  <AlertCircle className="w-3.5 h-3.5" /> {errors.name}
                </p>
              )}
            </div>

            <div className="col-span-1">
              <label className="block text-xs font-bold uppercase tracking-wider text-rose-200 mb-1.5">
                Code (Optional)
              </label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="e.g. MTH101"
                className="w-full px-3.5 py-2.5 rounded-xl bg-dark-900/90 border border-cherry-900/60 focus:border-cherry-500 focus:ring-2 focus:ring-cherry-500/20 text-white placeholder-rose-400/30 text-sm transition-all uppercase"
              />
            </div>
          </div>

          {/* Total Classes (T) */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-rose-200">
                Total Classes in Semester (T) *
              </label>
              <span className="text-[11px] text-rose-300/50">Full semester estimate</span>
            </div>
            <input
              type="number"
              min="1"
              value={totalClasses}
              onChange={(e) => {
                const val = e.target.value === '' ? '' : parseInt(e.target.value, 10);
                setTotalClasses(isNaN(val as number) ? '' : val);
                if (errors.totalClasses) setErrors((prev) => ({ ...prev, totalClasses: '' }));
              }}
              placeholder="e.g. 60"
              className="w-full px-3.5 py-2.5 rounded-xl bg-dark-900/90 border border-cherry-900/60 focus:border-cherry-500 focus:ring-2 focus:ring-cherry-500/20 text-white text-sm transition-all"
              required
            />
            {errors.totalClasses && (
              <p className="text-xs text-cherry-400 mt-1 flex items-center gap-1 font-semibold">
                <AlertCircle className="w-3.5 h-3.5" /> {errors.totalClasses}
              </p>
            )}
          </div>

          {/* Conducted Classes (C) & Attended (A) */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-rose-200">
                  Conducted So Far (C) *
                </label>
              </div>
              <input
                type="number"
                min="0"
                value={conductedClasses}
                onChange={(e) => {
                  const val = e.target.value === '' ? '' : parseInt(e.target.value, 10);
                  setConductedClasses(isNaN(val as number) ? '' : val);
                  if (errors.conductedClasses) setErrors((prev) => ({ ...prev, conductedClasses: '' }));
                }}
                placeholder="e.g. 24"
                className="w-full px-3.5 py-2.5 rounded-xl bg-dark-900/90 border border-cherry-900/60 focus:border-cherry-500 focus:ring-2 focus:ring-cherry-500/20 text-white text-sm transition-all"
                required
              />
              {errors.conductedClasses && (
                <p className="text-xs text-cherry-400 mt-1 flex items-center gap-1 font-semibold">
                  <AlertCircle className="w-3.5 h-3.5" /> {errors.conductedClasses}
                </p>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-rose-200">
                  Attended So Far (A) *
                </label>
              </div>
              <input
                type="number"
                min="0"
                value={attendedClasses}
                onChange={(e) => {
                  const val = e.target.value === '' ? '' : parseInt(e.target.value, 10);
                  setAttendedClasses(isNaN(val as number) ? '' : val);
                  if (errors.attendedClasses) setErrors((prev) => ({ ...prev, attendedClasses: '' }));
                }}
                placeholder="e.g. 20"
                className="w-full px-3.5 py-2.5 rounded-xl bg-dark-900/90 border border-cherry-900/60 focus:border-cherry-500 focus:ring-2 focus:ring-cherry-500/20 text-white text-sm transition-all"
                required
              />
              {errors.attendedClasses && (
                <p className="text-xs text-cherry-400 mt-1 flex items-center gap-1 font-semibold">
                  <AlertCircle className="w-3.5 h-3.5" /> {errors.attendedClasses}
                </p>
              )}
            </div>
          </div>

          {/* Real-time Math Preview Banner inside modal */}
          {tNum > 0 && (
            <div className="mt-4 p-3.5 rounded-2xl bg-dark-900/95 border border-cherry-800/40">
              <div className="flex items-center justify-between text-xs text-rose-300 mb-1.5">
                <span className="font-semibold flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5 text-cherry-400" /> Live Math Preview
                </span>
                <span className="font-bold text-white">
                  Target Required: {previewStats.targetRequired} / {tNum}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-rose-300/70">
                  Current: <strong className="text-white">{previewStats.currentPercentage.toFixed(1)}%</strong>
                </span>
                <span className={`px-2 py-0.5 rounded-full font-bold text-[11px] ${
                  previewStats.scenario === 'safe'
                    ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/40'
                    : previewStats.scenario === 'borderline'
                    ? 'bg-amber-950 text-amber-300 border border-amber-500/40'
                    : 'bg-cherry-950 text-cherry-300 border border-cherry-600/50'
                }`}>
                  {previewStats.scenario === 'safe' && `${previewStats.bunksRemaining} Bunks Left`}
                  {previewStats.scenario === 'borderline' && '0 Bunks Left'}
                  {previewStats.scenario === 'doomed' && 'DOOMED (<75%)'}
                </span>
              </div>
            </div>
          )}

          {/* Footer Buttons */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-cherry-900/40 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl text-sm font-semibold text-rose-300/70 hover:text-white hover:bg-cherry-950/50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              id="btn-submit-subject"
              className="px-6 py-2.5 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-cherry-600 to-rose-600 hover:from-cherry-500 hover:to-rose-500 shadow-cherry-glow hover:shadow-cherry-glow-lg active:scale-95 transition-all"
            >
              {initialSubject ? 'Update Subject' : 'Save Subject'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
