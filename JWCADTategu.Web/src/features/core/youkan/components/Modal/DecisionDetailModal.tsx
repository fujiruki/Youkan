import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Trash2, PauseCircle, CheckCircle2, Folder, CalendarDays, CalendarClock, ChevronDown, Building2, User } from 'lucide-react';
import { useIsMobile } from '@/hooks/useMediaQuery';
import { MobileBottomSheet } from '../Common/MobileBottomSheet';
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
import { isItemDone, COMPLETED_ITEM_CLASS } from '../../logic/statusUtils';
import { useExternalEvents } from '../../hooks/useExternalEvents';
import { useGoogleCalendars } from '../../hooks/useGoogleCalendars';


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
	// R-037: タイトル編集欄は常時 input。isEditingTitle フラグは廃止
	const [editedTitle, setEditedTitle] = React.useState('');
	const [estimatedMinutes, setEstimatedMinutes] = React.useState(0);

	// const [subTasks, setSubTasks] = React.useState<Item[]>([]);
	// const [newSubTaskTitle, setNewSubTaskTitle] = React.useState('');
	const [isProject, setIsProject] = React.useState(false);
	const [activeDateInput, setActiveDateInput] = React.useState<'due' | 'my' | null>('due');
	// R-064: 目安期間ブレイクダウン折りたたみ（デフォルト閉じ）
	const [isAllocationOpen, setIsAllocationOpen] = React.useState(false);

	const [localTenantId, setLocalTenantId] = React.useState<string>('');
	const [localProjectId, setLocalProjectId] = React.useState<string>('');
	const [localAssignedTo, setLocalAssignedTo] = React.useState<string>('');

	React.useEffect(() => {
		if (item) {
			setNote(item.memo || '');
			setDueStatus(item.dueStatus || (item.due_date ? 'confirmed' : 'waiting_external'));
			setDueDate(item.due_date || '');
			setPrepDate(item.prep_date ? safeFormat(item.prep_date * 1000, 'yyyy-MM-dd', '') : '');
			setWorkDays(item.work_days ?? 1);
			setIsWorkDaysDirty(false);
			setEditedTitle(item.title);
			setEstimatedMinutes(item.estimatedMinutes ?? 0);
			setIsProject(item.isProject ?? false);
			setLocalTenantId(item.tenantId || '');
			setLocalProjectId(item.projectId || '');
			setLocalAssignedTo(item.assignedTo || (item as any).assigned_to || '');
		}
	}, [item?.id, item?.title, item?.tenantId, item?.projectId, item?.assignedTo, allProjects.length, joinedTenants.length]);

	// props の isProject が true になった時のみ同期（false 方向への巻き戻しを防ぐ）
	React.useEffect(() => {
		if (item?.isProject === true) {
			setIsProject(true);
		}
	}, [item?.isProject]);

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

	const currentUserFromStorage = React.useMemo(() => {
		try {
			return JSON.parse(localStorage.getItem(YOUKAN_KEYS.USER) || '{}');
		} catch {
			return {};
		}
	}, []);

	// [NEW] Use separate memo for Details to display the breakdown, and derive Period from it
	const allocationDetails = React.useMemo(() => {
		if (!item || !capacityConfig) {
			return [];
		}

		const anchorStr = prepDate || dueDate;

		if (!anchorStr) {
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
				id: (currentUserFromStorage.id || ''),
				isCompanyAccount: (currentUserFromStorage.id || '').length > 20,
				joinedTenants: joinedTenants
			}
		};

		const details = QuantityEngine.calculateAllocationDetails(anchor, minutes, context, (localTenantId !== undefined ? localTenantId : item.tenantId));
		return details;
	}, [item?.id, prepDate, dueDate, estimatedMinutes, workDays, isWorkDaysDirty, localTenantId, capacityConfig, joinedTenants, quantityItems, members, filterMode, currentUserFromStorage]);

	const commitPeriodDates = React.useMemo(() => {
		return allocationDetails.map(step => step.date);
	}, [allocationDetails]);

	// R-061: 外部イベント取得（アンカー=dueDate||prepDate||today, ±1ヶ月）
	const externalRange = React.useMemo(() => {
		const ymd = (d: Date): string => {
			const y = d.getFullYear();
			const m = String(d.getMonth() + 1).padStart(2, '0');
			const day = String(d.getDate()).padStart(2, '0');
			return `${y}-${m}-${day}`;
		};
		const anchor = dueDate
			? new Date(dueDate)
			: prepDate
				? new Date(prepDate)
				: new Date();
		const from = new Date(anchor.getFullYear(), anchor.getMonth() - 1, 1);
		const to = new Date(anchor.getFullYear(), anchor.getMonth() + 2, 0);
		return { from: ymd(from), to: ymd(to) };
	}, [dueDate, prepDate]);

	const { eventsByDate: externalEventsByDate } = useExternalEvents(externalRange.from, externalRange.to, 'grid');
	const { calendars: googleCalendars } = useGoogleCalendars();

	const [isMenuOpen, setIsMenuOpen] = React.useState(false);
	const isMobile = useIsMobile();

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
	const isClosingRef = React.useRef(false);

	const dateInputRef = React.useRef<HTMLInputElement>(null);
	const titleInputRef = React.useRef<HTMLInputElement>(null);

	React.useEffect(() => {
		isClosingRef.current = false;
	}, [item?.id]);

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

	const handleClose = () => {
		isClosingRef.current = true;
		if (!item) {
			onClose();
			return;
		}

		const updates = getPendingChanges();
		onClose();

		if (Object.keys(updates).length > 0) {
			const itemId = item.id;
			void (onUpdate ? onUpdate(itemId, updates) : ApiClient.updateItem(itemId, updates))
				.catch(error => console.error('[DecisionDetailModal] Failed to save on close', error));
		}
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

	// Shift+Enter で「今日やる」相当のアクション発火（input/textarea/contentEditable 内では無視）
	React.useEffect(() => {
		if (!item) return;
		const onKey = (e: KeyboardEvent) => {
			if (!(e.shiftKey && e.key === 'Enter')) return;
			const target = e.target as HTMLElement | null;
			if (target && (
				target.tagName === 'INPUT' ||
				target.tagName === 'TEXTAREA' ||
				target.isContentEditable
			)) return;
			e.preventDefault();
			handleDecisionWithSave('yes');
		};
		window.addEventListener('keydown', onKey);
		return () => window.removeEventListener('keydown', onKey);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [item?.id]);

	const selectedDateObj = React.useMemo(
		() => dueDate ? new Date(dueDate) : null,
		[dueDate]
	);
	const prepDateObj = React.useMemo(
		() => prepDate ? new Date(prepDate) : null,
		[prepDate]
	);
	const handleSideCalendarSelectDate = React.useCallback((d: Date) => {
		const val = format(d, 'yyyy-MM-dd');
		if (activeDateInput === 'my') {
			setPrepDate(val);
			const timestamp = Math.floor(new Date(val).getTime() / 1000);
			if (onUpdate) onUpdate(item!.id, { prep_date: timestamp });
			else ApiClient.updateItem(item!.id, { prep_date: timestamp });
		} else {
			setDueDate(val);
			if (onUpdate) onUpdate(item!.id, { due_date: val, dueStatus: 'confirmed' });
			else ApiClient.updateItem(item!.id, { due_date: val, dueStatus: 'confirmed' });
		}
	}, [activeDateInput, item?.id, onUpdate]);

	if (!item) return null;

	return (
		<div
			className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm"
			onMouseDownCapture={(e) => {
				if (e.target === e.currentTarget) {
					isClosingRef.current = true;
				}
			}}
			onClick={handleClose}
		>
			<div
				className="relative w-[98vw] h-[calc(100vh-20px)] flex flex-col overflow-hidden rounded-xl shadow-2xl bg-white dark:bg-gray-800"
				onClick={e => e.stopPropagation()}
			>
				{/* Header (Fixed) — R-064-Y4: landscape-compact（スマホ横=高さ≤500px）のみコンパクト化。デスクトップ(高さ>500px)は従来通り大表示 */}
				<div className="flex-none flex flex-col border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 z-10">
					{/* Top Row: Breadcrumbs & Close */}
					<div className="flex justify-between items-start p-4 pb-2 landscape-compact:!p-1 landscape-compact:!pb-0">
						<div className="flex-1 min-w-0">
							{/* Breadcrumbs (Tenant/Project) — landscape-compact: テキスト縮小・mb 削減 */}
							<div className="flex items-center gap-1 mb-1 landscape-compact:!mb-0 overflow-visible h-6 landscape-compact:!h-5 relative z-50">
								{/* Tenant Selector */}
								<YoukanDropdown
									trigger={
										<button
											className={cn(
												"flex items-center gap-1 px-1.5 py-0.5 rounded transition-colors border border-transparent hover:bg-slate-50 dark:hover:bg-slate-800",
												localTenantId ? "text-indigo-700 dark:text-indigo-300" : "text-slate-500 dark:text-slate-400"
											)}
										>
											{localTenantId ? <Building2 size={10} /> : <User size={10} />}
											<span className={cn(
												"text-[10px] landscape-compact:!text-[9px] font-black uppercase tracking-widest truncate max-w-[120px] landscape-compact:!max-w-[80px]",
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


							{/* Title (Always Editable - R-037) */}
							{/* 空文字・空白のみのアイテムも編集可能にするため、表示/編集の出し分けを廃止し常に input を描画する */}
							<input
								ref={titleInputRef}
								type="text"
								data-testid="decision-detail-title-input"
								className={cn(
									"w-full text-2xl md:text-3xl font-bold leading-tight bg-transparent px-1 -ml-1 rounded transition-colors outline-none hover:bg-slate-50 dark:hover:bg-slate-800/50 focus:bg-slate-100 dark:focus:bg-slate-800 placeholder:font-normal placeholder:italic placeholder:text-slate-400 dark:placeholder:text-slate-500",
									"landscape-compact:!text-sm landscape-compact:!leading-none landscape-compact:!py-0",
									isItemDone(item) ? COMPLETED_ITEM_CLASS : "text-slate-800 dark:text-white"
								)}
								placeholder="タイトル未入力"
								value={editedTitle}
								onChange={(e) => setEditedTitle(e.target.value)}
								onBlur={async () => {
									if (isClosingRef.current) return;
									// editedTitle が item.title と異なれば常に保存（空文字・空白のみも許容）
									if (editedTitle !== item.title) {
										void onUpdate?.(item.id, { title: editedTitle });
									}
								}}
								onKeyDown={(e) => {
									if (e.key === 'Enter') {
										e.preventDefault();
										titleInputRef.current?.blur();
									}
								}}
							/>
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
									<div className="flex items-center mt-1 landscape-compact:!hidden">
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
								onMouseDown={() => {
									isClosingRef.current = true;
								}}
								onClick={handleClose}
								className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
							>
								<X size={24} />
							</button>
						</div>
					</div>

					{/* Bottom Row: Dates (Fixed) — R-064-Y4: landscape-compact（スマホ横）のみ横一列ピルに圧縮 */}
					<div className="px-4 pb-3 pt-0 landscape-compact:!px-1 landscape-compact:!pb-0.5 landscape-compact:!pt-0">
						<div className="flex flex-wrap gap-2 landscape-compact:!gap-1 landscape-compact:!flex-nowrap">
							{/* Due Date Input */}
							<div className={cn(
								"flex flex-col md:flex-row items-start md:items-center gap-1 md:gap-2 p-1.5 rounded-lg border transition-all duration-300",
								"landscape-compact:!flex-row landscape-compact:!items-center landscape-compact:!gap-1 landscape-compact:!py-0.5 landscape-compact:!px-1.5",
								activeDateInput === 'due'
									? "bg-red-50/60 dark:bg-red-900/20 border-red-300 dark:border-red-600 shadow-[0_0_8px_rgba(239,68,68,0.3)] ring-1 ring-red-200 dark:ring-red-700"
									: "bg-slate-50 dark:bg-slate-800/50 border-slate-100 dark:border-slate-700"
							)}>
								<div className={cn("flex items-center gap-1", activeDateInput === 'due' ? "text-red-500" : "text-slate-400")}>
									<CalendarDays size={14} className="landscape-compact:!w-[10px] landscape-compact:!h-[10px] md:w-[16px] md:h-[16px]" />
									<label className="block text-[8px] md:text-[10px] landscape-compact:!text-[8px] font-bold uppercase tracking-wider whitespace-nowrap">
										納期
									</label>
								</div>
								<div className="flex-1 min-w-0 w-full landscape-compact:!w-auto">
									<SmartDateInput
										value={dueDate ? new Date(dueDate) : null}
										onChange={(d) => {
											const val = d ? format(d, 'yyyy-MM-dd') : '';
											setDueDate(val);
											if (onUpdate) onUpdate(item.id, { due_date: val, dueStatus: 'confirmed' });
											else ApiClient.updateItem(item.id, { due_date: val, dueStatus: 'confirmed' });
										}}
										inputClassName="w-[71px] border-0 px-0 text-sm landscape-compact:!text-xs font-bold bg-transparent focus:ring-0 focus:outline-none"
										className="[&_svg]:hidden"
										onFocus={() => setActiveDateInput('due')}
									/>
								</div>
							</div>

							{/* Preparation Date Input */}
							<div className={cn(
								"flex flex-col md:flex-row items-start md:items-center gap-1 md:gap-2 p-1.5 rounded-lg border transition-all duration-300",
								"landscape-compact:!flex-row landscape-compact:!items-center landscape-compact:!gap-1 landscape-compact:!py-0.5 landscape-compact:!px-1.5",
								activeDateInput === 'my'
									? "bg-blue-50/60 dark:bg-blue-900/20 border-blue-300 dark:border-blue-600 shadow-[0_0_8px_rgba(59,130,246,0.3)] ring-1 ring-blue-200 dark:ring-blue-700"
									: "bg-slate-50 dark:bg-slate-800/50 border-slate-100 dark:border-slate-700"
							)}>
								<div className={cn(
									"flex items-center gap-1",
									(dueDate && prepDate && new Date(prepDate) > new Date(dueDate))
										? "text-red-500"
										: activeDateInput === 'my' ? "text-blue-500" : "text-slate-400"
								)}>
									<CalendarClock size={14} className="landscape-compact:!w-[10px] landscape-compact:!h-[10px] md:w-[16px] md:h-[16px]" />
									<label className={cn(
										"block text-[8px] md:text-[10px] landscape-compact:!text-[8px] font-bold uppercase tracking-wider whitespace-nowrap",
										(dueDate && prepDate && new Date(prepDate) > new Date(dueDate)) && "text-red-500"
									)}>
										マイ期限{(dueDate && prepDate && new Date(prepDate) > new Date(dueDate)) && ' ⚠'}
									</label>
								</div>
								<div className="flex-1 min-w-0 w-full landscape-compact:!w-auto">
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
											"w-[71px] border-0 px-0 text-sm landscape-compact:!text-xs font-bold bg-transparent focus:ring-0 focus:outline-none",
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

				{/* Middle Area — R-064: landscape-compact（スマホ横）=2カラム flex-row / md以上またはportrait=縦積みまたは横2カラム flex-col|flex-row */}
				<div className="flex-1 min-h-0 flex flex-col md:flex-row landscape-compact:!flex-row overflow-hidden bg-slate-50/50 dark:bg-slate-900/50">

					{/* LEFT COLUMN: カレンダー専有（R-064: landscape-compact で h-full 確保） */}
					{/* R-064-Y4: landscape-compact（スマホ横）では flex-1 + min-h-0 でフレックス内の高さを確実に伝搬させる */}
					<div className="flex-none md:flex-1 landscape-compact:!flex-1 landscape-compact:!min-h-0 flex flex-col min-w-0 md:border-r landscape-compact:!border-r border-slate-200 dark:border-slate-800 h-[45vh] md:h-full landscape-compact:!h-full overflow-hidden">

						{/* カレンダー（flex-1 で最大化） */}
						<div className="flex-1 min-h-0 bg-white dark:bg-slate-900">
							<SideCalendarPanel
								selectedDate={selectedDateObj}
								onSelectDate={handleSideCalendarSelectDate}
								prepDate={prepDateObj}
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
								externalEventsByDate={externalEventsByDate}
								googleCalendars={googleCalendars}
								hideExternalEventTime={true}
							/>
						</div>

						{/* R-064: 目安期間ブレイクダウン（折りたたみ、デフォルト閉じ） */}
						{(allocationDetails.length > 0 || (estimatedMinutes > 0 && (prepDate || dueDate))) && (
							<div className="flex-none border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900">
								<button
									data-testid="allocation-toggle-btn"
									onClick={() => setIsAllocationOpen(v => !v)}
									className="w-full flex items-center justify-between px-3 py-1.5 text-[10px] font-bold text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-colors"
								>
									<span>目安期間の内訳</span>
									<span className={cn("transition-transform duration-200", isAllocationOpen ? "rotate-180" : "rotate-0")}>▾</span>
								</button>
								{isAllocationOpen && (
									<div className="px-3 pb-2 space-y-1">
										{allocationDetails.length > 0 ? (
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
										) : (
											<div className="text-[10px] bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 p-2 rounded border border-amber-200 dark:border-amber-700 flex items-center gap-1.5">
												<span className="text-base">⚠</span>
												<div>
													<span className="font-bold">稼働設定が未完了のため、目安期間（青枠）を計算できません。</span>
													<span className="text-amber-500 dark:text-amber-400 ml-1">ガントチャートの「日次設定」で設定してください。</span>
												</div>
											</div>
										)}
									</div>
								)}
							</div>
						)}
					</div>


					{/* RIGHT COLUMN: Estimates, Assignee, Subtasks, Memo/Boost（R-064: 独立スクロール） */}
					<div className="w-full md:w-[320px] landscape-compact:!w-[320px] lg:w-[360px] flex-1 md:flex-none landscape-compact:!flex-none flex flex-col border-l border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-y-auto p-5 space-y-6">

						{/* R-064: Boost & Memo（カレンダーカラムから移動） */}
						<div className="space-y-2">
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
										if (isClosingRef.current) return;
										const updates = { memo: note };
										void (onUpdate ? onUpdate(item.id, updates) : ApiClient.updateItem(item.id, updates));
									}}
									placeholder="メモ..."
									rows={2}
									className="w-full bg-slate-50 dark:bg-slate-800/50 border border-transparent hover:border-slate-200 dark:hover:border-slate-700 rounded-lg p-2 text-xs text-slate-700 dark:text-slate-300 outline-none focus:bg-white dark:focus:bg-slate-800 focus:ring-1 focus:ring-indigo-400 transition-all resize-none"
								/>
							</div>
						</div>

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

						{/* Subtasks Section - [FIX] Only show if item is a project */}
						{(isProject || item.isProject) && (
							<div className="flex-1 min-h-0 pt-2 pb-10">
								<SubtaskListWidget
									parentId={item.id}
									parentItem={item}
									defaultProjectId={localProjectId || item.id || undefined}
									defaultTenantId={localTenantId || item.tenantId || undefined}
									onNavigate={(subItem) => {
										if (_onOpenItem) _onOpenItem(subItem);
										else handleDrillDown(subItem);
									}}
									className="h-full"
								/>
							</div>
						)}

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

						{isMobile ? (
							<MobileBottomSheet isOpen={isMenuOpen} onClose={() => setIsMenuOpen(false)} title="操作メニュー">
								<div className="flex flex-col py-2">
									{!isProject ? (
										<button
											onClick={async () => {
												setIsProject(true);
												setIsMenuOpen(false);
												if (onUpdate) await onUpdate(item.id, { isProject: true });
											}}
											className="text-left px-4 py-3 flex items-center gap-3 hover:bg-slate-50 dark:hover:bg-slate-800 text-blue-600 dark:text-blue-400"
										>
											<Folder size={14} />
											<span className="text-sm font-bold">プロジェクトに変換</span>
										</button>
									) : (
										<button
											onClick={async () => {
												setIsProject(false);
												setIsMenuOpen(false);
												if (onUpdate) await onUpdate(item.id, { isProject: false });
											}}
											className="text-left px-4 py-3 flex items-center gap-3 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300"
										>
											<Folder size={14} />
											<span className="text-sm font-bold">プロジェクト解除</span>
										</button>
									)}
									<button
										onClick={async () => {
											if (onUpdate) await onUpdate(item.id, { status: 'done' });
											else await ApiClient.updateItem(item.id, { status: 'done' });
											setIsMenuOpen(false);
											handleClose();
										}}
										className="text-left px-4 py-3 flex items-center gap-3 hover:bg-slate-50 dark:hover:bg-slate-800 text-green-600 dark:text-green-400"
									>
										<CheckCircle2 size={14} />
										<span className="text-sm font-bold">完了 (Complete)</span>
									</button>
									<button
										onClick={async () => {
											if (onUpdate) await onUpdate(item.id, { status: 'someday' as any });
											else await ApiClient.updateItem(item.id, { status: 'someday' });
											setIsMenuOpen(false);
											handleClose();
										}}
										className="text-left px-4 py-3 flex items-center gap-3 hover:bg-slate-50 dark:hover:bg-slate-800 text-purple-600 dark:text-purple-400"
									>
										<span className="w-2 h-2 rounded-full bg-purple-400" />
										<span className="text-sm font-bold">💭 いつかやる (Someday)</span>
									</button>
									<button
										onClick={async () => {
											if (onUpdate) await onUpdate(item.id, { isArchived: true });
											else await ApiClient.updateItem(item.id, { isArchived: true });
											setIsMenuOpen(false);
											handleClose();
										}}
										className="text-left px-4 py-3 flex items-center gap-3 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300"
									>
										<div className="w-3 h-3 border-2 border-slate-400 rounded-sm" />
										<span className="text-sm font-bold">アーカイブ</span>
									</button>
									<button
										onClick={() => onDelete(item.id)}
										className="text-left px-4 py-3 flex items-center gap-3 hover:bg-slate-50 dark:hover:bg-slate-800 text-red-500"
									>
										<Trash2 size={12} />
										<span className="text-sm font-bold">ゴミ箱</span>
									</button>
								</div>
							</MobileBottomSheet>
						) : (
							<AnimatePresence>
								{isMenuOpen && (
									<motion.div
										initial={{ opacity: 0, scale: 0.95, y: -10 }}
										animate={{ opacity: 1, scale: 1, y: -120 }}
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
											onClick={async () => {
												if (onUpdate) await onUpdate(item.id, { status: 'someday' as any });
												else await ApiClient.updateItem(item.id, { status: 'someday' });
												setIsMenuOpen(false);
												handleClose();
											}}
											className="w-full text-left px-3 py-2 text-xs font-bold text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded flex items-center gap-2"
										>
											<span className="w-2 h-2 rounded-full bg-purple-400" /> 💭 いつかやる (Someday)
										</button>
										<div className="h-px bg-slate-100 dark:bg-slate-800 my-1" />
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
											<Trash2 size={12} /> ゴミ箱
										</button>
									</motion.div>
								)}
							</AnimatePresence>
						)}
					</div>

					{/* Someday Button */}
					<button
						onClick={async () => {
							if (onUpdate) await onUpdate(item.id, { status: 'someday' as any });
							else await ApiClient.updateItem(item.id, { status: 'someday' });
							onClose();
						}}
						className="flex items-center gap-2 px-4 py-2 rounded-lg border border-purple-200 dark:border-purple-700 text-purple-500 hover:text-purple-700 hover:bg-purple-50 dark:hover:bg-purple-900/30 transition-all font-bold text-xs"
						title="いつかやる（自分で寝かせる）"
					>
						<span className="text-base leading-none">💭</span>
						いつかやる
					</button>

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
