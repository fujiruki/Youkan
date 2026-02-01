import React, { useEffect, useState } from 'react';
import { useProjectViewModel } from '../viewmodels/useProjectViewModel';
import { Project } from '../types';
import { Plus, Edit2, Trash2, ArrowLeft, Building2, Briefcase, Archive, LayoutGrid, List, MoreVertical, Calendar } from 'lucide-react';
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
    const [contextMenu, setContextMenu] = useState<{ x: number; y: number; project: Project } | null>(null); // Fixed type
    const [viewMode, setViewMode] = useState<'list' | 'grid'>('grid'); // [RESTORED]

    // Auth for resolving tenants list
    const { joinedTenants } = useAuth();

    // [RESTORED] Filtering Logic
    const filteredProjects = activeScope === 'company'
        ? projects.filter(p => p.tenantId)
        : projects.filter(p => !p.tenantId);

    // [RESTORED] Alias
    const handleCreateProject = () => {
        setEditingProject(null);
        setIsModalOpen(true);
    };


    useEffect(() => {
        fetchProjects();
    }, [fetchProjects]);

    const groupedProjects = projects.reduce((acc, proj) => {
        const key = proj.tenantName || 'Others';
        if (!acc[key]) acc[key] = [];
        acc[key].push(proj);
        return acc;
    }, {} as Record<string, Project[]>);

    const handleCreate = handleCreateProject; // Alias for consistency

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
    const handleContextMenu = (e: React.MouseEvent, project: Project) => {
        e.preventDefault();
        setContextMenu({
            x: e.clientX,
            y: e.clientY,
            project
        });
    };

    // [NEW] Confirmation Modal State from Implementation Plan
    const [confirmDialog, setConfirmDialog] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
        action: 'archive' | 'trash' | 'destroy';
        targetId: string;
        danger?: boolean;
    }>({ isOpen: false, title: '', message: '', action: 'trash', targetId: '' });

    const handleConfirmAction = () => {
        if (!confirmDialog.isOpen) return;

        const { action, targetId } = confirmDialog;
        if (action === 'archive') {
            archiveProject(targetId);
        } else if (action === 'trash') {
            trashProject(targetId);
        } else if (action === 'destroy') {
            deleteProject(targetId);
        }
        setConfirmDialog(prev => ({ ...prev, isOpen: false }));
    };

    const openConfirm = (action: 'archive' | 'trash' | 'destroy', project: Project) => {
        let title = '';
        let message = '';
        let danger = false;

        switch (action) {
            case 'archive':
                title = 'アーカイブ';
                message = `プロジェクト「${project.name}」をアーカイブしますか？\nアーカイブされたプロジェクトは一覧から非表示になります。`;
                break;
            case 'trash':
                title = 'ゴミ箱へ移動';
                message = `プロジェクト「${project.name}」をゴミ箱へ移動しますか？`;
                danger = true;
                break;
            case 'destroy':
                title = '完全削除';
                message = `【警告】プロジェクト「${project.name}」を完全に削除しますか？\nこの操作は取り消せません。`;
                danger = true;
                break;
        }

        setConfirmDialog({
            isOpen: true,
            title,
            message,
            action,
            targetId: String(project.id), // Ensure string
            danger
        });
    };

    return (
        <div className="h-full w-full bg-[#FAFAFA] dark:bg-slate-900 flex flex-col font-sans text-slate-800 dark:text-slate-200">
            {/* Header */}
            <div className="flex-none px-6 py-4 flex items-center justify-between border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 z-10">
                <div className="flex items-center gap-4">
                    {onBack && (
                        <button onClick={onBack} className="p-2 -ml-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors text-slate-500">
                            <ArrowLeft size={20} />
                        </button>
                    )}
                    <div>
                        <h1 className="text-xl font-bold flex items-center gap-2">
                            プロジェクト一覧
                            <span className="text-sm font-normal text-slate-400 ml-2">({filteredProjects.length})</span>
                        </h1>
                        <p className="text-xs text-slate-400 mt-1">案件の管理と進捗状況</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {/* View Toggle */}
                    <div className="flex bg-slate-100 dark:bg-slate-800 rounded-lg p-1 mr-2">
                        <button
                            onClick={() => setViewMode('grid')}
                            className={`p-1.5 rounded-md transition-all ${viewMode === 'grid' ? 'bg-white dark:bg-slate-700 shadow-sm text-blue-600 dark:text-blue-400' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                            <LayoutGrid size={18} />
                        </button>
                        <button
                            onClick={() => setViewMode('list')}
                            className={`p-1.5 rounded-md transition-all ${viewMode === 'list' ? 'bg-white dark:bg-slate-700 shadow-sm text-blue-600 dark:text-blue-400' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                            <List size={18} />
                        </button>
                    </div>

                    <button
                        onClick={handleCreateProject}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 shadow-sm shadow-blue-200 dark:shadow-none transition-all active:scale-95"
                    >
                        <Plus size={18} />
                        新規作成
                    </button>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6" onClick={() => setContextMenu(null)}>
                {loading ? (
                    <div className="flex justify-center items-center h-40">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                    </div>
                ) : filteredProjects.length === 0 ? (
                    <div className="text-center py-20 text-slate-400">
                        プロジェクトがありません
                    </div>
                ) : viewMode === 'list' ? (
                    // List View (Minimal)
                    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 text-xs uppercase text-slate-500 font-medium">
                                <tr>
                                    <th className="px-6 py-3">プロジェクト名</th>
                                    <th className="px-6 py-3">クライアント</th>
                                    <th className="px-6 py-3">更新日</th>
                                    <th className="px-6 py-3">アクション</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                                {filteredProjects.map((project) => (
                                    <tr
                                        key={project.id}
                                        className="hover:bg-slate-50 dark:hover:bg-slate-700/50 cursor-pointer transition-colors"
                                        onClick={() => onSelect(project)}
                                        onContextMenu={(e) => handleContextMenu(e, project)}
                                    >
                                        <td className="px-6 py-3 font-medium text-slate-700 dark:text-slate-200">
                                            {project.name}
                                        </td>
                                        <td className="px-6 py-3 text-slate-500">
                                            {project.client || '-'}
                                        </td>
                                        <td className="px-6 py-3 text-slate-400 text-xs">
                                            {new Date(project.updatedAt).toLocaleDateString()}
                                        </td>
                                        <td className="px-6 py-3">
                                            <button className="text-slate-400 hover:text-slate-600 p-1">
                                                <MoreVertical size={16} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    // Grid View
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        {filteredProjects.map((project) => (
                            <div
                                key={project.id}
                                className="group relative bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md transition-all cursor-pointer overflow-hidden flex flex-col h-[200px]"
                                onClick={() => onSelect(project)}
                                onContextMenu={(e) => handleContextMenu(e, project)}
                            >
                                {/* Color Bar */}
                                <div className="h-1.5 w-full bg-gradient-to-r from-blue-500 to-cyan-400" />

                                <div className="p-5 flex-1 flex flex-col">
                                    <div className="flex justify-between items-start mb-2">
                                        <h3 className="font-bold text-lg text-slate-800 dark:text-slate-100 line-clamp-1 group-hover:text-blue-600 transition-colors">
                                            {project.name}
                                        </h3>
                                        <button className="text-slate-300 hover:text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <MoreVertical size={18} />
                                        </button>
                                    </div>

                                    <div className="flex items-center gap-2 text-xs text-slate-500 mb-4">
                                        <span className="bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded text-slate-600 dark:text-slate-300">
                                            {project.tenantId ? 'Company' : 'Personal'}
                                        </span>
                                        {project.client && (
                                            <span className="flex items-center gap-1">
                                                <span className="w-1 h-1 rounded-full bg-slate-400" />
                                                {project.client}
                                            </span>
                                        )}
                                    </div>

                                    <div className="mt-auto flex items-center justify-between text-xs text-slate-400 pt-4 border-t border-slate-100 dark:border-slate-700">
                                        <span className="flex items-center gap-1">
                                            <Calendar size={12} />
                                            {new Date(project.updatedAt).toLocaleDateString()}
                                        </span>
                                        {/* Status Tag or Count could go here */}
                                    </div>
                                </div>
                            </div>
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
                    itemId="" // Not used in Generic Actions mode
                    onClose={() => setContextMenu(null)}
                    actions={[
                        {
                            label: '開く',
                            icon: <LayoutGrid size={14} />,
                            onClick: () => onSelect(contextMenu.project)
                        },
                        {
                            label: 'アーカイブ (Archive)',
                            icon: <Archive size={14} />,
                            onClick: () => openConfirm('archive', contextMenu.project)
                        },
                        {
                            label: 'ゴミ箱へ移動 (Move to Trash)',
                            icon: <Trash2 size={14} />,
                            danger: true,
                            onClick: () => openConfirm('trash', contextMenu.project)
                        }
                    ]}
                />
            )}

            {/* Confirmation Modal */}
            {confirmDialog.isOpen && (
                <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl max-w-md w-full p-6 border border-slate-200 dark:border-slate-700 scale-100 animate-in zoom-in-95 duration-200">
                        <h3 className={`text-lg font-bold mb-3 ${confirmDialog.danger ? 'text-red-600' : 'text-slate-800 dark:text-slate-100'}`}>
                            {confirmDialog.title}
                        </h3>
                        <p className="text-slate-600 dark:text-slate-300 text-sm whitespace-pre-wrap mb-6 leading-relaxed">
                            {confirmDialog.message}
                        </p>
                        <div className="flex justify-end gap-3">
                            <button
                                onClick={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))}
                                className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700 transition-colors"
                            >
                                キャンセル
                            </button>
                            <button
                                onClick={handleConfirmAction}
                                className={`px-4 py-2 rounded-lg text-sm font-medium text-white shadow-sm transition-all active:scale-95 ${confirmDialog.danger
                                    ? 'bg-red-600 hover:bg-red-700 shadow-red-200'
                                    : 'bg-blue-600 hover:bg-blue-700 shadow-blue-200'
                                    }`}
                            >
                                実行する
                            </button>
                        </div>
                    </div>
                </div>
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
