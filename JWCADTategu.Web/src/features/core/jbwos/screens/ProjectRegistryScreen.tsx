import React, { useEffect, useState } from 'react';
import { useProjectViewModel } from '../viewmodels/useProjectViewModel';
import { Project } from '../types';
import { Plus, Edit2, Trash2, ArrowLeft, Building2, Briefcase, Archive } from 'lucide-react';
import { useAuth } from '../../auth/providers/AuthProvider';

import { ProjectCreationDialog } from '../components/Modal/ProjectCreationDialog'; // Unified Dialog
import { ContextMenu } from '../components/GlobalBoard/ContextMenu'; // [NEW]

export const ProjectRegistryScreen: React.FC<{ onSelect: (project: Project) => void; onBack: () => void }> = ({ onSelect, onBack }) => {
    // [UPDATE] destructured new methods
    const {
        projects,
        members,
        loading,
        fetchProjects,
        createProject,
        updateProject,
        deleteProject, // Now destroy
        trashProject,  // New
        archiveProject, // New
        assignProject,
        activeScope,
        setActiveScope
    } = useProjectViewModel();

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingProject, setEditingProject] = useState<Project | null>(null);

    // Context Menu State
    const [contextMenu, setContextMenu] = useState<{ x: number; y: number; projectId: string } | null>(null);

    // Auth for resolving tenants list
    const { joinedTenants } = useAuth();


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
        setContextMenu(null);
    };

    const handleDialogSave = async (payload: Partial<Project>) => {
        if (editingProject) {
            await updateProject(editingProject.id, payload);
        } else {
            await createProject(payload);
        }
        setIsModalOpen(false);
    };

    // Context Menu Handler
    const handleContextMenu = (e: React.MouseEvent, projectId: string) => {
        e.preventDefault();
        setContextMenu({
            x: e.clientX,
            y: e.clientY,
            projectId
        });
    };

    const handleArchive = (id: string) => {
        archiveProject(id);
        setContextMenu(null);
    };

    const handleTrash = (id: string) => {
        trashProject(id);
        setContextMenu(null);
    };

    return (
        <div
            className="min-h-screen bg-slate-50 dark:bg-slate-900 p-8 pb-24"
            onClick={() => setContextMenu(null)} // Close menu on click outside
        >
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
                                            onContextMenu={(e) => handleContextMenu(e, project.id)}
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
                                onContextMenu={(e) => handleContextMenu(e, project.id)}
                                members={members}
                                onAssign={(id) => assignProject(project.id, id)}
                            />
                        ))}
                    </div>
                )}
            </div>

            {/* Unified Dialog */}
            {isModalOpen && (
                <ProjectCreationDialog
                    isOpen={isModalOpen}
                    onClose={() => setIsModalOpen(false)}
                    onCreate={handleDialogSave}
                    activeScope={activeScope}
                    tenants={joinedTenants}
                    project={editingProject}
                />
            )}

            {/* Context Menu */}
            {contextMenu && (
                <ContextMenu
                    x={contextMenu.x}
                    y={contextMenu.y}
                    itemId={contextMenu.projectId}
                    onClose={() => setContextMenu(null)}
                    // Legacy props not needed if actions provided
                    actions={[
                        {
                            label: 'アーカイブ (Archive)',
                            icon: <Briefcase size={14} />,
                            onClick: () => handleArchive(contextMenu.projectId)
                        },
                        {
                            label: 'ゴミ箱へ移動 (Trash)',
                            icon: <Trash2 size={14} />,
                            danger: true,
                            onClick: () => handleTrash(contextMenu.projectId)
                        }
                    ]}
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
    onContextMenu: (e: React.MouseEvent) => void; // [NEW]
    members?: any[];
    onAssign?: (id: string | null) => void;
}> = ({ project, onSelect, onEdit, onContextMenu, members = [], onAssign }) => {
    return (
        <div
            onClick={onSelect}
            onContextMenu={onContextMenu} // [NEW] Right click handler
            className="group bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm hover:shadow-lg transition-all border border-slate-100 dark:border-slate-700 relative overflow-hidden cursor-pointer"
        >
            {/* Color accent */}
            <div className="absolute top-0 left-0 w-1.5 h-full" style={{ backgroundColor: project.color || '#6366f1' }} />

            <div className="pl-3">
                <div className="flex justify-between items-start mb-1">
                    <div className="flex items-center gap-1.5">
                        {project.color && (
                            <div className="w-2.5 h-2.5 rounded-full shadow-sm" style={{ backgroundColor: project.color }} />
                        )}
                        <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 truncate max-w-[120px]">
                            {project.clientName || project.client || '自社・個人'}
                        </span>
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={(e) => { e.stopPropagation(); onEdit(); }} className="p-1 text-slate-400 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-full transition-colors">
                            <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        {/* [UPDATE] Removed Delete Button as requested */}
                    </div>
                </div>

                <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-0.5 truncate">
                    {project.name}
                </h3>

                <div className="flex items-center gap-3 mt-4 text-xs text-slate-500 dark:text-slate-400">
                    <div className="flex flex-col">
                        <span className="text-[10px] text-slate-400">目標粗利</span>
                        <span className="font-mono font-bold text-slate-700 dark:text-slate-200">
                            ¥{project.grossProfitTarget?.toLocaleString() ?? 0}
                        </span>
                    </div>
                    <div className="flex flex-col">
                        <span className="text-[10px] text-slate-400">状態</span>
                        <span className="capitalize text-[11px]">{project.judgmentStatus || '未分類'}</span>
                    </div>
                </div>

                {/* Assignment Selector */}
                <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-700/50 flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                        <span className="text-[10px] text-slate-400">担当:</span>
                        <select
                            value={project.assigned_to || ''}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) => {
                                e.stopPropagation();
                                onAssign?.(e.target.value || null);
                            }}
                            className="text-[10px] bg-slate-100 dark:bg-slate-700 border-none rounded px-1.5 py-0.5 outline-none focus:ring-1 focus:ring-indigo-400"
                        >
                            <option value="">未割当</option>
                            {members.map(m => (
                                <option key={m.id} value={m.id}>{m.name}</option>
                            ))}
                        </select>
                    </div>
                    {project.assigned_to && (
                        <div
                            className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] text-white font-bold"
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
