import React, { useState, useEffect } from 'react';
import { useDashboardViewModel } from '../viewmodels/useDashboardViewModel';
import { useFocusQueue } from '../../../../hooks/useFocusQueue'; // [NEW] Logic Hook
import { Item } from '../types';
import { DecisionDetailModal } from '../components/Modal/DecisionDetailModal';
import { Plus, ChevronDown, ChevronRight, BarChart2 } from 'lucide-react';
import { FocusCard } from '../components/Dashboard/FocusCard';
import { DayProgressBar } from '../components/Dashboard/DayProgressBar';
import { SideMemoWidget } from '../components/SideMemo/SideMemoWidget';

// --- Sub-components ---
const SimpleItemRow = ({ item, onFocus, onClick, index }: { item: Item, onFocus: (id: string, isIntent: boolean) => void, onClick: () => void, index?: number }) => (
    <div
        onClick={onClick}
        className="flex items-center justify-between p-3 bg-white border border-slate-100 rounded-lg mb-2 hover:border-slate-300 transition-colors group cursor-pointer"
    >
        <div className="flex items-center gap-3">
            {index !== undefined && (
                <span className="text-xs font-mono text-slate-300 w-4">{index + 1}</span>
            )}
            <div className={`w-2 h-2 rounded-full ${item.status === 'inbox' ? 'bg-orange-400' : 'bg-indigo-300'}`}></div>
            <div>
                <div className="text-sm font-medium text-slate-700">{item.title}</div>
                {(item.tenantName || item.projectTitle || item.estimatedMinutes) && (
                    <div className="text-xs text-slate-400 flex gap-2 items-center">
                        {item.tenantName && <span>🏢 {item.tenantName}</span>}
                        {item.estimatedMinutes && item.estimatedMinutes > 0 && <span>⏱️ {item.estimatedMinutes}m</span>}
                    </div>
                )}
            </div>
        </div>
        <button
            onClick={(e) => { e.stopPropagation(); onFocus(item.id, true); }}
            className="opacity-0 group-hover:opacity-100 text-xs bg-indigo-50 text-indigo-600 px-3 py-1.5 rounded hover:bg-indigo-100 transition-all font-medium"
        >
            今日やる
        </button>
    </div>
);

