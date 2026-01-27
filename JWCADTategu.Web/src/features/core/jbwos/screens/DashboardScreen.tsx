import React, { useState } from 'react';
import { useDashboardViewModel } from '../viewmodels/useDashboardViewModel';
import { Item } from '../types';
import { DecisionDetailModal } from '../components/Modal/DecisionDetailModal';
import { Plus } from 'lucide-react';

// Sub-components
const FocusItemCard = ({ item, onComplete, onDrop, onClick }: { item: Item, onComplete: (id: string) => void, onDrop: (id: string) => void, onClick: () => void }) => {
    return (
        <div
            onClick={onClick}
            className="bg-white/90 backdrop-blur-sm border border-indigo-100 rounded-xl p-4 shadow-sm hover:shadow-md transition-all duration-300 relative group cursor-pointer"
        >
            <div className="flex justify-between items-start">
                <div>
                    <span className="text-xs font-semibold text-indigo-500 uppercase tracking-wider mb-1 block">Focus</span>
                    <h3 className="text-lg font-bold text-slate-800 leading-tight">{item.title}</h3>
                    {item.tenantName && (
                        <span className="text-xs text-slate-400 bg-slate-50 px-2 py-0.5 rounded mt-2 inline-block">
                            {item.tenantName}
                        </span>
                    )}
                </div>
                <button
                    onClick={(e) => { e.stopPropagation(); onComplete(item.id); }}
                    className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center hover:bg-emerald-200 transition-colors"
                    title="Complete"
                >
                    ✓
                </button>
            </div>

            {/* Hover Actions */}
            <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                    onClick={(e) => { e.stopPropagation(); onDrop(item.id); }}
                    className="text-xs text-slate-400 hover:text-slate-600 px-2 py-1"
                >
                    Drop to Inbox
                </button>
            </div>
        </div>
    );
};

const SectionHeader = ({ title, count }: { title: string, count: number }) => (
    <div className="flex items-center gap-2 mb-4 mt-8">
        <h2 className="text-sm font-bold text-slate-500 uppercase tracking-widest">{title}</h2>
        {count > 0 && <span className="bg-slate-100 text-slate-500 text-xs px-2 py-0.5 rounded-full font-mono">{count}</span>}
    </div>
);

const SimpleItemRow = ({ item, onFocus, onClick }: { item: Item, onFocus: (id: string) => void, onClick: () => void }) => (
    <div
        onClick={onClick}
        className="flex items-center justify-between p-3 bg-white border border-slate-100 rounded-lg mb-2 hover:border-slate-300 transition-colors group cursor-pointer"
    >
        <div className="flex items-center gap-3">
            <div className={`w-1.5 h-1.5 rounded-full ${item.status === 'inbox' ? 'bg-orange-400' : 'bg-slate-300'}`}></div>
            <div>
                <div className="text-sm font-medium text-slate-700">{item.title}</div>
                {(item.tenantName || item.projectTitle) && (
                    <div className="text-xs text-slate-400 flex gap-2">
                        {item.tenantName && <span>🏢 {item.tenantName}</span>}
                        {item.projectTitle && <span>📁 {item.projectTitle}</span>}
                    </div>
                )}
            </div>
        </div>
        <button
            onClick={(e) => { e.stopPropagation(); onFocus(item.id); }}
            className="opacity-0 group-hover:opacity-100 text-xs bg-indigo-50 text-indigo-600 px-3 py-1.5 rounded hover:bg-indigo-100 transition-all font-medium"
        >
            Focus
        </button>
    </div>
);

