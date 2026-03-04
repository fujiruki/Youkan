import React, { useEffect, useState } from 'react';
import { useProjectViewModel } from '../viewmodels/useProjectViewModel';
import { Project } from '../types';
import { Plus, Edit2, Trash2, Building2, Archive, LayoutGrid, MoreVertical, Calendar } from 'lucide-react';
import { useAuth } from '../../auth/providers/AuthProvider';
import { YOUKAN_EVENTS } from '../../session/youkanKeys';
import { useFilter } from '../contexts/FilterContext';


import { ContextMenu } from '../components/GlobalBoard/ContextMenu';
import { DecisionDetailModal } from '../components/Modal/DecisionDetailModal';
import { ApiClient } from '../../../../api/client';
import { Item } from '../types';
import { useItemContextMenu } from '../hooks/useItemContextMenu';

export const ProjectRegistryScreen: React.FC<{ onSelect: (project: Project) => void }> = ({ onSelect }) => {
	const {
		projects,
		members,
		loading,
		fetchProjects,
		deleteProject,
		trashProject,
		archiveProject,
		assignProject,
		activeScope,
		setActiveScope
	} = useProjectViewModel();

	const [viewMode, setViewMode] = useState<'list' | 'grid'>('grid');
	const { menuState: contextMenu, handleContextMenu, closeMenu, lastTargetId, setLastTargetId } = useItemContextMenu({
		onDelete: (id) => trashProject(id)
	});
	const [selectedItem, setSelectedItem] = useState<Item | null>(null);

	const { joinedTenants } = useAuth();

	// Derived state for filtering
	const rawFilteredProjects = activeScope === 'company'
		? projects.filter(p => p.tenantId)
		: projects.filter(p => !p.tenantId);

	// [NEW] Recursive hierarchy sorting
	const getHierarchicalProjects = (projs: Project[]): (Project & { depth: number })[] => {
		const result: (Project & { depth: number })[] = [];
		const rootProjects = projs.filter(p => !p.parentId || !projs.some(pp => String(pp.id) === String(p.parentId)));

		const addRecursive = (parentId: string, depth: number) => {
			const children = projs.filter(p => String(p.parentId) === String(parentId));
			children.forEach(child => {
				result.push({ ...child, depth: depth + 1 });
				addRecursive(String(child.id), depth + 1);
			});
		};

		rootProjects.forEach(root => {
			result.push({ ...root, depth: 0 });
			addRecursive(String(root.id), 0);
		});

		return result;
	};

	const filteredProjects = getHierarchicalProjects(rawFilteredProjects);

	useEffect(() => {
		fetchProjects();
	}, [fetchProjects, activeScope]);

	const handleCreate = () => {
		window.dispatchEvent(new CustomEvent(YOUKAN_EVENTS.OPEN_PROJECT_MODAL));
	};

	const handleEdit = (project: Project) => {
		handleOpenDetail(project);
		closeMenu();
	};

	const handleOpenDetail = (project: Project) => {
		// Convert Project to Item compatible structure for DecisionDetailModal
		// Convert Status - Project has more statuses than Item
		const mapStatus = (s?: string): any => {
			if (!s) return 'inbox';
			if (s === 'active') return 'focus';
			if (s === 'decision_hold') return 'waiting';
			if (s === 'someday') return 'pending';
			return s;
		};

		const item: Item = {
			id: String(project.id),
			title: project.title || project.name || 'Untitled Project',
			status: mapStatus(project.judgmentStatus),
			focusOrder: 0,
			isEngaged: false,
			statusUpdatedAt: project.updatedAt || Math.floor(Date.now() / 1000),
			interrupt: false,
			weight: 2,
			projectId: String(project.id),
			isProject: true,
			tenantId: project.tenantId || null,
			createdAt: project.createdAt,
			updatedAt: project.updatedAt,
			memo: '',
			due_date: '',
			flags: {},
			assignedTo: project.assigned_to,
			isArchived: project.isArchived,
		};
		setSelectedItem(item);
		closeMenu();
	};

	// handleDialogSave removed - handled by App.tsx

	// Global Shortcut for ALT+D (Delete is handled by hook)
	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.altKey && e.key.toLowerCase() === 'd') {
				if (document.activeElement instanceof HTMLInputElement || document.activeElement instanceof HTMLTextAreaElement) return;
				e.preventDefault();
				const targetId = contextMenu?.targetId || lastTargetId;
				if (targetId) {
					const project = projects.find(p => String(p.id) === targetId);
					if (project) handleOpenDetail(project);
				}
			}
		};
		window.addEventListener('keydown', handleKeyDown);
		return () => window.removeEventListener('keydown', handleKeyDown);
	}, [contextMenu, lastTargetId, projects]);

	// [REFACTORED] FilterContextでフィルタモードを取得し、activeScopeと同期
	const { filterMode } = useFilter();
	useEffect(() => {
		if (filterMode === 'personal' || filterMode === 'company') {
			setActiveScope(filterMode as 'personal' | 'company');
		}
	}, [filterMode, setActiveScope]);

	useEffect(() => {
		const handleViewModeChange = (e: any) => {
			const mode = e.detail?.mode;
			if (mode === 'grid' || mode === 'list') {
				setViewMode(mode);
			}
		};
		window.addEventListener(YOUKAN_EVENTS.PROJECT_VIEW_MODE_CHANGE, handleViewModeChange as EventListener);
		return () => {
			window.removeEventListener(YOUKAN_EVENTS.PROJECT_VIEW_MODE_CHANGE, handleViewModeChange as EventListener);
		};
	}, []);

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
			{/* Project List Title (Optional - for context) */}
			<div className="shrink-0 px-6 pt-6 flex items-center justify-between">
				<div>
					<h1 className="text-sm font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
						Project Registry
						<span className="text-xs font-bold text-slate-300">({filteredProjects.length})</span>
					</h1>
				</div>
				<div className="flex items-center gap-2">
					<button
						onClick={() => handleCreate()}
						className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-md text-[11px] font-black flex items-center gap-1.5 shadow-sm transition-all focus:ring-2 focus:ring-blue-500 focus:outline-none uppercase tracking-tighter"
					>
						<Plus size={14} strokeWidth={3} />
						CREATE NEW
					</button>
				</div>
			</div>

			{/* Content */}
			<div className="flex-1 overflow-y-auto p-6" onClick={closeMenu}>
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
										onClick={() => { onSelect(project); setLastTargetId(String(project.id)); }}
										onContextMenu={(e) => handleContextMenu(e, String(project.id))}
									>
										<td className="px-6 py-3 font-medium text-slate-700 dark:text-slate-200">
											<div className="flex items-center gap-2" style={{ marginLeft: `${project.depth * 1.5}rem` }}>
												{project.depth > 0 && <span className="text-slate-300">└</span>}
												{project.title}
											</div>
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
													title={(members.find(m => m.id === project.assigned_to) as any)?.display_name || (members.find(m => m.id === project.assigned_to) as any)?.name}
												>
													{((members.find(m => m.id === project.assigned_to) as any)?.display_name || (members.find(m => m.id === project.assigned_to) as any)?.name)?.charAt(0)}
												</div>
											)}
										</td>
										<td className="px-6 py-3">
											<button className="text-slate-400 hover:text-slate-600 p-1" onClick={(e) => { e.stopPropagation(); handleContextMenu(e, String(project.id)); }}>
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
													<h2 className="text-lg font-bold text-slate-800 dark:text-white leading-tight">{(tenant as any).title || tenant.name}</h2>
													<p className="text-xs text-slate-400">所属プロジェクト: {tenantProjects.length}件</p>
												</div>
											</div>
											<button
												onClick={() => handleCreate()}
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
											<div className="grid gap-6" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))' }}>
												{tenantProjects.map((project) => (
													<ProjectCard
														key={project.id}
														project={project}
														members={members}
														onSelect={() => { onSelect(project); setLastTargetId(String(project.id)); }}
														onEdit={() => handleEdit(project)}
														onContextMenu={(e) => handleContextMenu(e, String(project.id))}
														onAssign={(assigneeId) => assignProject(String(project.id), assigneeId)}
													/>
												))}
											</div>
										)}
									</div>
								);
							})
						) : (
							<div className="grid gap-6" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))' }}>
								{filteredProjects.map((project) => (
									<ProjectCard
										key={project.id}
										project={project}
										members={members}
										onSelect={() => { onSelect(project); setLastTargetId(String(project.id)); }}
										onEdit={() => handleEdit(project)}
										onContextMenu={(e) => handleContextMenu(e, String(project.id))}
										onAssign={(assigneeId) => assignProject(String(project.id), assigneeId)}
									/>
								))}
							</div>
						)}
					</div>
				)}
			</div>

			{/* Unified Dialog removed - handled by App.tsx */}

			{/* Context Menu */}
			{contextMenu && (
				<ContextMenu
					x={contextMenu.x}
					y={contextMenu.y}
					itemId={contextMenu.targetId!}
					onClose={closeMenu}
					actions={[
						{
							label: '開く',
							icon: <LayoutGrid size={14} />,
							onClick: () => {
								const project = projects.find(p => String(p.id) === contextMenu.targetId);
								if (project) onSelect(project);
							}
						},
						{
							label: '詳細画面を開く (Detail)',
							icon: <Calendar size={14} />,
							onClick: () => {
								const project = projects.find(p => String(p.id) === contextMenu.targetId);
								if (project) handleOpenDetail(project);
							}
						},
						{
							label: '名前・設定変更',
							icon: <Edit2 size={14} />,
							onClick: () => {
								const project = projects.find(p => String(p.id) === contextMenu.targetId);
								if (project) handleEdit(project);
							}
						},
						{
							label: 'アーカイブ (Archive)',
							icon: <Archive size={14} />,
							onClick: () => {
								const project = projects.find(p => String(p.id) === contextMenu.targetId);
								if (project) openConfirm('archive', project);
							}
						},
						{
							label: 'ゴミ箱へ移動 (Move to Trash)',
							icon: <Trash2 size={14} />,
							danger: true,
							onClick: () => {
								const project = projects.find(p => String(p.id) === contextMenu.targetId);
								if (project) openConfirm('trash', project);
							}
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
					quantityItems={projects as any}
					filterMode={activeScope as any}
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
	const getStatusBgColor = (status: string) => {
		switch (status) {
			case 'focus': return 'bg-blue-50/40 dark:bg-blue-900/10';
			case 'done': return 'bg-green-50/40 dark:bg-green-900/10';
			case 'pending': return 'bg-amber-50/40 dark:bg-amber-900/10';
			case 'waiting': return 'bg-red-50/40 dark:bg-red-900/10';
			default: return 'bg-white dark:bg-slate-800';
		}
	};

	const statusBg = getStatusBgColor(project.judgmentStatus || 'inbox');

	return (
		<div
			onClick={onSelect}
			onContextMenu={onContextMenu}
			className={`group ${statusBg} rounded shadow-sm hover:shadow-md transition-all border border-slate-200 dark:border-slate-700 relative overflow-hidden cursor-pointer h-auto flex flex-col p-1 w-full`}
		>
			{/* Color accent (Simplified to bar) */}
			<div className="absolute top-0 left-0 w-1 h-full" style={{ backgroundColor: project.color || '#6366f1' }} />

			<div className="pl-1.5 flex flex-col">
				<div className="flex justify-between items-start leading-none">
					<div className="flex items-center gap-1">
						<span className="text-[9px] uppercase font-bold text-slate-400 truncate max-w-[100px]">
							{project.parentTitle ? `親: ${project.parentTitle}` : (project.clientName || project.client || '自社・個人')}
						</span>
					</div>
				</div>

				{/* Vertical margin exactly 3px (approx mt-[3px]) */}
				<h3 className="text-sm font-bold text-slate-800 dark:text-white mt-[3px] mb-1 break-words leading-tight">
					{project.title || project.name}
				</h3>

				<div className="flex items-center gap-2 text-[10px] text-slate-500 dark:text-slate-400 mb-1">
					<div className="flex items-center gap-1">
						<span className="text-slate-400">¥</span>
						<span className="font-mono font-bold text-slate-700 dark:text-slate-200">
							{project.grossProfitTarget?.toLocaleString() ?? 0}
						</span>
					</div>
					<div className="flex items-center gap-1 border-l border-slate-200 dark:border-slate-700 pl-2">
						<span className="capitalize">{project.judgmentStatus === 'waiting' ? 'キャンセル/待ち' : (project.judgmentStatus || '未分類')}</span>
					</div>
				</div>

				{/* Compact Assignee & Action */}
				<div className="pt-1 border-t border-slate-100 dark:border-slate-700/50 flex items-center justify-between">
					<div className="flex items-center gap-1">
						<span className="text-[9px] text-slate-400">担当:</span>
						<select
							value={project.assigned_to || ''}
							onClick={(e) => e.stopPropagation()}
							onChange={(e) => {
								e.stopPropagation();
								onAssign?.(e.target.value || null);
							}}
							className="text-[9px] bg-slate-100 dark:bg-slate-700 border-none rounded px-1 py-0 outline-none focus:ring-1 focus:ring-indigo-400 max-w-[60px] h-4"
						>
							<option value="">未割当</option>
							{members.map(m => (
								<option key={m.id} value={m.id}>{m.display_name || m.name}</option>
							))}
						</select>
					</div>

					<div className="flex items-center gap-1">
						<span className="flex items-center gap-0.5 text-[9px] text-slate-300">
							<Calendar size={8} />
							{new Date(project.updatedAt).toLocaleDateString(undefined, { month: 'numeric', day: 'numeric' })}
						</span>
						<button onClick={(e) => { e.stopPropagation(); onEdit(); }} className="p-0.5 text-slate-300 hover:text-indigo-500 transition-colors">
							<Edit2 className="w-3 h-3" />
						</button>
					</div>
				</div>
			</div>
		</div>
	);
};
