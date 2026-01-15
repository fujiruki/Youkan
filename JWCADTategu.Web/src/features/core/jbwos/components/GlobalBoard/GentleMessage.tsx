import React from 'react';
// import { cn } from '../../../../lib/utils';
import { t } from '../../../../../i18n/labels';

interface GentleMessageProps {
    variant: 'done_for_day' | 'almost_done' | 'inbox_clean';
}

export const GentleMessage: React.FC<GentleMessageProps> = ({ variant }) => {

    if (variant === 'inbox_clean') {
        return (
            <div className="flex flex-col items-center justify-center p-8 text-center text-slate-400">
                <div className="text-4xl mb-2">🍃</div>
                <p>{t.jbwos.inbox.empty}</p>
            </div>
        );
    }

    if (variant === 'done_for_day') {
        return (
            <div className="flex flex-col items-center justify-center p-8 text-center text-amber-600 dark:text-amber-500">
                <div className="text-4xl mb-2">☕</div>
                <p className="font-medium">{t.jbwos.ready.doneForDay}</p>
            </div>
        );
    }

    if (variant === 'almost_done') {
        return (
            <div className="text-slate-400 text-sm mt-4 text-center">
                あと1つ。<br />それで十分です。
            </div>
        );
    }

    if (variant === 'inbox_clean') {
        return (
            <div className="flex flex-col items-center text-slate-400 mt-10 opacity-50">
                <span className="text-2xl mb-2">✨</span>
                <span className="text-sm">頭の中は空っぽです</span>
            </div>
        );
    }

    return null;
};
