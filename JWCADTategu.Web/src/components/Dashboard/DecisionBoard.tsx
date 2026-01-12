import React, { useState, useEffect } from 'react';
import { Door, db } from '../../db/db';
import { Inbox, Hand, Flame, Snowflake, Box, CheckCircle2, Plus, ChevronDown, Package } from 'lucide-react';
import { clsx } from 'clsx';
import { GenericItemModal } from './GenericItemModal';

interface DecisionBoardProps {
    projectId: number;
    onSwitchToExternal: () => void;
}

type BucketType = 'inbox' | 'waiting' | 'ready' | 'pending';

export const DecisionBoard: React.FC<DecisionBoardProps> = ({ projectId, onSwitchToExternal }) => {
    const [doors, setDoors] = useState<Door[]>([]);
    const [isCreateMenuOpen, setIsCreateMenuOpen] = useState(false);
    const [isGenericModalOpen, setIsGenericModalOpen] = useState(false);

    // --- Data Loading ---
    const refresh = async () => {
        const items = await db.doors.where('projectId').equals(projectId).toArray();
        setDoors(items);
    };

    useEffect(() => {
        refresh();
    }, [projectId]);

    const [draggedItem, setDraggedItem] = useState<Door | null>(null);
    const [flashMessage, setFlashMessage] = useState<string | null>(null);

    // --- Buckets ---
    const inboxItems = doors?.filter(d => d.judgmentStatus === 'inbox' || !d.judgmentStatus) || [];
    const waitingItems = doors?.filter(d => d.judgmentStatus === 'waiting') || [];
    const readyItems = doors?.filter(d => d.judgmentStatus === 'ready') || [];
    const pendingItems = doors?.filter(d => d.judgmentStatus === 'pending') || [];
    // [NEW] Done Items
    const doneItems = doors?.filter(d => d.judgmentStatus === 'done') || [];

    // --- Drag Logic ---
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
            await db.doors.update(draggedItem.id!, { judgmentStatus: 'done' });
            setFlashMessage('お疲れ様でした！');
            setTimeout(() => setFlashMessage(null), 3000);
            refresh();
            return;
        }

        // General Move
        await db.doors.update(draggedItem.id!, { judgmentStatus: targetBucket as any });
        refresh();
    };

    // --- Creation Logic (Duplicated from JoineryScheduleScreen for MVP) ---
    const handleCreateDoor = async () => {
        await db.doors.add({
            projectId: projectId,
            name: '新規建具',
            count: 1,
            dimensions: { width: 800, height: 2000, depth: 36, stileWidth: 30, topRailWidth: 30, bottomRailWidth: 60, middleRailWidth: 30, middleRailCount: 0, tsukaWidth: 30, tsukaCount: 0, kumikoVertWidth: 6, kumikoVertCount: 0, kumikoHorizWidth: 6, kumikoHorizCount: 0 },
            category: 'door',
            type: 'flush',
            tag: 'TBD',
            specs: {},
            createdAt: new Date(),
            updatedAt: new Date(),
            judgmentStatus: 'inbox'
        });
        refresh();
        setIsCreateMenuOpen(false);
    };

    const handleCreateGeneric = () => {
        setIsCreateMenuOpen(false);
        setIsGenericModalOpen(true);
    };

    const handleSaveGeneric = async (item: Partial<Door> | Door) => {
        // Simple add logic for now, edit not fully supported in this view except creating new
        const nonDoors = doors.filter(d => d.category && d.category !== 'door');
        const nextIndex = nonDoors.length + 1;
        const tagPrefix = item.category === 'frame' ? 'W' : item.category === 'furniture' ? 'K' : item.category === 'hardware' ? 'H' : 'M';

        await db.doors.add({
            ...(item as Door),
            projectId: projectId,
            tag: `${tagPrefix}-${nextIndex}`,
            judgmentStatus: 'inbox',
            createdAt: new Date(),
            updatedAt: new Date()
        });
        setIsGenericModalOpen(false);
        refresh();
    };


    // --- Render Helpers ---
    const getBucketIcon = (type: BucketType | 'done') => {
        switch (type) {
            case 'inbox': return <Inbox size={20} className="text-slate-400" />;
            case 'waiting': return <Hand size={20} className="text-amber-400" />;
            case 'ready': return <Flame size={20} className="text-emerald-400" />;
            case 'pending': return <Snowflake size={20} className="text-blue-400" />;
            case 'done': return <CheckCircle2 size={20} className="text-slate-500" />;
        }
    };

    const renderCard = (item: Door) => (
        <div
            key={item.id}
            draggable
            onDragStart={(e) => handleDragStart(e, item)}
            className="bg-slate-800 p-2 rounded-md border border-slate-700 shadow-sm hover:border-emerald-500/50 cursor-grab active:cursor-grabbing mb-2 group flex gap-2"
        >
            {/* [NEW] Thumbnail */}
            {item.thumbnail ? (
                <div className="w-10 h-10 bg-slate-900 rounded flex-shrink-0 overflow-hidden border border-slate-700">
                    <img src={item.thumbnail} className="w-full h-full object-contain" alt="" />
                </div>
            ) : (
                <div className="w-10 h-10 bg-slate-900 rounded flex-shrink-0 flex items-center justify-center text-slate-700">
                    {item.category === 'door' ? <Box size={16} /> : <Package size={16} />}
                </div>
            )}

            <div className="flex-1 min-w-0">
                <div className="flex justify-between items-start mb-0.5">
                    <span className="font-bold text-slate-200 text-sm truncate">{item.name}</span>
                    <span className="text-xs text-slate-500 font-mono ml-1">{item.tag}</span>
                </div>

                {/* Buffers */}
                <div className="flex gap-2 items-center">
                    {item.roughTiming && (
                        <div className="text-[9px] bg-slate-700 px-1 rounded text-slate-400">
                            {item.roughTiming === 'early_month' ? '上旬' : item.roughTiming === 'mid_month' ? '中旬' : item.roughTiming === 'late_month' ? '下旬' : '未定'}
                        </div>
                    )}
                    {item.waitingReason && (
                        <div className="text-[10px] text-amber-500/80 truncate max-w-[80px]">Wait: {item.waitingReason}</div>
                    )}
                </div>
            </div>
        </div>
    );

    return (
        <div className="h-full flex flex-col bg-slate-950 text-slate-200 p-4 relative overflow-hidden">
            {/* Flash Message */}
            {flashMessage && (
                <div className="absolute top-10 left-1/2 -translate-x-1/2 bg-emerald-500/90 text-white px-6 py-3 rounded-full shadow-2xl z-50 flex items-center gap-2 font-bold backdrop-blur animate-in fade-in slide-in-from-top-4">
                    <CheckCircle2 size={20} />
                    {flashMessage}
                </div>
            )}

            {/* Header */}
            <div className="flex justify-between items-center mb-4 shrink-0">
                <div>
                    <h2 className="text-xl font-bold flex items-center gap-2">
                        <span className="text-2xl">⚡</span>
                        Decision Board
                    </h2>
                </div>
                <div className="flex items-center gap-3">
                    {/* [NEW] Create Button */}
                    <div className="relative">
                        <button
                            onClick={() => setIsCreateMenuOpen(!isCreateMenuOpen)}
                            className="bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 rounded-md flex items-center gap-2 text-sm font-bold shadow-lg transition-all"
                        >
                            <Plus size={16} />
                            追加
                            <ChevronDown size={14} />
                        </button>
                        {isCreateMenuOpen && (
                            <>
                                <div className="fixed inset-0 z-10" onClick={() => setIsCreateMenuOpen(false)}></div>
                                <div className="absolute right-0 top-full mt-2 w-48 bg-slate-900 border border-slate-700 rounded-lg shadow-xl overflow-hidden z-20">
                                    <button onClick={handleCreateDoor} className="w-full text-left px-4 py-3 hover:bg-slate-800 flex items-center gap-3 text-sm text-slate-200">
                                        <div className="bg-emerald-500/20 p-1 rounded text-emerald-400"><Package size={16} /></div>
                                        建具 (Door)
                                    </button>
                                    <button onClick={handleCreateGeneric} className="w-full text-left px-4 py-3 hover:bg-slate-800 flex items-center gap-3 text-sm text-slate-200">
                                        <div className="bg-amber-500/20 p-1 rounded text-amber-400"><Box size={16} /></div>
                                        建具枠・その他
                                    </button>
                                </div>
                            </>
                        )}
                    </div>

                    <button
                        onClick={onSwitchToExternal}
                        className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-400 px-3 py-1.5 rounded border border-slate-700 transition-colors"
                    >
                        対外説明モードへ (External View)
                    </button>
                </div>
            </div>

            {/* Board Area - Fixed Layout with Flex % */}
            <div className="flex-1 flex gap-2 overflow-hidden pb-2">

                {/* 1. Inbox (25%) */}
                <div
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, 'inbox')}
                    className="flex-[25] bg-slate-900/50 rounded-lg p-2 flex flex-col border border-slate-800 min-w-0"
                >
                    <div className="flex items-center gap-2 px-2 py-2 border-b border-slate-800 mb-2">
                        {getBucketIcon('inbox')}
                        <span className="font-bold text-slate-400 text-sm">Inbox ({inboxItems.length})</span>
                    </div>
                    <div className="flex-1 overflow-y-auto px-1 scrollbar-thin scrollbar-thumb-slate-700">
                        {inboxItems.map(renderCard)}
                    </div>
                </div>

                {/* 2. Waiting (15%) */}
                <div
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, 'waiting')}
                    className="flex-[15] bg-slate-900/50 rounded-lg p-2 flex flex-col border border-slate-800 min-w-0"
                >
                    <div className="flex items-center gap-2 px-2 py-2 border-b border-slate-800 mb-2">
                        {getBucketIcon('waiting')}
                        <span className="font-bold text-amber-500/80 text-sm">Wait ({waitingItems.length})</span>
                    </div>
                    <div className="flex-1 overflow-y-auto px-1 scrollbar-thin scrollbar-thumb-slate-700">
                        {waitingItems.map(renderCard)}
                    </div>
                </div>

                {/* 3. Ready (25%) */}
                <div
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, 'ready')}
                    className={clsx(
                        "flex-[25] rounded-lg p-2 flex flex-col border transition-all min-w-0",
                        readyItems.length > 0 ? "bg-emerald-900/10 border-emerald-500/30" : "bg-slate-900/50 border-slate-800"
                    )}
                >
                    <div className="flex items-center gap-2 px-2 py-2 border-b border-white/5 mb-2">
                        {getBucketIcon('ready')}
                        <span className="font-bold text-emerald-400 text-sm">Ready ({readyItems.length}/2)</span>
                    </div>
                    <div className="flex-1 overflow-y-auto px-1 scrollbar-thin scrollbar-thumb-slate-700">
                        {readyItems.map(renderCard)}
                    </div>
                </div>

                {/* 4. Pending (15%) */}
                <div
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, 'pending')}
                    className="flex-[15] bg-slate-900/30 rounded-lg p-2 flex flex-col border border-slate-800 min-w-0"
                >
                    <div className="flex items-center gap-2 px-2 py-2 border-b border-slate-800 mb-2">
                        {getBucketIcon('pending')}
                        <span className="font-bold text-blue-400/80 text-sm">Pending ({pendingItems.length})</span>
                    </div>
                    <div className="flex-1 overflow-y-auto px-1 scrollbar-thin scrollbar-thumb-slate-700">
                        {pendingItems.map(renderCard)}
                    </div>
                </div>

                {/* 5. Done (20%) [NEW] */}
                <div
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, 'done')}
                    className="flex-[20] bg-slate-900/20 rounded-lg p-2 flex flex-col border border-slate-800 min-w-0 opacity-75 hover:opacity-100 transition-opacity"
                >
                    <div className="flex items-center gap-2 px-2 py-2 border-b border-slate-800 mb-2">
                        {getBucketIcon('done')}
                        <span className="font-bold text-slate-500 text-sm">Done ({doneItems.length})</span>
                    </div>
                    <div className="flex-1 overflow-y-auto px-1 scrollbar-thin scrollbar-thumb-slate-700">
                        {doneItems.map(renderCard)}
                    </div>
                </div>

            </div>

            {/* Generic Item Modal [NEW] */}
            <GenericItemModal
                isOpen={isGenericModalOpen}
                onClose={() => setIsGenericModalOpen(false)}
                onSave={handleSaveGeneric}
                projectId={projectId}
            />
        </div>
    );
};
