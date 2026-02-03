import React, { useEffect, useState } from 'react';
import { useProjectViewModel } from '../viewmodels/useProjectViewModel';
import { Project } from '../types';
import { Plus, Edit2, Trash2, ArrowLeft, Building2, Briefcase, Archive, LayoutGrid, List, MoreVertical, Calendar } from 'lucide-react';
import { useAuth } from '../../auth/providers/AuthProvider';

import { ProjectCreationDialog } from '../components/Modal/ProjectCreationDialog';
import { ContextMenu } from '../components/GlobalBoard/ContextMenu';
import { DecisionDetailModal } from '../components/Modal/DecisionDetailModal';
import { ApiClient } from '../../../../api/client';
import { Item } from '../types';

export const ProjectRegistryScreen: React.FC<{ onSelect: (project: Project) => void; onBack: () => void }> = ({ onSelect, onBack }) => {
    const {
        projects,
        members,
        loading,
        fetchProjects,
        createProject,
        updateProject,
        deleteProject,
        trashProject,
        archiveProject,
        assignProject,
        activeScope,
        setActiveScope
    } = useProjectViewModel();

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingProject, setEditingProject] = useState<Project | null>(null);
    const [viewMode, setViewMode] = useState<'list' | 'grid'>('grid');
    const [contextMenu, setContextMenu] = useState<{ x: number; y: number; project: Project } | null>(null);
    const [selectedItem, setSelectedItem] = useState<Item | null>(null);
    const [defaultTenantId, setDefaultTenantId] = useState<string | undefined>(undefined);

    const { joinedTenants } = useAuth();

    // Derived state for filtering
    const filteredProjects = activeScope === 'company'
        ? projects.filter(p => p.tenantId)
        : projects.filter(p => !p.tenantId);

    useEffect(() => {
        fetchProjects();
    }, [fetchProjects, activeScope]);

    const handleCreate = (tenantId?: string) => {
        setEditingProject(null);
        setDefaultTenantId(tenantId);
        setIsModalOpen(true);
    };

    const handleEdit = (project: Project) => {
        setEditingProject(project);
        setIsModalOpen(true);
        setContextMenu(null);
    };

    const handleOpenDetail = (project: Project) => {
        // Convert Project to Item compatible structure for DecisionDetailModal
        const item: Item = {
            id: project.id,
            title: project.title || project.name,
            status: project.judgmentStatus || 'inbox',
            focusOrder: 0,
            isEngaged: false,
            statusUpdatedAt: project.updatedAt || Math.floor(Date.now() / 1000),
            interrupt: false,
            weight: 2,
            projectId: project.id,
            isProject: true,
            tenantId: project.tenantId || null,
            createdAt: project.createdAt,
            updatedAt: project.updatedAt,
            memo: '',
            due_date: '',
            flags: {}
        };
        setSelectedItem(item);
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

    const handleContextMenu = (e: React.MouseEvent, project: Project) => {
        e.preventDefault();
        setContextMenu({
            x: e.clientX,
            y: e.clientY,
            project
        });
    };

    // [NEW] Confirmation Modal State
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
                message = `プロジェクト「${project.title || project.name}」をアーカイブしますか？\nアーカイブされたプロジェクトは一覧から非表示になります。`;
                break;
            case 'trash':
                title = 'ゴミ箱へ移動';
                message = `プロジェクト「${project.title || project.name}」をゴミ箱へ移動しますか？`;
                danger = true;
                break;
            case 'destroy':
                title = '完全削除';
                message = `【警告】プロジェクト「${project.title || project.name}」を完全に削除しますか？\nこの操作は取り消せません。`;
                danger = true;
                break;
        }

        setConfirmDialog({
            isOpen: true,
            title,
            message,
            action,
            targetId: String(project.id),
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

                {/* Scope Tabs */}
                <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-lg p-1">
                    <button
                        onClick={() => setActiveScope('company')}
                        className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium transition-all ${activeScope === 'company'
                            ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm'
                            : 'text-slate-500 hover:text-slate-700'
                            }`}
                    >
                        <Building2 size={16} />
                        Company
                    </button>
                    <button
                        onClick={() => setActiveScope('personal')}
                        className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium transition-all ${activeScope === 'personal'
                            ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm'
                            : 'text-slate-500 hover:text-slate-700'
                            }`}
                    >
                        <Briefcase size={16} />
                        Personal
                    </button>
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
                        onClick={() => handleCreate()}
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
                ) : viewMode === 'list' && activeScope === 'personal' ? (
                    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 text-xs uppercase text-slate-500 font-medium">
                                <tr>
                                    <th className="px-6 py-3">プロジェクト名</th>
                                    <th className="px-6 py-3">クライアント</th>
                                    <th className="px-6 py-3">更新日</th>
                                    <th className="px-6 py-3">担当</th>
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
                                            {project.title || project.name}
                                        </td>
                                        <td className="px-6 py-3 text-slate-500">
                                            {project.client || '-'}
                                        </td>
                                        <td className="px-6 py-3 text-slate-400 text-xs">
                                            {new Date(project.updatedAt).toLocaleDateString()}
                                        </td>
                                        <td className="px-6 py-3">
                                            {project.assigned_to && (
                                                <div
                                                    className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] text-white font-bold"
                                                    style={{ backgroundColor: members.find(m => m.id === project.assigned_to)?.color || '#94a3b8' }}
                                                    title={members.find(m => m.id === project.assigned_to)?.name}
                                                >
                                                    {members.find(m => m.id === project.assigned_to)?.name?.charAt(0)}
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-6 py-3">
                                            <button className="text-slate-400 hover:text-slate-600 p-1" onClick={(e) => { e.stopPropagation(); handleContextMenu(e, project); }}>
                                                <MoreVertical size={16} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="space-y-12">
                        {activeScope === 'company' ? (
                            joinedTenants.map(tenant => {
                                const tenantProjects = projects.filter(p => p.tenantId === tenant.id);
                                return (
                                    <div key={tenant.id} className="space-y-6">
                                        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white">
                                                    <Building2 size={18} />
                                                </div>
                                                <div>
                                                    <h2 className="text-lg font-bold text-slate-800 dark:text-white leading-tight">{tenant.name}</h2>
                                                    <p className="text-xs text-slate-400">所属プロジェクト: {tenantProjects.length}件</p>
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => handleCreate(tenant.id)}
                                                className="p-1.5 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors flex items-center gap-1.5 text-xs font-bold"
                                            >
                                                <Plus size={16} />
                                                <span>PROJECT</span>
                                            </button>
                                        </div>

                                        {tenantProjects.length === 0 ? (
                                            <div className="text-center py-12 bg-slate-50 dark:bg-slate-800/30 rounded-xl border border-dashed border-slate-200 dark:border-slate-700 text-slate-400 text-sm">
                                                プロジェクトがありません
                                            </div>
                                        ) : (
                                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                                                {tenantProjects.map((project) => (
                                                    <ProjectCard
                                                        key={project.id}
                                                        project={project}
                                                        members={members}
                                                        onSelect={() => onSelect(project)}
                                                        onEdit={() => handleEdit(project)}
                                                        onContextMenu={(e) => handleContextMenu(e, project)}
                                                        onAssign={(assigneeId) => assignProject(String(project.id), assigneeId)}
                                                    />
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                );
                            })
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                                {filteredProjects.map((project) => (
                                    <ProjectCard
                                        key={project.id}
                                        project={project}
                                        members={members}
                                        onSelect={() => onSelect(project)}
                                        onEdit={() => handleEdit(project)}
                                        onContextMenu={(e) => handleContextMenu(e, project)}
                                        onAssign={(assigneeId) => assignProject(String(project.id), assigneeId)}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Unified Dialog */}
            {isModalOpen && (
                <ProjectCreationDialog
                    isOpen={isModalOpen}
                    onClose={() => {
                        setIsModalOpen(false);
                        setDefaultTenantId(undefined);
                    }}
                    onCreate={handleDialogSave}
                    activeScope={activeScope}
                    tenants={joinedTenants}
                    project={editingProject}
                    defaultTenantId={defaultTenantId}
                />
            )}

            {/* Context Menu */}
            {contextMenu && (
                <ContextMenu
                    x={contextMenu.x}
                    y={contextMenu.y}
                    itemId=""
                    onClose={() => setContextMenu(null)}
                    actions={[
                        {
                            label: '開く',
                            icon: <LayoutGrid size={14} />,
                            onClick: () => onSelect(contextMenu.project)
                        },
                        {
                            label: '詳細画面を開く (Detail)',
                            icon: <Calendar size={14} />,
                            onClick: () => handleOpenDetail(contextMenu.project)
                        },
                        {
                            label: '名前・設定変更',
                            icon: <Edit2 size={14} />,
                            onClick: () => handleEdit(contextMenu.project)
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

            {/* Decision Detail Modal integration for Projects */}
            {selectedItem && (
                <DecisionDetailModal
                    item={selectedItem}
                    onClose={() => {
                        setSelectedItem(null);
                        fetchProjects(); // Refresh after modal close
                    }}
                    onDecision={(id, _decision, _note, updates) => {
                        // Standard Decision Logic?
                        // For Project screen, we mostly care about updates.
                        if (updates) ApiClient.updateItem(id, updates).then(() => fetchProjects());
                        setSelectedItem(null);
                    }}
                    onDelete={(id) => {
                        trashProject(id);
                        setSelectedItem(null);
                    }}
                    onUpdate={async (id, updates) => {
                        await ApiClient.updateItem(id, updates);
                        fetchProjects();
                    }}
                    onCreateSubTask={async (parentId, title) => {
                        const res = await ApiClient.createItem({ title, projectId: parentId, status: 'inbox' });
                        return res.id;
                    }}
                    onGetSubTasks={async (parentId) => {
                        // Projects usually don't have sub-tasks in THIS screen context?
                        // Actually they DO have tasks in the GDB items table.
                        return ApiClient.getAllItems({ project_id: parentId }) as any;
                    }}
                    members={members as any}
                    joinedTenants={joinedTenants}
                    allProjects={projects as any}
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

// Rich Project Card Component
const ProjectCard: React.FC<{
    project: Project;
    onSelect: () => void;
    onEdit: () => void;
    onContextMenu: (e: React.MouseEvent) => void;
    members?: any[];
    onAssign?: (id: string | null) => void;
}> = ({ project, onSelect, onEdit, onContextMenu, members = [], onAssign }) => {
    return (
        <div
            onClick={onSelect}
            onContextMenu={onContextMenu}
            className="group bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm hover:shadow-lg transition-all border border-slate-100 dark:border-slate-700 relative overflow-hidden cursor-pointer h-[200px] flex flex-col"
        >
            {/* Color accent */}
            <div className="absolute top-0 left-0 w-1.5 h-full" style={{ backgroundColor: project.color || '#6366f1' }} />

            <div className="pl-3 flex flex-col h-full">
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
                    </div>
                </div>

                <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-0.5 truncate">
                    {project.title || project.name}
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

                {/* Spacer */}
                <div className="flex-1" />

                {/* Assignment Selector & Date */}
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
                            className="text-[10px] bg-slate-100 dark:bg-slate-700 border-none rounded px-1.5 py-0.5 outline-none focus:ring-1 focus:ring-indigo-400 max-w-[80px]"
                        >
                            <option value="">未割当</option>
                            {members.map(m => (
                                <option key={m.id} value={m.id}>{m.name}</option>
                            ))}
                        </select>
                    </div>

                    <div className="flex items-center gap-2">
                        {project.assigned_to && (
                            <div
                                className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] text-white font-bold"
                                style={{ backgroundColor: members.find(m => m.id === project.assigned_to)?.color || '#94a3b8' }}
                                title={members.find(m => m.id === project.assigned_to)?.name}
                            >
                                {members.find(m => m.id === project.assigned_to)?.name?.charAt(0)}
                            </div>
                        )}
                        <span className="flex items-center gap-1 text-[10px] text-slate-400">
                            <Calendar size={10} />
                            {new Date(project.updatedAt).toLocaleDateString()}
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
};
