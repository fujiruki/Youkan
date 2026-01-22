import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Save, Upload } from 'lucide-react';
import { MasterItem, MasterCategory } from '../../domain/ManufacturingTypes';
import { ManufacturingService } from '../../services/ManufacturingService';

interface MasterItemEditorProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: () => void;
    initialItem?: MasterItem | null;
}

export const MasterItemEditor: React.FC<MasterItemEditorProps> = ({
    isOpen,
    onClose,
    onSave,
    initialItem
}) => {
    const [name, setName] = useState('');
    const [category, setCategory] = useState<MasterCategory>('material');
    const [unitPrice, setUnitPrice] = useState<number>(0);
    const [supplier, setSupplier] = useState('');
    const [imageUrl, setImageUrl] = useState('');
    const [specs, setSpecs] = useState<{ [key: string]: any }>({});
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (isOpen && initialItem) {
            setName(initialItem.name);
            setCategory(initialItem.category);
            setUnitPrice(initialItem.unitPrice);
            setSupplier(initialItem.supplier || '');
            setImageUrl(initialItem.imageUrl || '');
            setSpecs(initialItem.specs || {});
        } else if (isOpen) {
            // Reset for new item
            setName('');
            setCategory('material');
            setUnitPrice(0);
            setSupplier('');
            setImageUrl('');
            setSpecs({});
        }
    }, [isOpen, initialItem]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            const data: Partial<MasterItem> = {
                name,
                category,
                unitPrice: Number(unitPrice),
                supplier,
                imageUrl,
                specs
            };

            if (initialItem) {
                await ManufacturingService.updateMaster(initialItem.id, data);
            } else {
                await ManufacturingService.createMaster(data);
            }
            onSave();
            onClose();
        } catch (error) {
            console.error('Failed to save master item', error);
            alert('保存に失敗しました。');
        } finally {
            setIsSubmitting(false);
        }
    };

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
                        className="relative z-10 w-full max-w-2xl bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden flex flex-col max-h-[90vh]"
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-700">
                            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                                {initialItem ? 'マスタ編集' : 'マスタ新規登録'}
                            </h2>
                            <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
                                <X size={20} />
                            </button>
                        </div>

                        {/* Body - Scrollable */}
                        <div className="flex-1 overflow-y-auto p-6">
                            <form id="master-form" onSubmit={handleSubmit} className="space-y-6">
                                {/* Basic Info Grid */}
                                <div className="grid grid-cols-2 gap-6">
                                    <div className="col-span-2">
                                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                            品名 <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            required
                                            value={name}
                                            onChange={e => setName(e.target.value)}
                                            className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-slate-900 dark:text-white"
                                            placeholder="例: 杉板 2000x30x20"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                            カテゴリ
                                        </label>
                                        <select
                                            value={category}
                                            onChange={e => setCategory(e.target.value as MasterCategory)}
                                            className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-slate-900 dark:text-white"
                                        >
                                            <option value="material">材料 (Material)</option>
                                            <option value="hardware">金物 (Hardware)</option>
                                            <option value="labor">労務 (Labor)</option>
                                            <option value="other">その他 (Other)</option>
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                            標準単価 (円)
                                        </label>
                                        <input
                                            type="number"
                                            min="0"
                                            value={unitPrice}
                                            onChange={e => setUnitPrice(Number(e.target.value))}
                                            className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-slate-900 dark:text-white font-mono"
                                        />
                                    </div>

                                    <div className="col-span-2">
                                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                            仕入先
                                        </label>
                                        <input
                                            type="text"
                                            value={supplier}
                                            onChange={e => setSupplier(e.target.value)}
                                            className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-slate-900 dark:text-white"
                                            placeholder="例: 山田木材店"
                                        />
                                    </div>

                                    <div className="col-span-2">
                                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                            画像URL (任意)
                                        </label>
                                        <div className="flex gap-2">
                                            <input
                                                type="text"
                                                value={imageUrl}
                                                onChange={e => setImageUrl(e.target.value)}
                                                className="flex-1 px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-slate-900 dark:text-white text-sm"
                                                placeholder="https://..."
                                            />
                                            {/* Future: Upload Button */}
                                            <button type="button" className="px-3 py-2 bg-slate-100 dark:bg-slate-700 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600">
                                                <Upload size={18} />
                                            </button>
                                        </div>
                                        {imageUrl && (
                                            <div className="mt-2 w-20 h-20 bg-slate-100 dark:bg-slate-900 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700">
                                                <img src={imageUrl} alt="Preview" className="w-full h-full object-cover" />
                                            </div>
                                        )}
                                    </div>

                                    {/* Specs (Optional Dimensions) */}
                                    <div className="col-span-2 border-t border-slate-100 dark:border-slate-700 pt-4 mt-2">
                                        <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-3">仕様・寸法 (mm)</h3>
                                        <div className="grid grid-cols-3 gap-4">
                                            <div>
                                                <label className="text-xs text-slate-500 dark:text-slate-400">長さ (L)</label>
                                                <input
                                                    type="number"
                                                    value={specs.length || ''}
                                                    onChange={e => setSpecs({ ...specs, length: Number(e.target.value) })}
                                                    className="w-full px-2 py-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded focus:ring-1 focus:ring-blue-500 outline-none text-sm"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-xs text-slate-500 dark:text-slate-400">幅 (W)</label>
                                                <input
                                                    type="number"
                                                    value={specs.width || ''}
                                                    onChange={e => setSpecs({ ...specs, width: Number(e.target.value) })}
                                                    className="w-full px-2 py-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded focus:ring-1 focus:ring-blue-500 outline-none text-sm"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-xs text-slate-500 dark:text-slate-400">厚み (T)</label>
                                                <input
                                                    type="number"
                                                    value={specs.thickness || ''}
                                                    onChange={e => setSpecs({ ...specs, thickness: Number(e.target.value) })}
                                                    className="w-full px-2 py-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded focus:ring-1 focus:ring-blue-500 outline-none text-sm"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </form>
                        </div>

                        {/* Footer */}
                        <div className="bg-slate-50 dark:bg-slate-900/50 px-6 py-4 flex justify-end gap-3 border-t border-slate-100 dark:border-slate-700">
                            <button
                                onClick={onClose}
                                className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                            >
                                キャンセル
                            </button>
                            <button
                                form="master-form"
                                type="submit"
                                disabled={isSubmitting}
                                className="px-6 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg shadow-sm transition-colors flex items-center gap-2"
                            >
                                <Save size={18} />
                                {isSubmitting ? '保存中...' : '保存する'}
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};
