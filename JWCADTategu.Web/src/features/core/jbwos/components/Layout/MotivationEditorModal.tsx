




import React, { useState, useEffect } from 'react';
import { ApiClient } from '../../../../../api/client';
import { useAuth } from '../../../auth/providers/AuthProvider';
import { useToast } from '../../../../../contexts/ToastContext';
import { Save, X } from 'lucide-react';





import { motion, AnimatePresence } from 'framer-motion';

interface MotivationEditorModalProps {
    onClose: () => void;
}

export const MotivationEditorModal: React.FC<MotivationEditorModalProps> = ({ onClose }) => {
    const { user, checkAuth } = useAuth();
    const { showToast } = useToast();
    const [quotes, setQuotes] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (user?.preferences?.motivation_quotes) {
            setQuotes(user.preferences.motivation_quotes as string);
        }
    }, [user]);

    const handleSave = async () => {
        try {
            setIsLoading(true);
            const currentProfile = await ApiClient.getUserProfile();
            const prefs = currentProfile.preferences ? (typeof currentProfile.preferences === 'string' ? JSON.parse(currentProfile.preferences) : currentProfile.preferences) : {};

            prefs.motivation_quotes = quotes;

            await ApiClient.updateUserProfile({
                preferences: prefs
            });

            await checkAuth();
            showToast({ type: 'success', title: '保存完了', message: '好きな言葉を更新しました' });
            onClose();
        } catch (error) {
            console.error(error);
            showToast({ type: 'error', title: 'エラー', message: '保存に失敗しました' });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200 dark:border-slate-700"
                >
                    <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                        <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                            <Save className="w-5 h-5 text-emerald-500" />
                            好きな言葉集（モチベーター）
                        </h2>
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full transition-colors text-slate-500"
                        >
                            <X size={20} />
                        </button>
                    </div>

                    <div className="p-6 space-y-4">
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                            自分を鼓舞する言葉を編集してください。ここに入力された言葉が、ふとした瞬間に囁きかけます。
                        </p>
                        <textarea
                            value={quotes}
                            onChange={(e) => setQuotes(e.target.value)}
                            rows={10}
                            className="w-full px-4 py-3 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all placeholder:text-slate-300 text-sm leading-relaxed"
                            placeholder={"一歩ずつ進もう\n今日できることをやる\n完璧よりもまず完成させよう"}
                            autoFocus
                        />
                    </div>

                    <div className="flex justify-end gap-3 px-6 py-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-700">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors text-sm font-medium"
                        >
                            キャンセル
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={isLoading}
                            className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold shadow-sm transition-all disabled:opacity-50 text-sm flex items-center gap-2"
                        >
                            {isLoading ? '保存中...' : '保存して閉じる'}
                        </button>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
};
