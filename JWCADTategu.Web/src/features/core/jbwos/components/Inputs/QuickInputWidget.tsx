import React, { useState, useRef, useEffect } from 'react';
import { Plus, Briefcase, CornerDownLeft } from 'lucide-react';
import { Item } from '../../types';

interface JBWOSViewModel {
    throwIn: (title: string, tenantId?: string | null, projectId?: string | null) => Promise<string | null>;
    allProjects: Item[];
    gdbActive: Item[];
    gdbPreparation: Item[];
    gdbIntent: Item[];
    todayCandidates: Item[];
    todayCommits: Item[];
}

interface QuickInputWidgetProps {
    viewModel: JBWOSViewModel;

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

    // Auto Focus
    useEffect(() => {
        if (autoFocus && inputRef.current) {
            inputRef.current.focus();
        }
    }, [autoFocus]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!title.trim()) return;

        try {
            // Use Explicit Context if available
            // Note: viewModel.throwIn logic: (title, tenantId, projectId)
            // If projectContext is null, we pass undefined/null to indicate "Inbox/Personal"

            const pId = projectContext?.id || null;
            const tId = projectContext?.tenantId || null;

            console.log('[QuickInput] Submitting:', { title, tId, pId });

            const newId = await viewModel.throwIn(title, tId, pId);

            if (newId) {
                setLastAddedId(newId);
                // We could show a toast here, but ViewModel usually handles it or UI feedback is enough
            }
        } catch (error) {
            console.error('[QuickInput] Failed to add item:', error);
        }

        setTitle('');
    };

    const handleKeyDown = async (e: React.KeyboardEvent) => {
        // Alt + D Shortcut
        if (e.altKey && e.key.toLowerCase() === 'd') {
            e.preventDefault();

            console.log('[QuickInput] Alt+D Triggered. LastAdded:', lastAddedId);

            // Priority 1: Locally created item in this session
            if (lastAddedId) {
                // We need to fetch the item object. 
                // Since `throwIn` returns ID, and ViewModel updates state, we try to find it in ViewModel's lists?
                // The widget doesn't have access to the lists directly via active props usually (it receives VM).
                // But VM state is usually accessible via VM hook result used in parent. 
                // Wait, this components receives `viewModel` which is the RESULT of the hook? 
                // Yes, usually passed as `vm`.

                // We need a way to get the item object. 
                // Hack: We can iterate known lists in VM if exposed, OR request parent to find it.
                // Better Design: `onOpenItem` expects an Item object.
                // Let's assume the parent can find it if we pass ID?
                // Or we can try to find it in `vm.gdbActive` etc if available.
                // Let's try to find it from the VM's exposed methods or data if possible.
                // Actually, `viewModel` passed from parent has `gdbActive` etc.

                const allItems = [
                    ...(viewModel.gdbActive || []),
                    ...(viewModel.gdbPreparation || []),
                    ...(viewModel.gdbIntent || []),
                    ...(viewModel.todayCandidates || []),
                    ...(viewModel.todayCommits || [])
                ];

                const item = allItems.find((i: any) => i.id === lastAddedId);
                if (item) {
                    onOpenItem(item);
                    return;
                }
            }

            // Priority 2: Fallback to Parent's "Last Interacted"
            if (onRequestFallbackOpen) {
                console.log('[QuickInput] Falling back to parent RequestFallbackOpen');
                onRequestFallbackOpen();
            }
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
                    className="w-full pl-3 pr-10 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-800 focus:border-blue-300 transition-all text-sm"
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
