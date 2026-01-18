import React, { useState, useEffect } from 'react';
import { Door, db } from '../../../../db/db';
import { Inbox, Hand, Flame, Snowflake, Box, CheckCircle2, Plus, ChevronDown, Package, LayoutGrid, List as ListIcon } from 'lucide-react';
import { clsx } from 'clsx';
import { GenericItemModal } from './GenericItemModal';

interface DecisionBoardProps {
    projectId: number;
    onSwitchToExternal: () => void;
}

type BucketType = 'inbox' | 'waiting' | 'ready' | 'pending';
type ViewMode = 'card' | 'list';

export const DecisionBoard: React.FC<DecisionBoardProps> = ({ projectId, onSwitchToExternal }) => {
    const [doors, setDoors] = useState<Door[]>([]);
    const [viewMode, setViewMode] = useState<ViewMode>('list'); // Default to list for density
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

    const renderCard = (item: Door) => {
        if (viewMode === 'list') {
            return (
                <div
                    key={item.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, item)}
                    className="group flex items-center justify-between px-3 py-1 bg-slate-800/50 hover:bg-slate-700 border-b border-slate-700/50 cursor-grab active:cursor-grabbing text-sm"
                >
                    <div className="flex items-center gap-2 overflow-hidden">
                        <div className={`w-1.5 h-1.5 rounded-full ${item.category === 'door' ? 'bg-emerald-500' : 'bg-blue-500'}`} />
                        <span className="truncate text-slate-300 font-medium group-hover:text-white transition-colors">
                            {item.name}
                        </span>
                    </div>
                    {item.count > 1 && (
                        <span className="text-xs bg-slate-900/50 px-1.5 py-0.5 rounded text-slate-400">
                            x{item.count}
                        </span>
                    )}
                </div>
            );
        }

        return (
            <div
                key={item.id}
                draggable
                onDragStart={(e) => handleDragStart(e, item)}
                className="bg-slate-800 p-2 rounded-md border border-slate-700 shadow-sm hover:border-emerald-500/50 cursor-grab active:cursor-grabbing mb-2 group flex gap-2"
            >
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
                        <span className="font-bold text-sm text-slate-200 truncate pr-1">{item.name}</span>
                        {item.count > 1 && <span className="text-xs px-1 rounded bg-slate-900 text-slate-400">x{item.count}</span>}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                        <span className="font-mono bg-slate-900 px-1 rounded">{item.tag}</span>
                        <span>{item.dimensions.width}×{item.dimensions.height}</span>
                    </div>
                </div>
            </div>
        );
    };

    const renderBucket = (title: string, type: BucketType | 'done', items: Door[], className: string) => (
        <div
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, type)}
            className={clsx(
                "flex flex-col rounded-lg border-2 border-transparent transition-colors duration-200 min-w-[250px]",
                className,
                draggedItem && "hover:border-emerald-500/30"
            )}
        >
            <div className="p-3 border-b border-white/5 flex justify-between items-center shrink-0">
                <div className="flex items-center gap-2">
                    {getBucketIcon(type)}
                    <h3 className="font-bold text-slate-300">{title}</h3>
                    <span className="bg-slate-800 text-slate-400 text-xs px-2 py-0.5 rounded-full">{items.length}</span>
                </div>
            </div>
            <div className="flex-1 p-2 overflow-y-auto">
                <div className={clsx(
                    viewMode === 'list' && "grid grid-cols-1 xl:grid-cols-2 gap-2",
                    viewMode === 'card' && "flex flex-col gap-2"
                )}>
                    {items.length === 0 ? (
                        <div className="h-24 flex items-center justify-center text-slate-600 border-2 border-dashed border-slate-700/50 rounded-lg text-sm italic">
                            No Items
                        </div>
                    ) : (
                        items.map(item => renderCard(item))
                    )}
                </div>
            </div>
        </div>
    );

    return (
        <div className="h-full flex flex-col bg-slate-950 text-slate-200">
            {/* Flash Message */}
            {flashMessage && (
                <div className="absolute top-10 left-1/2 -translate-x-1/2 bg-emerald-500/90 text-white px-6 py-3 rounded-full shadow-2xl z-50 flex items-center gap-2 font-bold backdrop-blur animate-in fade-in slide-in-from-top-4">
                    <CheckCircle2 size={20} />
                    {flashMessage}
                </div>
            )}

            {/* Header */}
            <div className="bg-slate-900 border-b border-slate-800 p-4 flex justify-between items-center shrink-0">
                <div className="flex items-center gap-4">
                    <h2 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 to-cyan-400">
                        Global Decision Board
                    </h2>

                    {/* View Mode Toggle */}
                    <div className="flex bg-slate-800 rounded p-1 border border-slate-700">
                        <button
                            onClick={() => setViewMode('card')}
                            className={clsx(
                                "p-1.5 rounded transition-colors",
                                viewMode === 'card' ? "bg-slate-700 text-white" : "text-slate-400 hover:text-slate-200"
                            )}
                            title="Card View"
                        >
                            <LayoutGrid size={18} />
                        </button>
                        <button
                            onClick={() => setViewMode('list')}
                            className={clsx(
                                "p-1.5 rounded transition-colors",
                                viewMode === 'list' ? "bg-slate-700 text-white" : "text-slate-400 hover:text-slate-200"
                            )}
                            title="List View"
                        >
                            <ListIcon size={18} />
                        </button>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    {/* Create Button */}
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
                        対外説明モードへ
                    </button>
                </div>
            </div>

            {/* Board Area */}
            <div className="flex-1 flex gap-2 overflow-hidden p-4">
                {renderBucket('Inbox', 'inbox', inboxItems, 'flex-[25] bg-slate-900/50')}
                {renderBucket('Wait', 'waiting', waitingItems, 'flex-[15] bg-slate-900/50')}
                {renderBucket(
                    `Ready (${readyItems.length}/2)`,
                    'ready',
                    readyItems,
                    clsx('flex-[25]', readyItems.length > 0 ? "bg-emerald-900/10 border-emerald-500/30" : "bg-slate-900/50 border-slate-800")
                )}
                {renderBucket('Pending', 'pending', pendingItems, 'flex-[15] bg-slate-900/50')}
                {renderBucket('Done', 'done', doneItems, 'flex-[20] bg-slate-900/20 opacity-75 hover:opacity-100')}
            </div>

            <GenericItemModal
                isOpen={isGenericModalOpen}
                onClose={() => setIsGenericModalOpen(false)}
                onSave={handleSaveGeneric}
                projectId={projectId}
            />
        </div>
    );
};
