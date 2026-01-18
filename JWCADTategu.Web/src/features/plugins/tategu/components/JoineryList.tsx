import React from 'react';
import { Door, Project } from '../../../../db/db';
import { calculateCost } from '../domain/EstimationService';
import { Trash2, Copy, Plus, DollarSign, Box, ShoppingBag, Hexagon, Wrench } from 'lucide-react';
import clsx from 'clsx';

import { JoineryTab } from './JoineryTabs';

interface JoineryListProps {
    project?: Project; // Make optional if not used critically
    doors: Door[];
    activeTab?: JoineryTab;
    searchQuery: string;
    showCost: boolean;
    onOpenDoor: (door: Door) => void;
    onDuplicate: (e: React.MouseEvent, door: Door) => void;
    onDelete: (e: React.MouseEvent, id: number) => void;
    onGenericEdit: (door: Door) => void;
    onCreateDoor: () => void;
    onCreateGeneric: () => void;
}

const DoorPreview: React.FC<{ door: Door }> = ({ door }) => (
    <div className="w-full h-32 bg-slate-900/50 rounded-md flex items-center justify-center overflow-hidden border border-slate-700/50 mb-3 relative group-hover:border-emerald-500/30 transition-colors">
        <div className="absolute bottom-4 left-0 right-0 h-px bg-slate-800 z-0"></div>
        {door.thumbnail ? (
            <img src={door.thumbnail} alt={door.name} className="h-[90%] w-auto object-contain z-10 relative" />
        ) : (
            <span className="text-[10px] text-slate-600 text-center leading-tight">No Preview</span>
        )}
    </div>
);

const GenericItemPreview: React.FC<{ door: Door }> = ({ door }) => {
    const getIcon = () => {
        switch (door.category) {
            case 'frame': return <Box size={40} className="text-amber-500/50" />;
            case 'furniture': return <ShoppingBag size={40} className="text-indigo-500/50" />;
            case 'hardware': return <Hexagon size={40} className="text-slate-500/50" />;
            default: return <Wrench size={40} className="text-emerald-500/50" />;
        }
    };

    return (
        <div className="w-full h-32 bg-slate-900/50 rounded-md flex items-center justify-center overflow-hidden border border-slate-700/50 mb-3 relative group-hover:border-emerald-500/30 transition-colors">
            {getIcon()}
            {door.category !== 'door' && (
                <div className="absolute bottom-2 right-2 text-[10px] text-slate-600 font-mono uppercase">
                    {door.category}
                </div>
            )}
        </div>
    );
};

export const JoineryList: React.FC<JoineryListProps> = ({
    project,
    doors,
    searchQuery,
    showCost,
    onOpenDoor,
    onDuplicate,
    onDelete,
    onGenericEdit,
    onCreateDoor,
    onCreateGeneric
}) => {
    const filteredDoors = doors.filter(d =>
        (d.name && d.name.includes(searchQuery)) ||
        (d.tag && d.tag.includes(searchQuery))
    );

    return (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-6 pb-20">
            {/* Create Actions */}
            <div className="aspect-[3/4] rounded-xl border-2 border-dashed border-slate-800 hover:border-emerald-500/50 hover:bg-slate-900/50 transition-all cursor-pointer group flex flex-col items-center justify-center gap-4">
                <button
                    onClick={onCreateDoor}
                    className="flex flex-col items-center gap-2 p-4 hover:bg-slate-800 rounded-lg transition-colors w-full"
                >
                    <div className="w-12 h-12 rounded-full bg-slate-800 group-hover:bg-emerald-500/20 text-slate-500 group-hover:text-emerald-400 flex items-center justify-center transition-colors">
                        <Plus size={24} />
                    </div>
                    <span className="text-sm font-medium text-slate-500 group-hover:text-slate-300">新規建具を作成</span>
                </button>
                <div className="w-full h-px bg-slate-800 w-3/4"></div>
                <button
                    onClick={onCreateGeneric}
                    className="flex flex-col items-center gap-2 p-2 hover:bg-slate-800 rounded-lg transition-colors w-full"
                >
                    <span className="text-xs font-medium text-slate-600 group-hover:text-slate-400">その他の項目を追加</span>
                </button>
            </div>

            {/* List */}
            {filteredDoors.map(door => {
                const isGeneric = door.category && door.category !== 'door';
                const cost = isGeneric
                    ? (door.specs?.unitPrice || 0) * (door.count || 1)
                    : (project?.settings ? calculateCost(door.dimensions, project.settings).totalCost : 0) * (door.count || 1);

                return (
                    <div
                        key={door.id}
                        onClick={() => isGeneric ? onGenericEdit(door) : onOpenDoor(door)}
                        className="bg-slate-900 rounded-xl border border-slate-800 hover:border-emerald-500/50 hover:shadow-lg hover:shadow-emerald-500/10 transition-all cursor-pointer group flex flex-col p-4 relative"
                    >
                        <div className="absolute top-4 right-4 z-20 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-900/80 p-1 rounded backdrop-blur-sm">
                            <button
                                onClick={(e) => onDuplicate(e, door)}
                                className="p-1.5 hover:bg-slate-700 rounded text-slate-400 hover:text-white"
                                title="複製"
                            >
                                <Copy size={14} />
                            </button>
                            <button
                                onClick={(e) => onDelete(e, door.id!)}
                                className="p-1.5 hover:bg-red-900/50 rounded text-slate-400 hover:text-red-400"
                                title="削除"
                            >
                                <Trash2 size={14} />
                            </button>
                        </div>

                        {/* Tag */}
                        <div className="flex justify-between items-start mb-2">
                            <span className="font-mono text-xs text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded">
                                {door.tag || 'TBD'}
                            </span>
                            {showCost && (
                                <span className="font-mono text-xs text-amber-500 flex items-center gap-1">
                                    <DollarSign size={10} />
                                    {Math.round(cost).toLocaleString()}
                                </span>
                            )}
                        </div>

                        {/* Preview */}
                        {isGeneric ? <GenericItemPreview door={door} /> : <DoorPreview door={door} />}

                        {/* Info */}
                        <div>
                            <h3 className="font-bold text-slate-200 mb-1 truncate">{door.name}</h3>
                            <div className="flex justify-between items-end">
                                <span className={clsx(
                                    "text-xs px-2 py-0.5 rounded-full border",
                                    isGeneric ? "bg-indigo-500/10 text-indigo-400 border-indigo-500/20" : "bg-slate-800 text-slate-400 border-slate-700"
                                )}>
                                    {isGeneric ? (door.category === 'frame' ? '枠材' : door.category === 'furniture' ? '家具' : '金物') : door.type}
                                </span>
                                <span className="text-sm font-mono text-slate-500">
                                    x{door.count}
                                </span>
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
};
