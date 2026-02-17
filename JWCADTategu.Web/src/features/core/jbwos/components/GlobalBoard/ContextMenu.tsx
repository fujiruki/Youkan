import React, { useEffect, useRef } from 'react';
import { Trash2, Edit2 } from 'lucide-react';

interface ContextMenuAction {
    label: string;
    onClick: () => void;
    danger?: boolean;
    icon?: React.ReactNode;
}

interface ContextMenuProps {
    x: number;
    y: number;
    itemId: string;
    onClose: () => void;
    onDelete?: (id: string) => void;
    onEdit?: (id: string) => void; // Rename or Open Detail
    actions?: ContextMenuAction[]; // [NEW] Generic Actions
}

export const ContextMenu: React.FC<ContextMenuProps> = ({ x, y, itemId, onClose, onDelete, onEdit, actions }) => {
    const ref = useRef<HTMLDivElement>(null);
    const [position, setPosition] = React.useState({ x, y });
    const [isVisible, setIsVisible] = React.useState(false);

    // Update position when props change (reset)
    React.useLayoutEffect(() => {
        setPosition({ x, y });
        setIsVisible(false);
    }, [x, y]);

    // Adjust position based on viewport
    React.useLayoutEffect(() => {
        if (!ref.current) return;

        const el = ref.current;
        const rect = el.getBoundingClientRect();
        const winW = window.innerWidth;
        const winH = window.innerHeight;

        let newX = x;
        let newY = y;

        // Check vertical overflow
        if (y + rect.height > winH) {
            newY = Math.max(0, y - rect.height); // Flip up (ensure not negative)
        }

        // Check horizontal overflow
        if (x + rect.width > winW) {
            newX = Math.max(0, x - rect.width); // Flip left (ensure not negative)
        }

        setPosition({ x: newX, y: newY });
        setIsVisible(true);
    }, [x, y]); // Re-run when props x/y change (though reset effect also runs)

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Delete') {
                // If generic actions, finding one with "Delete" label might be fragile.
                // But legacy onDelete relies on this. 
                // Let's support legacy behavior for now.
                if (onDelete) {
                    e.preventDefault();
                    onDelete(itemId);
                    onClose();
                }
            }
        };

        const handleClickOutside = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) {
                onClose();
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        document.addEventListener('mousedown', handleClickOutside);

        return () => {
            document.removeEventListener('keydown', handleKeyDown);
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [onClose, onDelete, itemId]);

    return (
        <div
            ref={ref}
            className={`fixed z-[9999] bg-white dark:bg-slate-800 rounded-lg shadow-xl border border-slate-200 dark:border-slate-700 py-1 min-w-[160px] animate-in fade-in zoom-in-95 duration-100 ${isVisible ? 'opacity-100' : 'opacity-0'}`}
            style={{ top: position.y, left: position.x }}
            onContextMenu={(e) => e.preventDefault()}
        >
            {actions ? (
                // Generic Mode
                actions.map((action, index) => (
                    <React.Fragment key={index}>
                        {index > 0 && <div className="h-px bg-slate-100 dark:bg-slate-700 my-1" />}
                        <button
                            onClick={() => { action.onClick(); onClose(); }}
                            className={`w-full text-left px-4 py-2 text-sm flex items-center gap-2 ${action.danger
                                ? 'text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20'
                                : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700'
                                }`}
                        >
                            {action.icon}
                            {action.label}
                        </button>
                    </React.Fragment>
                ))
            ) : (
                // Legacy Mode
                <>
                    {onEdit && (
                        <button
                            onClick={() => { onEdit(itemId); onClose(); }}
                            className="w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2"
                        >
                            <Edit2 size={14} className="text-slate-400" />
                            詳細 / 名前変更
                        </button>
                    )}
                    {(onEdit && onDelete) && <div className="h-px bg-slate-100 dark:bg-slate-700 my-1" />}
                    {onDelete && (
                        <button
                            onClick={() => {
                                onDelete(itemId);
                                onClose();
                            }}
                            className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2"
                        >
                            <Trash2 size={14} />
                            削除 (Delete)
                        </button>
                    )}
                </>
            )}
        </div>
    );
};
