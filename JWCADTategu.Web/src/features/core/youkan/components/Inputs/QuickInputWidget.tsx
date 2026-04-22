import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Plus, Briefcase, CornerDownLeft } from 'lucide-react';
import { Item } from '../../types';

interface YoukanViewModel {
    // [NEW] initialStatus: 'inbox' (default) or 'focus' (Ctrl+Enter)
    throwIn: (title: string, tenantId?: string | null, projectId?: string | null, initialStatus?: 'inbox' | 'focus') => Promise<string | null>;
    allProjects: Item[];
    gdbActive: Item[];
    gdbPreparation: Item[];
    gdbIntent: Item[];
    todayCandidates: Item[];
    todayCommits: Item[];
}

interface QuickInputWidgetProps {
    viewModel: YoukanViewModel;

    // Explicit Context to ensure Tenant/Project inheritance
    projectContext?: {
        id?: string;
        title?: string;      // [NEW] Unified
        name: string;
        tenantId?: string | null;
    } | null;

    onOpenItem: (item: Item) => void;
    onRequestFallbackOpen?: () => void; // Fallback for Alt+D if no local item

    placeholder?: string;
    className?: string;
    autoFocus?: boolean;
}

export const QuickInputWidget: React.FC<QuickInputWidgetProps> = ({
    viewModel,
    projectContext,
    onOpenItem,
    onRequestFallbackOpen,
    placeholder = "思いついたことを入力...",
    className = "",
    autoFocus = false
}) => {
    const [title, setTitle] = useState('');
    const [lastAddedId, setLastAddedId] = useState<string | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const viewModelRef = useRef(viewModel);

    useEffect(() => { viewModelRef.current = viewModel; }, [viewModel]);

    // Auto Focus
    useEffect(() => {
        if (autoFocus && inputRef.current) {
            inputRef.current.focus();
        }
    }, [autoFocus]);

    const findItemById = useCallback((id: string) => {
        const vm = viewModelRef.current;
        const allItems = [
            ...(vm.gdbActive || []),
            ...(vm.gdbPreparation || []),
            ...(vm.gdbIntent || []),
            ...(vm.todayCandidates || []),
            ...(vm.todayCommits || []),
        ];
        return allItems.find((i: any) => i.id === id) || null;
    }, []);

    const handleSubmit = async (e: React.FormEvent, asFocus: boolean = false): Promise<string | null> => {
        e.preventDefault();
        if (!title.trim()) return null;

        try {
            const pId = projectContext?.id || null;
            const tId = projectContext?.tenantId || null;
            const initialStatus = asFocus ? 'focus' : 'inbox';

            const newId = await viewModel.throwIn(title, tId, pId, initialStatus);

            if (newId) {
                setLastAddedId(newId);
            }
            setTitle('');
            return newId;
        } catch (error) {
            console.error('[QuickInput] Failed to add item:', error);
            setTitle('');
            return null;
        }
    };

    const handleKeyDown = async (e: React.KeyboardEvent) => {
        // Shift+Enter = 今日やる（focus）で登録
        if (e.shiftKey && e.key === 'Enter') {
            e.preventDefault();
            if (title.trim()) {
                await handleSubmit(e as any, true);
            }
            return;
        }

        // Alt+Enter = 登録して詳細モーダルを開く / 空なら前回登録アイテムを開く
        if (e.altKey && e.key === 'Enter') {
            e.preventDefault();
            if (title.trim()) {
                const newId = await handleSubmit(e as any, false);
                if (newId) {
                    setTimeout(() => {
                        const item = findItemById(newId);
                        if (item) {
                            onOpenItem(item);
                        } else {
                            onRequestFallbackOpen?.();
                        }
                    }, 200);
                }
            } else {
                if (lastAddedId) {
                    const item = findItemById(lastAddedId);
                    if (item) {
                        onOpenItem(item);
                    } else {
                        onRequestFallbackOpen?.();
                    }
                } else {
                    onRequestFallbackOpen?.();
                }
            }
            return;
        }

        // Alt+D = 前回登録アイテムを開く（後方互換）
        if (e.altKey && e.key.toLowerCase() === 'd') {
            e.preventDefault();
            if (lastAddedId) {
                const item = findItemById(lastAddedId);
                if (item) {
                    onOpenItem(item);
                    return;
                }
            }
            onRequestFallbackOpen?.();
        }
    };

    return (
        <form onSubmit={handleSubmit} className={`relative group ${className}`}>
            {/* Context Badge */}
            <div className="absolute -top-5 right-0 flex items-center gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity duration-200">
                {projectContext ? (
                    <span className="bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-300 text-[10px] px-2 py-0.5 rounded-full font-bold flex items-center gap-1 animate-in slide-in-from-bottom-1">
                        <Briefcase size={10} />
                        To: {projectContext.title || projectContext.name}
                    </span>
                ) : (
                    <span className="bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500 text-[10px] px-2 py-0.5 rounded-full font-bold animate-in slide-in-from-bottom-1">
                        To: Inbox
                    </span>
                )}
            </div>

            <div className="relative">
                <input
                    ref={inputRef}
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={placeholder}
                    className="w-full pl-[0.7em] pr-[2.5em] py-[0.4em] bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-800 focus:border-blue-300 transition-all text-[1em]"
                />
                <button
                    type="submit"
                    className={`absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg transition-colors ${title.trim() ? 'bg-blue-500 text-white hover:bg-blue-600' : 'bg-slate-100 text-slate-300 dark:bg-slate-700 dark:text-slate-500 cursor-not-allowed'}`}
                    disabled={!title.trim()}
                >
                    {title.trim() ? <CornerDownLeft size={16} /> : <Plus size={16} />}
                </button>
            </div>
        </form>
    );
};
