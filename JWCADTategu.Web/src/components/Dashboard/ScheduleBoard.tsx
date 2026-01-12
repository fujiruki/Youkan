import React, { useEffect, useState } from 'react';
import { db, Door, Project, Task } from '../../db/db';
import { KanbanSquare, CheckCircle2, Clock, Hammer, Calendar } from 'lucide-react';
import clsx from 'clsx';

import { GanttChart } from './GanttChart';

export type ScheduleItem = {
    type: 'door' | 'task';
    id: number;
    projectId: number;
    projectName: string;
    title: string;
    status: 'design' | 'production' | 'completed'; // mapped from todo/doing/done for tasks
    startDate?: Date;
    dueDate?: Date;
    manHours?: number;
};

const COLUMNS = [
    { id: 'design', label: 'Estimating / Design', icon: <Clock size={18} />, color: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
    { id: 'production', label: 'Production', icon: <Hammer size={18} />, color: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
    { id: 'completed', label: 'Completed', icon: <CheckCircle2 size={18} />, color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' }
] as const;

export const ScheduleBoard: React.FC = () => {
    const [items, setItems] = useState<ScheduleItem[]>([]);
    const [viewMode, setViewMode] = useState<'kanban' | 'gantt'>('kanban');

    const loadData = async () => {
        const projects = await db.projects.toArray();
        const doors = await db.doors.toArray();
        const tasks = await db.tasks.toArray();

        const projectMap = new Map(projects.map(p => [p.id!, p.name]));

        const mappedItems: ScheduleItem[] = [];

        // Map Doors
        doors.forEach(d => {
            mappedItems.push({
                type: 'door',
                id: d.id!,
                projectId: d.projectId,
                projectName: projectMap.get(d.projectId) || 'Unknown',
                title: d.name,
                status: d.status || 'design',
                startDate: d.startDate,
                dueDate: d.dueDate,
                manHours: d.manHours
            });
        });

        // Map Tasks
        tasks.forEach(t => {
            let status: 'design' | 'production' | 'completed' = 'design';
            if (t.status === 'doing') status = 'production';
            if (t.status === 'done') status = 'completed';

            mappedItems.push({
                type: 'task',
                id: t.id!,
                projectId: t.projectId,
                projectName: projectMap.get(t.projectId) || 'Unknown',
                title: t.title,
                status: status,
                dueDate: t.dueDate,
                manHours: t.manHours
            });
        });

        setItems(mappedItems);
    };

    useEffect(() => { loadData(); }, []);

    const handleStatusMove = async (item: ScheduleItem, newStatus: 'design' | 'production' | 'completed') => {
        // Optimistic UI
        setItems(prev => prev.map(i => i.id === item.id && i.type === item.type ? { ...i, status: newStatus } : i));

        if (item.type === 'door') {
            await db.doors.update(item.id, { status: newStatus });
        } else {
            let taskStatus: 'todo' | 'doing' | 'done' = 'todo';
            if (newStatus === 'production') taskStatus = 'doing';
            if (newStatus === 'completed') taskStatus = 'done';
            await db.tasks.update(item.id, { status: taskStatus });
        }
    };

    return (
        <div className="h-full flex flex-col">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    {viewMode === 'kanban' ? <KanbanSquare size={24} className="text-emerald-500" /> : <Calendar size={24} className="text-emerald-500" />}
                    Project Schedule
                </h2>
                <div className="flex bg-slate-800 rounded mx-4 p-1">
                    <button
                        onClick={() => setViewMode('kanban')}
                        className={clsx("px-3 py-1 text-sm rounded transition-colors flex items-center gap-2", viewMode === 'kanban' ? "bg-slate-700 text-white shadow" : "text-slate-400 hover:text-white")}
                    >
                        <KanbanSquare size={16} />
                        Kanban
                    </button>
                    <button
                        onClick={() => setViewMode('gantt')}
                        className={clsx("px-3 py-1 text-sm rounded transition-colors flex items-center gap-2", viewMode === 'gantt' ? "bg-slate-700 text-white shadow" : "text-slate-400 hover:text-white")}
                    >
                        <Calendar size={16} />
                        Gantt
                    </button>
                </div>
                <button
                    onClick={loadData}
                    className="text-xs text-slate-400 hover:text-white bg-slate-800 px-3 py-1 rounded"
                >
                    Refresh
                </button>
            </div>

            {viewMode === 'kanban' ? (
                <div className="flex-1 grid grid-cols-3 gap-6 overflow-hidden">
                    {COLUMNS.map(col => (
                        <div key={col.id} className="flex flex-col h-full bg-slate-900/50 rounded-xl border border-slate-800 overflow-hidden">
                            {/* Column Header */}
                            <div className={`p-4 border-b border-slate-800 flex items-center justify-between font-bold ${col.color.split(' ')[1]}`}>
                                <div className="flex items-center gap-2">
                                    {col.icon}
                                    {col.label}
                                </div>
                                <span className="bg-slate-900 px-2 py-0.5 rounded text-xs opacity-70">
                                    {items.filter(i => i.status === col.id).length}
                                </span>
                            </div>

                            {/* Column Content */}
                            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
                                {items.filter(i => i.status === col.id).map(item => (
                                    <div key={`${item.type}-${item.id}`} className="bg-slate-800 border border-slate-700 p-3 rounded shadow hover:border-slate-500 transition-colors group relative">
                                        <div className="text-[10px] text-slate-500 uppercase flex justify-between">
                                            <span>{item.projectName}</span>
                                            <span className={item.type === 'door' ? 'text-emerald-500' : 'text-amber-500'}>
                                                {item.type.toUpperCase()}
                                            </span>
                                        </div>
                                        <div className="font-bold text-slate-200 mt-1 mb-2">
                                            {item.title}
                                        </div>

                                        <div className="flex items-center justify-between text-xs text-slate-400">
                                            <div className="flex items-center gap-1">
                                                {item.dueDate ? (
                                                    <>
                                                        <Calendar size={12} />
                                                        {item.dueDate.toLocaleDateString()}
                                                    </>
                                                ) : (
                                                    <span className="opacity-50">No Date</span>
                                                )}
                                            </div>
                                            {item.manHours && <span>{item.manHours}h</span>}
                                        </div>

                                        {/* Action Buttons (Simple) */}
                                        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 flex gap-1">
                                            {col.id !== 'design' && (
                                                <button
                                                    onClick={() => handleStatusMove(item, 'design')}
                                                    className="bg-slate-700 hover:bg-slate-600 p-1 rounded text-slate-300"
                                                    title="Back to Design"
                                                >
                                                    &lt;
                                                </button>
                                            )}
                                            {col.id !== 'production' && (
                                                <button
                                                    onClick={() => handleStatusMove(item, 'production')}
                                                    className="bg-slate-700 hover:bg-slate-600 p-1 rounded text-slate-300"
                                                    title="Move to Production"
                                                >
                                                    {col.id === 'design' ? '>' : '<'}
                                                </button>
                                            )}
                                            {col.id !== 'completed' && (
                                                <button
                                                    onClick={() => handleStatusMove(item, 'completed')}
                                                    className="bg-slate-700 hover:bg-slate-600 p-1 rounded text-slate-300"
                                                    title="Mark Done"
                                                >
                                                    &gt;
                                                </button>
                                            )}
                                        </div>

                                    </div>
                                ))}
                                {items.filter(i => i.status === col.id).length === 0 && (
                                    <div className="text-center text-slate-600 text-sm mt-10">No Items</div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="flex-1 overflow-hidden">
                    <GanttChart items={items} />
                </div>
            )}
        </div>
    );
};