export const DashboardScreen = () => {
    const {
        focusItems, inboxItems, pendingItems, waitingItems,
        isLoading,
        moveToFocus, moveToInbox, completeItem, createItem, refresh, updateItem, deleteItem // Actions
    } = useDashboardViewModel();

    const [selectedItem, setSelectedItem] = useState<Item | null>(null);
    const [newItemTitle, setNewItemTitle] = useState('');

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newItemTitle.trim()) return;
        await createItem(newItemTitle);
        setNewItemTitle('');
    };

    if (isLoading) {
        return <div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-400">Loading Dashboard...</div>;
    }

    return (
        <div className="min-h-screen bg-slate-50 pb-20">
            {/* Header / Focus Zone */}
            <div className="bg-gradient-to-br from-indigo-50 via-white to-purple-50 pb-12 pt-8 px-6 rounded-b-[2.5rem] shadow-sm mb-8">
                <div className="max-w-4xl mx-auto">
                    <header className="mb-8">
                        <h1 className="text-2xl font-light text-slate-800">
                            Dashboard <span className="text-indigo-500 font-bold">Focus</span>
                        </h1>
                        <p className="text-sm text-slate-500 mt-1">What matters most right now.</p>
                    </header>

                    {/* Focus Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {focusItems.length === 0 ? (
                            <div className="col-span-3 py-12 text-center text-slate-400 border-2 border-dashed border-slate-200 rounded-xl">
                                <p>No active focus.</p>
                                <p className="text-xs mt-2 text-slate-300">Pick something from your inbox below.</p>
                            </div>
                        ) : (
                            focusItems.map(item => (
                                <FocusItemCard
                                    key={item.id}
                                    item={item}
                                    onComplete={completeItem}
                                    onDrop={moveToInbox}
                                    onClick={() => setSelectedItem(item)}
                                />
                            ))
                        )}

                        {/* Empty Slots Encouragement */}
                        {[...Array(Math.max(0, 3 - focusItems.length))].map((_, i) => (
                            <div key={`empty-${i}`} className="hidden md:flex items-center justify-center h-32 border-2 border-dashed border-slate-100 rounded-xl text-slate-200 text-sm">
                                Open Slot
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Panorama View (Inbox & Others) */}
            <div className="max-w-4xl mx-auto px-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">

                    {/* Main Column: Inbox */}
                    <div>
                        <div className="flex items-center justify-between mb-4 mt-8">
                            <h2 className="text-sm font-bold text-slate-500 uppercase tracking-widest">Inbox</h2>
                            <span className="bg-slate-100 text-slate-500 text-xs px-2 py-0.5 rounded-full font-mono">{inboxItems.length}</span>
                        </div>

                        {/* Quick Add Input */}
                        <form onSubmit={handleCreate} className="mb-4 relative">
                            <input
                                type="text"
                                value={newItemTitle}
                                onChange={(e) => setNewItemTitle(e.target.value)}
                                placeholder="Add new item..."
                                className="w-full pl-4 pr-10 py-3 bg-white border border-slate-200 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300 transition-all text-sm"
                            />
                            <button
                                type="submit"
                                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-indigo-500 disabled:opacity-50"
                                disabled={!newItemTitle.trim()}
                            >
                                <Plus size={18} />
                            </button>
                        </form>

                        <div className="space-y-1">
                            {inboxItems.length === 0 ? (
                                <p className="text-sm text-slate-400 italic text-center py-8">Inbox zero. Nice.</p>
                            ) : (
                                inboxItems.map(item => (
                                    <SimpleItemRow
                                        key={item.id}
                                        item={item}
                                        onFocus={moveToFocus}
                                        onClick={() => setSelectedItem(item)}
                                    />
                                ))
                            )}
                        </div>
                    </div>

                    {/* Secondary Column: Pending & Waiting */}
                    <div className="space-y-8">
                        <div>
                            <SectionHeader title="Pending" count={pendingItems.length} />
                            <div className="space-y-1 opacity-75 hover:opacity-100 transition-opacity">
                                {pendingItems.map(item => (
                                    <SimpleItemRow
                                        key={item.id}
                                        item={item}
                                        onFocus={moveToFocus}
                                        onClick={() => setSelectedItem(item)}
                                    />
                                ))}
                            </div>
                        </div>

                        <div>
                            <SectionHeader title="Waiting" count={waitingItems.length} />
                            <div className="space-y-1 opacity-75 hover:opacity-100 transition-opacity">
                                {waitingItems.map(item => (
                                    <SimpleItemRow
                                        key={item.id}
                                        item={item}
                                        onFocus={moveToFocus}
                                        onClick={() => setSelectedItem(item)}
                                    />
                                ))}
                            </div>
                        </div>
                    </div>

                </div>
            </div>

            {/* Detail Modal */}
            {selectedItem && (
                <DecisionDetailModal
                    item={selectedItem}
                    onClose={() => { setSelectedItem(null); refresh(); }}
                    onDecision={async (id, decision, note, updates) => {
                        // Simplify decision handling: update status and potential fields
                        let newStatus: Item['status'] = 'inbox'; // Default to inbox
                        if (decision === 'yes') newStatus = 'focus';
                        else if (decision === 'hold') newStatus = 'pending';
                        else if (decision === 'no') newStatus = 'done'; // 'no' could be done or delete? logic says done for now.

                        const finalUpdates: any = { ...updates, status: newStatus };
                        if (note) finalUpdates.memo = note;

                        await updateItem(id, finalUpdates);
                        setSelectedItem(null);
                        refresh();
                    }}
                    onDelete={async (id) => {
                        if (confirm('Are you sure you want to delete this item?')) {
                            await deleteItem(id);
                            setSelectedItem(null);
                            refresh();
                        }
                    }}
                    onUpdate={async (id, updates) => {
                        await updateItem(id, updates);
                    }}
                />
            )}
        </div>
    );
};
