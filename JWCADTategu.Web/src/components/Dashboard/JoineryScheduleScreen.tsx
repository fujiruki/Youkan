import React, { useEffect, useState } from 'react';
import { Door, db } from '../../db/db';
import { Project } from '../../db/db';
import { calculateCost } from '../../domain/EstimationService';
import { projectRepository } from '../../repositories/ProjectRepository';
import { PreviewCanvas } from '../Editor/PreviewCanvas';
import { Trash2, Copy, ArrowLeft, Plus } from 'lucide-react';

const DoorPreview: React.FC<{ dim: any }> = ({ dim }) => (
    <div className="w-16 h-16 bg-slate-800 rounded flex items-center justify-center overflow-hidden">
        <PreviewCanvas dimensions={dim} />
    </div>
);

export const JoineryScheduleScreen: React.FC<{ project: Project; onBack: () => void; onOpenDoor: (door: Door) => void; onDeleteProject: (id: number) => void; onUpdateProject: (p: Project) => void }> = ({ project, onBack, onOpenDoor, onDeleteProject, onUpdateProject }) => {
    const [doors, setDoors] = useState<Door[]>([]);
    const [editTableName, setEditTableName] = useState(project.name);
    const [isEditingTitle, setIsEditingTitle] = useState(false);

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

    const updateDoorName = async (id: number, name: string) => {
        const door = doors.find(d => d.id === id);
        if (door) {
            const updated = { ...door, name };
            setDoors(doors.map(d => d.id === id ? updated : d));
            await projectRepository.saveDoor(updated);
        }
    };

    const handleCreateDoor = async () => {
        const newDoor: Door = {
            projectId: project.id!,
            tag: `D-${doors.length + 1}`,
            name: '新規建具',
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
        const id = await projectRepository.saveDoor(newDoor);
        onOpenDoor({ ...newDoor, id }); // Open directly or just load reload?
        // Ideally reload list or jump to editor. Let's look at specs.
        // Usually jump to editor:
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

    const totalEstimate = doors.reduce((acc, d) => acc + calculateCost(d.dimensions, project.settings!).totalCost * d.count, 0);

    return (
        <div className="p-8 h-full bg-slate-950 text-slate-200 overflow-auto">
            {/* Header UI */}
            <div className="flex justify-between items-center mb-8">
                <div className="flex items-center gap-4">
                    <button onClick={onBack} className="text-slate-500 hover:text-white flex items-center gap-2">
                        <ArrowLeft size={20} />
                        一覧に戻る
                    </button>
                    <div className="h-8 w-px bg-slate-800 mx-2"></div>
                    {isEditingTitle ? (
                        <input
                            value={editTableName}
                            onChange={e => setEditTableName(e.target.value)}
                            onBlur={handleProjectNameSave}
                            autoFocus
                            className="bg-slate-800 text-2xl font-bold border border-emerald-500 rounded px-2 text-white"
                        />
                    ) : (
                        <h1 onClick={() => setIsEditingTitle(true)} className="text-2xl font-bold cursor-pointer hover:text-emerald-400 decoration-emerald-500/30 hover:underline hover:underline-offset-4 transition-all">
                            {project.name}
                        </h1>
                    )}
                </div>
                <div className="flex items-center gap-4">
                    <button onClick={handleCreateDoor} className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded flex items-center gap-2 transition-colors shadow-lg shadow-emerald-900/20">
                        <Plus size={20} />
                        新規作成
                    </button>
                    <button onClick={() => onDeleteProject(project.id!)} className="text-red-500 hover:text-red-400 text-sm flex items-center gap-1 opacity-50 hover:opacity-100 transition-opacity">
                        <Trash2 size={14} /> 案件削除
                    </button>
                </div>
            </div>

            {/* Total Calculation */}
            <div className="mb-6 flex justify-end">
                <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl min-w-[200px]">
                    <div className="text-xs text-slate-500 mb-1">見積合計 (Total Estimate)</div>
                    <div className="text-3xl font-bold text-emerald-400 tracking-tight">
                        ¥ {totalEstimate.toLocaleString()}
                    </div>
                </div>
            </div>

            {/* Table UI */}
            <div className="rounded-lg border border-slate-800 overflow-hidden">
                <table className="w-full text-left border-collapse bg-slate-900/30">
                    <thead className="text-xs uppercase bg-slate-900 text-slate-400 font-medium">
                        <tr>
                            <th className="p-4 w-24 text-center">Preview</th>
                            <th className="p-4 w-32">Ref / Tag</th>
                            <th className="p-4">Name</th>
                            <th className="p-4 w-40">Size (WxH)</th>
                            <th className="p-4 text-right w-40">Cost</th>
                            <th className="p-4 w-24 text-center">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/50">
                        {doors.map(door => {
                            const { totalCost } = calculateCost(door.dimensions, project.settings!);

                            return (
                                <tr key={door.id} onClick={() => onOpenDoor(door)} className="hover:bg-slate-800/50 cursor-pointer transition-colors group">
                                    <td className="p-3 text-center">
                                        <DoorPreview dim={door.dimensions} />
                                    </td>
                                    <td className="p-4 font-mono text-emerald-500 font-medium">{door.tag}</td>
                                    <td className="p-4" onClick={e => e.stopPropagation()}>
                                        <input
                                            value={door.name}
                                            onChange={(e) => updateDoorName(door.id!, e.target.value)}
                                            className="bg-transparent border border-transparent hover:border-slate-600 focus:border-emerald-500 rounded px-2 py-1 -ml-2 w-full outline-none text-slate-200 transition-colors"
                                        />
                                    </td>
                                    <td className="p-4 text-slate-400 font-mono text-sm">
                                        {door.dimensions.width} <span className="text-slate-600">x</span> {door.dimensions.height}
                                    </td>
                                    <td className="p-4 font-mono text-right text-slate-300">
                                        ¥ {totalCost.toLocaleString()}
                                    </td>
                                    <td className="p-4">
                                        <div className="flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button
                                                onClick={(e) => handleDuplicate(e, door)}
                                                className="p-2 text-slate-400 hover:text-emerald-400 hover:bg-slate-800 rounded transition-colors"
                                                title="Duplicate"
                                            >
                                                <Copy size={16} />
                                            </button>
                                            <button
                                                onClick={(e) => handleDelete(e, door.id!)}
                                                className="p-2 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded transition-colors"
                                                title="Delete"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                        {doors.length === 0 && (
                            <tr>
                                <td colSpan={6} className="p-12 text-center text-slate-500">
                                    建具が登録されていません。<br />
                                    右上の「新規作成」ボタンなどを作成してください。
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
