import React from 'react';
import { Volume2 } from 'lucide-react';

type Props = {
  onClick: () => void;
  variant?: 'header' | 'floating';
};

export const SpeechButton: React.FC<Props> = ({ onClick, variant = 'header' }) => {
  if (variant === 'floating') {
    return (
      <button
        onClick={onClick}
        className="bg-indigo-600 hover:bg-indigo-700 text-white p-3 rounded-full shadow-lg transition-transform hover:scale-110"
        title="タスクを読み上げる"
        aria-label="タスクを読み上げる"
      >
        <Volume2 size={24} />
      </button>
    );
  }

  return (
    <button
      onClick={onClick}
      className="p-1.5 hover:bg-slate-700 rounded-lg transition-colors text-slate-400"
      title="タスクを読み上げる"
      aria-label="タスクを読み上げる"
    >
      <Volume2 size={18} />
    </button>
  );
};
