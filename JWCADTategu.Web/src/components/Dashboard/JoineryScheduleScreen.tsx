import React, { useEffect, useState } from 'react';
import { Door, db } from '../../db/db';
import { Project } from '../../db/db';
import { calculateCost } from '../../domain/EstimationService';
import { generateDoorDxf } from '../../utils/DxfGenerator';
// import { exportProjectToJson } from '../../utils/ProjectExport';
import { Trash2, Copy, ArrowLeft, Plus, DollarSign, FileDown, Search, Settings, Package, ShoppingBag, Box, Hexagon, Wrench, ChevronDown } from 'lucide-react';
import clsx from 'clsx';
import { ProjectSettingsModal } from './ProjectSettingsModal';
import { FieldNoteList } from './FieldNoteList';
import { GenericItemModal } from './GenericItemModal'; // [NEW]

const DoorPreview: React.FC<{ door: Door }> = ({ door }) => (
    <div className="w-full h-32 bg-slate-900/50 rounded-md flex items-center justify-center overflow-hidden border border-slate-700/50 mb-3 relative group-hover:border-emerald-500/30 transition-colors">
        {/* Floor Line (Mock) */}
        <div className="absolute bottom-4 left-0 right-0 h-px bg-slate-800 z-0"></div>

        {door.thumbnail ? (
            <img src={door.thumbnail} alt={door.name} className="h-[90%] w-auto object-contain z-10 relative" />
        ) : (
            <span className="text-[10px] text-slate-600 text-center leading-tight">No Preview</span>
        )}
    </div>
);

// [NEW] Simplified card for Generic Items
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

// [NEW]
import { DecisionBoard } from './DecisionBoard';

