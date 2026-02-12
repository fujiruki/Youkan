import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Trash2, PauseCircle, CheckCircle2, Folder, Plus, CheckSquare, AlertTriangle } from 'lucide-react';
import { Item, Member, FilterMode, CapacityConfig } from '../../types';
import { cn } from '../../../../../lib/utils';
import { ApiClient } from '../../../../../api/client';
import { format } from 'date-fns';
import { SmartDateInput } from '../Inputs/SmartDateInput';
import { SideCalendarPanel } from '../Inputs/SideCalendarPanel';
import { QuantityEngine } from '../../logic/QuantityEngine';

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
    yesButtonLabel?: string;
    initialFocus?: 'date';
}

export const DecisionDetailModal: React.FC<DecisionDetailModalProps> = ({
    item: propItem, onClose, onDecision, onDelete, onUpdate, onCreateSubTask, onGetSubTasks,
    onDelegate: _onDelegate, onOpenItem: _onOpenItem, members = [], allProjects = [], joinedTenants = [],
    quantityItems = [], filterMode = 'all', capacityConfig,
    initialFocus, yesButtonLabel
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

    const [subTasks, setSubTasks] = React.useState<Item[]>([]);
    const [newSubTaskTitle, setNewSubTaskTitle] = React.useState('');
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
            setPrepDate(item.prep_date ? new Date(item.prep_date * 1000).toISOString().split('T')[0] : '');
            setWorkDays(item.work_days ?? 1);
            setIsWorkDaysDirty(false);
            setEditedTitle(item.title);
            setEstimatedMinutes(item.estimatedMinutes ?? 0);
            setIsProject(item.isProject ?? false);
            setLocalTenantId(item.tenantId || '');
            setLocalProjectId(item.projectId || '');
            setLocalAssignedTo(item.assignedTo || (item as any).assigned_to || '');
            setSubTasks([]);
        }
    }, [item?.id, item?.tenantId, item?.projectId, item?.assignedTo, allProjects.length, joinedTenants.length]);

    React.useEffect(() => {
        if (!item) return;

        if (isProject && onGetSubTasks) {
            onGetSubTasks(item.id).then(tasks => {
                setSubTasks(tasks);
            });
        }

        if (item.dueStatus === 'waiting_external' && !dueDate) {
            const todayStr = format(new Date(), 'yyyy-MM-dd');
            setDueDate(todayStr);
            setDueStatus('confirmed');
        }
    }, [item?.id, isProject, onGetSubTasks, item?.dueStatus]);

    const commitPeriodDates = React.useMemo(() => {
        if (!item || !capacityConfig) return [];

        const anchorStr = prepDate || dueDate;
        if (!anchorStr) return [];
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
                id: localStorage.getItem('jbwos_account_id') || '',
                isCompanyAccount: (localStorage.getItem('jbwos_account_id') || '').length > 20,
                joinedTenants: joinedTenants
            }
        };

        return QuantityEngine.calculateAllocationDays(anchor, minutes, context, (localTenantId !== undefined ? localTenantId : item.tenantId));
    }, [item?.id, prepDate, dueDate, activeDateInput, estimatedMinutes, workDays, isWorkDaysDirty, localTenantId, capacityConfig, joinedTenants, quantityItems, members, filterMode]);

    const [isMenuOpen, setIsMenuOpen] = React.useState(false);
    const [confirmDelete, setConfirmDelete] = React.useState(false);
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
            if (!updates.due_date && !item.due_date) {
                updates.due_date = todayStr;
                updates.dueStatus = 'confirmed';
            }
        }
        onDecision(item.id, decision, note, updates);
    };

    if (!item) return null;

    return (
        <AnimatePresence>
            {item && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center">
                    <motion.div
                        data-testid="modal-backdrop"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
                        onClick={handleClose}
                    />

                    <motion.div
                        initial={{ scale: 0.95, opacity: 0, y: 20 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.95, opacity: 0, y: 20 }}
                        onClick={(e) => e.stopPropagation()}
                        className="relative z-10 w-full max-w-lg md:max-w-4xl bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-white/20 overflow-hidden flex flex-col h-[calc(100vh-30px)]"
                    >
                        <div className="p-4 pb-3 flex justify-between items-start flex-none">
                            <div className="flex-1 min-w-0">

                                {history.length > 0 && (
                                    <button
                                        onClick={handleBack}
                                        className="mb-2 flex items-center gap-1 text-xs font-bold text-slate-400 hover:text-indigo-500 transition-colors"
                                    >
                                        <div className="p-0.5 rounded-full bg-slate-100 dark:bg-slate-800">
                                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
                                        </div>
                                        <span>親アイテムに戻る</span>
                                    </button>
                                )}

                                {isEditingTitle ? (
                                    <div className="flex flex-col gap-2 mb-2">
                                        <div className="flex items-center gap-2">
                                            <Folder size={18} className="text-slate-400" />
                                            <select
                                                value={localTenantId}
                                                onChange={async (e) => {
                                                    const nextTenantId = e.target.value;
                                                    setLocalTenantId(nextTenantId);

                                                    let nextProjectId = localProjectId;
                                                    if (localProjectId) {
                                                        const p = allProjects.find(x => x.id === localProjectId);
                                                        if (p && p.tenantId && p.tenantId !== nextTenantId) {
                                                            setLocalProjectId('');
                                                            nextProjectId = '';
                                                        }
                                                    }
                                                    const updates: Partial<Item> = {
                                                        tenantId: nextTenantId || null as any,
                                                        projectId: nextProjectId || null as any
                                                    };
                                                    if (onUpdate) await onUpdate(item.id, updates);
                                                    else await ApiClient.updateItem(item.id, updates);
                                                }}
                                                className="bg-slate-100 dark:bg-slate-800 text-[11px] font-bold p-1 rounded border-none focus:ring-1 focus:ring-blue-500 uppercase tracking-tighter"
                                            >
                                                <option value="">(個人・プライベート) </option>
                                                {joinedTenants.map(t => (
                                                    <option key={t.id} value={t.id}>{t.name}</option>
                                                ))}
                                            </select>

                                            <span className="text-slate-300">/</span>

                                            <select
                                                value={localProjectId}
                                                onChange={async (e) => {
                                                    const nextVal = e.target.value;
                                                    setLocalProjectId(nextVal);
                                                    const updates: Partial<Item> = {
                                                        projectId: nextVal || null as any
                                                    };
                                                    if (onUpdate) await onUpdate(item.id, updates);
                                                    else await ApiClient.updateItem(item.id, updates);
                                                }}
                                                className="bg-slate-100 dark:bg-slate-800 text-[11px] font-bold p-1 rounded border-none focus:ring-1 focus:ring-blue-500"
                                            >
                                                <option value="">(なし / Inbox) </option>
                                                {allProjects
                                                    .filter(p => !localTenantId ? !p.tenantId : p.tenantId === localTenantId)
                                                    .map(p => (
                                                        <option key={p.id} value={p.id}>{p.title || (p as any).name}</option>
                                                    ))}
                                            </select>
                                        </div>
                                        <input
                                            ref={titleInputRef}
                                            type="text"
                                            className="w-full text-2xl font-bold bg-slate-100 dark:bg-slate-800 p-1 rounded mt-1"
                                            value={editedTitle}
                                            onChange={(e) => setEditedTitle(e.target.value)}
                                            onBlur={async () => {
                                                setIsEditingTitle(false);
                                                if (editedTitle !== item.title) {
                                                    await onUpdate?.(item.id, { title: editedTitle });
                                                }
                                            }}
                                            onKeyDown={async (e) => {
                                                if (e.key === 'Enter') {
                                                    e.preventDefault();
                                                    titleInputRef.current?.blur();
                                                }
                                            }}
                                        />
                                    </div>
                                ) : (
                                    <>
                                        <div className="flex items-center gap-2 mb-1 overflow-hidden h-5">
                                            {(() => {
                                                const project = allProjects.find(p => p.id === localProjectId);
                                                const tenant = joinedTenants.find(t => t.id === localTenantId);

                                                return (
                                                    <div className="flex items-center gap-1.5 min-w-0" onClick={() => setIsEditingTitle(true)}>
                                                        <span className={cn(
                                                            "px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest cursor-pointer",
                                                            tenant ? "bg-indigo-600 text-white" : "bg-slate-200 text-slate-500 dark:bg-slate-800"
                                                        )}>
                                                            {tenant ? tenant.name : 'Private'}
                                                        </span>

                                                        <span className="text-slate-300 font-bold">/</span>

                                                        {project ? (
                                                            <span className="px-2 py-0.5 rounded bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 text-[10px] font-bold truncate cursor-pointer hover:bg-amber-200 transition-colors">
                                                                {project.title || (project as any).name}
                                                            </span>
                                                        ) : (
                                                            <span className="text-[10px] font-bold text-slate-400 tracking-tight cursor-pointer hover:text-slate-600">
                                                                Inbox
                                                            </span>
                                                        )}
                                                    </div>
                                                );
                                            })()}

                                            <button
                                                onClick={() => setIsEditingTitle(true)}
                                                className="ml-auto flex-none text-[10px] font-bold text-slate-400 hover:text-indigo-500 transition-colors uppercase tracking-widest"
                                            >
                                                Change
                                            </button>
                                        </div>
                                        <h2
                                            className="text-2xl md:text-3xl font-bold text-slate-800 dark:text-white leading-tight cursor-text hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded px-1 -ml-1 transition-colors"
                                            onClick={() => setIsEditingTitle(true)}
                                        >
                                            {item.title}
                                        </h2>
                                    </>
                                )}
                            </div>

                            <div className="flex items-center gap-2 flex-none ml-4">
                                <div className="relative" ref={menuRef}>
                                    <button
                                        onClick={() => setIsMenuOpen(!isMenuOpen)}
                                        className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                                    >
                                        <CheckSquare size={20} />
                                    </button>
                                    <AnimatePresence>
                                        {isMenuOpen && (
                                            <motion.div
                                                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                                exit={{ opacity: 0, scale: 0.95, y: 10 }}
                                                className="absolute right-0 top-full mt-2 w-48 bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-slate-100 dark:border-slate-700 p-2 z-50 overflow-hidden"
                                            >
                                                {confirmDelete ? (
                                                    <div className="p-2 space-y-2">
                                                        <p className="text-xs font-semibold text-red-500">本当に削除しますか？</p>
                                                        <div className="flex gap-2">
                                                            <button
                                                                onClick={() => onDelete(item.id)}
                                                                className="flex-1 py-1 bg-red-500 text-white rounded text-xs font-bold"
                                                            >
                                                                OK
                                                            </button>
                                                            <button
                                                                onClick={() => setConfirmDelete(false)}
                                                                className="flex-1 py-1 bg-slate-100 text-slate-600 rounded text-xs font-bold"
                                                            >
                                                                戻る
                                                            </button>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <button
                                                        onClick={() => setConfirmDelete(true)}
                                                        className="w-full flex items-center gap-2 p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg text-sm font-semibold transition-colors"
                                                    >
                                                        <Trash2 size={16} />
                                                        <span>削除する</span>
                                                    </button>
                                                )}
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>
                                <button
                                    onClick={handleClose}
                                    className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                                >
                                    <X size={24} />
                                </button>
                            </div>
                        </div>

                        <div className="flex-1 min-h-0 flex flex-col md:flex-row overflow-hidden">
                            <div className="flex-1 flex flex-col min-w-0 md:border-r border-slate-100 dark:border-slate-800 h-full">
                                <div className="p-3 pb-1 flex-none border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 z-10">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        <div className="flex flex-col gap-0.5">
                                            <div className="flex items-center justify-between">
                                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                                                    <div className="w-1 h-2.5 bg-red-400 rounded-full"></div>
                                                    納期
                                                </span>
                                                <button
                                                    onClick={async () => {
                                                        const newStatus = dueStatus === 'waiting_external' ? 'confirmed' : 'waiting_external';
                                                        const todayStr = format(new Date(), 'yyyy-MM-dd');
                                                        const newDateVal = newStatus === 'waiting_external' ? null : (dueDate || todayStr);
                                                        setDueStatus(newStatus as any);
                                                        if (newStatus === 'confirmed' && !dueDate) setDueDate(todayStr); // Only auto-set if empty
                                                        const updates: Partial<Item> = { dueStatus: newStatus as any, due_date: newDateVal };
                                                        if (onUpdate) await onUpdate(item.id, updates);
                                                        else await ApiClient.updateItem(item.id, updates);
                                                    }}
                                                    className="text-[10px] text-slate-300 hover:text-indigo-500 underline"
                                                >
                                                    {dueStatus === 'waiting_external' ? '設定' : '未定に戻す'}
                                                </button>
                                            </div>
                                            {dueStatus === 'waiting_external' ? (
                                                <div
                                                    onClick={async () => {
                                                        const todayStr = format(new Date(), 'yyyy-MM-dd');
                                                        setDueStatus('confirmed');
                                                        setDueDate(todayStr);
                                                        const updates: Partial<Item> = { dueStatus: 'confirmed', due_date: todayStr };
                                                        if (onUpdate) await onUpdate(item.id, updates);
                                                        else await ApiClient.updateItem(item.id, updates);
                                                    }}
                                                    className="bg-slate-50 dark:bg-slate-800/50 rounded px-2 py-1.5 text-xs text-slate-400 font-medium border border-dashed border-slate-200 dark:border-slate-700 cursor-pointer hover:border-indigo-400 hover:text-indigo-500 transition-colors text-center"
                                                >
                                                    未定
                                                </div>
                                            ) : (
                                                <div className="relative group">
                                                    <div className="hidden md:block">
                                                        <SmartDateInput
                                                            value={dueDate ? new Date(dueDate) : null}
                                                            onChange={async (d) => {
                                                                const val = d ? format(d, 'yyyy-MM-dd') : '';
                                                                setDueDate(val);
                                                                const updates: Partial<Item> = { due_date: val, dueStatus: 'confirmed' };
                                                                if (onUpdate) await onUpdate(item.id, updates);
                                                                else await ApiClient.updateItem(item.id, updates);
                                                            }}
                                                            onFocus={() => {
                                                                setActiveDateInput('due');
                                                            }}
                                                            autoFocus={initialFocus === 'date' || !dueDate}
                                                            className="text-xs py-1"
                                                        />
                                                    </div>
                                                    <div className="md:hidden">
                                                        <input
                                                            type="date"
                                                            value={dueDate}
                                                            onChange={async (e) => {
                                                                const val = e.target.value;
                                                                setDueDate(val);
                                                                const updates: Partial<Item> = { due_date: val, dueStatus: 'confirmed' as any };
                                                                if (onUpdate) await onUpdate(item.id, updates);
                                                                else await ApiClient.updateItem(item.id, updates);
                                                            }}
                                                            onFocus={() => {
                                                                setActiveDateInput('due');
                                                            }}
                                                            className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded px-2 py-1.5 text-xs"
                                                        />
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        <div className="flex flex-col gap-0.5">
                                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                                                <div className="w-1 h-2.5 bg-indigo-400 rounded-full"></div>
                                                マイ期限
                                            </span>
                                            <div className="relative group/mydate">
                                                <div className="hidden md:block">
                                                    <SmartDateInput
                                                        value={prepDate ? new Date(prepDate) : null}
                                                        onChange={async (d) => {
                                                            const val = d ? format(d, 'yyyy-MM-dd') : '';
                                                            setPrepDate(val);
                                                            const dateObj = new Date(val);
                                                            const timestamp = !isNaN(dateObj.getTime()) ? Math.floor(dateObj.getTime() / 1000) : null;
                                                            const updates = { prep_date: timestamp };
                                                            if (onUpdate) await onUpdate(item.id, updates);
                                                            else await ApiClient.updateItem(item.id, updates);
                                                        }}
                                                        onFocus={() => {
                                                            setActiveDateInput('my');
                                                        }}
                                                        placeholder="Goal..."
                                                        className={cn(
                                                            "w-full bg-slate-50 dark:bg-slate-800/50 border border-transparent hover:border-slate-200 dark:hover:border-slate-700 rounded px-2 py-1.5 text-xs text-slate-700 dark:text-slate-300 outline-none focus:bg-white dark:focus:bg-slate-800 transition-colors",
                                                            activeDateInput === 'my' ? "ring-1 ring-indigo-400 border-indigo-300" : "focus:ring-1 focus:ring-indigo-400"
                                                        )}
                                                    />
                                                </div>
                                                <div className="md:hidden">
                                                    <input
                                                        type="date"
                                                        value={prepDate}
                                                        onChange={async (e) => {
                                                            const val = e.target.value;
                                                            setPrepDate(val);
                                                            const dateObj = new Date(val);
                                                            const timestamp = !isNaN(dateObj.getTime()) ? Math.floor(dateObj.getTime() / 1000) : null;
                                                            const updates: Partial<Item> = { prep_date: timestamp || undefined };
                                                            if (onUpdate) await onUpdate(item.id, updates);
                                                            else await ApiClient.updateItem(item.id, updates);
                                                        }}
                                                        onFocus={() => {
                                                            setActiveDateInput('my');
                                                        }}
                                                        className={cn(
                                                            "bg-slate-50 dark:bg-slate-800/50 border border-transparent hover:border-slate-200 dark:hover:border-slate-700 rounded px-2 py-1.5 text-xs text-slate-700 dark:text-slate-300 outline-none focus:bg-white dark:focus:bg-slate-800 focus:ring-1 w-full transition-colors",
                                                            activeDateInput === 'my' ? "ring-1 ring-indigo-400 border-indigo-300" : "focus:ring-indigo-400"
                                                        )}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex-1 min-h-0 hidden md:flex bg-slate-50/10 dark:bg-slate-900/10 flex-col overflow-hidden relative">
                                    {estimatedMinutes > 0 && commitPeriodDates.length === 0 && (
                                        <div className="mb-2 p-2 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 rounded-md flex items-start gap-2">
                                            <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                                            <span className="text-[10px] leading-tight text-amber-700 dark:text-amber-300">
                                                キャパシティ割り当てが見積もれませんでした。設定を確認してください。
                                            </span>
                                        </div>
                                    )}
                                    <SideCalendarPanel
                                        items={quantityItems || []}
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
                                        workDays={item.work_days || 1}
                                        onItemClick={() => { }}
                                        targetMode={activeDateInput || 'due'}
                                        filterMode={filterMode}
                                        volumeOnly={true}
                                        targetItemId={item.id}
                                        commitPeriod={commitPeriodDates}
                                        capacityConfig={capacityConfig}
                                        className="h-full border-l-0"
                                    />
                                </div>

                                <div className="flex-none p-3 space-y-2 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 z-10 shadow-inner">
                                    <div className="flex justify-center">
                                        <button
                                            onClick={async () => {
                                                const newBoostState = !item.is_boosted;
                                                const updates = { is_boosted: newBoostState, boosted_date: Date.now() };
                                                if (onUpdate) await onUpdate(item.id, updates);
                                                else await ApiClient.updateItem(item.id, updates);
                                            }}
                                            className={cn(
                                                "w-full flex items-center justify-center gap-2 px-3 py-1 rounded-full text-[10px] font-bold transition-colors border",
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
                                                else await ApiClient.updateItem(item.id, updates);
                                            }}
                                            placeholder="メモ..."
                                            rows={2}
                                            className="w-full bg-slate-50 dark:bg-slate-800/50 border border-transparent hover:border-slate-200 dark:hover:border-slate-700 rounded-lg p-2 text-xs text-slate-700 dark:text-slate-300 outline-none focus:bg-white dark:focus:bg-slate-800 focus:ring-1 focus:ring-indigo-400 transition-all resize-none"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="w-full md:w-[320px] lg:w-[360px] flex flex-col border-l border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-y-auto p-5 space-y-6">

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
                                                onClick={() => {
                                                    const newVal = preset.val;
                                                    setEstimatedMinutes(newVal);
                                                    setWorkDays(newVal / 480);
                                                    setIsWorkDaysDirty(true);
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
                                        value={estimatedMinutes / 60}
                                        onChange={e => setEstimatedMinutes(Number(e.target.value) * 60)}
                                        className="w-12 bg-transparent border-b border-slate-200 text-right text-xs font-mono focus:outline-none focus:border-amber-400 transition-colors"
                                        placeholder="0"
                                    />
                                    <span className="text-[10px] text-slate-400">h</span>
                                </div>
                            </div>

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
                                        className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 outline-none focus:ring-1 focus:ring-indigo-400 focus:border-indigo-400 transition-all appearance-none cursor-pointer"
                                    >
                                        <option value="">(未割り当て)</option>
                                        {members.map(m => (
                                            <option key={m.id} value={m.id}>
                                                {(m as any).display_name || (m as any).name} {m.role ? `(${m.role})` : ''}
                                            </option>
                                        ))}
                                    </select>
                                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 text-[10px]">
                                        ▼
                                    </div>
                                </div>
                            </div>

                            {isProject && (
                                <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="text-xs font-bold text-slate-400 flex items-center gap-1">
                                            <Folder size={12} className="text-blue-400" />
                                            サブタスク
                                        </div>
                                        {subTasks.length > 0 && (
                                            <button
                                                onClick={async () => {
                                                    const totalMinutes = subTasks.reduce((sum, t) => sum + (t.estimatedMinutes || 0), 0);
                                                    if (totalMinutes > 0 && totalMinutes !== estimatedMinutes) {
                                                        setEstimatedMinutes(totalMinutes);
                                                        const updates = { estimatedMinutes: totalMinutes };
                                                        if (onUpdate) await onUpdate(item.id, updates);
                                                        else await ApiClient.updateItem(item.id, updates);
                                                    }
                                                }}
                                                className="text-[10px] text-indigo-500 hover:bg-indigo-50 px-1.5 py-0.5 rounded transition-colors"
                                            >
                                                合計を反映
                                            </button>
                                        )}
                                    </div>

                                    <div className="space-y-1 mb-2">
                                        {subTasks.map(sub => (
                                            <div
                                                key={sub.id}
                                                onClick={() => handleDrillDown(sub)}
                                                className="flex items-center gap-2 p-2 bg-slate-50 dark:bg-slate-800/50 rounded-md border border-slate-200 dark:border-slate-700 hover:bg-white dark:hover:bg-slate-800 hover:border-blue-300 dark:hover:border-blue-700 cursor-pointer transition-all group"
                                            >
                                                <CheckSquare size={14} className={cn(
                                                    "transition-colors",
                                                    sub.status === 'done' ? "text-green-500" : "text-slate-300 group-hover:text-blue-400"
                                                )} />
                                                <span className={cn(
                                                    "text-xs font-medium flex-1 truncate",
                                                    sub.status === 'done' ? "text-slate-400 line-through" : "text-slate-700 dark:text-slate-200"
                                                )}>{sub.title}</span>
                                                <div className="flex items-center gap-1">
                                                    {sub.estimatedMinutes && sub.estimatedMinutes > 0 ? (
                                                        <span className="text-[10px] font-mono text-slate-500 bg-white dark:bg-slate-900 px-1.5 py-0.5 rounded border border-slate-100 dark:border-slate-800">
                                                            {sub.estimatedMinutes >= 60 ? `${(sub.estimatedMinutes / 60).toFixed(1)}h` : `${sub.estimatedMinutes}m`}
                                                        </span>
                                                    ) : (
                                                        sub.work_days !== undefined && sub.work_days > 0 && (
                                                            <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500 bg-white dark:bg-slate-900 px-1.5 py-0.5 rounded border border-slate-100 dark:border-slate-800">
                                                                {Number(sub.work_days).toFixed(1)}d
                                                            </span>
                                                        )
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    <div className="flex items-center gap-2">
                                        <input
                                            type="text"
                                            value={newSubTaskTitle}
                                            onChange={e => setNewSubTaskTitle(e.target.value)}
                                            onKeyDown={async e => {
                                                if (e.key === 'Enter' && newSubTaskTitle.trim() && onCreateSubTask) {
                                                    e.preventDefault();
                                                    const titleToAdd = newSubTaskTitle.trim();
                                                    setNewSubTaskTitle('');
                                                    await onCreateSubTask(item.id, titleToAdd, dueDate || item.due_date || undefined);
                                                    if (onGetSubTasks) {
                                                        const tasks = await onGetSubTasks(item.id);
                                                        setSubTasks(tasks);
                                                    }
                                                }
                                            }}
                                            placeholder="サブタスクを追加..."
                                            className="flex-1 bg-transparent border-b border-slate-200 dark:border-slate-800 text-sm py-1 focus:outline-none focus:border-blue-400 transition-colors"
                                        />
                                        <button
                                            onClick={async () => {
                                                if (newSubTaskTitle.trim() && onCreateSubTask) {
                                                    const titleToAdd = newSubTaskTitle.trim();
                                                    setNewSubTaskTitle('');
                                                    await onCreateSubTask(item.id, titleToAdd, dueDate || item.due_date || undefined);
                                                    if (onGetSubTasks) {
                                                        const tasks = await onGetSubTasks(item.id);
                                                        setSubTasks(tasks);
                                                    }
                                                }
                                            }}
                                            className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded text-slate-400 hover:text-blue-500 transition-colors"
                                        >
                                            <Plus size={16} />
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>

                    </motion.div>

                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 w-full max-w-4xl px-4 z-20">
                        <div className="p-4 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md rounded-2xl shadow-2xl border border-white/20 flex flex-col md:flex-row justify-between items-center gap-4">
                            <div className="flex items-center gap-2 w-full md:w-auto">
                                <div className="relative group/notnow" ref={menuRef}>
                                    <button
                                        onClick={() => setIsMenuOpen(!isMenuOpen)}
                                        className={cn(
                                            "flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-transparent transition-all",
                                            isMenuOpen
                                                ? "bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200"
                                                : "hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                                        )}
                                    >
                                        <Trash2 size={18} />
                                    </button>
                                    <div className={cn(
                                        "absolute bottom-full left-0 w-56 bg-white dark:bg-slate-900 shadow-xl rounded-xl border border-slate-200 dark:border-slate-800 p-2 mb-2 z-50",
                                        isMenuOpen ? "block" : "hidden group-hover/notnow:block"
                                    )}>
                                        <div className="text-[10px] font-bold text-slate-400 px-2 py-1 mb-1 uppercase">場所を移動</div>
                                        {!isProject && (
                                            <button
                                                onClick={async () => {
                                                    setIsProject(true);
                                                    if (onUpdate) await onUpdate(item.id, { isProject: true });
                                                    if (onGetSubTasks) {
                                                        const tasks = await onGetSubTasks(item.id);
                                                        setSubTasks(tasks);
                                                    }
                                                }}
                                                className="w-full text-left px-3 py-2 text-xs font-bold text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded flex items-center gap-2"
                                            >
                                                <Folder size={14} /> プロジェクトに変換
                                            </button>
                                        )}
                                        <button
                                            onClick={() => onDecision(item.id, 'no', 'someday')}
                                            className="w-full text-left px-3 py-2 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded flex items-center gap-2"
                                        >
                                            <span className="w-2 h-2 rounded-full bg-amber-400" /> いつかやる
                                        </button>
                                        <div className="h-px bg-slate-100 dark:bg-slate-800 my-1" />
                                        <button
                                            onClick={() => onDelete(item.id)}
                                            className="w-full text-left px-3 py-2 text-xs font-bold text-red-500 hover:bg-red-50 rounded flex items-center gap-2"
                                        >
                                            <Trash2 size={12} /> 完全に削除
                                        </button>
                                    </div>
                                </div>

                                <button
                                    onClick={() => onDecision(item.id, 'hold', note)}
                                    className="flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all font-bold text-xs"
                                >
                                    <PauseCircle size={18} /> 保留にする
                                </button>
                            </div>

                            <div className="flex items-center gap-3 w-full md:w-auto justify-end">
                                <button
                                    onClick={handleClose}
                                    className="px-4 py-2 rounded-lg border-2 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 font-bold text-sm"
                                >
                                    閉じる
                                </button>
                                <button
                                    onClick={() => handleDecisionWithSave('yes')}
                                    className="flex items-center gap-2 px-6 py-2 rounded-lg bg-amber-400 hover:bg-amber-500 text-white font-bold text-sm transition-all"
                                >
                                    <CheckCircle2 size={18} /> {yesButtonLabel || '今日やる'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </AnimatePresence>
    );
};
