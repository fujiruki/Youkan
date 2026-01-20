import React, { useState, useEffect, useRef } from 'react';
import { format, parse, isValid, addDays, nextDay } from 'date-fns';
import { CalendarIcon } from 'lucide-react';
import { cn } from '../../../../../lib/utils';

interface SmartDateInputProps {
    value: Date | null;
    onChange: (date: Date | null) => void;
    className?: string;
    autoFocus?: boolean;
}

export const SmartDateInput: React.FC<SmartDateInputProps> = ({
    value,
    onChange,
    className,
    autoFocus
}) => {
    const [inputValue, setInputValue] = useState('');
    const [isFocused, setIsFocused] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    // Sync Input Text when props value changes (unless user is typing)
    useEffect(() => {
        if (!isFocused && value) {
            setInputValue(format(value, 'yyyy/MM/dd'));
        } else if (!isFocused && !value) {
            setInputValue('');
        }
    }, [value, isFocused]);

    const handleSmartParse = (text: string) => {
        const today = new Date();
        const lower = text.toLowerCase().trim();

        // 1. Natural Language Keywords
        if (['today', 'kyou', 'ima'].includes(lower)) return today;
        if (['tomorrow', 'asu', 'tmr', 'tm'].includes(lower)) return addDays(today, 1);
        // 'next day' or next week handled vaguely
        if (['next week', 'raishu'].includes(lower)) return addDays(today, 7);

        // 2. Simple Numbers (e.g. "25" -> 25th of this month)
        if (/^\d{1,2}$/.test(lower)) {
            const day = parseInt(lower);
            return new Date(today.getFullYear(), today.getMonth(), day);
        }

        // 3. Month/Day (e.g. "1/25", "1.25", "1-25", "0125")
        if (/^\d{1,2}[\/\.\-]\d{1,2}$/.test(lower)) {
            // Handle 1.25 or 1/25
            const separator = lower.includes('.') ? '.' : lower.includes('-') ? '-' : '/';
            const parts = lower.split(separator);
            return new Date(today.getFullYear(), parseInt(parts[0]) - 1, parseInt(parts[1]));
        }
        if (/^\d{3,4}$/.test(lower)) {
            // Handle 0125 or 125
            const month = parseInt(lower.slice(0, lower.length === 3 ? 1 : 2)) - 1;
            const day = parseInt(lower.slice(lower.length === 3 ? 1 : 2));
            return new Date(today.getFullYear(), month, day);
        }

        // 4. Standard Formats
        const formats = ['yyyy/MM/dd', 'yyyy-MM-dd', 'yyyy.MM.dd', 'yyyyMMdd'];
        for (const fmt of formats) {
            const d = parse(lower, fmt, new Date());
            if (isValid(d)) return d;
        }

        return null;
    };

    const handleBlur = () => {
        setIsFocused(false);
        const parsed = handleSmartParse(inputValue);
        // Only update if valid. If empty string, consider clearing? 
        if (inputValue.trim() === '') {
            onChange(null);
            setInputValue('');
            return;
        }

        if (parsed && isValid(parsed)) {
            onChange(parsed);
            setInputValue(format(parsed, 'yyyy/MM/dd'));
        } else {
            // Revert to valid value or clear if invalid
            if (value) {
                setInputValue(format(value, 'yyyy/MM/dd'));
            } else {
                setInputValue('');
            }
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            inputRef.current?.blur(); // Trigger blur to commit
        }
        if (e.key === 'ArrowDown') {
            // Future: Focus the side calendar
            // For now just prevent default
            e.preventDefault();
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setInputValue(e.target.value);
    };

    return (
        <div className={cn("relative group", className)}>
            <input
                ref={inputRef}
                type="text" // Keep text to allow smart parsing (users want to type "tomorrow")
                value={inputValue}
                onChange={handleChange}
                onFocus={(e) => {
                    setIsFocused(true);
                    e.target.select();
                }}
                onBlur={handleBlur}
                onKeyDown={handleKeyDown}
                placeholder="YYYY/MM/DD or 'tomorrow'"
                autoFocus={autoFocus}
                // Tailwind styling matching standard Input component
                className="flex h-10 w-full rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 pl-9 text-sm font-bold text-slate-800 dark:text-slate-200 shadow-sm ring-offset-background placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50 transition-all font-mono"
            />
            <CalendarIcon className="absolute left-3 top-3 h-4 w-4 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
        </div>
    );
};