const SectionHeader = ({ title, count, icon, expanded, onToggle }: { title: string, count: number, icon?: React.ReactNode, expanded?: boolean, onToggle?: () => void }) => (
    <div
        className={`flex items-center gap-2 mb-4 mt-8 ${onToggle ? 'cursor-pointer select-none group' : ''}`}
        onClick={onToggle}
    >
        {onToggle && (
            <div className="text-slate-400 group-hover:text-slate-600 transition-colors">
                {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            </div>
        )}
        {icon && <span className="text-slate-400">{icon}</span>}
        <h2 className="text-sm font-bold text-slate-500 uppercase tracking-widest">{title}</h2>
        {count > 0 && <span className="bg-slate-100 text-slate-500 text-xs px-2 py-0.5 rounded-full font-mono">{count}</span>}
    </div>
);

export const DashboardScreen = () => {
    // Legacy VM for Inbox/Pending (until fully migrated)
    const {
        inboxItems, pendingItems, waitingItems,
        isLoading: isDashboardLoading,
        moveToFocus: legacyMoveToFocus, moveToInbox, completeItem, createItem, refresh: refreshDashboard, updateItem, deleteItem
    } = useDashboardViewModel();

    // New Logic for Focus Zone
    const {
        items: queueItems,
        loading: isQueueLoading,
        capacityUsed,
        capacityLimit,
        setIntent,
        reorder,
        refresh: refreshQueue
    } = useFocusQueue();

    const [selectedItem, setSelectedItem] = useState<Item | null>(null);
    const [newItemTitle, setNewItemTitle] = useState('');
    const [isPendingExpanded, setIsPendingExpanded] = useState(false); // Collapsed by default to reduce noise
    const [isWaitingExpanded, setIsWaitingExpanded] = useState(false);

    // Refresh both when needed
    const handleRefresh = async () => {
        await Promise.all([refreshDashboard(), refreshQueue()]);
    };

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newItemTitle.trim()) return;
        await createItem(newItemTitle);
        setNewItemTitle('');
        handleRefresh();
    };

    // Actions Wrapper
    const handleSetIntent = async (id: string, isIntent: boolean) => {
        await setIntent(id, isIntent);
        handleRefresh();
    };

    const handleComplete = async (id: string) => {
        await completeItem(id);
        handleRefresh();
    };

    const handleDropToInbox = async (id: string) => {
        await moveToInbox(id);
        handleRefresh();
    };

    const handleMoveToFocus = async (id: string) => {
        await legacyMoveToFocus(id); // Sets status='focus'
        // Also force intent? Maybe not immediately.
        handleRefresh();
    }

    if (isDashboardLoading || isQueueLoading) {
        return <div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-400">JBWOSを読み込み中...</div>;
    }

    // Identify the Active Focus Item (Top of Queue)
    const activeFocusItem = queueItems.length > 0 ? queueItems[0] : null;
    const remainingQueue = queueItems.slice(1);

    return (
        <div className="min-h-screen bg-slate-50 pb-20">
            {/* Header / Judgment Zone */}
            <div className="bg-gradient-to-b from-indigo-50 to-white pb-12 pt-8 px-4 md:px-6 rounded-b-[2.5rem] shadow-sm mb-8 transition-all">
                <div className="max-w-3xl mx-auto">
                    <header className="mb-6 flex justify-between items-end">
                        <div onClick={handleRefresh} className="cursor-pointer">
                            <h1 className="text-2xl font-light text-slate-800 tracking-tight">
                                タスク判断・実行 <span className="text-indigo-500 font-bold">Stream</span>
                            </h1>
                            <p className="text-xs text-slate-400 mt-1">タスクの判断と実行</p>
                        </div>
                        {/* Capacity Viz */}
                        <div className="w-1/3 min-w-[120px]">
                            <DayProgressBar usedMinutes={capacityUsed} limitMinutes={capacityLimit} />
                        </div>
                    </header>

                    {/* Active Focus Card */}
                    <div className="mb-8">
                        {activeFocusItem ? (
                            <FocusCard
                                item={activeFocusItem}
                                onSetIntent={handleSetIntent}
                                onComplete={handleComplete}
                                onDrop={handleDropToInbox}
                                onClick={() => setSelectedItem(activeFocusItem)}
                            />
                        ) : (
                            <div className="py-16 text-center border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50/50">
                                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-slate-100 text-slate-400 mb-4">
                                    <BarChart2 size={24} />
                                </div>
                                <h3 className="text-lg font-medium text-slate-600">現在タスク無し</h3>
                                <p className="text-sm text-slate-400 mt-2 max-w-xs mx-auto">
                                    判断キャパシティに余裕があります。<br />下の受信箱からタスクを選んでください。
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Remaining Queue (Next Up) */}
                    {remainingQueue.length > 0 && (
                        <div className="mb-8 pl-4 border-l-2 border-indigo-100/50 ml-4 pb-2">
                            <h3 className="text-xs font-bold text-indigo-300 uppercase tracking-widest mb-3 pl-2">次に控えているタスク</h3>
                            <div className="space-y-2">
                                {remainingQueue.map((item, index) => (
                                    <SimpleItemRow
                                        key={item.id}
                                        item={item}
                                        index={index + 1} // Offset by 1 (active is 0)
                                        onClick={() => setSelectedItem(item)}
                                        onFocus={handleSetIntent} // Already focused context, but intent toggle
                                    />
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Panorama View: Inbox & Staged */}
            <div className="max-w-3xl mx-auto px-4 md:px-6">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-sm font-bold text-slate-500 uppercase tracking-widest">受信箱 (Inbox)</h2>
                    <span className="bg-slate-100 text-slate-500 text-xs px-2 py-0.5 rounded-full font-mono">{inboxItems.length}</span>
                </div>

                {/* Quick Add */}
                <form onSubmit={handleCreate} className="mb-6 relative">
                    <input
                        type="text"
                        value={newItemTitle}
                        onChange={(e) => setNewItemTitle(e.target.value)}
                        placeholder="思いついたことを入力..."
                        className="w-full pl-4 pr-10 py-3 bg-white border border-slate-200 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300 transition-all text-sm"
                    />
                    <button
                        type="submit"
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 disabled:opacity-50 transition-colors"
                        disabled={!newItemTitle.trim()}
                    >
                        <Plus size={16} />
                    </button>
                </form>

                {/* Inbox List */}
                <div className="space-y-1 mb-12">
                    {inboxItems.length === 0 ? (
                        <p className="text-sm text-slate-400 italic text-center py-4">受信箱は空です。</p>
                    ) : (
                        inboxItems.map(item => (
                            <SimpleItemRow
                                key={item.id}
                                item={item}
                                onFocus={handleMoveToFocus}
                                onClick={() => setSelectedItem(item)}
                            />
                        ))
                    )}
                </div>

                {/* Collapsible Sections */}
                <SectionHeader
                    title="待機中 (Waiting)"
                    count={waitingItems.length}
                    expanded={isWaitingExpanded}
                    onToggle={() => setIsWaitingExpanded(!isWaitingExpanded)}
                />
                {isWaitingExpanded && (
                    <div className="space-y-1 mb-8 opacity-75">
                        {waitingItems.map(item => (
                            <SimpleItemRow
                                key={item.id}
                                item={item}
                                onFocus={handleMoveToFocus}
                                onClick={() => setSelectedItem(item)}
                            />
                        ))}
                    </div>
                )}

                <SectionHeader
                    title="保留 (Pending)"
                    count={pendingItems.length}
                    expanded={isPendingExpanded}
                    onToggle={() => setIsPendingExpanded(!isPendingExpanded)}
                />
                {isPendingExpanded && (
                    <div className="space-y-1 mb-20 opacity-75">
                        {pendingItems.map(item => (
                            <SimpleItemRow
                                key={item.id}
                                item={item}
                                onFocus={handleMoveToFocus}
                                onClick={() => setSelectedItem(item)}
                            />
                        ))}
                    </div>
                )}
            </div>

            {/* Detail Modal (Shared) */}
            {selectedItem && (
                <DecisionDetailModal
                    item={selectedItem}
                    onClose={() => { setSelectedItem(null); handleRefresh(); }}
                    onDecision={async (id, decision, note, updates) => {
                        let newStatus: Item['status'] = 'inbox';
                        // Logic update: Yes -> Focus, Hold -> Pending, No -> Done
                        if (decision === 'yes') newStatus = 'focus';
                        else if (decision === 'hold') newStatus = 'pending';
                        else if (decision === 'no') newStatus = 'done';

                        const finalUpdates: any = { ...updates, status: newStatus };
                        if (note) finalUpdates.memo = note;
                        // If decision is YES, we implies Intent
                        if (decision === 'yes') {
                            finalUpdates.isIntent = true;
                            finalUpdates.dueStatus = 'today';
                        }

                        await updateItem(id, finalUpdates);
                        setSelectedItem(null);
                        handleRefresh();
                    }}
                    onDelete={async (id) => {
                        if (confirm('本当に削除しますか?')) {
                            await deleteItem(id);
                            setSelectedItem(null);
                            handleRefresh();
                        }
                    }}
                    onUpdate={async (id, updates) => {
                        await updateItem(id, updates);
                    }}
                />
            )}

            {/* Thinking Parking Lot */}
            <SideMemoWidget />
        </div>
    );
};
