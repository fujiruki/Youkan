import React, { useState } from 'react';
import { Plus, CheckCircle2, Circle } from 'lucide-react';
import { Item } from '../../types';
import { useSubtasks } from '../../hooks/useSubtasks';
import { cn } from '../../../../../lib/utils'; // Keep shared utils path

interface SubtaskListWidgetProps {
    parentId: string;
    defaultProjectId?: string;
    defaultTenantId?: string;
    onNavigate: (item: Item) => void;
    className?: string;
}

export const SubtaskListWidget: React.FC<SubtaskListWidgetProps> = ({
    parentId,
    defaultProjectId,
    defaultTenantId,
    onNavigate,
    className
}) => {
    const { subtasks, loading, addSubtask } = useSubtasks(parentId, defaultProjectId, defaultTenantId);
    const [inputValue, setInputValue] = useState('');

    const handleKeyDown = async (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            if (inputValue.trim()) {
                await addSubtask(inputValue.trim());
                setInputValue('');
            }
        }
    };

    return (
        <div className={cn("flex flex-col gap-2", className)}>
            <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                    <div className="w-1 h-2.5 bg-slate-400 rounded-full"></div>
                    サブタスク
                </span>
                <span className="text-[10px] text-slate-300 font-mono">
                    {subtasks.filter(t => t.status === 'done').length}/{subtasks.length}
                </span>
            </div>

            {/* Input Area */}
            <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg p-1.5 focus-within:ring-1 focus-within:ring-indigo-400 transition-all">
                <Plus size={16} className="text-slate-400 ml-1" />
                <input
                    type="text"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="サブタスクを追加..."
                    className="flex-1 bg-transparent text-xs outline-none placeholder:text-slate-400 dark:text-slate-200"
                />
                <button
                    onClick={async () => {
                        if (inputValue.trim()) {
                            await addSubtask(inputValue.trim());
                            setInputValue('');
                        }
                    }}
                    className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded text-slate-400 hover:text-indigo-500 transition-colors"
                    disabled={!inputValue.trim()}
                >
                    <span className="text-[10px] font-bold">ADD</span>
                </button>
            </div>

            {/* Subtask List */}
            <div className="flex flex-col gap-1 min-h-[60px]">
                {loading && subtasks.length === 0 ? (
                    <div className="text-center py-4 text-xs text-slate-300">Loading...</div>
                ) : subtasks.length === 0 ? (
                    <div className="text-center py-4 text-xs text-slate-300 border border-dashed border-slate-100 dark:border-slate-800 rounded-lg">
                        サブタスクはありません
                    </div>
                ) : (
                    subtasks.map(task => {
                        const isDone = task.status === 'done';
                        return (
                            <div
                                key={task.id}
                                onClick={() => onNavigate(task)}
                                className={cn(
                                    "group flex items-center gap-2 p-2 rounded-md border border-transparent hover:border-slate-100 dark:hover:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer transition-all",
                                    isDone && "opacity-60"
                                )}
                            >
                                <div className={cn(
                                    "flex-none transition-colors",
                                    isDone ? "text-slate-300" : "text-slate-400 group-hover:text-indigo-400"
                                )}>
                                    {isDone ? <CheckCircle2 size={14} /> : <Circle size={14} />}

                                </div>
                                <span className={cn(
                                    "flex-1 text-xs truncate",
                                    isDone ? "text-slate-400 line-through" : "text-slate-700 dark:text-slate-300"
                                )}>
                                    {task.title}
                                </span>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
};
