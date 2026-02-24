import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Trash2, PauseCircle, CheckCircle2, Folder, CalendarDays, CalendarClock, ChevronDown, Building2, User } from 'lucide-react';
import { Item, Member, FilterMode, CapacityConfig } from '../../../youkan/types';
import { cn } from '../../../../../lib/utils';
import { YOUKAN_KEYS } from '../../../session/youkanKeys';
import { ApiClient } from '../../../../../api/client';
import { format } from 'date-fns';
import { safeFormat } from '../../logic/dateUtils';
import { SmartDateInput } from '../Inputs/SmartDateInput';
import { SideCalendarPanel } from '../Inputs/SideCalendarPanel';
import { QuantityEngine } from '../../logic/QuantityEngine';
import { SubtaskListWidget } from '../Widgets/SubtaskListWidget';
import { YoukanDropdown, YoukanDropdownItem } from '../../../ui/YoukanDropdown';


interface DecisionDetailModalProps {
	item: Item | null;
	onClose: () => void;
	onDecision: (id: string, decision: 'yes' | 'hold' | 'no', note?: string, updates?: Partial<Item>) => void;
	onDelete: (id: string) => void;
	onUpdate?: (id: string, updates: Partial<Item>) => Promise<void>;
	onCreateSubTask?: (parentId: string, title: string, initialDueDate?: string) => Promise<string | undefined>;
	onGetSubTasks?: (parentId: string) => Promise<Item[]>;
	onDelegate?: (taskId: string, assignedTo: string, dueDate?: string, note?: string) => Promise<void>;
	onOpenItem?: (item: Item) => void;
	members?: Member[];
	allProjects?: Item[];
	joinedTenants?: { id: string; name: string }[];
	quantityItems?: Item[];
	filterMode?: FilterMode;
	capacityConfig?: CapacityConfig;
	currentUserId?: string | null;
	updateItemMetrics?: (id: string, metrics: { work_days?: number, estimatedMinutes?: number }) => Promise<void>;
	// yesButtonLabel?: string; // Unused
	initialFocus?: 'date';
}
export const DecisionDetailModal: React.FC<DecisionDetailModalProps> = ({
	item: propItem, onClose, onDecision, onDelete, onUpdate, onCreateSubTask: _onCreateSubTask, onGetSubTasks: _onGetSubTasks,
	onDelegate: _onDelegate, onOpenItem: _onOpenItem, members = [], allProjects = [], joinedTenants = [],
	quantityItems = [], filterMode = 'all', capacityConfig, currentUserId, updateItemMetrics
}) => {
	const [history, setHistory] = React.useState<Item[]>([]);

	const item = React.useMemo(() => {
		if (history.length > 0) return history[history.length - 1];
		return propItem;
	}, [history, propItem]);

	React.useEffect(() => {
		setHistory([]);
	}, [propItem?.id]);

	const handleDrillDown = (subItem: Item) => {
		setHistory(prev => [...prev, subItem]);
	};

	const handleBack = async () => {
		await saveChanges();
		setHistory(prev => prev.slice(0, -1));
	};

	const [note, setNote] = React.useState('');
	const [dueStatus, setDueStatus] = React.useState<any>('waiting_external');
	const [dueDate, setDueDate] = React.useState('');
	const [prepDate, setPrepDate] = React.useState('');
	const [workDays, setWorkDays] = React.useState(1);
	const [isWorkDaysDirty, setIsWorkDaysDirty] = React.useState(false);
	const [isEditingTitle, setIsEditingTitle] = React.useState(false);
	const [editedTitle, setEditedTitle] = React.useState('');
	const [estimatedMinutes, setEstimatedMinutes] = React.useState(0);

	// const [subTasks, setSubTasks] = React.useState<Item[]>([]);
	// const [newSubTaskTitle, setNewSubTaskTitle] = React.useState('');
	const [isProject, setIsProject] = React.useState(false);
	const [activeDateInput, setActiveDateInput] = React.useState<'due' | 'my' | null>('due');

	const [localTenantId, setLocalTenantId] = React.useState<string>('');
	const [localProjectId, setLocalProjectId] = React.useState<string>('');
	const [localAssignedTo, setLocalAssignedTo] = React.useState<string>('');

	React.useEffect(() => {
		if (item) {
			setNote(item.memo || '');
			setDueStatus(item.dueStatus || (item.due_date ? 'confirmed' : 'waiting_external'));
			setDueDate(item.due_date || '');
			// [FIX] Use safeFormat instead of direct Date parse + toISOString to prevent RangeError
			setPrepDate(item.prep_date ? safeFormat(item.prep_date * 1000, 'yyyy-MM-dd', '') : '');
			setWorkDays(item.work_days ?? 1);
			setIsWorkDaysDirty(false);
			setEditedTitle(item.title);
			setEstimatedMinutes(item.estimatedMinutes ?? 0);
			setIsProject(item.isProject ?? false);
			setLocalTenantId(item.tenantId || '');
			setLocalProjectId(item.projectId || '');
			setLocalAssignedTo(item.assignedTo || (item as any).assigned_to || '');
			// setSubTasks([]);
		}
	}, [item?.id, item?.title, item?.tenantId, item?.projectId, item?.assignedTo, allProjects.length, joinedTenants.length]);

	React.useEffect(() => {
		if (!item) return;

		// if (isProject && onGetSubTasks) {
		//     onGetSubTasks(item.id).then(tasks => {
		//         setSubTasks(tasks);
		//     });
		// }

		if (item.dueStatus === 'waiting_external' && !dueDate) {
			const todayStr = safeFormat(new Date(), 'yyyy-MM-dd');
			setDueDate(todayStr);
			setDueStatus('confirmed');
		}
	}, [item?.id, isProject, _onGetSubTasks, item?.dueStatus]);

	// [NEW] Use separate memo for Details to display the breakdown, and derive Period from it
	const allocationDetails = React.useMemo(() => {
		if (!item || !capacityConfig) {
			console.log('[DecisionDetailModal] No item or capacityConfig, skipping allocation');
			return [];
		}

		const anchorStr = prepDate || dueDate;
		// console.log(`[DecisionDetailModal] Recalc Trigger: anchor=${anchorStr}, min=${estimatedMinutes}, wDays=${workDays}`);

		if (!anchorStr) {
			console.log('[DecisionDetailModal] No anchor date, skipping allocation');
			return [];
		}
		const anchor = new Date(anchorStr);

		const baseDailyMinutes = capacityConfig.defaultDailyMinutes || 480;
		const minutes = (isWorkDaysDirty || !estimatedMinutes) ? (workDays * baseDailyMinutes) : estimatedMinutes;

		const tenantProfiles = new Map<string, any>();
		joinedTenants.forEach((t: any) => {
			if (t.capacityProfile) {
				tenantProfiles.set(t.id, t.capacityProfile);
			}
		});

		const context: any = {
			items: quantityItems,
			members,
			capacityConfig,
			filterMode,
			focusedTenantId: (localTenantId !== undefined ? localTenantId : item.tenantId),
			focusedProjectId: item.projectId,
			tenantProfiles,
			currentUser: {
				id: (JSON.parse(localStorage.getItem(YOUKAN_KEYS.USER) || '{}').id || ''),
				isCompanyAccount: (JSON.parse(localStorage.getItem(YOUKAN_KEYS.USER) || '{}').id || '').length > 20,
				joinedTenants: joinedTenants
			}
		};

		const details = QuantityEngine.calculateAllocationDetails(anchor, minutes, context, (localTenantId !== undefined ? localTenantId : item.tenantId));
		// console.log(`[DecisionDetailModal] Allocation Result: ${details.length} steps`);
		return details;
	}, [item?.id, prepDate, dueDate, activeDateInput, estimatedMinutes, workDays, isWorkDaysDirty, localTenantId, capacityConfig, joinedTenants, quantityItems, members, filterMode]);

	const commitPeriodDates = React.useMemo(() => {
		return allocationDetails.map(step => step.date);
	}, [allocationDetails]);

	const [isMenuOpen, setIsMenuOpen] = React.useState(false);

	// [NEW] Active Menu for Header Dropdowns -> Removed in favor of YoukanDropdown internal state
	// const [activeMenu, setActiveMenu] = React.useState<'tenant' | 'project' | null>(null);
	// const headerMenuRef = React.useRef<HTMLDivElement>(null);

	// React.useEffect(() => {
	//     const handleClickOutsideHeader = (event: MouseEvent) => {
	//         if (headerMenuRef.current && !headerMenuRef.current.contains(event.target as Node)) {
	//             setActiveMenu(null);
	//         }
	//     };

	//     if (activeMenu) {
	//         document.addEventListener('mousedown', handleClickOutsideHeader);
	//     }
	//     return () => {
	//         document.removeEventListener('mousedown', handleClickOutsideHeader);
	//     };
	// }, [activeMenu]);

	// Footer Menu Logic
	const menuRef = React.useRef<HTMLDivElement>(null);

	const dateInputRef = React.useRef<HTMLInputElement>(null);
	const titleInputRef = React.useRef<HTMLInputElement>(null);

	React.useEffect(() => {
		const handleClickOutside = (event: MouseEvent) => {
			if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
				setIsMenuOpen(false);
			}
		};

		if (isMenuOpen) {
			document.addEventListener('mousedown', handleClickOutside);
		}
		return () => {
			document.removeEventListener('mousedown', handleClickOutside);
		};
	}, [isMenuOpen]);

	React.useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if (!item) return;
			e.stopPropagation();

			if (e.altKey && e.key.toLowerCase() === 'd') {
				e.preventDefault();
				if (dueStatus === 'waiting_external') {
					setDueStatus('confirmed');
					const updates: Partial<Item> = { dueStatus: 'confirmed' };
					if (onUpdate) onUpdate(item.id, updates);
					else ApiClient.updateItem(item.id, updates);
				}
				setTimeout(() => dateInputRef.current?.focus(), 50);
			}

			if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
				e.preventDefault();
				handleDecisionWithSave('yes');
				return;
			}

			if (e.key === 'Escape') {
				e.preventDefault();
				handleClose();
			}
		};
		window.addEventListener('keydown', handleKeyDown);
		return () => window.removeEventListener('keydown', handleKeyDown);
	}, [item ? item.id : null, dueStatus, note, workDays, onDecision, onClose, onUpdate, isWorkDaysDirty]);

	const getPendingChanges = () => {
		if (!item) return {};
		const updates: Partial<Item> = {};

		if (isWorkDaysDirty || workDays !== item.work_days) {
			updates.work_days = workDays;
		}
		if (estimatedMinutes !== (item.estimatedMinutes || 0)) {
			updates.estimatedMinutes = estimatedMinutes;
		}
		if (note !== (item.memo || '')) {
			updates.memo = note;
		}
		const itemPrepStr = item.prep_date ? new Date(item.prep_date * 1000).toISOString().split('T')[0] : '';
		if (prepDate !== itemPrepStr) {
			const dateObj = new Date(prepDate);
			const timestamp = !isNaN(dateObj.getTime()) ? Math.floor(dateObj.getTime() / 1000) : null;
			if (timestamp !== item.prep_date) {
				updates.prep_date = timestamp;
			}
		}
		if (dueDate !== (item.due_date || '')) {
			updates.due_date = dueDate;
			updates.dueStatus = dueStatus;
		}
		if (editedTitle !== item.title) {
			updates.title = editedTitle;
		}
		if (localTenantId !== (item.tenantId || '')) {
			updates.tenantId = localTenantId || null as any;
		}
		if (localProjectId !== (item.projectId || '')) {
			updates.projectId = localProjectId || null as any;
		}
		const currentAssignedTo = item.assignedTo || (item as any).assigned_to || '';
		if (localAssignedTo !== currentAssignedTo) {
			updates.assignedTo = localAssignedTo || null as any;
		}

		return updates;
	};

	const saveChanges = async () => {
		if (!item) return;
		const updates = getPendingChanges();
		if (Object.keys(updates).length > 0) {
			if (onUpdate) {
				await onUpdate(item.id, updates);
			} else {
				await ApiClient.updateItem(item.id, updates);
			}
		}
	};

	const handleClose = async () => {
		await saveChanges();
		onClose();
	};

	const handleDecisionWithSave = async (decision: 'yes' | 'hold' | 'no') => {
		if (!item) return;
		const updates = getPendingChanges();

		if (decision === 'yes') {
			const todayStr = format(new Date(), 'yyyy-MM-dd');
			// Ensure confirmed status and date if it's the primary "Do Today" action
			if (!updates.due_date && !item.due_date) {
				updates.due_date = todayStr;
				updates.dueStatus = 'confirmed';
			} else {
				updates.dueStatus = 'confirmed';
			}
		}

		onDecision(item.id, decision, note, updates);
	};

	if (!item) return null;

	return (
		<div
			className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm"
			onClick={handleClose}
		>
			<div
				className="relative w-[98vw] h-[calc(100vh-20px)] flex flex-col overflow-hidden rounded-xl shadow-2xl bg-white dark:bg-gray-800"
				onClick={e => e.stopPropagation()}
			>
				{/* Header (Fixed) */}
				<div className="flex-none flex flex-col border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 z-10">
					{/* Top Row: Breadcrumbs & Close */}
					<div className="flex justify-between items-start p-4 pb-2">
						<div className="flex-1 min-w-0">
							{/* Breadcrumbs (Tenant/Project) */}
							<div className="flex items-center gap-1 mb-1 overflow-visible h-6 relative z-50">
								{/* Tenant Selector */}
								<YoukanDropdown
									trigger={
										<button
											className={cn(
												"flex items-center gap-1.5 px-2 py-1 rounded transition-colors border border-transparent hover:bg-slate-50 dark:hover:bg-slate-800",
												localTenantId ? "text-indigo-700 dark:text-indigo-300" : "text-slate-500 dark:text-slate-400"
											)}
										>
											{localTenantId ? <Building2 size={10} /> : <User size={10} />}
											<span className={cn(
												"text-[10px] font-black uppercase tracking-widest truncate max-w-[120px]",
												localTenantId && "bg-indigo-50 dark:bg-indigo-900/30 px-1 rounded"
											)}>
												{joinedTenants.find(t => t.id === localTenantId)?.name || 'Private'}
											</span>
											<ChevronDown size={10} className="opacity-50" />
										</button>
									}
									usePortal={true}
								>
									<div className="px-3 py-1 text-[9px] font-bold text-slate-400 uppercase tracking-wider bg-slate-50 dark:bg-slate-800/50 mb-1">
										アカウント (Tenant)
									</div>
									<YoukanDropdownItem
										onClick={() => {
											setLocalTenantId('');
											setLocalProjectId('');
											if (onUpdate) onUpdate(item.id, { tenantId: null as any, projectId: null as any });
										}}
										active={!localTenantId}
										className="text-xs"
									>
										<User size={12} className={!localTenantId ? "text-indigo-500" : "text-slate-400"} />
										<span className="font-bold ml-2">Private (個人)</span>
										{!localTenantId && <CheckCircle2 size={10} className="ml-auto text-indigo-500" />}
									</YoukanDropdownItem>
									{joinedTenants.map(t => (
										<YoukanDropdownItem
											key={t.id}
											onClick={() => {
												setLocalTenantId(t.id);
												setLocalProjectId('');
												if (onUpdate) onUpdate(item.id, { tenantId: t.id, projectId: null as any });
											}}
											active={localTenantId === t.id}
											className="text-xs"
										>
											<Building2 size={12} className={localTenantId === t.id ? "text-indigo-500" : "text-slate-400"} />
											<span className="font-bold truncate ml-2">{t.name}</span>
											{localTenantId === t.id && <CheckCircle2 size={10} className="ml-auto text-indigo-500" />}
										</YoukanDropdownItem>
									))}
								</YoukanDropdown>

								<span className="text-slate-300 text-[10px] font-bold">/</span>

								{/* Project Selector */}
								<YoukanDropdown
									trigger={
										<button
											className={cn(
												"flex items-center gap-1.5 px-2 py-1 rounded transition-colors border border-transparent group hover:bg-slate-50 dark:hover:bg-slate-800",
												localProjectId ? "text-amber-700 dark:text-amber-300" : "text-slate-400 dark:text-slate-500"
											)}
										>
											<span className={cn(
												"text-[10px] font-bold truncate max-w-[200px]",
												localProjectId && "bg-amber-100 dark:bg-amber-900/30 px-1 rounded"
											)}>
												{allProjects.find(p => p.id === localProjectId)?.title
													|| 'Inbox (未分類)'}
											</span>
											<ChevronDown size={10} className="opacity-50 group-hover:opacity-100" />
										</button>
									}
									width="w-64"
									usePortal={true}
								>
									<div className="px-3 py-1 text-[9px] font-bold text-slate-400 uppercase tracking-wider bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800">
										プロジェクト選択
									</div>
									<div className="max-h-[300px] overflow-y-auto">
										<YoukanDropdownItem
											onClick={() => {
												setLocalProjectId('');
												if (onUpdate) onUpdate(item.id, { projectId: null as any });
											}}
											active={!localProjectId}
											className={cn(
												"text-xs mb-1",
												!localProjectId ? "text-amber-800 font-bold" : "text-slate-500 font-medium"
											)}
										>
											Inbox (未分類)
										</YoukanDropdownItem>

										{allProjects
											.filter(p => !p.isArchived)
											.filter(p => {
												if (!localTenantId) return !p.tenantId; // Private
												return p.tenantId === localTenantId; // Company
											})
											.map(p => (
												<YoukanDropdownItem
													key={p.id}
													onClick={() => {
														setLocalProjectId(p.id);
														if (onUpdate) onUpdate(item.id, { projectId: p.id });
													}}
													active={localProjectId === p.id}
													className="text-xs mb-0.5"
												>
													<span className="w-2 h-2 rounded-full flex-none mr-2" style={{ backgroundColor: (p as any).color || '#cbd5e1' }} />
													<span className="font-bold truncate">{p.title}</span>
													{localProjectId === p.id && <CheckCircle2 size={10} className="ml-auto text-amber-500" />}
												</YoukanDropdownItem>
											))}

										{allProjects.filter(p => !p.isArchived && ((!localTenantId && !p.tenantId) || (p.tenantId === localTenantId))).length === 0 && (
											<div className="px-3 py-4 text-center text-xs text-slate-400 italic">
												プロジェクトはありません
											</div>
										)}
									</div>
								</YoukanDropdown>
							</div>


							{/* Title (Editable) */}
							{isEditingTitle ? (
								<input
									ref={titleInputRef}
									type="text"
									className="w-full text-2xl font-bold bg-slate-100 dark:bg-slate-800 p-1 rounded mt-1"
									value={editedTitle}
									onChange={(e) => setEditedTitle(e.target.value)}
									onBlur={async () => {
										setIsEditingTitle(false);
										if (editedTitle.trim() && editedTitle !== item.title) {
											await onUpdate?.(item.id, { title: editedTitle.trim() });
										} else if (!editedTitle.trim()) {
											// Restore old title if input is empty
											setEditedTitle(item.title);
										}
									}}
									onKeyDown={async (e) => {
										if (e.key === 'Enter') {
											e.preventDefault();
											titleInputRef.current?.blur();
										}
									}}
								/>
							) : (
								<h2
									className="text-2xl md:text-3xl font-bold text-slate-800 dark:text-white leading-tight cursor-text hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded px-1 -ml-1 transition-colors"
									onClick={() => setIsEditingTitle(true)}
								>
									{item.title}
								</h2>
							)}
							{/* [NEW] Perspective Label Badge in Detail View (Computed Dynamically) */}
							{(() => {
								const isCompanyAccount = (currentUserId?.length || 0) > 20;
								let label = '';
								if (isCompanyAccount) {
									label = localTenantId ? '事業の管理' : '社内背景での管理';
								} else {
									const tenant = joinedTenants.find(t => t.id === localTenantId);
									label = tenant ? `${tenant.name}マネージャーとして` : '自分の時間管理';
								}
								return (
									<div className="flex items-center mt-1">
										<span className="text-[9px] font-black text-slate-400 bg-slate-50 dark:bg-slate-800/50 px-2.5 py-0.5 rounded-full border border-slate-100 dark:border-slate-800 uppercase tracking-tighter">
											{label}
										</span>
									</div>
								);
							})()}
						</div>

						{/* Top Right Controls */}
						<div className="flex items-center gap-2 flex-none ml-4">
							{history.length > 0 && (
								<button
									onClick={handleBack}
									className="p-2 text-slate-400 hover:text-indigo-500 transition-colors"
									title="親アイテムに戻る"
								>
									<div className="flex items-center gap-1">
										<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
										<span className="text-xs font-bold">Back</span>
									</div>
								</button>
							)}
							<button
								onClick={handleClose}
								className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
							>
								<X size={24} />
							</button>
						</div>
					</div>

					{/* Bottom Row: Dates (Fixed) */}
					<div className="px-4 pb-3 pt-0">
						{/* Mobile Side-by-Side Optimization: Fixed width for yyyy/mm/dd */}
						<div className="flex flex-wrap gap-2">
							{/* Due Date Input */}
							<div className={cn(
								"flex flex-col md:flex-row items-start md:items-center gap-1 md:gap-2 p-1.5 rounded-lg border transition-all duration-300",
								activeDateInput === 'due'
									? "bg-red-50/60 dark:bg-red-900/20 border-red-300 dark:border-red-600 shadow-[0_0_8px_rgba(239,68,68,0.3)] ring-1 ring-red-200 dark:ring-red-700"
									: "bg-slate-50 dark:bg-slate-800/50 border-slate-100 dark:border-slate-700"
							)}>
								<div className={cn("flex items-center gap-1", activeDateInput === 'due' ? "text-red-500" : "text-slate-400")}>
									<CalendarDays size={14} className="md:w-[16px] md:h-[16px]" />
									<label className="block text-[8px] md:text-[10px] font-bold uppercase tracking-wider whitespace-nowrap">
										納期
									</label>
								</div>
								<div className="flex-1 min-w-0 w-full">
									<SmartDateInput
										value={dueDate ? new Date(dueDate) : null}
										onChange={(d) => {
											const val = d ? format(d, 'yyyy-MM-dd') : '';
											setDueDate(val);
											if (onUpdate) onUpdate(item.id, { due_date: val, dueStatus: 'confirmed' });
											else ApiClient.updateItem(item.id, { due_date: val, dueStatus: 'confirmed' });
										}}
										inputClassName="w-[71px] border-0 px-0 text-sm font-bold bg-transparent focus:ring-0 focus:outline-none"
										className="[&_svg]:hidden"
										onFocus={() => setActiveDateInput('due')}
									/>
								</div>
							</div>

							{/* Preparation Date Input */}
							<div className={cn(
								"flex flex-col md:flex-row items-start md:items-center gap-1 md:gap-2 p-1.5 rounded-lg border transition-all duration-300",
								activeDateInput === 'my'
									? "bg-blue-50/60 dark:bg-blue-900/20 border-blue-300 dark:border-blue-600 shadow-[0_0_8px_rgba(59,130,246,0.3)] ring-1 ring-blue-200 dark:ring-blue-700"
									: "bg-slate-50 dark:bg-slate-800/50 border-slate-100 dark:border-slate-700"
							)}>
								<div className={cn(
									"flex items-center gap-1",
									// [WARNING] 納期よりマイ期限が遅い場合は赤字で警告
									(dueDate && prepDate && new Date(prepDate) > new Date(dueDate))
										? "text-red-500"
										: activeDateInput === 'my' ? "text-blue-500" : "text-slate-400"
								)}>
									<CalendarClock size={14} className="md:w-[16px] md:h-[16px]" />
									<label className={cn(
										"block text-[8px] md:text-[10px] font-bold uppercase tracking-wider whitespace-nowrap",
										(dueDate && prepDate && new Date(prepDate) > new Date(dueDate)) && "text-red-500"
									)}>
										マイ期限{(dueDate && prepDate && new Date(prepDate) > new Date(dueDate)) && ' ⚠ 納期超過'}
									</label>
								</div>
								<div className="flex-1 min-w-0 w-full">
									<SmartDateInput
										value={prepDate ? new Date(prepDate) : null}
										onChange={(d) => {
											const val = d ? format(d, 'yyyy-MM-dd') : '';
											setPrepDate(val);
											const timestamp = d ? Math.floor(d.getTime() / 1000) : null;
											// @ts-ignore
											if (onUpdate) onUpdate(item.id, { prep_date: timestamp });
											// @ts-ignore
											else ApiClient.updateItem(item.id, { prep_date: timestamp });
										}}
										inputClassName={cn(
											"w-[71px] border-0 px-0 text-sm font-bold bg-transparent focus:ring-0 focus:outline-none",
											(dueDate && prepDate && new Date(prepDate) > new Date(dueDate)) && "text-red-500"
										)}
										className="[&_svg]:hidden"
										onFocus={() => setActiveDateInput('my')}
									/>
								</div>
							</div>
						</div>
					</div>
				</div>

				{/* Middle Area (Flex Row) */}
				<div className="flex-1 min-h-0 flex flex-col md:flex-row overflow-hidden bg-slate-50/50 dark:bg-slate-900/50">

					{/* LEFT COLUMN: Calendar (Scrollable) & Memo (Fixed Bottom) */}
					<div className="flex-none md:flex-1 flex flex-col min-w-0 md:border-r border-slate-200 dark:border-slate-800 h-[45vh] md:h-full overflow-hidden">

						{/* Scrollable Calendar */}
						<div className="flex-1 overflow-y-auto min-h-0 bg-white dark:bg-slate-900">
							<SideCalendarPanel
								selectedDate={dueDate ? new Date(dueDate) : null}
								onSelectDate={(d) => {
									const val = format(d, 'yyyy-MM-dd');
									if (activeDateInput === 'my') {
										setPrepDate(val);
										const timestamp = Math.floor(new Date(val).getTime() / 1000);
										if (onUpdate) onUpdate(item.id, { prep_date: timestamp });
										else ApiClient.updateItem(item.id, { prep_date: timestamp });
									} else {
										setDueDate(val);
										if (onUpdate) onUpdate(item.id, { due_date: val, dueStatus: 'confirmed' });
										else ApiClient.updateItem(item.id, { due_date: val, dueStatus: 'confirmed' });
									}
								}}
								prepDate={prepDate ? new Date(prepDate) : null}
								targetMode={activeDateInput || 'due'}
								filterMode={filterMode}
								currentItem={item}
								className="h-full border-l-0"
								items={quantityItems}
								members={members}
								capacityConfig={capacityConfig}
								projects={allProjects}
								joinedTenants={joinedTenants}
								currentUserId={currentUserId}
								commitPeriod={commitPeriodDates}
							/>
						</div>

						{/* Fixed Bottom: Memo & Boost & [NEW] Allocation Details */}
						<div className="flex-none p-3 space-y-2 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 z-10 shadow-[0_-5px_15px_-5px_rgba(0,0,0,0.05)]">
							{/* [NEW] Allocation Details */}
							{allocationDetails.length > 0 && (
								<div className="text-[10px] text-slate-500 bg-slate-50 dark:bg-slate-800 p-2 rounded border border-slate-100 dark:border-slate-700">
									<div className="font-bold mb-1 text-slate-400 uppercase tracking-wider flex justify-between">
										<span>目安期間の対象</span>
										<span>計 {allocationDetails.reduce((sum, s) => sum + s.allocatedMinutes, 0)}分 / {estimatedMinutes}分</span>
									</div>
									<div className="flex flex-wrap gap-1">
										{allocationDetails.map((step, idx) => (
											<span key={idx} className="inline-flex items-center">
												<span className="font-mono text-slate-700 dark:text-slate-300">
													{format(step.date, 'M/d')}
												</span>
												<span className="text-slate-400 mx-0.5 text-[9px]">
													({step.allocatedMinutes}m/{step.capacityMinutes}m)
												</span>
												{idx < allocationDetails.length - 1 && <span className="text-slate-300 mr-1">,</span>}
											</span>
										))}
									</div>
									<div className="mt-1 text-[8px] text-slate-400 dark:text-slate-500 border-t border-slate-200 dark:border-slate-700 pt-1 leading-tight">
										※(消費/枠)。稼働枠を使い切っている日は目安期間（青枠）となります。
									</div>
								</div>
							)}

							{/* [NEW] Capacity Insufficiency Warning */}
							{estimatedMinutes > 0 && allocationDetails.length === 0 && (prepDate || dueDate) && (
								<div className="text-[10px] bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 p-2 rounded border border-amber-200 dark:border-amber-700 flex items-center gap-1.5">
									<span className="text-base">⚠</span>
									<div>
										<span className="font-bold">稼働設定が未完了のため、目安期間（青枠）を計算できません。</span>
										<span className="text-amber-500 dark:text-amber-400 ml-1">ガントチャートの「日次設定」で1日あたりの稼働時間を設定してください。</span>
									</div>
								</div>
							)}

							<div className="flex justify-center">
								<button
									onClick={async () => {
										const newBoostState = !item.is_boosted;
										const updates = { is_boosted: newBoostState, boosted_date: Date.now() };
										if (onUpdate) await onUpdate(item.id, updates);
										else await ApiClient.updateItem(item.id, updates);
									}}
									className={cn(
										"w-full flex items-center justify-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-bold transition-colors border",
										item.is_boosted
											? "bg-amber-100 text-amber-700 border-amber-200"
											: "bg-slate-50 text-slate-400 border-slate-200 hover:bg-slate-100"
									)}
								>
									<span className={cn("w-1.5 h-1.5 rounded-full", item.is_boosted ? "bg-amber-500" : "bg-slate-300")} />
									Boost (今日だけ優先)
								</button>
							</div>

							<div className="relative">
								<textarea
									value={note}
									onChange={(e) => setNote(e.target.value)}
									onBlur={async () => {
										const updates = { memo: note };
										if (onUpdate) await onUpdate(item.id, updates);
										else ApiClient.updateItem(item.id, updates);
									}}
									placeholder="メモ..."
									rows={2}
									className="w-full bg-slate-50 dark:bg-slate-800/50 border border-transparent hover:border-slate-200 dark:hover:border-slate-700 rounded-lg p-2 text-xs text-slate-700 dark:text-slate-300 outline-none focus:bg-white dark:focus:bg-slate-800 focus:ring-1 focus:ring-indigo-400 transition-all resize-none"
								/>
							</div>
						</div>
					</div>


					{/* RIGHT COLUMN: Estimates, Assignee, Subtasks (Independently Scrollable) */}
					<div className="w-full md:w-[320px] lg:w-[360px] flex-1 md:flex-none flex flex-col border-l border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-y-auto p-5 space-y-6">

						{/* Estimate Section */}
						<div className="space-y-4">
							<div className="flex items-center justify-between pb-1 border-b border-slate-100 dark:border-slate-800">
								<span className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
									<div className="w-1 h-3 bg-amber-400 rounded-full"></div>
									見積工数
								</span>
								<span className="text-sm font-bold text-slate-700 dark:text-slate-200">
									{estimatedMinutes > 0 ? (estimatedMinutes >= 60 ? `${(estimatedMinutes / 60).toFixed(1)}h` : `${estimatedMinutes}m`) : '-'}
								</span>
							</div>

							<div className="grid grid-cols-2 gap-2">
								{[
									{ label: '0.5h', val: 30, desc: '30分', icon: '⚡' },
									{ label: '1h', val: 60, desc: '1時間', icon: '☕' },
									{ label: '2h', val: 120, desc: '午前/午後', icon: '🏃' },
									{ label: '4h', val: 240, desc: '半日', icon: '🌓' },
									{ label: '8h', val: 480, desc: '1日', icon: '🌕' },
									{ label: '1.5日', val: 720, desc: '残業含む', icon: '📅' },
									{ label: '2日', val: 960, desc: 'じっくり', icon: '🗓️' },
									{ label: '3日', val: 1440, desc: '長丁場', icon: '🏗️' },
								].map(preset => {
									const isActive = estimatedMinutes === preset.val;
									return (
										<button
											key={preset.label}
											onClick={async () => {
												const newVal = preset.val;
												setEstimatedMinutes(newVal);
												setWorkDays(newVal / 480);
												setIsWorkDaysDirty(true);

												// [Robustness] Atomic update directly via ViewModel
												if (updateItemMetrics && item) {
													await updateItemMetrics(item.id, { estimatedMinutes: newVal });
												}
											}}
											className={cn(
												"relative group flex items-center gap-3 p-2 rounded-xl border transition-all duration-200",
												isActive
													? "bg-amber-50 border-amber-300 shadow-md shadow-amber-100 dark:bg-amber-900/40 dark:border-amber-700 dark:shadow-none"
													: "bg-white border-slate-200 hover:border-indigo-300 hover:bg-slate-50 hover:shadow-sm dark:bg-slate-800/50 dark:border-slate-700 dark:hover:bg-slate-800"
											)}
										>
											<div className={cn(
												"flex items-center justify-center w-8 h-8 rounded-lg text-sm transition-colors",
												isActive
													? "bg-amber-200 text-amber-800 dark:bg-amber-800 dark:text-amber-200"
													: "bg-slate-100 text-slate-500 group-hover:bg-white group-hover:text-indigo-500 dark:bg-slate-700 dark:text-slate-400"
											)}>
												{preset.icon}
											</div>

											<div className="flex flex-col items-start gap-0.5">
												<span className={cn(
													"text-sm font-bold leading-none",
													isActive ? "text-amber-900 dark:text-amber-100" : "text-slate-700 dark:text-slate-200 group-hover:text-indigo-700"
												)}>
													{preset.label}
												</span>
												<span className="text-[10px] text-slate-400 font-medium group-hover:text-indigo-400 dark:text-slate-500">
													{preset.desc}
												</span>
											</div>

											{isActive && (
												<div className="absolute top-2 right-2 text-amber-500 dark:text-amber-400">
													<div className="w-2 h-2 rounded-full bg-current" />
												</div>
											)}
										</button>
									);
								})}
							</div>

							<div className="flex items-center justify-end gap-2 pt-1 pb-3 border-b border-slate-100 dark:border-slate-800">
								<span className="text-[10px] text-slate-400">手入力:</span>
								<input
									type="number"
									value={estimatedMinutes === 0 ? '' : estimatedMinutes / 60}
									onChange={e => {
										const hrs = Number(e.target.value);
										const mins = hrs * 60;
										setEstimatedMinutes(mins);
										// Sync workDays for GDB/Gantt consistency
										const baseMinutes = capacityConfig?.defaultDailyMinutes || 480;
										setWorkDays(mins / baseMinutes);
										setIsWorkDaysDirty(true);
									}}
									onFocus={e => e.target.select()}
									className="w-12 bg-transparent border-b border-slate-200 text-right text-xs font-mono focus:outline-none focus:border-amber-400 transition-colors"
									placeholder="0"
								/>
								<span className="text-[10px] text-slate-400">h</span>
							</div>
						</div>

						{/* Assignee Section */}
						<div className="space-y-2 pt-1 pb-4 border-b border-slate-100 dark:border-slate-800">
							<span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
								<div className="w-1 h-2.5 bg-indigo-400 rounded-full"></div>
								担当者
							</span>
							<div className="relative group/assignee shadow-sm">
								<select
									value={localAssignedTo}
									onChange={async (e) => {
										const val = e.target.value;
										setLocalAssignedTo(val);
										const updates: Partial<Item> = { assignedTo: val || null as any };
										if (onUpdate) await onUpdate(item.id, updates);
										else await ApiClient.updateItem(item.id, updates);
									}}
									className="w-full appearance-none bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg py-2 px-3 pr-8 text-xs font-medium text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-400 focus:border-indigo-400 transition-all"
								>
									<option value="">(未割り当て)</option>
									{members.map(m => (
										<option key={m.id} value={m.id}>{m.display_name}</option>
									))}
								</select>
								<div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
									<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
								</div>
							</div>
						</div>

						{/* Subtasks Section */}
						<div className="flex-1 min-h-0 pt-2 pb-10">
							<SubtaskListWidget
								parentId={item.id}
								parentItem={item}
								// [FIX] Use local state to reflect changes immediately
								defaultProjectId={localProjectId || (item.isProject ? item.id : item.projectId) || undefined}
								defaultTenantId={localTenantId || item.tenantId || undefined}
								onNavigate={(subItem) => {
									if (_onOpenItem) _onOpenItem(subItem);
									else handleDrillDown(subItem);
								}}
								className="h-full"
							/>
						</div>

					</div>
				</div>

				{/* Footer Action Bar (Fixed) */}
				<div className="flex-none h-[64px] border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-end gap-3 px-6 z-20 shadow-[0_-5px_20px_rgba(0,0,0,0.05)]">

					{/* Menu Button with Popover */}
					<div className="relative" ref={menuRef}>
						<button
							onClick={() => setIsMenuOpen(!isMenuOpen)}
							className={cn(
								"flex items-center justify-center gap-1 px-3 py-2 rounded-lg border transition-all text-xs font-bold",
								isMenuOpen
									? "bg-slate-200 border-slate-300 text-slate-700"
									: "bg-white border-slate-200 hover:bg-slate-50 text-slate-500 hover:text-slate-700 hover:border-slate-300"
							)}
						>
							<Trash2 size={14} className="opacity-50" />
							<span>その他...</span>
						</button>

						<AnimatePresence>
							{isMenuOpen && (
								<motion.div
									initial={{ opacity: 0, scale: 0.95, y: -10 }}
									animate={{ opacity: 1, scale: 1, y: -120 }} // Pop UPWARDS
									exit={{ opacity: 0, scale: 0.95, y: -10 }}
									className="absolute right-0 bottom-full mb-2 w-56 bg-white dark:bg-slate-900 shadow-2xl rounded-xl border border-slate-200 dark:border-slate-800 p-2 z-50 overflow-hidden origin-bottom-right"
								>
									<div className="text-[10px] font-bold text-slate-400 px-2 py-1 mb-1 uppercase">場所・状態の変更</div>
									{!isProject ? (
										<button
											onClick={async () => {
												setIsProject(true);
												setIsMenuOpen(false);
												if (onUpdate) await onUpdate(item.id, { isProject: true });
											}}
											className="w-full text-left px-3 py-2 text-xs font-bold text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded flex items-center gap-2"
										>
											<Folder size={14} /> プロジェクトに変換
										</button>
									) : (
										<button
											onClick={async () => {
												setIsProject(false);
												setIsMenuOpen(false);
												if (onUpdate) await onUpdate(item.id, { isProject: false });
											}}
											className="w-full text-left px-3 py-2 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 rounded flex items-center gap-2"
										>
											<Folder size={14} /> プロジェクト解除
										</button>
									)}

									{/* Complete Action */}
									<button
										onClick={async () => {
											if (onUpdate) await onUpdate(item.id, { status: 'done' });
											else await ApiClient.updateItem(item.id, { status: 'done' });
											setIsMenuOpen(false);
											handleClose();
										}}
										className="w-full text-left px-3 py-2 text-xs font-bold text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 rounded flex items-center gap-2"
									>
										<CheckCircle2 size={14} /> 完了 (Complete)
									</button>

									<button
										onClick={() => {
											onDecision(item.id, 'no', 'someday');
											setIsMenuOpen(false);
										}}
										className="w-full text-left px-3 py-2 text-xs font-bold text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded flex items-center gap-2"
									>
										<span className="w-2 h-2 rounded-full bg-amber-400" /> いつかやる (Someday)
									</button>

									<div className="h-px bg-slate-100 dark:bg-slate-800 my-1" />

									{/* Archive Action */}
									<button
										onClick={async () => {
											if (onUpdate) await onUpdate(item.id, { isArchived: true });
											else await ApiClient.updateItem(item.id, { isArchived: true });
											setIsMenuOpen(false);
											handleClose();
										}}
										className="w-full text-left px-3 py-2 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 rounded flex items-center gap-2"
									>
										<div className="w-3 h-3 border-2 border-slate-400 rounded-sm" /> アーカイブ
									</button>

									<button
										onClick={() => onDelete(item.id)}
										className="w-full text-left px-3 py-2 text-xs font-bold text-red-500 hover:bg-red-50 rounded flex items-center gap-2"
									>
										<Trash2 size={12} /> 完全に削除
									</button>
								</motion.div>
							)}
						</AnimatePresence>
					</div>

					{/* Hold Button */}
					<button
						onClick={() => handleDecisionWithSave('hold')}
						className="flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all font-bold text-xs"
					>
						<PauseCircle size={16} />
						保留にする
					</button>

					{/* Primary: Do Today */}
					<button
						onClick={() => handleDecisionWithSave('yes')}
						className="flex items-center gap-2 px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-200 dark:shadow-none transition-all font-bold text-xs"
					>
						<CheckCircle2 size={16} />
						今日やる
					</button>

				</div>
			</div>
		</div >
	);
};
