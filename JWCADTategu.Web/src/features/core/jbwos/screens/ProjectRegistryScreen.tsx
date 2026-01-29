import React, { useEffect, useState } from 'react';
import { useProjectViewModel } from '../viewmodels/useProjectViewModel';
import { Project } from '../types';
import { Plus, Edit2, Trash2, ArrowLeft, Building2 } from 'lucide-react';
import { useAuth } from '../../auth/providers/AuthProvider';
import { JbwosTenant } from '../../auth/types';

export const ProjectRegistryScreen: React.FC<{ onSelect: (project: Project) => void; onBack: () => void }> = ({ onSelect, onBack }) => {
    const { projects, members, loading, fetchProjects, createProject, updateProject, deleteProject, assignProject, activeScope, setActiveScope } = useProjectViewModel();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingProject, setEditingProject] = useState<Project | null>(null);

    useEffect(() => {
        fetchProjects();
    }, [fetchProjects]);

    // Grouping logic for Company scope
    const groupedProjects = projects.reduce((acc, proj) => {
        const key = proj.tenantName || 'Others';
        if (!acc[key]) acc[key] = [];
        acc[key].push(proj);
        return acc;
    }, {} as Record<string, Project[]>);

    const handleCreate = () => {
        setEditingProject(null);
        setIsModalOpen(true);
    };

    const handleEdit = (project: Project) => {
        setEditingProject(project);
        setIsModalOpen(true);
    };

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-900 p-8 pb-24">
            <div className="max-w-7xl mx-auto space-y-8">
                {/* Header */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div className="flex items-center gap-4">
                        <button onClick={onBack} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full transition-colors">
                            <ArrowLeft className="w-6 h-6 text-slate-600 dark:text-slate-400" />
                        </button>
                        <div>
                            <h1 className="text-3xl font-light text-slate-800 dark:text-slate-100 tracking-tight">
                                プロジェクト一覧
                            </h1>
                            <p className="text-slate-500 dark:text-slate-400 mt-1">
                                創造と収益の源泉（コンテキスト）を定義します
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        {/* Scope Tabs */}
                        <div className="flex bg-slate-200 dark:bg-slate-800 rounded-lg p-1">
                            <button
                                onClick={() => setActiveScope('personal')}
                                className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${activeScope === 'personal'
                                    ? 'bg-white dark:bg-slate-700 shadow text-indigo-600 dark:text-white'
                                    : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
                                    }`}
                            >
                                基本 (Personal)
                            </button>
                            <button
                                onClick={() => setActiveScope('company')}
                                className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${activeScope === 'company'
                                    ? 'bg-white dark:bg-slate-700 shadow text-indigo-600 dark:text-white'
                                    : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
                                    }`}
                            >
                                会社 (Company)
                            </button>
                        </div>

                        <button
                            onClick={handleCreate}
                            className="hidden md:flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-full shadow-lg transition-all hover:scale-105 active:scale-95"
                        >
                            <Plus className="w-5 h-5" />
                            <span>新規プロジェクト</span>
                        </button>
                        {/* Mobile Add Button */}
                        <button
                            onClick={handleCreate}
                            className="md:hidden flex items-center justify-center bg-indigo-600 hover:bg-indigo-700 text-white w-12 h-12 rounded-full shadow-lg transition-all"
                        >
                            <Plus className="w-6 h-6" />
                        </button>
                    </div>
                </div>

                {/* Grid */}
                {loading && projects.length === 0 ? (
                    <div className="text-center py-20 text-slate-400">読み込み中...</div>
                ) : activeScope === 'company' ? (
                    <div className="space-y-12">
                        {Object.entries(groupedProjects).map(([tenantName, tenantProjects]) => (
                            <div key={tenantName} className="space-y-6">
                                <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
                                    <Building2 className="w-5 h-5 text-indigo-500" />
                                    <h2 className="text-xl font-bold text-slate-700 dark:text-slate-200">{tenantName}</h2>
                                    <span className="bg-slate-200 dark:bg-slate-800 text-slate-500 text-xs px-2 py-0.5 rounded-full">
                                        {tenantProjects.length}
                                    </span>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                    {tenantProjects.map(project => (
                                        <ProjectCard
                                            key={project.id}
                                            project={project}
                                            onSelect={() => onSelect(project)}
                                            onEdit={() => handleEdit(project)}
                                            onDelete={() => deleteProject(project.id)}
                                            members={members}
                                            onAssign={(id) => assignProject(project.id, id)}
                                        />
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {projects.map(project => (
                            <ProjectCard
                                key={project.id}
                                project={project}
                                onSelect={() => onSelect(project)}
                                onEdit={() => handleEdit(project)}
                                onDelete={() => deleteProject(project.id)}
                                members={members}
                                onAssign={(id) => assignProject(project.id, id)}
                            />
                        ))}
                    </div>
                )}
            </div>

            {/* Modal */}
            {isModalOpen && (
                <ProjectModal
                    project={editingProject}
                    activeScope={activeScope}
                    onClose={() => setIsModalOpen(false)}
                    onSave={async (data) => {
                        const payload = { ...data };
                        if (activeScope === 'personal') {
                            (payload as any).isPersonal = true;
                        }
                        if (editingProject) {
                            await updateProject(editingProject.id, payload);
                        } else {
                            await createProject(payload);
                        }
                        setIsModalOpen(false);
                    }}
                />
            )}
        </div>
    );
};

// Sub-components

const ProjectCard: React.FC<{
    project: Project;
    onSelect: () => void;
    onEdit: () => void;
    onDelete: () => void;
    members?: any[];
    onAssign?: (id: string | null) => void;
}> = ({ project, onSelect, onEdit, onDelete, members = [], onAssign }) => {
    return (
        <div
            onClick={onSelect}
            className="group bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm hover:shadow-xl transition-all border border-slate-100 dark:border-slate-700 relative overflow-hidden cursor-pointer"
        >
            {/* Color accent */}
            <div className="absolute top-0 left-0 w-2 h-full" style={{ backgroundColor: project.color || '#6366f1' }} />

            <div className="pl-4">
                <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center gap-2">
                        {project.color && (
                            <div className="w-3 h-3 rounded-full shadow-sm" style={{ backgroundColor: project.color }} />
                        )}
                        <span className="text-xs uppercase font-bold tracking-wider text-slate-400">
                            {project.clientName || project.client || '自社・個人'}
                        </span>
                    </div>
                    <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={(e) => { e.stopPropagation(); onEdit(); }} className="p-1.5 text-slate-400 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-full transition-colors">
                            <Edit2 className="w-4 h-4" />
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); onDelete(); }} className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-full transition-colors">
                            <Trash2 className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-1 truncate">
                    {project.name}
                </h3>

                <div className="flex items-center gap-4 mt-6 text-sm text-slate-500 dark:text-slate-400">
                    <div className="flex flex-col">
                        <span className="text-xs text-slate-400">目標粗利</span>
                        <span className="font-mono font-medium text-slate-700 dark:text-slate-200">
                            ¥{project.grossProfitTarget?.toLocaleString() ?? 0}
                        </span>
                    </div>
                    <div className="flex flex-col">
                        <span className="text-xs text-slate-400">状態</span>
                        <span className="capitalize">{project.judgmentStatus || '未分類'}</span>
                    </div>
                </div>

                {/* Assignment Selector */}
                <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-700/50 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-400">担当:</span>
                        <select
                            value={project.assigned_to || ''}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) => {
                                e.stopPropagation();
                                onAssign?.(e.target.value || null);
                            }}
                            className="text-xs bg-slate-100 dark:bg-slate-700 border-none rounded px-2 py-1 outline-none focus:ring-1 focus:ring-indigo-400"
                        >
                            <option value="">未割当</option>
                            {members.map(m => (
                                <option key={m.id} value={m.id}>{m.name}</option>
                            ))}
                        </select>
                    </div>
                    {project.assigned_to && (
                        <div
                            className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] text-white font-bold"
                            style={{ backgroundColor: members.find(m => m.id === project.assigned_to)?.color || '#94a3b8' }}
                            title={members.find(m => m.id === project.assigned_to)?.name}
                        >
                            {members.find(m => m.id === project.assigned_to)?.name?.charAt(0)}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

const ProjectModal: React.FC<{
    project: Project | null;
    activeScope: 'personal' | 'company';
    onClose: () => void;
    onSave: (data: Partial<Project>) => Promise<void>;
}> = ({ project, activeScope, onClose, onSave }) => {
    const { tenant } = useAuth();
    const jbwosTenant = tenant as JbwosTenant;
    const isManufacturing = jbwosTenant?.config?.plugins?.manufacturing ?? false;

    const [name, setName] = useState(project?.name || '');
    const [clientName, setClientName] = useState(project?.clientName || project?.client || '');
    const [target, setTarget] = useState(project?.grossProfitTarget?.toString() || '0');
    const [color, setColor] = useState(project?.color || '#6366f1');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            await onSave({
                name,
                clientName,
                grossProfitTarget: parseInt(target) || 0,
                color
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-scale-in">
                <div className="p-6 border-b border-slate-100 dark:border-slate-800">
                    <h2 className="text-xl font-bold text-slate-800 dark:text-white">
                        {project ? 'プロジェクト編集' : '新規プロジェクト'}
                    </h2>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                            プロジェクト名
                        </label>
                        <input
                            type="text"
                            value={name}
                            onChange={e => setName(e.target.value)}
                            required
                            className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                            placeholder="例: 玄関ドア新規製作"
                        />
                    </div>

                    {activeScope === 'company' && isManufacturing && (
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                    顧客名 / 現場名
                                </label>
                                <input
                                    type="text"
                                    value={clientName}
                                    onChange={e => setClientName(e.target.value)}
                                    className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                                    placeholder="例: 田中邸"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                    目標粗利 (円)
                                </label>
                                <input
                                    type="number"
                                    value={target}
                                    onChange={e => setTarget(e.target.value)}
                                    className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                                />
                            </div>
                        </div>
                    )}

                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                            カラーラベル
                        </label>
                        <div className="flex gap-2 flex-wrap">
                            {['#6366f1', '#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899', '#64748b'].map(c => (
                                <button
                                    key={c}
                                    type="button"
                                    onClick={() => setColor(c)}
                                    className={`w-8 h-8 rounded-full border-2 transition-all ${color === c ? 'border-indigo-500 scale-110 shadow-md' : 'border-transparent opacity-70 hover:opacity-100'}`}
                                    style={{ backgroundColor: c }}
                                />
                            ))}
                        </div>
                    </div>

                    <div className="flex justify-end gap-3 pt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                        >
                            キャンセル
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-lg shadow-md transition-all flex items-center gap-2"
                        >
                            {isSubmitting && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                            {project ? '変更を保存' : '作成する'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
