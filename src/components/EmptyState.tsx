import React from 'react';
import { Plus, Flame } from 'lucide-react';

interface EmptyStateProps {
  onAddClick: () => void;
}

export const EmptyState: React.FC<EmptyStateProps> = ({ onAddClick }) => {
  return (
    <div className="glass-panel rounded-3xl p-8 sm:p-12 text-center max-w-xl mx-auto my-12 border border-cherry-900/40 relative overflow-hidden">
      <div className="w-20 h-20 mx-auto rounded-3xl bg-gradient-to-tr from-cherry-950 via-cherry-900 to-dark-900 border border-cherry-700/40 flex items-center justify-center shadow-cherry-glow mb-6">
        <Flame className="w-10 h-10 text-cherry-500 animate-pulse-subtle" />
      </div>

      <h3 className="text-2xl font-black text-white tracking-tight mb-2">
        No Subjects Added Yet
      </h3>
      <p className="text-sm text-rose-300/70 max-w-md mx-auto mb-8 leading-relaxed">
        Add your college courses with their total and attended classes to calculate safe bunks, borderline warnings, and stay above 75%.
      </p>

      <div className="flex items-center justify-center">
        <button
          onClick={onAddClick}
          className="px-6 py-3 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-cherry-600 to-rose-600 hover:from-cherry-500 hover:to-rose-500 shadow-cherry-glow hover:shadow-cherry-glow-lg transition-all active:scale-95 flex items-center justify-center gap-2"
        >
          <Plus className="w-4 h-4" />
          <span>Add Your First Subject</span>
        </button>
      </div>
    </div>
  );
};