export const JoineryScheduleScreen: React.FC<{ project: Project; onBack: () => void; onOpenDoor: (door: Door) => void; onDeleteProject: (id: number) => void; onUpdateProject: (p: Project) => void }> = ({ project, onBack, onOpenDoor, onDeleteProject, onUpdateProject }) => {
    // Mode State
    const [viewMode, setViewMode] = useState<'internal' | 'external'>('internal');

    const [doors, setDoors] = useState<Door[]>([]);

    // Restored State
    const [editTableName, setEditTableName] = useState(project.name);
    const [isEditingTitle, setIsEditingTitle] = useState(false);
    const [activeTab, setActiveTab] = useState<'products' | 'notes'>('products');

    // UI Options
    const [showCost, setShowCost] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    // const [includeHumanScale, setIncludeHumanScale] = useState(true);
    const [useA3Layout, setUseA3Layout] = useState(true);

    const [isGenericModalOpen, setIsGenericModalOpen] = useState(false);
    const [editingGenericItem, setEditingGenericItem] = useState<Door | null>(null);
    const [isCreateMenuOpen, setIsCreateMenuOpen] = useState(false);

    // [RESTORED] Data Fetching
    const refreshDoors = async () => {
        if (!project.id) return;
        const items = await db.doors.where('projectId').equals(project.id).toArray();
        setDoors(items);
    };

    useEffect(() => {
        refreshDoors();
    }, [project.id]);

    // [RESTORED] Handlers
    const handleProjectNameSave = async () => {
        if (editTableName !== project.name) {
            onUpdateProject({ ...project, name: editTableName });
            if (project.id) {
                await db.projects.update(project.id, { name: editTableName });
            }
        }
        setIsEditingTitle(false);
    };

    const handleCreateDoor = async () => {
        const id = await db.doors.add({
            projectId: project.id!,
            name: '新規建具',
            count: 1,
            dimensions: {
                width: 800,
                height: 2000,
                depth: 36,
                // Default Dimensions
                stileWidth: 30,
                topRailWidth: 30,
                bottomRailWidth: 60,
                middleRailWidth: 30,
                middleRailCount: 0,
                tsukaWidth: 30,
                tsukaCount: 0,
                kumikoVertWidth: 6,
                kumikoVertCount: 0,
                kumikoHorizWidth: 6,
                kumikoHorizCount: 0
            },
            category: 'door',
            type: 'flush',
            tag: 'TBD', // Temporary tag
            specs: {},
            createdAt: new Date(),
            updatedAt: new Date(),
            judgmentStatus: 'inbox'
        });
        const newDoor = await db.doors.get(id);
        if (newDoor) onOpenDoor(newDoor);
        refreshDoors();
    };

    const handleCreateGeneric = () => {
        setEditingGenericItem(null);
        setIsGenericModalOpen(true);
        setIsCreateMenuOpen(false);
    };

    const handleSaveGeneric = async (item: Partial<Door> | Door) => {
        if (item.id) {
            await db.doors.update(item.id, item as any); // Cast for safety
        } else {
            // New Item
            const nonDoors = doors.filter(d => d.category && d.category !== 'door');
            const nextIndex = nonDoors.length + 1;
            const tagPrefix = item.category === 'frame' ? 'W' :
                item.category === 'furniture' ? 'K' :
                    item.category === 'hardware' ? 'H' : 'M';

            await db.doors.add({
                ...(item as Door),
                projectId: project.id!,
                tag: `${tagPrefix}-${nextIndex}`,
                judgmentStatus: 'inbox',
                createdAt: new Date(),
                updatedAt: new Date()
            });
        }
        setIsGenericModalOpen(false);
        refreshDoors();
    };

    // ... (delete/duplicate handlers unchanged)

    const handleDelete = async (e: React.MouseEvent, id: number) => {
        e.stopPropagation();
        if (confirm('本当に削除しますか？')) {
            await db.doors.delete(id);
            refreshDoors();
        }
    };

    const handleDuplicate = async (e: React.MouseEvent, door: Door) => {
        e.stopPropagation();
        const { id, ...rest } = door;
        await db.doors.add({ ...rest, name: `${door.name} (Copy)`, createdAt: new Date() });
        refreshDoors();
    };

    // [NEW] Project Actions
    const handleArchiveProject = async () => {
        if (confirm('このプロジェクトをアーカイブしますか？\n（プロジェクト一覧で非表示になりますが、検索は可能です - 機能未実装）')) {
            onUpdateProject({ ...project, isArchived: true });
            // Ideally navigate back, but let parent handle update
            alert('アーカイブしました');
            onBack();
        }
    };

    const handleDeleteProjectAction = () => {
        if (confirm('【危険】プロジェクトを削除しますか？\nこの操作は取り消せません。\n含まれる全ての建具データも削除されます。')) {
            onDeleteProject(project.id!);
        }
    };

    // [NEW] View Mode Persistence
    useEffect(() => {
        if (project.viewMode) {
            setViewMode(project.viewMode);
        }
    }, []); // Run once on mount

    const handleSwitchViewMode = (mode: 'internal' | 'external') => {
        setViewMode(mode);
        // Persist
        onUpdateProject({ ...project, viewMode: mode });
        db.projects.update(project.id!, { viewMode: mode });
    };

    const handleItemClick = (door: Door) => {
        if (door.category === 'door' || !door.category) {
            onOpenDoor(door);
        } else {
            setEditingGenericItem(door);
            setIsGenericModalOpen(true);
        }
    };

    const handleSaveSettings = (updatedProject: Project) => {
        onUpdateProject(updatedProject);
        setIsSettingsOpen(false);
    };

    const handleExportDxf = async () => {
        const doorsToExport = doors.filter(d => d.category === 'door' || !d.category);
        for (const door of doorsToExport) {
            // Pass array as expected by generateDoorDxf
            // [FIX] Use project.dxfLayerConfig instead of project.settings
            generateDoorDxf([door], project.dxfLayerConfig);
            // ... trigger download logic stub ...
        }
        alert('DXFの一括出力ロジックは実装中です。個別の建具画面から出力してください。');
    };


    // Computations
    const filteredDoors = doors.filter(d =>
        (d.name && d.name.includes(searchQuery)) ||
        (d.tag && d.tag.includes(searchQuery))
    );

    const totalEstimate = filteredDoors.reduce((acc, d) => {
        let cost = 0;
        if (d.category === 'door' || !d.category) {
            if (project.settings) {
                cost = calculateCost(d.dimensions, project.settings).totalCost;
            } else {
                cost = 0; // Or fallback
            }
        } else {
            cost = d.specs?.unitPrice || 0;
        }
        return acc + (cost * d.count);
    }, 0);
    if (viewMode === 'internal') {
        return (
            <div className="h-full flex flex-col">
                {/* Back Link for consistency (optional) */}
                <div className="bg-slate-950 px-4 pt-4 shrink-0">
                    <button
                        onClick={onBack}
                        className="text-slate-500 hover:text-white flex items-center gap-2 text-sm transition-colors"
                    >
                        <ArrowLeft size={16} />
                        プロジェクト一覧に戻る
                    </button>
                </div>
                <div className="flex-1 overflow-hidden">
                    <DecisionBoard
                        projectId={project.id!}
                        onSwitchToExternal={() => handleSwitchViewMode('external')} // [FIX] Use new handler
                    />
                </div>
            </div>
        );
    }

    return (
        <div className="p-8 h-full bg-slate-950 text-slate-200 overflow-auto flex flex-col">
            {/* Header UI */}
            <div className="flex justify-between items-start mb-8 shrink-0">
                <div className="flex flex-col gap-2">
                    <button
                        onClick={onBack}
                        className="text-slate-500 hover:text-white flex items-center gap-2 text-sm transition-colors mb-1"
                    >
                        <ArrowLeft size={16} />
                        プロジェクト一覧に戻る
                    </button>
                    <div className="flex items-center gap-4">
                        {isEditingTitle ? (
                            <input
                                autoFocus
                                type="text"
                                value={editTableName}
                                onChange={(e) => setEditTableName(e.target.value)}
                                onBlur={handleProjectNameSave}
                                onKeyDown={(e) => e.key === 'Enter' && handleProjectNameSave()}
                                className="bg-slate-800 text-slate-200 px-2 py-1 rounded border border-emerald-500 outline-none w-full max-w-md text-3xl font-bold"
                            />
                        ) : (
                            <span onClick={() => setIsEditingTitle(true)} className="text-3xl font-bold cursor-pointer hover:underline decoration-emerald-500/30 underline-offset-4 flex items-center gap-3">
                                {project.name}
                            </span>
                        )}
                        <span className="bg-slate-800 text-slate-400 px-2 py-1 rounded text-xs">
                            {doors.length} items
                        </span>
                    </div>
                </div>

                {/* Right Actions */}
                <div className="flex flex-col items-end gap-3">
                    <div className="flex items-center gap-2">
                        {/* Situation Report Generator */}
                        <button
                            onClick={() => {
                                const inProgressCount = doors.filter(d => d.judgmentStatus === 'pending' || d.judgmentStatus === 'waiting').length;
                                const readyCount = doors.filter(d => d.judgmentStatus === 'ready').length;
                                const progressText = readyCount > 0 ? "現在、鋭意製作中となっております。" :
                                    inProgressCount > 0 ? "順次加工に入っている段階です。" :
                                        "現在、材料の手配と工程の調整を行っております。";

                                const report = `【${project.name} 進捗状況のご報告】\n\n` +
                                    `お世話になっております。\n` +
                                    `${project.client || 'お客様'}邸の建具製作の進捗につきまして、簡単にご報告させていただきます。\n\n` +
                                    `${progressText}\n` +
                                    `引き続き、品質を第一に進めてまいります。\n\n` +
                                    `次回の状況の変化があり次第、改めてご連絡差し上げます。\n` +
                                    `何卒よろしくお願い申し上げます。`;

                                if (navigator.clipboard) {
                                    navigator.clipboard.writeText(report);
                                    alert("以下の内容をクリップボードにコピーしました。\n\n" + report);
                                } else {
                                    prompt("以下の内容をコピーして使用してください", report);
                                }
                            }}
                            className="flex items-center gap-2 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-sm shadow transition-colors"
                        >
                            <FileDown size={16} />
                            状況報告
                        </button>

                        <div className="flex bg-slate-900 rounded-lg p-1 border border-slate-700">
                            <button
                                onClick={() => handleSwitchViewMode('internal')}
                                className={clsx(
                                    "px-3 py-1.5 rounded text-sm font-bold transition-all flex items-center gap-2",
                                    (viewMode as string) === 'internal'
                                        ? "bg-emerald-600 text-white shadow"
                                        : "text-slate-400 hover:text-white"
                                )}
                            >
                                <ArrowLeft size={16} />
                                内部モード
                            </button>
                            <button
                                onClick={() => handleSwitchViewMode('external')}
                                className={clsx(
                                    "px-3 py-1.5 rounded text-sm font-bold transition-all flex items-center gap-2",
                                    viewMode === 'external'
                                        ? "bg-indigo-600 text-white shadow"
                                        : "text-slate-400 hover:text-white"
                                )}
                            >
                                対外説明
                                <ArrowLeft size={16} className="rotate-180" />
                            </button>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        {/* Cost Toggle */}
                        <button
                            onClick={() => setShowCost(!showCost)}
                            className={clsx(
                                "p-2 rounded-md border transition-all flex items-center gap-2 text-sm font-medium",
                                showCost
                                    ? "bg-amber-900/20 border-amber-500/50 text-amber-400"
                                    : "bg-slate-900 border-slate-700 text-slate-500 hover:text-slate-300"
                            )}
                            title="Toggle Cost Visibility"
                        >
                            <DollarSign size={16} />
                        </button>

                        {/* A3 Layout Toggle */}
                        <button
                            onClick={() => setUseA3Layout(!useA3Layout)}
                            className={clsx(
                                "p-2 rounded-md border transition-all flex items-center gap-2 text-sm font-medium",
                                useA3Layout
                                    ? "bg-blue-900/20 border-blue-500/50 text-blue-400"
                                    : "bg-slate-900 border-slate-700 text-slate-500 hover:text-slate-300"
                            )}
                            title="Use A3 Layout"
                        >
                            📄
                        </button>

                        {/* Settings Button */}
                        <div className="relative group">
                            <button
                                onClick={() => setIsSettingsOpen(true)}
                                className="p-2 border border-slate-700 hover:border-emerald-500 text-slate-400 hover:text-emerald-400 rounded-md transition-all"
                            >
                                <Settings size={18} />
                            </button>
                            {/* Dropdown for Project Actions */}
                            <div className="absolute right-0 top-full mt-2 w-48 bg-slate-900 border border-slate-700 rounded-lg shadow-xl overflow-hidden z-30 hidden group-hover:block">
                                <button
                                    onClick={handleArchiveProject}
                                    className="w-full text-left px-4 py-2 hover:bg-slate-800 text-sm text-slate-300 flex items-center gap-2"
                                >
                                    <FileDown size={14} /> アーカイブ
                                </button>
                                <button
                                    onClick={handleDeleteProjectAction}
                                    className="w-full text-left px-4 py-2 hover:bg-red-900/30 text-sm text-red-400 flex items-center gap-2"
                                >
                                    <Trash2 size={14} /> プロジェクト削除
                                </button>
                            </div>
                        </div>

                        {/* JWCAD Export */}
                        <button
                            onClick={handleExportDxf}
                            title="Download DXF"
                            className="bg-sky-700 hover:bg-sky-600 border border-sky-600 text-white px-3 py-1.5 rounded-md flex items-center gap-2 text-sm font-bold shadow-lg shadow-sky-900/20 transition-all"
                        >
                            <FileDown size={16} />
                            DXF
                        </button>

                        {/* Create New Menu */}
                        <div className="relative">
                            <button
                                onClick={() => setIsCreateMenuOpen(!isCreateMenuOpen)}
                                className="bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 rounded-md flex items-center gap-2 text-sm font-bold shadow-lg shadow-emerald-900/20 transition-all ml-2"
                            >
                                <Plus size={16} />
                                追加
                                <ChevronDown size={14} />
                            </button>

                            {isCreateMenuOpen && (
                                <div className="absolute right-0 top-full mt-2 w-48 bg-slate-900 border border-slate-700 rounded-lg shadow-xl overflow-hidden z-20">
                                    <button
                                        onClick={handleCreateDoor}
                                        className="w-full text-left px-4 py-3 hover:bg-slate-800 flex items-center gap-3 text-sm text-slate-200"
                                    >
                                        <div className="bg-emerald-500/20 p-1 rounded text-emerald-400"><Package size={16} /></div>
                                        建具 (Door)
                                    </button>
                                    <button
                                        onClick={handleCreateGeneric}
                                        className="w-full text-left px-4 py-3 hover:bg-slate-800 flex items-center gap-3 text-sm text-slate-200"
                                    >
                                        <div className="bg-amber-500/20 p-1 rounded text-amber-400"><Box size={16} /></div>
                                        建具枠・その他
                                    </button>
                                </div>
                            )}
                            {isCreateMenuOpen && (
                                <div className="fixed inset-0 z-10" onClick={() => setIsCreateMenuOpen(false)}></div>
                            )}
                        </div>
                    </div>

                    {showCost && (
                        <div className="text-sm font-mono text-slate-400 mt-1">
                            Total: <span className="text-amber-400 text-lg font-bold">¥{totalEstimate.toLocaleString()}</span>
                        </div>
                    )}
                </div>
            </div>

            {/* Tab Navigation */}
            < div className="flex gap-1 mb-4 border-b border-slate-800" >
                <button
                    onClick={() => setActiveTab('products')}
                    className={clsx(
                        "px-4 py-2 text-sm font-bold flex items-center gap-2 border-b-2 transition-colors",
                        activeTab === 'products' ? "border-emerald-500 text-emerald-400" : "border-transparent text-slate-500 hover:text-slate-300"
                    )}
                >
                    <Package size={16} />
                    製作物リスト ({doors.length})
                </button>
                <button
                    onClick={() => setActiveTab('notes')}
                    className={clsx(
                        "px-4 py-2 text-sm font-bold flex items-center gap-2 border-b-2 transition-colors",
                        activeTab === 'notes' ? "border-indigo-500 text-indigo-400" : "border-transparent text-slate-500 hover:text-slate-300"
                    )}
                >
                    <FileDown size={16} className="rotate-180" />
                    野帳・写真
                </button>
            </div >

            {
                activeTab === 'products' ? (
                    <>
                        {/* Toolbar (Search) */}
                        <div className="mb-6 flex items-center justify-between shrink-0">
                            <div className="relative group">
                                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-emerald-400 transition-colors" />
                                <input
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="Search items..."
                                    className="bg-slate-900 border border-slate-700 text-sm rounded-full pl-10 pr-4 py-2 w-64 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all placeholder:text-slate-600"
                                />
                            </div>
                        </div>

                        {/* Grid UI */}
                        <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 pb-20">
                            {filteredDoors.map(door => {
                                const isDoor = door.category === 'door' || !door.category;
                                let cost = 0;
                                if (isDoor) {
                                    if (project.settings) {
                                        cost = calculateCost(door.dimensions, project.settings).totalCost * door.count;
                                    } else {
                                        cost = 0;
                                    }
                                } else {
                                    cost = (door.specs?.unitPrice || 0) * door.count;
                                }

                                return (
                                    <div
                                        key={door.id}
                                        onClick={() => handleItemClick(door)}
                                        className="group bg-slate-900 border border-slate-800 hover:border-emerald-500/50 rounded-xl p-4 cursor-pointer transition-all hover:shadow-xl hover:shadow-emerald-900/10 hover:-translate-y-1 relative"
                                    >
                                        {/* Card Header */}
                                        <div className="flex justify-between items-start mb-2">
                                            <div className="bg-slate-800 text-emerald-400 text-xs font-bold px-2 py-0.5 rounded border border-slate-700 font-mono">
                                                {door.tag}
                                            </div>
                                            <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                                                <button
                                                    onClick={(e) => handleDuplicate(e, door)}
                                                    className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded transition-colors"
                                                    title="複製 (Duplicate)"
                                                >
                                                    <Copy size={14} />
                                                </button>
                                                <button
                                                    onClick={(e) => handleDelete(e, door.id!)}
                                                    className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-slate-700 rounded transition-colors"
                                                    title="削除 (Delete)"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        </div>

                                        {/* Preview */}
                                        {isDoor ? (
                                            <DoorPreview door={door} />
                                        ) : (
                                            <GenericItemPreview door={door} />
                                        )}

                                        {/* Card Body */}
                                        <div>
                                            <h3 className="font-bold text-slate-200 mb-1 truncate group-hover:text-emerald-400 transition-colors">{door.name}</h3>
                                            <div className="flex justify-between items-end">
                                                <div className="flex flex-col gap-1">
                                                    <div className="text-xs text-slate-500 font-mono">
                                                        W{door.dimensions.width} x H{door.dimensions.height}
                                                    </div>
                                                    {door.roughTiming && (
                                                        <div className="text-xs text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded inline-block border border-slate-700">
                                                            時期: {door.roughTiming === 'early_month' ? '上旬' :
                                                                door.roughTiming === 'mid_month' ? '中旬' :
                                                                    door.roughTiming === 'late_month' ? '下旬' : '未定'}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                            {showCost && (
                                                <div className="text-sm font-bold text-amber-500 font-mono">
                                                    ¥{cost.toLocaleString()}
                                                </div>
                                            )}
                                        </div>

                                        {/* Selection Effect Border (optional) */}
                                        <div className="absolute inset-0 border-2 border-transparent group-hover:border-emerald-500/20 rounded-xl pointer-events-none"></div>
                                    </div>
                                );
                            })}
                        </div>
                    </>
                ) : (
                    <div className="flex-1 overflow-hidden pb-4">
                        {project.id && <FieldNoteList projectId={project.id!} />}
                    </div>
                )
            }

            {/* Settings Modal */}
            <ProjectSettingsModal
                project={project}
                isOpen={isSettingsOpen}
                onClose={() => setIsSettingsOpen(false)}
                onSave={handleSaveSettings}
            />

            {/* [NEW] Generic Item Modal */}
            <GenericItemModal
                isOpen={isGenericModalOpen}
                onClose={() => setIsGenericModalOpen(false)}
                onSave={handleSaveGeneric}
                initialItem={editingGenericItem}
                projectId={project.id!}
            />
        </div >
    );
};
