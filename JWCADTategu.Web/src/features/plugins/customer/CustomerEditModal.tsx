/**
 * Customer Plugin - Edit Modal Component
 * 
 * 顧客登録・編集モーダル
 */
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Trash2, CreditCard, Banknote } from 'lucide-react';
import { Customer, PaymentType } from './types';
import { cn } from '../../../lib/utils';

interface CustomerEditModalProps {
    customer: Customer;
    isNew: boolean;
    onSave: (customer: Customer) => void;
    onDelete: (id: string) => void;
    onClose: () => void;
}

export const CustomerEditModal: React.FC<CustomerEditModalProps> = ({
    customer,
    isNew,
    onSave,
    onDelete,
    onClose
}) => {
    const [form, setForm] = useState<Customer>(customer);

    const handleChange = (field: keyof Customer, value: unknown) => {
        setForm((prev) => ({ ...prev, [field]: value }));
    };

    const handleSubmit = () => {
        if (!form.name.trim()) {
            alert('顧客名を入力してください');
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
                    <div className="p-4 flex justify-between items-center border-b border-slate-100 dark:border-slate-800">
                        <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">
                            {isNew ? '新規顧客登録' : '顧客情報編集'}
                        </h2>
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
                        >
                            <X size={20} className="text-slate-400" />
                        </button>
                    </div>

                    {/* Content */}
                    <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
                        {/* 顧客名 */}
                        <div>
                            <label className="block text-xs font-bold text-slate-500 mb-1">
                                顧客名 <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                value={form.name}
                                onChange={(e) => handleChange('name', e.target.value)}
                                placeholder="例: 山田建設 株式会社"
                                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400"
                                autoFocus
                            />
                        </div>

                        {/* フリガナ */}
                        <div>
                            <label className="block text-xs font-bold text-slate-500 mb-1">
                                フリガナ
                            </label>
                            <input
                                type="text"
                                value={form.nameKana || ''}
                                onChange={(e) => handleChange('nameKana', e.target.value)}
                                placeholder="例: ヤマダケンセツ"
                                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400"
                            />
                        </div>

                        {/* 連絡先 */}
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1">
                                    電話番号
                                </label>
                                <input
                                    type="tel"
                                    value={form.phone || ''}
                                    onChange={(e) => handleChange('phone', e.target.value)}
                                    placeholder="03-1234-5678"
                                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1">
                                    メール
                                </label>
                                <input
                                    type="email"
                                    value={form.email || ''}
                                    onChange={(e) => handleChange('email', e.target.value)}
                                    placeholder="customer@example.com"
                                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400"
                                />
                            </div>
                        </div>

                        {/* 住所 */}
                        <div>
                            <label className="block text-xs font-bold text-slate-500 mb-1">
                                住所
                            </label>
                            <input
                                type="text"
                                value={form.address || ''}
                                onChange={(e) => handleChange('address', e.target.value)}
                                placeholder="東京都新宿区..."
                                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400"
                            />
                        </div>

                        {/* 支払タイプ */}
                        <div>
                            <label className="block text-xs font-bold text-slate-500 mb-2">
                                支払タイプ
                            </label>
                            <div className="flex gap-3">
                                <button
                                    onClick={() => handleChange('paymentType', 'credit' as PaymentType)}
                                    className={cn(
                                        "flex-1 flex items-center justify-center gap-2 py-3 rounded-lg border-2 transition-colors",
                                        form.paymentType === 'credit'
                                            ? "border-blue-500 bg-blue-50 text-blue-600"
                                            : "border-slate-200 text-slate-400 hover:border-slate-300"
                                    )}
                                >
                                    <CreditCard size={18} />
                                    掛売上
                                </button>
                                <button
                                    onClick={() => handleChange('paymentType', 'cash' as PaymentType)}
                                    className={cn(
                                        "flex-1 flex items-center justify-center gap-2 py-3 rounded-lg border-2 transition-colors",
                                        form.paymentType === 'cash'
                                            ? "border-green-500 bg-green-50 text-green-600"
                                            : "border-slate-200 text-slate-400 hover:border-slate-300"
                                    )}
                                >
                                    <Banknote size={18} />
                                    現金
                                </button>
                            </div>
                        </div>

                        {/* 締め日（掛売上のみ） */}
                        {form.paymentType === 'credit' && (
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1">
                                    締め日
                                </label>
                                <select
                                    value={form.closingDay ?? 0}
                                    onChange={(e) => handleChange('closingDay', parseInt(e.target.value))}
                                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400"
                                >
                                    <option value={0}>月末</option>
                                    <option value={5}>5日</option>
                                    <option value={10}>10日</option>
                                    <option value={15}>15日</option>
                                    <option value={20}>20日</option>
                                    <option value={25}>25日</option>
                                </select>
                            </div>
                        )}

                        {/* 繰越金 */}
                        <div>
                            <label className="block text-xs font-bold text-slate-500 mb-1">
                                繰越金
                            </label>
                            <div className="flex items-center gap-2">
                                <input
                                    type="number"
                                    value={form.carryOver ?? 0}
                                    onChange={(e) => handleChange('carryOver', parseFloat(e.target.value) || 0)}
                                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400 text-right"
                                />
                                <span className="text-slate-500">円</span>
                            </div>
                        </div>

                        {/* メモ */}
                        <div>
                            <label className="block text-xs font-bold text-slate-500 mb-1">
                                メモ
                            </label>
                            <textarea
                                value={form.memo || ''}
                                onChange={(e) => handleChange('memo', e.target.value)}
                                rows={3}
                                placeholder="備考など..."
                                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none"
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
                                className="px-6 py-2 text-sm font-bold bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg transition-colors"
                            >
                                {isNew ? '登録' : '保存'}
                            </button>
                        </div>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
};
