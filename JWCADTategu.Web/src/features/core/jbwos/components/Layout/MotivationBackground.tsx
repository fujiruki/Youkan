import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../../../core/auth/providers/AuthProvider';

export const MotivationBackground: React.FC = () => {
    const { user } = useAuth();
    const [selectedQuote, setSelectedQuote] = useState<string | null>(null);

    const quotes = useMemo(() => {
        if (!user?.preferences) return [];
        const prefs = typeof user.preferences === 'string' ? JSON.parse(user.preferences) : user.preferences;
        const rawQuotes = prefs.motivation_quotes || '';
        return rawQuotes.split('\n').map((s: string) => s.trim()).filter((s: string) => s.length > 0);
    }, [user?.preferences]);

    useEffect(() => {
        if (quotes.length > 0) {
            const randomQuote = quotes[Math.floor(Math.random() * quotes.length)];
            setSelectedQuote(randomQuote);
        } else {
            setSelectedQuote("一歩ずつ進もう。");
        }
    }, [quotes]);

    if (!selectedQuote) return null;

    return (
        <span className="text-sm font-medium text-slate-400 dark:text-slate-500 italic ml-2 opacity-70">
            「{selectedQuote}」
        </span>
    );
};
