import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, FolderPlus, GitFork, ArrowUpCircle } from 'lucide-react';
import { TaskTemplate, Project } from '../../types';
import { useProjectCategories } from '../../hooks/useProjectCategories';
import { useAuth } from '../../../auth/providers/AuthProvider';
// import { JbwosTenant } from '../../../auth/types';
import { useProjectCreationViewModel } from './useProjectCreationViewModel';
import { ExtensionSlot } from '../../../plugin-system/ExtensionSlot';
import { TenantSelector } from './TenantSelector';

interface ProjectCreationDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onCreate: (project: Partial<Project>, defaultTasks: TaskTemplate[]) => Promise<void>;

    // Context Props
    parentProject?: Project | null;
    activeScope?: 'personal' | 'company';
    tenants?: { id: string; name: string }[];
    project?: Project | null; // [NEW] For editing
    defaultTenantId?: string; // [NEW] Default tenant selection
}

export const ProjectCreationDialog: React.FC<ProjectCreationDialogProps> = ({
    isOpen,
    onClose,
    onCreate,
    parentProject = null,
    activeScope = 'personal',
    tenants = [],
    project = null,
    defaultTenantId: propDefaultTenantId
}) => {
    // Auth context for manufacturing config
    const { tenant } = useAuth();
    // const jbwosTenant = tenant as JbwosTenant; // Logic moved to registry
    // Show additional inputs if in company mode and manufacturing plugin is enabled
    // OR if we are inheriting from a manufacturing parent? For now check global config
    // const isManufacturing = activeScope === 'company' && (jbwosTenant?.config?.plugins?.manufacturing ?? false);

    // [New] Account Type Logic (Approximation)
    // If user is representative -> Personal Account (Can select Personal or Company)
    // If user is NOT representative -> Company Account (Employee, locked to company)
    // [New] Account Type Logic (Approximation)
    // If user is representative -> Personal Account (Can select Personal or Company)
    // If user is NOT representative -> Company Account (Employee, locked to company)
    // [Updated] Chack account_type from backend if available

    // Show Selector if: It's a User Account AND they are a Representative (Owner)
    // If they are an Employee (isRepresentative=false) or a Tenant Account, hide it.

    // Important: 
    // If Personal Account, we WANT to show the selector even if activeScope is personal?
    // The spec says: "If Personal Account... show selector starting with Personal".
    // This implies they can switch context here. 
    // But `useProjectCreationViewModel` confines `canSelectTenant` to `activeScope === 'company'`.
    // We might need to relax that or interpret `activeScope` as just the *current* selection.

    // For now, let's trust the VM but if we want to allow switching FROM personal TO company,
    // we should ideally allow it. 
    // However, passing `activeScope` as 'company' to VM might be safer if we want to enable selection.
    // OR, we just render the selector and let VM handle the ID.
    // If ID is empty string -> Personal.

    const vm = useProjectCreationViewModel({
        parentProject,
        activeScope,
        defaultTenantId: propDefaultTenantId || tenant?.id,
        joinedTenants: tenants,
        initialData: project
    });

    const { categories } = useProjectCategories();
    // Simplified logic: Default category "general" mostly used
    const selectedCategory = categories.find(c => c.id === 'general');

    const handleCreate = async () => {
        if (!vm.name.trim()) return;

        vm.setIsSubmitting(true);

        try {
            const payload: any = {
                id: project?.id, // Important if editing
                title: vm.name,
                name: vm.name,
                // types.ts: Project has 'name', 'clientName'. Item has 'title'.
                // Usually we map them.
                isProject: true,
                projectCategory: 'general',
                judgmentStatus: project ? project.judgmentStatus : 'inbox',
                grossProfitTarget: parseInt(vm.grossProfitTarget) || 0,

                // Unified Logic
                tenantId: vm.getEffectiveTenantId() ?? null, // [FIX] null (not undefined) so JSON includes the field for backend isset()
                parentId: vm.getEffectiveParentId(),

                // Manufacturing Fields
                clientName: vm.clientName || undefined,
                color: vm.color,
                assigned_to: vm.assignedTo,
            };

            const defaultTasks = selectedCategory?.defaultTasks || [];

            await onCreate(payload, defaultTasks);

            // Reset handled by onClose usually, but let's clear inputs
            vm.setName('');
            onClose();
        } catch (e) {
            console.error('Failed to create project', e);
        } finally {
            vm.setIsSubmitting(false);
        }
    };

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 bg-black/40 backdrop-blur-sm"
                    onClick={onClose}
                />

                <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 20 }}
                    className="relative z-10 w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 overflow-hidden"
                >
                    <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
                        <div className="flex items-center gap-2">
                            <FolderPlus size={20} className="text-indigo-500" />
                            <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">
                                {project
                                    ? 'プロジェクトを編集'
                                    : (vm.creationMode === 'child' ? 'サブプロジェクトを作成' : '新規プロジェクトを作成')
                                }
                            </h2>
                        </div>
                        <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                            <X size={20} />
                        </button>
                    </div>

                    <form onSubmit={(e) => { e.preventDefault(); handleCreate(); }}>
                        <div className="p-6 space-y-6">
                            {/* Context Information Message (Only keep if useful or replace with selector) */}
                            {/* The spec implies the Selector IS the indicator. So we might hide this if selector is shown. */}
                            {/* But for Company Account (hidden selector), this is useful. */}
                            {/* Context Information Message (Only keep if useful or replace with selector) */}
                            {/* [FIX] Use internal selectedTenantId state for the message to provide feedback during selection */}
                            {(() => {
                                const isTargetingCompany = !!vm.selectedTenantId;
                                return (
                                    <div className={`px-4 py-2 rounded-lg text-xs font-bold border ${isTargetingCompany
                                        ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-100 dark:border-blue-800 text-blue-600 dark:text-blue-400'
                                        : 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-100 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400'
                                        }`}>
                                        {isTargetingCompany
                                            ? `🏢 現在は【会社・組織 (${tenants.find(t => t.id === vm.selectedTenantId)?.name || '指定なし'})】として登録されます`
                                            : '👤 現在は【個人・プライベート】として登録されます'
                                        }
                                    </div>
                                );
                            })()}

                            {/* Location Selector (Only if parent exists OR editing and allowed to move) */}
                            {/* Hide if editing for simplicity unless logic is robust. For now hide. */}
                            {!project && vm.showLocationSelector && (
                                <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-lg border border-slate-200 dark:border-slate-700">
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
                                        作成位置 (Location)
                                    </label>
                                    <div className="space-y-2">
                                        <label className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${vm.creationMode === 'child'
                                            ? 'bg-white dark:bg-slate-800 border-indigo-500 ring-1 ring-indigo-500 shadow-sm'
                                            : 'border-transparent hover:bg-white dark:hover:bg-slate-800'
                                            }`}>
                                            <input
                                                type="radio"
                                                name="creationMode"
                                                checked={vm.creationMode === 'child'}
                                                onChange={() => vm.setCreationMode('child')}
                                                className="accent-indigo-500"
                                            />
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2 text-sm font-bold text-slate-700 dark:text-slate-200">
                                                    <GitFork size={16} className="text-indigo-500" />
                                                    {vm.parentProjectName || '親プロジェクト'} の中に入れる
                                                </div>
                                                <div className="text-xs text-slate-500 mt-0.5 ml-6">
                                                    現在のプロジェクトのサブプロジェクトとして作成します
                                                </div>
                                            </div>
                                        </label>

                                        <label className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${vm.creationMode === 'root'
                                            ? 'bg-white dark:bg-slate-800 border-indigo-500 ring-1 ring-indigo-500 shadow-sm'
                                            : 'border-transparent hover:bg-white dark:hover:bg-slate-800'
                                            }`}>
                                            <input
                                                type="radio"
                                                name="creationMode"
                                                checked={vm.creationMode === 'root'}
                                                onChange={() => vm.setCreationMode('root')}
                                                className="accent-indigo-500"
                                            />
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2 text-sm font-bold text-slate-700 dark:text-slate-200">
                                                    <ArrowUpCircle size={16} className="text-emerald-500" />
                                                    独立させる (ルート)
                                                </div>
                                                <div className="text-xs text-slate-500 mt-0.5 ml-6">
                                                    最上位階層（または指定した会社）に作成します
                                                </div>
                                            </div>
                                        </label>
                                    </div>
                                </div>
                            )}

                            {/* Project Name */}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                    プロジェクト名 <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={vm.name}
                                    onChange={e => vm.setName(e.target.value)}
                                    className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                                    placeholder="例: 玄関ドア新規製作"
                                    autoFocus
                                />
                            </div>

                            {/* Plugin Hook Slot (Project Creation Fields) */}
                            <ExtensionSlot
                                point="project-creation-fields"
                                context={{
                                    activeScope,
                                    tenant,
                                    // VM state props for binding
                                    clientName: vm.clientName,
                                    setClientName: vm.setClientName,
                                    grossProfitTarget: vm.grossProfitTarget,
                                    setGrossProfitTarget: vm.setGrossProfitTarget
                                }}
                            />

                            {/* Company Selection (Tenant Selector) */}
                            {/* Relaxed condition: Show if root project and we have tenants to choose from */}
                            {(vm.creationMode === 'root' && tenants.length > 0) && (
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                        所属 (Owner)
                                    </label>
                                    <TenantSelector
                                        tenants={tenants}
                                        selectedTenantId={vm.selectedTenantId}
                                        onChange={vm.setSelectedTenantId}
                                    />
                                </div>
                            )}

                            {/* Color Labels */}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                    カラーラベル
                                </label>
                                <div className="flex gap-2 flex-wrap">
                                    {['#6366f1', '#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899', '#64748b'].map(c => (
                                        <button
                                            key={c}
                                            type="button"
                                            onClick={() => vm.setColor(c)}
                                            className={`w-8 h-8 rounded-full border-2 transition-all ${vm.color === c ? 'border-indigo-500 scale-110 shadow-md' : 'border-transparent opacity-70 hover:opacity-100'}`}
                                            style={{ backgroundColor: c }}
                                        />
                                    ))}
                                </div>
                            </div>

                            {/* Footer (Actions) */}
                            <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                                <button
                                    type="button"
                                    onClick={onClose}
                                    className="px-4 py-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                                >
                                    キャンセル
                                </button>
                                <button
                                    type="submit"
                                    disabled={vm.isSubmitting || !vm.name.trim()}
                                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-lg shadow-md transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {vm.isSubmitting && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                                    {vm.isSubmitting ? '保存中...' : (project ? '変更を保存' : 'プロジェクトを作成')}
                                </button>
                            </div>
                        </div>
                    </form>
                </motion.div>
            </div>
        </AnimatePresence>
    );
};
