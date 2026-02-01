import React, { useEffect, useState } from 'react';
import { Item } from '../types';
// CloudJBWOSRepository imported dynamically
import { ArrowLeft, Briefcase, Trash2, RefreshCw, XCircle } from 'lucide-react';

interface ArchiveTrashScreenProps {
    mode: 'archive' | 'trash';
    onBack: () => void;
}

export const ArchiveTrashScreen: React.FC<ArchiveTrashScreenProps> = ({ mode, onBack }) => {
    const [items, setItems] = useState<Item[]>([]);
    const [loading, setLoading] = useState(false);

    // Since CloudJBWOSRepository is an object (not class), we use it directly or via getRepository if context needed.
    // For now assuming direct usage is fine or check imports.
    // Actually CloudJBWOSRepository might be imported from '../repositories/CloudJBWOSRepository'

    // We need real repository import
    // Let's assume passed via props or imported.
    // I will dynamically import or assume it's available.
    // To be safe, let's assume standard Repository usage

    const loadItems = async () => {
        setLoading(true);
        try {
            // mode to filter
            const repo = (await import('../repositories/CloudJBWOSRepository')).CloudJBWOSRepository;
            const data = mode === 'archive'
                ? await repo.getArchivedItems()
                : await repo.getTrashedItems();
            setItems(data);
        } catch (e) {
            console.error('Failed to load items', e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadItems();
    }, [mode]);

    const handleRestore = async (id: string) => {
        if (!confirm('アイテムを復元しますか？')) return;
        try {
            const repo = (await import('../repositories/CloudJBWOSRepository')).CloudJBWOSRepository;
            await repo.restoreItem(id);
            setItems(prev => prev.filter(i => i.id !== id));
        } catch (e) {
            alert('Restore failed');
        }
    };

    const handleDestroy = async (id: string) => {
        if (!confirm('永久に削除しますか？この操作は取り消せません。')) return;
        try {
            const repo = (await import('../repositories/CloudJBWOSRepository')).CloudJBWOSRepository;
            await repo.destroyItem(id);
            setItems(prev => prev.filter(i => i.id !== id));
        } catch (e) {
            alert('Destroy failed');
        }
    };

    const handleEmptyTrash = async () => {
        if (mode !== 'trash') return;
        if (!confirm('ゴミ箱を空にしますか？全てのアイテムが永久に削除されます。')) return;
        // Batch destroy or backend endpoint?
        // Backend doesn't have "empty trash" yet, so looping client side or adding endpoint.
        // For safety, loop client side or just destroy visible.
        // Ideally backend endpoint /items/empty-trash
        // For now, let's just warn "Not implemented" or simple loop
        alert('Batch empty not implemented yet.');
    };

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-900 p-8 pb-24">
            <div className="flex items-center gap-4 mb-8">
                <button
                    onClick={onBack}
                    className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full transition-colors"
                >
                    <ArrowLeft className="w-6 h-6 text-slate-600 dark:text-slate-400" />
                </button>
                <div className="flex items-center gap-3">
                    {mode === 'archive' ? <Briefcase className="w-8 h-8 text-slate-500" /> : <Trash2 className="w-8 h-8 text-red-500" />}
                    <h1 className="text-3xl font-light text-slate-800 dark:text-slate-100 tracking-tight">
                        {mode === 'archive' ? 'Archives' : 'Trash'}
                    </h1>
                </div>

                {mode === 'trash' && items.length > 0 && (
                    <button
                        onClick={handleEmptyTrash}
                        className="ml-auto flex items-center gap-2 px-4 py-2 bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-200 dark:hover:bg-red-900/40 transition-colors"
                    >
                        <Trash2 size={16} />
                        Empty Trash
                    </button>
                )}
            </div>

            {loading ? (
                <div className="text-slate-400 text-center py-20">Loading...</div>
            ) : items.length === 0 ? (
                <div className="text-slate-400 text-center py-20 bg-slate-100 dark:bg-slate-800/50 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700">
                    {mode === 'archive' ? 'アーカイブされた項目はありません' : 'ゴミ箱は空です'}
                </div>
            ) : (
                <div className="space-y-2 max-w-4xl mx-auto">
                    {items.map(item => (
                        <div key={item.id} className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 flex items-center justify-between group">
                            <div className="flex items-center gap-3 overflow-hidden">
                                <div className={`w-1 h-8 rounded-full ${mode === 'archive' ? 'bg-slate-300' : 'bg-red-300'}`} />
                                <div className="min-w-0">
                                    <h3 className="font-medium text-slate-700 dark:text-slate-200 truncate">{item.title}</h3>
                                    <div className="text-xs text-slate-400 flex items-center gap-2">
                                        <span>{item.updatedAt ? new Date(item.updatedAt).toLocaleDateString() : '-'}</span>
                                        {item.isProject && <span className="bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-[4px] text-[10px]">PROJECT</span>}
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                    onClick={() => handleRestore(item.id)}
                                    className="p-2 text-slate-400 hover:text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-full transition-colors"
                                    title="復元"
                                >
                                    <RefreshCw size={18} />
                                </button>
                                {mode === 'trash' && (
                                    <button
                                        onClick={() => handleDestroy(item.id)}
                                        className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full transition-colors"
                                        title="完全に削除"
                                    >
                                        <XCircle size={18} />
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};
