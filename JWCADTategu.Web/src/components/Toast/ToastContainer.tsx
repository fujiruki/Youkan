import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertCircle, X } from 'lucide-react';

export interface Toast {
    id: string;
    type: 'error' | 'warning' | 'info' | 'success';
    title: string;
    message?: string;
    duration?: number; // ms, default 5000
    action?: {
        label: string;
        onClick: () => void;
    };
}

interface ToastContainerProps {
    toasts: Toast[];
    onDismiss: (id: string) => void;
}

export const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, onDismiss }) => {
    React.useEffect(() => {
        const timers = toasts.map(toast => {
            const duration = toast.duration || 5000;
            return setTimeout(() => onDismiss(toast.id), duration);
        });

        return () => timers.forEach(timer => clearTimeout(timer));
    }, [toasts, onDismiss]);

    return (
        <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none">
            <AnimatePresence>
                {toasts.map(toast => (
                    <motion.div
                        key={toast.id}
                        initial={{ opacity: 0, x: 100, scale: 0.8 }}
                        animate={{ opacity: 1, x: 0, scale: 1 }}
                        exit={{ opacity: 0, x: 100, scale: 0.8 }}
                        className="pointer-events-auto bg-white dark:bg-slate-900 rounded-lg shadow-2xl border border-slate-200 dark:border-slate-800 p-4 min-w-[320px] max-w-md"
                    >
                        <div className="flex items-start gap-3">
                            <div className={`flex-shrink-0 ${toast.type === 'error' ? 'text-red-500' :
                                    toast.type === 'warning' ? 'text-amber-500' :
                                        toast.type === 'success' ? 'text-green-500' :
                                            'text-blue-500'
                                }`}>
                                <AlertCircle size={20} />
                            </div>
                            <div className="flex-1 min-w-0">
                                <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                                    {toast.title}
                                </h4>
                                {toast.message && (
                                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                                        {toast.message}
                                    </p>
                                )}
                                {toast.action && (
                                    <button
                                        onClick={() => {
                                            toast.action!.onClick();
                                            onDismiss(toast.id);
                                        }}
                                        className="mt-1 text-xs font-bold text-blue-600 hover:text-blue-800 underline"
                                    >
                                        {toast.action.label}
                                    </button>
                                )}
                            </div>
                            <button
                                onClick={() => onDismiss(toast.id)}
                                className="flex-shrink-0 p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors"
                            >
                                <X size={16} className="text-slate-400" />
                            </button>
                        </div>
                    </motion.div>
                ))}
            </AnimatePresence>
        </div>
    );
};
