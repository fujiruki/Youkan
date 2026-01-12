import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trash2, AlertTriangle } from 'lucide-react';
import { cn } from '../../../../lib/utils';
import { t } from '../../../../i18n/labels';

interface ConfirmDeleteDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title?: string;
    message?: string;
    itemName?: string;
}

export const ConfirmDeleteDialog: React.FC<ConfirmDeleteDialogProps> = ({
    isOpen,
    onClose,
    onConfirm,
    title,
    message,
    itemName
}) => {
    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm"
                    />

                    {/* Dialog Content */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 10 }}
                        transition={{ duration: 0.2 }}
                        className="relative z-10 w-full max-w-md bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden"
                    >
                        <div className="p-6">
                            <div className="flex items-start gap-4">
                                <div className="p-3 bg-red-100 dark:bg-red-900/30 rounded-full shrink-0">
                                    <Trash2 className="w-6 h-6 text-red-600 dark:text-red-400" />
                                </div>
                                <div className="flex-1">
                                    <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">
                                        {title || t.jbwos.common.alerts?.deleteConfirm || "このアイテムを削除しますか？"}
                                    </h3>
                                    <p className="text-slate-600 dark:text-slate-300 text-sm leading-relaxed mb-1">
                                        {message || "この操作は取り消せません。本当に削除してもよろしいですか？"}
                                    </p>
                                    {itemName && (
                                        <div className="mt-3 p-3 bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-slate-100 dark:border-slate-700 text-sm font-medium text-slate-700 dark:text-slate-200 break-words">
                                            {itemName}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="bg-slate-50 dark:bg-slate-900/30 px-6 py-4 flex justify-end gap-3 border-t border-slate-100 dark:border-slate-700">
                            <button
                                onClick={onClose}
                                className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                            >
                                キャンセル
                            </button>
                            <button
                                onClick={() => {
                                    onConfirm();
                                }}
                                className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 active:bg-red-800 rounded-lg shadow-sm transition-colors flex items-center gap-2"
                            >
                                <Trash2 size={16} />
                                削除する
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};
