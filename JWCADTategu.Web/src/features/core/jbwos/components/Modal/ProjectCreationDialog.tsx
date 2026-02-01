import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, FolderPlus } from 'lucide-react';
import { Item, TaskTemplate } from '../../types';
import { useProjectCategories } from '../../hooks/useProjectCategories';
import { cn } from '../../../../../lib/utils';

interface ProjectCreationDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onCreate: (project: Partial<Item>, defaultTasks: TaskTemplate[]) => Promise<void>;
    tenants?: { id: string; name: string; role: string }[]; // [NEW]
}

export const ProjectCreationDialog: React.FC<ProjectCreationDialogProps> = ({
    isOpen,
    onClose,
    onCreate,
    tenants = [] // [NEW]
}) => {
    const [projectName, setProjectName] = useState('');
    const [selectedCategoryId, setSelectedCategoryId] = useState('general');
    const [selectedTenantId, setSelectedTenantId] = useState(''); // [NEW]
    const [useTemplate, setUseTemplate] = useState(true);
    const [dueDate, setDueDate] = useState('');

    // Use Hook
    const { categories } = useProjectCategories();

    const [isCreating, setIsCreating] = useState(false);

    const selectedCategory = categories.find(c => c.id === selectedCategoryId);

    const handleCreate = async () => {
        if (!projectName.trim()) return;

        setIsCreating(true);

        try {
            const project: Partial<Item> = {
                title: projectName,
                isProject: true,
                projectCategory: selectedCategoryId,
                status: 'inbox',
                due_date: dueDate || undefined,
                weight: 1,
                interrupt: false,
                domain: selectedCategory?.domain, // Inherit domain
                pluginId: selectedCategory?.pluginId, // Inherit pluginId
                tenantId: selectedTenantId || null // [NEW] Link to Company
            };

            const defaultTasks = useTemplate && selectedCategory
                ? selectedCategory.defaultTasks
                : [];

            await onCreate(project, defaultTasks);

            // リセット
            setProjectName('');
            setSelectedCategoryId('general');
            setUseTemplate(true);
            setDueDate('');
            onClose();
        } catch (e) {
            console.error('Failed to create project', e);
        } finally {
            setIsCreating(false);
        }
    };

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
                {/* Backdrop */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 bg-black/40 backdrop-blur-sm"
                    onClick={onClose}
                />

                {/* Dialog */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 20 }}
                    className="relative z-10 w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-white/20 overflow-hidden"
                >
                    {/* Header */}
                    <div className="p-4 pb-3 flex justify-between items-center border-b border-slate-100 dark:border-slate-800">
                        <div className="flex items-center gap-2">
                            <FolderPlus size={20} className="text-indigo-500" />
                            <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">
                                新しいプロジェクトを作成
                            </h2>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 -mr-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
                        >
                            <X size={20} className="text-slate-400" />
                        </button>
                    </div>

                    {/* Content */}
                    <div className="p-5 space-y-4">
                        {/* Project Name */}
                        <div>
                            <label className="block text-xs font-bold text-slate-500 mb-1">
                                プロジェクト名
                            </label>
                            <input
                                type="text"
                                value={projectName}
                                onChange={(e) => setProjectName(e.target.value)}
                                placeholder="例: 佐藤邸 建具"
                                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                                autoFocus
                            />
                        </div>



                        {/* Company Selection [NEW] */}
                        {tenants && tenants.length > 0 && (
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1">
                                    所属 (Company)
                                </label>
                                <select
                                    value={selectedTenantId}
                                    onChange={(e) => setSelectedTenantId(e.target.value)}
                                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                                >
                                    <option value="">(なし / プライベート)</option>
                                    {tenants.map(t => (
                                        <option key={t.id} value={t.id}>
                                            {t.name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        )}

                        {/* Project Category */}
                        <div>
                            <label className="block text-xs font-bold text-slate-500 mb-1">
                                プロジェクトの種類
                            </label>
                            <select
                                value={selectedCategoryId}
                                onChange={(e) => setSelectedCategoryId(e.target.value)}
                                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                            >
                                {categories.map(category => (
                                    <option key={category.id} value={category.id}>
                                        {category.icon} {category.name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Template Checkbox */}
                        {selectedCategory && selectedCategory.defaultTasks.length > 0 && (
                            <div className="p-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg border border-indigo-100 dark:border-indigo-800">
                                <label className="flex items-start gap-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={useTemplate}
                                        onChange={(e) => setUseTemplate(e.target.checked)}
                                        className="mt-0.5"
                                    />
                                    <div className="flex-1">
                                        <div className="text-sm font-medium text-slate-700 dark:text-slate-200">
                                            よくあるタスクを追加する
                                        </div>
                                        {useTemplate && (
                                            <div className="mt-2 text-xs text-slate-600 dark:text-slate-400 space-y-1">
                                                <div className="font-medium">追加されるタスク:</div>
                                                {selectedCategory.defaultTasks.map((task, index) => (
                                                    <div key={index} className="flex items-center gap-2">
                                                        <span className="w-1 h-1 rounded-full bg-indigo-400"></span>
                                                        <span>{task.title}</span>
                                                        {task.estimatedMinutes && (
                                                            <span className="text-slate-400">
                                                                ({task.estimatedMinutes}分)
                                                            </span>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </label>
                            </div>
                        )}

                        {/* Conditional Fields (Only for non-general/business types if needed, but per request, local/personal usually hides them) */}
                        {selectedCategoryId !== 'general' && selectedCategoryId !== 'private' && (
                            <>
                                {/* Due Date */}
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1">
                                        納期（オプション）
                                    </label>
                                    <input
                                        type="date"
                                        value={dueDate}
                                        onChange={(e) => setDueDate(e.target.value)}
                                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                                    />
                                </div>
                            </>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="p-4 bg-slate-50 dark:bg-slate-950/50 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                        >
                            キャンセル
                        </button>
                        <button
                            onClick={handleCreate}
                            disabled={!projectName.trim() || isCreating}
                            className={cn(
                                "px-6 py-2 text-sm font-bold rounded-lg transition-all",
                                projectName.trim() && !isCreating
                                    ? "bg-indigo-500 hover:bg-indigo-600 text-white shadow-md"
                                    : "bg-slate-200 text-slate-400 cursor-not-allowed"
                            )}
                        >
                            {isCreating ? '作成中...' : '作成する'}
                        </button>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
};
