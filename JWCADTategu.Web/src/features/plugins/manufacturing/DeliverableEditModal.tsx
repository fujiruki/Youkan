/**
 * Manufacturing Plugin - Deliverable Edit Modal
 * 
 * 成果物登録・編集モーダル
 */
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Trash2, Factory, MapPin, Package } from 'lucide-react';
import { Deliverable, DeliverableType, DeliverableStatus } from './types';
import { cn } from '../../../lib/utils';

interface DeliverableEditModalProps {
    deliverable: Deliverable;
    isNew: boolean;
    onSave: (deliverable: Deliverable) => void;
    onDelete: (id: string) => void;
    onClose: () => void;
}

export const DeliverableEditModal: React.FC<DeliverableEditModalProps> = ({
    deliverable,
    isNew,
    onSave,
    onDelete,
    onClose
}) => {
    const [form, setForm] = useState<Deliverable>(deliverable);

    const handleChange = (field: keyof Deliverable, value: unknown) => {
        setForm((prev) => ({ ...prev, [field]: value }));
    };

    const handleSubmit = () => {
        if (!form.name.trim()) {
            alert('成果物名を入力してください');
            return;
        }
        onSave(form);
    };

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
                {/* Backdrop */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 bg-black/40 backdrop-blur-sm"
                    onClick={onClose}
                />

                {/* Modal */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 20 }}
                    className="relative z-10 w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl shadow-xl overflow-hidden"
                >
                    {/* Header */}
                    <div className="p-4 flex justify-between items-center border-b border-slate-100 dark:border-slate-800 bg-purple-50 dark:bg-purple-900/30">
                        <div className="flex items-center gap-2">
                            <Package className="text-purple-500" size={20} />
                            <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">
                                {isNew ? '成果物追加' : '成果物編集'}
                            </h2>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full transition-colors"
                        >
                            <X size={20} className="text-slate-400" />
                        </button>
                    </div>

                    {/* Content */}
                    <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
                        {/* 成果物名 */}
                        <div>
                            <label className="block text-xs font-bold text-slate-500 mb-1">
                                成果物名 <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                value={form.name}
                                onChange={(e) => handleChange('name', e.target.value)}
                                placeholder="例: リビングドア"
                                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400"
                                autoFocus
                            />
                        </div>

                        {/* タイプ選択 */}
                        <div>
                            <label className="block text-xs font-bold text-slate-500 mb-2">
                                タイプ
                            </label>
                            <div className="flex gap-3">
                                <button
                                    onClick={() => handleChange('type', 'product' as DeliverableType)}
                                    className={cn(
                                        "flex-1 flex items-center justify-center gap-2 py-3 rounded-lg border-2 transition-colors",
                                        form.type === 'product'
                                            ? "border-blue-500 bg-blue-50 text-blue-600"
                                            : "border-slate-200 text-slate-400 hover:border-slate-300"
                                    )}
                                >
                                    <Factory size={18} />
                                    製作物
                                </button>
                                <button
                                    onClick={() => handleChange('type', 'service' as DeliverableType)}
                                    className={cn(
                                        "flex-1 flex items-center justify-center gap-2 py-3 rounded-lg border-2 transition-colors",
                                        form.type === 'service'
                                            ? "border-green-500 bg-green-50 text-green-600"
                                            : "border-slate-200 text-slate-400 hover:border-slate-300"
                                    )}
                                >
                                    <MapPin size={18} />
                                    現場作業
                                </button>
                            </div>
                        </div>

                        {/* 時間入力 */}
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1">
                                    <Factory size={12} className="inline mr-1" />
                                    作業時間
                                </label>
                                <div className="flex gap-2">
                                    <div className="flex-1">
                                        <div className="relative">
                                            <input
                                                type="number"
                                                step="0.01"
                                                value={form.estimatedWorkMinutes ? Math.round(form.estimatedWorkMinutes / 60 * 100) / 100 : ''}
                                                onChange={(e) => {
                                                    const h = parseFloat(e.target.value) || 0;
                                                    handleChange('estimatedWorkMinutes', Math.round(h * 60));
                                                }}
                                                className="w-full pl-3 pr-6 py-2 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400"
                                                placeholder="0.0"
                                            />
                                            <span className="absolute right-2 top-2 text-xs text-slate-400">h</span>
                                        </div>
                                    </div>
                                    <div className="flex-1">
                                        <div className="relative">
                                            <input
                                                type="number"
                                                value={form.estimatedWorkMinutes}
                                                onChange={(e) => handleChange('estimatedWorkMinutes', parseInt(e.target.value) || 0)}
                                                className="w-full pl-3 pr-8 py-2 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400"
                                                placeholder="0"
                                            />
                                            <span className="absolute right-2 top-2 text-xs text-slate-400">min</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1">
                                    <MapPin size={12} className="inline mr-1" />
                                    現場時間（分）
                                </label>
                                <input
                                    type="number"
                                    value={form.estimatedSiteMinutes}
                                    onChange={(e) => handleChange('estimatedSiteMinutes', parseInt(e.target.value) || 0)}
                                    disabled={!form.requiresSiteInstallation}
                                    className={cn(
                                        "w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400",
                                        form.requiresSiteInstallation
                                            ? "bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700"
                                            : "bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed"
                                    )}
                                />
                            </div>
                        </div>

                        {/* 現場取付チェック */}
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={form.requiresSiteInstallation}
                                onChange={(e) => handleChange('requiresSiteInstallation', e.target.checked)}
                                className="w-4 h-4 rounded border-slate-300 text-purple-500 focus:ring-purple-400"
                            />
                            <span className="text-sm text-slate-700 dark:text-slate-300">
                                現場取付あり
                            </span>
                        </label>

                        {/* 原価入力 */}
                        <div className="pt-2 border-t border-slate-200 dark:border-slate-700">
                            <label className="block text-xs font-bold text-slate-500 mb-2">
                                原価（任意・アバウト入力OK）
                            </label>
                            <div className="grid grid-cols-3 gap-3">
                                <div>
                                    <label className="block text-xs text-slate-400 mb-1">材料費</label>
                                    <input
                                        type="number"
                                        value={form.materialCost ?? ''}
                                        onChange={(e) => handleChange('materialCost', e.target.value ? parseFloat(e.target.value) : undefined)}
                                        placeholder="例: 50000"
                                        className="w-full px-2 py-1.5 text-sm bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded focus:outline-none focus:ring-2 focus:ring-purple-400"
                                    />
                                    {isNew && (
                                        <p className="text-[10px] text-slate-400 mt-1">
                                            自動算出: ¥{(deliverable.materialCost || 0).toLocaleString()}
                                        </p>
                                    )}
                                </div>
                                <div>
                                    <label className="block text-xs text-slate-400 mb-1">労務費</label>
                                    <input
                                        type="number"
                                        value={form.laborCost ?? ''}
                                        onChange={(e) => handleChange('laborCost', e.target.value ? parseFloat(e.target.value) : undefined)}
                                        placeholder="例: 30000"
                                        className="w-full px-2 py-1.5 text-sm bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded focus:outline-none focus:ring-2 focus:ring-purple-400"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs text-slate-400 mb-1">外注費</label>
                                    <input
                                        type="number"
                                        value={form.outsourceCost ?? ''}
                                        onChange={(e) => handleChange('outsourceCost', e.target.value ? parseFloat(e.target.value) : undefined)}
                                        placeholder="例: 0"
                                        className="w-full px-2 py-1.5 text-sm bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded focus:outline-none focus:ring-2 focus:ring-purple-400"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* ステータス */}
                        <div>
                            <label className="block text-xs font-bold text-slate-500 mb-1">
                                ステータス
                            </label>
                            <select
                                value={form.status}
                                onChange={(e) => handleChange('status', e.target.value as DeliverableStatus)}
                                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400"
                            >
                                <option value="pending">未着手</option>
                                <option value="in_progress">作業中</option>
                                <option value="completed">完了</option>
                            </select>
                        </div>

                        {/* メモ */}
                        <div>
                            <label className="block text-xs font-bold text-slate-500 mb-1">
                                メモ
                            </label>
                            <textarea
                                value={form.memo ?? ''}
                                onChange={(e) => handleChange('memo', e.target.value)}
                                rows={2}
                                placeholder="備考など..."
                                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400 resize-none"
                            />
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="p-4 bg-slate-50 dark:bg-slate-950/50 border-t border-slate-100 dark:border-slate-800 flex justify-between">
                        {!isNew && (
                            <button
                                onClick={() => onDelete(form.id)}
                                className="flex items-center gap-1 px-3 py-2 text-sm text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                            >
                                <Trash2 size={16} />
                                削除
                            </button>
                        )}
                        <div className="flex gap-2 ml-auto">
                            <button
                                onClick={onClose}
                                className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                            >
                                キャンセル
                            </button>
                            <button
                                onClick={handleSubmit}
                                className="px-6 py-2 text-sm font-bold bg-purple-500 hover:bg-purple-600 text-white rounded-lg transition-colors"
                            >
                                {isNew ? '追加' : '保存'}
                            </button>
                        </div>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
};
