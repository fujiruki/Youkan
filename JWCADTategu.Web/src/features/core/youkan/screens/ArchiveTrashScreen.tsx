import React, { useEffect, useState } from 'react';
import { Item } from '../types';
import { ArrowLeft, Briefcase, Trash2, RefreshCw, XCircle } from 'lucide-react';
import { useAuth } from '../../auth/providers/AuthProvider';

interface ArchiveTrashScreenProps {
    mode: 'archive' | 'trash';
    onBack: () => void;
}

function formatTimestamp(ts: number | null | undefined): string {
    if (!ts) return '-';
    const d = new Date(ts * 1000);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const mi = String(d.getMinutes()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd} ${hh}:${mi}`;
}

export const ArchiveTrashScreen: React.FC<ArchiveTrashScreenProps> = ({ mode, onBack }) => {
    const [items, setItems] = useState<Item[]>([]);
    const [loading, setLoading] = useState(false);
    const { joinedTenants } = useAuth();

    const getTenantName = (item: Item): string => {
        if (item.tenantName) return item.tenantName;
        if (!item.tenantId) return '個人';
        const found = joinedTenants.find(t => String(t.id) === String(item.tenantId));
        return found ? (found.title || found.name) : String(item.tenantId);
    };

    const getParentTitle = (item: Item): string => {
        if (item.projectTitle) return item.projectTitle;
        if (item.parentId) return `ID:${item.parentId}`;
        return '-';
    };

    const loadItems = async () => {
        setLoading(true);
        try {
            const repo = (await import('../repositories/CloudYoukanRepository')).CloudYoukanRepository;
            const data = mode === 'archive'
                ? await repo.getArchivedItems(undefined, 'aggregated')
                : await repo.getTrashedItems(undefined, 'aggregated');
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
            const repo = (await import('../repositories/CloudYoukanRepository')).CloudYoukanRepository;
            await repo.restoreItem(id);
            setItems(prev => prev.filter(i => i.id !== id));
        } catch (e) {
            alert('Restore failed');
        }
    };

    const handleDestroy = async (id: string) => {
        if (!confirm('永久に削除しますか？この操作は取り消せません。')) return;
        try {
            const repo = (await import('../repositories/CloudYoukanRepository')).CloudYoukanRepository;
            await repo.destroyItem(id);
            setItems(prev => prev.filter(i => i.id !== id));
        } catch (e) {
            alert('Destroy failed');
        }
    };

    const handleEmptyTrash = async () => {
        if (mode !== 'trash') return;
        if (!confirm('ゴミ箱を空にしますか？全てのアイテムが永久に削除されます。')) return;
        alert('Batch empty not implemented yet.');
    };

    const dateLabel = mode === 'archive' ? 'アーカイブ日時' : '削除日時';

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
                <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="bg-slate-100 dark:bg-slate-800 sticky top-0 z-10">
                                <th className="text-left px-4 py-3 font-medium text-slate-600 dark:text-slate-300 whitespace-nowrap">タイトル</th>
                                <th className="text-left px-4 py-3 font-medium text-slate-600 dark:text-slate-300 whitespace-nowrap">タイプ</th>
                                <th className="text-left px-4 py-3 font-medium text-slate-600 dark:text-slate-300 whitespace-nowrap">テナント</th>
                                <th className="text-left px-4 py-3 font-medium text-slate-600 dark:text-slate-300 whitespace-nowrap">親プロジェクト</th>
                                <th className="text-left px-4 py-3 font-medium text-slate-600 dark:text-slate-300 whitespace-nowrap">{dateLabel}</th>
                                <th className="text-left px-4 py-3 font-medium text-slate-600 dark:text-slate-300 whitespace-nowrap">アクション</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white dark:bg-slate-900 divide-y divide-slate-100 dark:divide-slate-800">
                            {items.map(item => (
                                <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                    <td className="px-4 py-3 max-w-[280px]">
                                        <div className="flex items-center gap-2 min-w-0">
                                            {item.isProject && (
                                                <Briefcase size={14} className="text-blue-400 shrink-0" />
                                            )}
                                            <span className="font-medium text-slate-700 dark:text-slate-200 truncate">{item.title}</span>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 whitespace-nowrap">
                                        {item.isProject ? (
                                            <span className="inline-block bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 text-xs px-2 py-0.5 rounded-full">プロジェクト</span>
                                        ) : (
                                            <span className="inline-block bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs px-2 py-0.5 rounded-full">タスク</span>
                                        )}
                                    </td>
                                    <td className="px-4 py-3 text-slate-500 dark:text-slate-400 whitespace-nowrap">
                                        {getTenantName(item)}
                                    </td>
                                    <td className="px-4 py-3 text-slate-500 dark:text-slate-400 max-w-[180px]">
                                        <span className="truncate block">{getParentTitle(item)}</span>
                                    </td>
                                    <td className="px-4 py-3 text-slate-500 dark:text-slate-400 whitespace-nowrap font-mono text-xs">
                                        {mode === 'trash'
                                            ? formatTimestamp(item.deletedAt)
                                            : formatTimestamp(item.updatedAt)
                                        }
                                    </td>
                                    <td className="px-4 py-3 whitespace-nowrap">
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => handleRestore(item.id)}
                                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/20 hover:bg-green-100 dark:hover:bg-green-900/40 rounded-lg transition-colors"
                                                title="復元"
                                            >
                                                <RefreshCw size={13} />
                                                復元
                                            </button>
                                            {mode === 'trash' && (
                                                <button
                                                    onClick={() => handleDestroy(item.id)}
                                                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/40 rounded-lg transition-colors"
                                                    title="完全に削除"
                                                >
                                                    <XCircle size={13} />
                                                    完全削除
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};
