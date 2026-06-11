import React, { useRef, useEffect, useState } from 'react';

interface InlineAddRowProps {
    depth: number;
    onSubmit: (title: string) => void;
    onCancel: () => void;
}

export const InlineAddRow: React.FC<InlineAddRowProps> = ({ depth, onSubmit, onCancel }) => {
    const [value, setValue] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        inputRef.current?.focus();
    }, []);

    const handleSubmit = () => {
        const trimmed = value.trim();
        if (trimmed) onSubmit(trimmed);
        else onCancel();
    };

    return (
        <div
            className="mt-[2px] break-inside-avoid"
            style={{ paddingLeft: `${depth * 1.5 + 0.5}rem` }}
        >
            <input
                ref={inputRef}
                type="text"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        handleSubmit();
                    } else if (e.key === 'Escape') {
                        onCancel();
                    }
                }}
                onBlur={() => {
                    setTimeout(() => {
                        if (!value.trim()) onCancel();
                    }, 150);
                }}
                placeholder="Alt+D to add..."
                className="w-full text-[0.9em] px-2 py-1 border border-blue-300 dark:border-blue-700 rounded bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
        </div>
    );
};
