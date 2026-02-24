import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RotateCcw, X } from 'lucide-react';
import { useUndo } from '../../contexts/UndoContext';

export const UndoToast: React.FC = () => {
    const { lastAction, undo, clearUndo } = useUndo();

    // Auto-dismiss after 8 seconds
    useEffect(() => {
        if (!lastAction) return;

        const timer = setTimeout(() => {
            clearUndo();
        }, 8000);

        return () => clearTimeout(timer);
    }, [lastAction, clearUndo]);

    if (!lastAction) return null;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0, y: 50, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 20, scale: 0.9 }}
                className="fixed bottom-6 right-6 z-[200] flex items-center gap-3 p-4 bg-slate-800 text-white rounded-lg shadow-2xl shadow-slate-900/50 border border-slate-700 max-w-sm"
            >
                <div className="flex flex-col">
                    <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">
                        Undo Available (Ctrl+Z)
                    </span>
                    <span className="text-sm font-medium">
                        {lastAction.description}
                    </span>
                </div>

                <div className="h-8 w-px bg-slate-600 mx-2" />

                <button
                    onClick={undo}
                    className="flex items-center gap-2 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-900 text-sm font-bold rounded transition-colors"
                >
                    <RotateCcw size={16} />
                    元に戻す
                </button>

                <button
                    onClick={clearUndo}
                    className="p-1 hover:bg-slate-700 rounded-full text-slate-400"
                >
                    <X size={16} />
                </button>
            </motion.div>
        </AnimatePresence>
    );
};
