import React, { useEffect, useState } from 'react';
import { Door, db } from '../../db/db';
import { Project } from '../../db/db';
import { calculateCost } from '../../domain/EstimationService';
import { projectRepository } from '../../repositories/ProjectRepository';
import { generateDoorDxf } from '../../utils/DxfGenerator';
import { exportProjectToJson, generateExportFilename } from '../../utils/ProjectExport';
import { debugLog } from '../../config/debug';
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

export const JoineryScheduleScreen: React.FC<{ project: Project; onBack: () => void; onOpenDoor: (door: Door) => void; onDeleteProject: (id: number) => void; onUpdateProject: (p: Project) => void }> = ({ project, onBack, onOpenDoor, onDeleteProject, onUpdateProject }) => {
    const [doors, setDoors] = useState<Door[]>([]);
    const [editTableName, setEditTableName] = useState(project.name);
    const [isEditingTitle, setIsEditingTitle] = useState(false);
    const [activeTab, setActiveTab] = useState<'products' | 'notes'>('products'); // [CHANGED] 'doors' -> 'products'

    // UI Options
    const [showCost, setShowCost] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [includeHumanScale, setIncludeHumanScale] = useState(true);
    const [useA3Layout, setUseA3Layout] = useState(true);

    // [NEW] Generic Item Modal State
    const [isGenericModalOpen, setIsGenericModalOpen] = useState(false);
    const [editingGenericItem, setEditingGenericItem] = useState<Door | null>(null);
    const [isCreateMenuOpen, setIsCreateMenuOpen] = useState(false);

    const loadDoors = async () => {
        if (project.id) {
            const loaded = await db.doors.where('projectId').equals(project.id).toArray();
            setDoors(loaded);
        }
    };

    useEffect(() => {
        loadDoors();
    }, [project.id]);

    const handleProjectNameSave = async () => {
        const updated = { ...project, name: editTableName };
        await projectRepository.saveProject(updated);
        onUpdateProject(updated);
        setIsEditingTitle(false);
    };

    const handleCreateDoor = async () => {
        const newDoor: Door = {
            projectId: project.id!,
            tag: `D-${doors.length + 1}`,
            name: '新規建具',
            category: 'door', // [NEW]
            count: 1,
            dimensions: {
                width: 800, height: 2000, depth: 30,
                stileWidth: 100, topRailWidth: 100, bottomRailWidth: 200,
                middleRailCount: 0, middleRailWidth: 30,
                tsukaCount: 0, tsukaWidth: 30,
                kumikoVertCount: 0, kumikoVertWidth: 6,
                kumikoHorizCount: 0, kumikoHorizWidth: 6
            },
            specs: {},
            createdAt: new Date(),
            updatedAt: new Date()
        };
        try {
            const id = await projectRepository.saveDoor(newDoor);
            onOpenDoor({ ...newDoor, id });
            setIsCreateMenuOpen(false);
        } catch (e) {
            console.error('[Schedule] Failed to save door', e);
        }
    };

    const handleCreateGeneric = () => {
        setEditingGenericItem(null);
        setIsGenericModalOpen(true);
        setIsCreateMenuOpen(false);
    };

    const handleSaveGeneric = async (item: Partial<Door>) => {
        if (item.id) {
            await db.doors.update(item.id, item);
        } else {
            // Generate Tag for Generic Item
            const nonDoors = doors.filter(d => d.category && d.category !== 'door');
            // Simple tagging: O-{Index} for "Other/Generic"
            // Or better, just continue numeric sequence but maybe prefix? 
            // Let's use simple logic: "M-{index}" for Miscellaneous/Material
            const nextIndex = nonDoors.length + 1;
            const itemWithTag = {
                ...item,
                tag: item.tag === 'GEN-?' ? `M-${nextIndex}` : item.tag
            } as Door;
            await db.doors.add(itemWithTag);
        }
        loadDoors();
    };

    const handleDuplicate = async (e: React.MouseEvent, door: Door) => {
        e.stopPropagation();
        const { id, ...rest } = door;
        const newDoor: Door = {
            ...rest,
            name: `${door.name} (Copy)`,
            tag: `${door.tag}-CP`,
            createdAt: new Date(),
            updatedAt: new Date()
        };
        await projectRepository.saveDoor(newDoor);
        loadDoors();
    };

    const handleDelete = async (e: React.MouseEvent, id: number) => {
        e.stopPropagation();
        if (window.confirm('本当に削除しますか？')) {
            await db.doors.delete(id);
            loadDoors();
        }
    };

    // Filter Doors
    const filteredDoors = doors.filter(d =>
        d.name.includes(searchQuery) || d.tag.includes(searchQuery)
    );

    const totalEstimate = doors.reduce((acc, d) => {
        if (d.category === 'door' || !d.category) { // Default or Explicit Door
            return acc + calculateCost(d.dimensions, project.settings!).totalCost * d.count;
        } else {
            // Generic Item Price (stored in specs.unitPrice temporarily)
            const price = d.specs?.unitPrice || 0;
            return acc + (price * d.count);
        }
    }, 0);

    const handleExportDxf = () => {
        // Only export actual doors for now
        const exportableDoors = filteredDoors.filter(d => d.category === 'door' || !d.category);

        if (exportableDoors.length === 0) {
            alert('DXF出力可能な建具がありません。\n(No doors to export)');
            return;
        }

        const dxfContent = generateDoorDxf(
            exportableDoors,
            project.dxfLayerConfig,
            undefined,
            { includeHumanScale, useA3Layout }
        );

        const blob = new Blob([dxfContent], { type: 'application/dxf' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${project.name}_${new Date().toISOString().slice(0, 10)}.dxf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const handleExportJson = () => {
        debugLog('PROJECT_EXPORT', `Exporting project: ${project.name}`, {
            doorCount: doors.length,
            projectId: project.id,
            settings: project.settings
        });

        const jsonContent = exportProjectToJson(project, doors);

        const blob = new Blob([jsonContent], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = generateExportFilename(project.name);
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const handleSaveSettings = async (updatedProject: Project) => {
        await projectRepository.saveProject(updatedProject);
        onUpdateProject(updatedProject);
    };

    const handleItemClick = (door: Door) => {
        if (door.category === 'door' || !door.category) {
            onOpenDoor(door);
        } else {
            setEditingGenericItem(door);
            setIsGenericModalOpen(true);
        }
    };

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
                                value={editTableName}
                                onChange={e => setEditTableName(e.target.value)}
                                onBlur={handleProjectNameSave}
                                autoFocus
                                className="bg-slate-800 text-3xl font-bold border border-emerald-500 rounded px-2 text-white outline-none"
                            />
                        ) : (
                            <h1
                                onClick={() => setIsEditingTitle(true)}
                                className="text-3xl font-bold cursor-pointer hover:text-emerald-400 decoration-emerald-500/30 hover:underline hover:underline-offset-4 transition-all"
                            >
                                {project.name}
                            </h1>
                        )}
                        <span className="bg-slate-800 text-slate-400 px-2 py-1 rounded text-xs">
                            {doors.length} items
                        </span>
                    </div>
                </div>

                {/* Right Actions */}
                <div className="flex flex-col items-end gap-3">
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
                            {showCost ? 'ON' : 'OFF'}
                        </button>

                        {/* Human Scale Toggle */}
                        <button
                            onClick={() => setIncludeHumanScale(!includeHumanScale)}
                            className={clsx(
                                "p-2 rounded-md border transition-all flex items-center gap-2 text-sm font-medium",
                                includeHumanScale
                                    ? "bg-emerald-900/20 border-emerald-500/50 text-emerald-400"
                                    : "bg-slate-900 border-slate-700 text-slate-500 hover:text-slate-300"
                            )}
                            title="Include Human Scale Figure in DXF"
                        >
                            👤
                            {includeHumanScale ? 'ON' : 'OFF'}
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
                            title="Use A3 Layout (2×3 Grid)"
                        >
                            📄
                            {useA3Layout ? 'A3' : 'リニア'}
                        </button>

                        {/* Settings Button */}
                        <button
                            onClick={() => setIsSettingsOpen(true)}
                            title="Project Settings"
                            className="p-2 border border-slate-700 hover:border-emerald-500 text-slate-400 hover:text-emerald-400 rounded-md transition-all"
                        >
                            <Settings size={18} />
                        </button>


                        {/* JWCAD Export */}
                        <button
                            onClick={handleExportDxf}
                            title="Download DXF (JWCAD Compatible)"
                            className="bg-sky-700 hover:bg-sky-600 border border-sky-600 text-white px-4 py-2 rounded-md flex items-center gap-2 text-sm font-bold shadow-lg shadow-sky-900/20 transition-all"
                        >
                            <FileDown size={18} />
                            DXF出力
                        </button>

                        {/* JSON Export (Backup) */}
                        <button
                            onClick={handleExportJson}
                            title="プロジェクトデータをJSON形式でバックアップ"
                            className="bg-purple-700 hover:bg-purple-600 border border-purple-600 text-white px-4 py-2 rounded-md flex items-center gap-2 text-sm font-bold shadow-lg shadow-purple-900/20 transition-all"
                        >
                            <Package size={18} />
                            JSON出力
                        </button>

                        {/* Create New Menu */}
                        <div className="relative">
                            <button
                                onClick={() => setIsCreateMenuOpen(!isCreateMenuOpen)}
                                className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-md flex items-center gap-2 text-sm font-bold shadow-lg shadow-emerald-900/20 transition-all ml-2"
                            >
                                <Plus size={18} />
                                製作物を追加
                                <ChevronDown size={16} />
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
                        <div className="text-sm font-mono text-slate-400">
                            Total: <span className="text-amber-400 text-lg font-bold">¥{totalEstimate.toLocaleString()}</span>
                        </div>
                    )}
                </div>
            </div>

            {/* Tab Navigation */}
            <div className="flex gap-1 mb-4 border-b border-slate-800">
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
            </div>

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
                                const cost = isDoor
                                    ? calculateCost(door.dimensions, project.settings!).totalCost * door.count
                                    : (door.specs?.unitPrice || 0) * door.count;

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
                                                <div className="text-xs text-slate-500 font-mono">
                                                    W{door.dimensions.width} x H{door.dimensions.height}
                                                </div>
                                                {showCost && (
                                                    <div className="text-sm font-bold text-amber-500 font-mono">
                                                        ¥{cost.toLocaleString()}
                                                    </div>
                                                )}
                                            </div>
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
