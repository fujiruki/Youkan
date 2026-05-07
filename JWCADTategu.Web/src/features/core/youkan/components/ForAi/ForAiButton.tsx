import React from 'react';
import { Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

type Props = { onClick: () => void; className?: string };

export const ForAiButton: React.FC<Props> = ({ onClick, className }) => (
  <button
    onClick={onClick}
    className={cn('p-1.5 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-slate-200', className)}
    title="AIに状況を渡す（ForAI）"
    aria-label="ForAI"
  >
    <Sparkles size={18} />
  </button>
);
