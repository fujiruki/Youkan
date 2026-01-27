import React from 'react';
import { useDashboardViewModel } from '../viewmodels/useDashboardViewModel';
import { Item } from '../types';

// Sub-components (Inline for now, extract later)
const FocusItemCard = ({ item, onComplete, onDrop }: { item: Item, onComplete: (id: string) => void, onDrop: (id: string) => void }) => {
    return (
        <div className="bg-white/90 backdrop-blur-sm border border-indigo-100 rounded-xl p-4 shadow-sm hover:shadow-md transition-all duration-300 relative group">
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
                    onClick={() => onComplete(item.id)}
                    className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center hover:bg-emerald-200 transition-colors"
                    title="Complete"
                >
                    ✓
                </button>
            </div>

            {/* Hover Actions */}
            <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                    onClick={() => onDrop(item.id)}
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

const SimpleItemRow = ({ item, onFocus }: { item: Item, onFocus: (id: string) => void }) => (
    <div className="flex items-center justify-between p-3 bg-white border border-slate-100 rounded-lg mb-2 hover:border-slate-300 transition-colors group">
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
            onClick={() => onFocus(item.id)}
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
        moveToFocus, moveToInbox, completeItem // Actions
    } = useDashboardViewModel();

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
                                />
                            ))
                        )}

                        {/* Empty Slots Encouragement (Optional) */}
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
                        <SectionHeader title="Inbox" count={inboxItems.length} />
                        <div className="space-y-1">
                            {inboxItems.length === 0 ? (
                                <p className="text-sm text-slate-400 italic">Inbox zero. Nice.</p>
                            ) : (
                                inboxItems.map(item => (
                                    <SimpleItemRow key={item.id} item={item} onFocus={moveToFocus} />
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
                                    <SimpleItemRow key={item.id} item={item} onFocus={moveToFocus} />
                                ))}
                            </div>
                        </div>

                        <div>
                            <SectionHeader title="Waiting" count={waitingItems.length} />
                            <div className="space-y-1 opacity-75 hover:opacity-100 transition-opacity">
                                {waitingItems.map(item => (
                                    <SimpleItemRow key={item.id} item={item} onFocus={moveToFocus} />
                                ))}
                            </div>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
};
