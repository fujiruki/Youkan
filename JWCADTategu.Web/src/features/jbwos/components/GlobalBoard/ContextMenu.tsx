import React, { useEffect, useRef } from 'react';
import { Trash2, Edit2, PlayCircle, PauseCircle } from 'lucide-react';

interface ContextMenuProps {
    x: number;
    y: number;
    itemId: string;
    onClose: () => void;
    onDelete: (id: string) => void;
    onEdit: (id: string) => void; // Rename or Open Detail
}

export const ContextMenu: React.FC<ContextMenuProps> = ({ x, y, itemId, onClose, onDelete, onEdit }) => {
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) {
                onClose();
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [onClose]);

    return (
        <div
            ref={ref}
            className="fixed z-[9999] bg-white dark:bg-slate-800 rounded-lg shadow-xl border border-slate-200 dark:border-slate-700 py-1 min-w-[160px] animate-in fade-in zoom-in-95 duration-100"
            style={{ top: y, left: x }}
            onContextMenu={(e) => e.preventDefault()}
        >
            <button
                onClick={() => { onEdit(itemId); onClose(); }}
                className="w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2"
            >
                <Edit2 size={14} className="text-slate-400" />
                詳細 / 名前変更
            </button>
            <div className="h-px bg-slate-100 dark:bg-slate-700 my-1" />
            <button
                onClick={() => {
                    if (confirm('削除しますか？')) {
                        onDelete(itemId);
                        onClose();
                    }
                }}
                className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2"
            >
                <Trash2 size={14} />
                削除 (Delete)
            </button>
        </div>
    );
};
