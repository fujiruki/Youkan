import React, { useState, useEffect } from 'react';
import { Door, db } from '../../db/db';
import { Inbox, Hand, Flame, Snowflake, Box, AlertCircle, CheckCircle2 } from 'lucide-react';
import { clsx } from 'clsx';
// import { GenericItemPreview } from './JoineryScheduleScreen'; // Not exported, removed usage

interface DecisionBoardProps {
    projectId: number;
    onSwitchToExternal: () => void;
}

type BucketType = 'inbox' | 'waiting' | 'ready' | 'pending';

export const DecisionBoard: React.FC<DecisionBoardProps> = ({ projectId, onSwitchToExternal }) => {
    const [doors, setDoors] = useState<Door[]>([]);

    useEffect(() => {
        const load = async () => {
            const items = await db.doors.where('projectId').equals(projectId).toArray();
            setDoors(items);
        };
        load();
        // Since we don't have live query, we need to reload on changes manually or simple polling?
        // Let's use simple polling for now or trigger reload on D&D.
        // Actually, db updates in handleDrop will not trigger re-render if we don't update local state.
        // I will update local state manually for smooth UX.
    }, [projectId]);

    const refresh = async () => {
        const items = await db.doors.where('projectId').equals(projectId).toArray();
        setDoors(items);
    };

    const [draggedItem, setDraggedItem] = useState<Door | null>(null);
    const [flashMessage, setFlashMessage] = useState<string | null>(null);

    // Initial data load handling could be here but useLiveQuery handles updates.

    // Sort logic: We do NOT sort by weight/timing to avoid stress (as per Constitution).
    // Just simple arrival order or ID order.
    const inboxItems = doors?.filter(d => d.judgmentStatus === 'inbox' || !d.judgmentStatus) || [];
    const waitingItems = doors?.filter(d => d.judgmentStatus === 'waiting') || [];
    const readyItems = doors?.filter(d => d.judgmentStatus === 'ready') || [];
    const pendingItems = doors?.filter(d => d.judgmentStatus === 'pending') || [];

    const handleDragStart = (e: React.DragEvent, item: Door) => {
        setDraggedItem(item);
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    };

    const handleDrop = async (e: React.DragEvent, targetBucket: BucketType | 'done') => {
        e.preventDefault();
        if (!draggedItem) return;

        // Constraints
        if (targetBucket === 'ready') {
            if (readyItems.length >= 2 && draggedItem.judgmentStatus !== 'ready') {
                alert('Ready（今日やる）は最大2件までです。\nどれかをPendingかWaitingに戻してください。');
                return;
            }
        }

        // Done Logic
        if (targetBucket === 'done') {
            // Just move to done status. No logging.
            await db.doors.update(draggedItem.id!, { judgmentStatus: 'done' });
            setFlashMessage('今日は、ここまでで十分です。');
            setTimeout(() => setFlashMessage(null), 3000);
            refresh();
            return;
        }

        // General Move
        await db.doors.update(draggedItem.id!, { judgmentStatus: targetBucket as any });

        // Post-Move Feedback
        if (targetBucket === 'ready') {
            setFlashMessage('今日はこれで十分です');
            setTimeout(() => setFlashMessage(null), 3000);
        }
        refresh();
    };

    const getBucketIcon = (type: BucketType) => {
        switch (type) {
            case 'inbox': return <Inbox size={20} className="text-slate-400" />;
            case 'waiting': return <Hand size={20} className="text-amber-400" />;
            case 'ready': return <Flame size={20} className="text-emerald-400" />;
            case 'pending': return <Snowflake size={20} className="text-blue-400" />;
        }
    };

    const getBucketLabel = (type: BucketType) => {
        switch (type) {
            case 'inbox': return 'Inbox';
            case 'waiting': return 'Waiting';
            case 'ready': return 'Ready';
            case 'pending': return 'Pending';
        }
    };

    const renderCard = (item: Door) => (
        <div
            key={item.id}
            draggable
            onDragStart={(e) => handleDragStart(e, item)}
            className="bg-slate-800 p-3 rounded-md border border-slate-700 shadow-sm hover:border-emerald-500/50 cursor-grab active:cursor-grabbing mb-2 group"
        >
            <div className="flex justify-between items-start mb-1">
                <span className="font-bold text-slate-200 text-sm">{item.name}</span>
                <span className="text-xs text-slate-500 font-mono">{item.tag}</span>
            </div>

            {/* Buffers (Subtle) */}
            <div className="flex gap-2 mt-2 opacity-50 group-hover:opacity-100 transition-opacity">
                {item.weight && (
                    <div className="flex text-slate-500">
                        {[...Array(item.weight)].map((_, i) => <Box key={i} size={12} />)}
                    </div>
                )}
                {item.roughTiming && (
                    <div className="text-[10px] bg-slate-700 px-1 rounded text-slate-400">
                        {item.roughTiming === 'early_month' ? '上旬' :
                            item.roughTiming === 'mid_month' ? '中旬' :
                                item.roughTiming === 'late_month' ? '下旬' : 'そのうち'}
                    </div>
                )}
            </div>
            {item.waitingReason && (
                <div className="mt-1 text-xs text-amber-500/80 truncate">Wait: {item.waitingReason}</div>
            )}
        </div>
    );

    return (
        <div className="h-full flex flex-col bg-slate-950 text-slate-200 p-4 relative overflow-hidden">
            {/* Flash Message Overlay */}
            {flashMessage && (
                <div className="absolute top-10 left-1/2 -translate-x-1/2 bg-emerald-500/90 text-white px-6 py-3 rounded-full shadow-2xl z-50 animate-in fade-in slide-in-from-top-4 flex items-center gap-2 font-bold backdrop-blur">
                    <CheckCircle2 size={20} />
                    {flashMessage}
                </div>
            )}

            {/* Header */}
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h2 className="text-xl font-bold flex items-center gap-2">
                        <span className="text-2xl">⚡</span>
                        Decision Board
                    </h2>
                    <p className="text-xs text-slate-500 mt-1">
                        {inboxItems.length > 10 ? 'Inboxが溜まっています。今日は1件だけ処理すればOKです。' : '今日の判断を行いましょう。'}
                    </p>
                </div>
                <button
                    onClick={onSwitchToExternal}
                    className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-400 px-3 py-1.5 rounded border border-slate-700 transition-colors"
                >
                    対外説明モードへ (External View)
                </button>
            </div>

            {/* Board Area */}
            <div className="flex-1 flex gap-4 overflow-x-auto pb-2">

                {/* 1. Inbox */}
                <div
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, 'inbox')}
                    className="flex-1 min-w-[250px] bg-slate-900/50 rounded-lg p-2 flex flex-col border border-slate-800"
                >
                    <div className="flex items-center gap-2 px-2 py-3 border-b border-slate-800 mb-2">
                        {getBucketIcon('inbox')}
                        <span className="font-bold text-slate-400">Box ({inboxItems.length})</span>
                    </div>
                    <div className="flex-1 overflow-y-auto px-1 scrollbar-thin scrollbar-thumb-slate-700">
                        {inboxItems.map(renderCard)}
                        {inboxItems.length === 0 && <div className="text-center text-slate-600 text-xs py-10">空です</div>}
                    </div>
                </div>

                {/* 2. Waiting */}
                <div
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, 'waiting')}
                    className="flex-1 min-w-[250px] bg-slate-900/50 rounded-lg p-2 flex flex-col border border-slate-800"
                >
                    <div className="flex items-center gap-2 px-2 py-3 border-b border-slate-800 mb-2">
                        {getBucketIcon('waiting')}
                        <span className="font-bold text-amber-500/80">Wait ({waitingItems.length})</span>
                    </div>
                    <div className="flex-1 overflow-y-auto px-1 scrollbar-thin scrollbar-thumb-slate-700">
                        {waitingItems.map(renderCard)}
                    </div>
                </div>

                {/* 3. Ready */}
                <div
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, 'ready')}
                    className={clsx(
                        "flex-1 min-w-[250px] rounded-lg p-2 flex flex-col border transition-all",
                        readyItems.length > 0 ? "bg-emerald-900/10 border-emerald-500/30" : "bg-slate-900/50 border-slate-800"
                    )}
                >
                    <div className="flex items-center gap-2 px-2 py-3 border-b border-white/5 mb-2">
                        {getBucketIcon('ready')}
                        <span className="font-bold text-emerald-400">Ready ({readyItems.length}/2)</span>
                    </div>
                    <div className="flex-1 overflow-y-auto px-1 scrollbar-thin scrollbar-thumb-slate-700">
                        {readyItems.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-slate-600">
                                <span className="text-sm">今日はもう、やるものはありません</span>
                                <span className="text-xs opacity-50 mt-1">ゆっくり休みましょう</span>
                            </div>
                        ) : (
                            readyItems.map(renderCard)
                        )}
                    </div>

                    {/* Done Zone (Drop Target included here for UX, or sidebar?) */}
                    {/* Let's make a clear 'Done' Area at the bottom of Ready if dragging from ready? No, simplify. */}
                    {/* Maybe a global drop zone for 'Done' at bottom? */}
                </div>

                {/* 4. Pending */}
                <div
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, 'pending')}
                    className="w-[100px] bg-slate-950 border-l border-slate-800 flex flex-col items-center py-4 transition-all hover:w-[250px] group/pending"
                >
                    <div className="mb-4 text-slate-500 group-hover/pending:text-blue-400 transition-colors">
                        <Snowflake size={24} />
                    </div>
                    <div className="flex-1 w-full overflow-hidden relative">
                        <div className="absolute inset-0 flex flex-col items-center pt-4 group-hover/pending:hidden">
                            <span className="vertical-text text-xs text-slate-600 tracking-widest">塩漬け中 ({pendingItems.length})</span>
                        </div>
                        <div className="absolute inset-0 hidden group-hover/pending:block px-2 overflow-y-auto">
                            <h3 className="text-center text-xs font-bold text-slate-500 mb-2">Pending ({pendingItems.length})</h3>
                            {pendingItems.map(renderCard)}
                        </div>
                    </div>
                </div>

            </div>

            {/* Done Drop Zone (Always visible at bottom right?) */}
            <div
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, 'done')}
                className="absolute bottom-4 right-4 w-32 h-20 border-2 border-dashed border-slate-700 rounded-lg flex flex-col items-center justify-center text-slate-500 hover:border-emerald-500 hover:text-emerald-500 hover:bg-emerald-900/20 transition-all z-10"
            >
                <CheckCircle2 size={24} />
                <span className="text-xs mt-1">完了 (Done)</span>
            </div>
        </div>
    );
};
