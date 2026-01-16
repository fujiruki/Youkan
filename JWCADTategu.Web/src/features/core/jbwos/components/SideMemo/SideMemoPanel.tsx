import React, { useState, useEffect } from 'react';
import { SideMemo } from '../../types';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight, StickyNote, Inbox, X } from 'lucide-react';
import { cn } from '../../../../../lib/utils';

interface SideMemoPanelProps {
    memos: SideMemo[];
    onAdd: (content: string) => void;
    onDelete: (id: string) => void;
    onMoveToInbox: (id: string) => void;
}

export const SideMemoPanel: React.FC<SideMemoPanelProps> = ({ memos, onAdd, onDelete, onMoveToInbox }) => {
    const [input, setInput] = useState('');
    const [isOpen, setIsOpen] = useState(true);
    const [isMobile, setIsMobile] = useState(false);

    // Responsive Check
    useEffect(() => {
        const checkMobile = () => {
            const mobile = window.innerWidth < 768;
            setIsMobile(mobile);
            if (mobile) setIsOpen(false); // Default closed on mobile
            else setIsOpen(true); // Default open on desktop
        };

        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (input.trim()) {
            onAdd(input);
            setInput('');
        }
    };

    return (
        <>
            {/* Trigger Pill (Visible when closed) */}
            <AnimatePresence>
                {!isOpen && (
                    <motion.button
                        initial={{ x: 100, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        exit={{ x: 100, opacity: 0 }}
                        onClick={() => setIsOpen(true)}
                        className="fixed bottom-20 right-0 z-50 bg-white dark:bg-slate-800 shadow-lg border-l border-t border-b border-gray-200 dark:border-slate-700 rounded-l-full pl-3 pr-2 py-2 flex items-center gap-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors group"
                    >
                        <StickyNote size={18} className="text-slate-400 group-hover:text-amber-500 transition-colors" />
                        {memos.length > 0 && (
                            <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 rounded-full min-w-[1.2em] text-center">
                                {memos.length}
                            </span>
                        )}
                    </motion.button>
                )}
            </AnimatePresence>

            {/* Panel */}
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ x: 300, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        exit={{ x: 300, opacity: 0 }}
                        transition={{ type: "spring", stiffness: 300, damping: 30 }}
                        className={cn(
                            "fixed bottom-4 right-4 z-50 flex flex-col bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-gray-200 dark:border-slate-700 rounded-xl shadow-2xl overflow-hidden",
                            isMobile ? "w-[calc(100vw-2rem)] bottom-4 right-4" : "w-72" // Wider on mobile
                        )}
                        style={{ maxHeight: '80vh' }}
                    >
                        {/* Header */}
                        <div className="bg-slate-50 dark:bg-slate-800 p-3 flex justify-between items-center border-b border-gray-100 dark:border-slate-800 cursor-pointer" onClick={() => setIsOpen(false)}>
                            <div className="flex items-center gap-2">
                                <StickyNote size={16} className="text-amber-500" />
                                <span className="text-xs font-bold text-slate-600 dark:text-slate-300">Side Memo (忘れる場所)</span>
                                <span className="bg-slate-200 dark:bg-slate-700 px-2 py-0.5 rounded-full text-[10px] font-bold text-slate-500 dark:text-slate-400">
                                    {memos.length}
                                </span>
                            </div>
                            <button
                                onClick={(e) => { e.stopPropagation(); setIsOpen(false); }}
                                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1"
                            >
                                <ChevronRight size={18} />
                            </button>
                        </div>

                        {/* List */}
                        <div className="flex-1 overflow-y-auto p-3 space-y-2 min-h-[150px]">
                            {memos.length === 0 && (
                                <div className="text-center py-8 text-xs text-slate-400 border-2 border-dashed border-slate-100 dark:border-slate-800 rounded-lg">
                                    <p>何でもここに書き出して</p>
                                    <p>頭を空っぽにしましょう</p>
                                </div>
                            )}
                            {memos.map(memo => (
                                <div key={memo.id} className="group relative bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 p-3 rounded-lg shadow-sm hover:shadow-md transition-shadow">
                                    <div className="pr-8 break-words text-sm text-slate-700 dark:text-slate-200 leading-relaxed font-medium">
                                        {memo.content}
                                    </div>

                                    {/* Quick Actions (Always visible on mobile?) No, clear is better */}
                                    <div className="absolute top-2 right-2 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-white dark:bg-slate-800 pl-1 rounded">
                                        <button
                                            onClick={() => onMoveToInbox(memo.id)}
                                            className="text-slate-400 hover:text-blue-500 p-1 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded"
                                            title="Inboxへ移動"
                                        >
                                            <Inbox size={14} />
                                        </button>
                                        <button
                                            onClick={() => onDelete(memo.id)}
                                            className="text-slate-400 hover:text-red-500 p-1 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                                            title="削除"
                                        >
                                            <X size={14} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Input */}
                        <form onSubmit={handleSubmit} className="p-3 bg-slate-50 dark:bg-slate-800 border-t border-slate-100 dark:border-slate-800">
                            <div className="relative">
                                <input
                                    type="text"
                                    value={input}
                                    onChange={(e) => setInput(e.target.value)}
                                    placeholder="吐き出す..."
                                    className="w-full pl-3 pr-10 py-3 bg-white dark:bg-slate-900 rounded-xl text-sm font-medium border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-inner"
                                />
                                <button
                                    type="submit"
                                    disabled={!input.trim()}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 bg-indigo-500 text-white rounded-lg opacity-80 hover:opacity-100 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                                >
                                    <ChevronRight size={14} />
                                </button>
                            </div>
                        </form>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
};
