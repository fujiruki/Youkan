/**
 * Manufacturing Plugin - Deliverable List Component
 * 
 * 成果物（Manifest）一覧表示・管理コンポーネント
 */
import React, { useState, useEffect } from 'react';
import { Package, Plus, Factory, MapPin, CheckCircle, Circle, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import { Deliverable, ProjectSummary } from './types';
import { deliverableRepository } from './repository';
import { DeliverableEditModal } from './DeliverableEditModal';
import { cn } from '../../../lib/utils';

interface DeliverableListProps {
    projectId: string;
    onDeliverableChange?: () => void;
}

export const DeliverableList: React.FC<DeliverableListProps> = ({ projectId, onDeliverableChange }) => {
    const [deliverables, setDeliverables] = useState<Deliverable[]>([]);
    const [summary, setSummary] = useState<ProjectSummary | null>(null);
    const [loading, setLoading] = useState(true);
    const [editingDeliverable, setEditingDeliverable] = useState<Deliverable | null>(null);
    const [isCreating, setIsCreating] = useState(false);
    const [showSummary, setShowSummary] = useState(true);

    // 成果物一覧と集計を取得
    const loadData = async () => {
        setLoading(true);
        try {
            const [items, summaryData] = await Promise.all([
                deliverableRepository.getByProject(projectId),
                deliverableRepository.getProjectSummary(projectId)
            ]);
            setDeliverables(items);
            setSummary(summaryData);
        } catch (e) {
            console.error('Failed to load deliverables', e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, [projectId]);

    // 成果物を保存
    const handleSave = async (deliverable: Deliverable) => {
        try {
            if (isCreating) {
                await deliverableRepository.create({
                    projectId,
                    name: deliverable.name,
                    type: deliverable.type,
                    estimatedWorkMinutes: deliverable.estimatedWorkMinutes,
                    estimatedSiteMinutes: deliverable.estimatedSiteMinutes,
                    materialCost: deliverable.materialCost,
                    laborCost: deliverable.laborCost,
                    outsourceCost: deliverable.outsourceCost,
                    status: deliverable.status,
                    requiresSiteInstallation: deliverable.requiresSiteInstallation,
                    memo: deliverable.memo
                });
            } else {
                await deliverableRepository.update(deliverable.id, deliverable);
            }
            setEditingDeliverable(null);
            setIsCreating(false);
            loadData();
            onDeliverableChange?.();
        } catch (e) {
            console.error('Failed to save deliverable', e);
        }
    };

    // 成果物を削除
    const handleDelete = async (id: string) => {
        if (!confirm('この成果物を削除しますか？')) return;
        try {
            await deliverableRepository.delete(id);
            loadData();
            onDeliverableChange?.();
        } catch (e) {
            console.error('Failed to delete deliverable', e);
        }
    };

    // ステータスアイコン
    const StatusIcon = ({ status }: { status: string }) => {
        switch (status) {
            case 'completed': return <CheckCircle size={16} className="text-green-500" />;
            case 'in_progress': return <Loader2 size={16} className="text-blue-500 animate-spin" />;
            default: return <Circle size={16} className="text-slate-400" />;
        }
    };

    // 時間をフォーマット
    const formatMinutes = (minutes: number) => {
        if (minutes < 60) return `${minutes}分`;
        const h = Math.floor(minutes / 60);
        const m = minutes % 60;
        return m > 0 ? `${h}時間${m}分` : `${h}時間`;
    };

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Package className="text-purple-500" size={20} />
                    <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">
                        成果物リスト
                    </h3>
                    <span className="text-sm text-slate-400">
                        ({deliverables.length}件)
                    </span>
                </div>
                <button
                    onClick={() => {
                        setIsCreating(true);
                        setEditingDeliverable({
                            id: '',
                            projectId,
                            name: '',
                            type: 'product',
                            estimatedWorkMinutes: 0,
                            estimatedSiteMinutes: 0,
                            status: 'pending',
                            requiresSiteInstallation: true,
                            createdAt: Date.now(),
                            updatedAt: Date.now()
                        });
                    }}
                    className="flex items-center gap-1 px-3 py-1.5 bg-purple-500 hover:bg-purple-600 text-white rounded-lg text-sm font-medium transition-colors"
                >
                    <Plus size={16} />
                    成果物追加
                </button>
            </div>

            {/* Summary Panel */}
            {summary && summary.deliverableCount > 0 && (
                <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                    <button
                        onClick={() => setShowSummary(!showSummary)}
                        className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
                    >
                        <span className="text-sm font-bold text-slate-600 dark:text-slate-300">
                            集計
                        </span>
                        {showSummary ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>
                    {showSummary && (
                        <div className="px-4 pb-4 grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div className="text-center p-3 bg-blue-50 dark:bg-blue-900/30 rounded-lg">
                                <div className="flex items-center justify-center gap-1 text-blue-600 mb-1">
                                    <Factory size={14} />
                                    <span className="text-xs font-bold">製作時間</span>
                                </div>
                                <div className="text-lg font-bold text-blue-700 dark:text-blue-400">
                                    {formatMinutes(summary.totalEstimatedWorkMinutes)}
                                </div>
                            </div>
                            <div className="text-center p-3 bg-green-50 dark:bg-green-900/30 rounded-lg">
                                <div className="flex items-center justify-center gap-1 text-green-600 mb-1">
                                    <MapPin size={14} />
                                    <span className="text-xs font-bold">現場時間</span>
                                </div>
                                <div className="text-lg font-bold text-green-700 dark:text-green-400">
                                    {formatMinutes(summary.totalEstimatedSiteMinutes)}
                                </div>
                            </div>
                            <div className="text-center p-3 bg-amber-50 dark:bg-amber-900/30 rounded-lg">
                                <div className="flex items-center justify-center gap-1 text-amber-600 mb-1">
                                    <span className="text-xs font-bold">総原価</span>
                                </div>
                                <div className="text-lg font-bold text-amber-700 dark:text-amber-400">
                                    ¥{(summary.totalMaterialCost + summary.totalLaborCost + summary.totalOutsourceCost).toLocaleString()}
                                </div>
                            </div>
                            <div className="text-center p-3 bg-purple-50 dark:bg-purple-900/30 rounded-lg">
                                <div className="flex items-center justify-center gap-1 text-purple-600 mb-1">
                                    <span className="text-xs font-bold">進捗</span>
                                </div>
                                <div className="text-lg font-bold text-purple-700 dark:text-purple-400">
                                    {summary.completedCount}/{summary.deliverableCount}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Deliverable List */}
            {loading ? (
                <div className="text-center text-slate-400 py-8">読み込み中...</div>
            ) : deliverables.length === 0 ? (
                <div className="text-center text-slate-400 py-8 bg-white dark:bg-slate-800 rounded-xl border border-dashed border-slate-300 dark:border-slate-600">
                    成果物がありません。「成果物追加」から追加してください。
                </div>
            ) : (
                <div className="space-y-2">
                    {deliverables.map((item) => (
                        <div
                            key={item.id}
                            onClick={() => {
                                setIsCreating(false);
                                setEditingDeliverable(item);
                            }}
                            className={cn(
                                "p-3 bg-white dark:bg-slate-800 rounded-lg border cursor-pointer transition-colors",
                                item.status === 'completed'
                                    ? "border-green-200 dark:border-green-800"
                                    : "border-slate-200 dark:border-slate-700 hover:border-purple-300"
                            )}
                        >
                            <div className="flex items-center gap-3">
                                <StatusIcon status={item.status} />
                                <div className="flex-1 min-w-0">
                                    <div className="font-medium text-slate-800 dark:text-slate-100 truncate">
                                        {item.name}
                                    </div>
                                    <div className="flex items-center gap-3 text-xs text-slate-500 mt-1">
                                        <span className="flex items-center gap-1">
                                            <Factory size={12} />
                                            {formatMinutes(item.estimatedWorkMinutes)}
                                        </span>
                                        {item.requiresSiteInstallation && (
                                            <span className="flex items-center gap-1">
                                                <MapPin size={12} />
                                                {formatMinutes(item.estimatedSiteMinutes)}
                                            </span>
                                        )}
                                        {item.materialCost && (
                                            <span>¥{item.materialCost.toLocaleString()}</span>
                                        )}
                                    </div>
                                </div>
                                <span className={cn(
                                    "px-2 py-0.5 text-xs rounded-full",
                                    item.type === 'product'
                                        ? "bg-blue-100 text-blue-600"
                                        : "bg-green-100 text-green-600"
                                )}>
                                    {item.type === 'product' ? '製作' : '作業'}
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Edit Modal */}
            {editingDeliverable && (
                <DeliverableEditModal
                    deliverable={editingDeliverable}
                    isNew={isCreating}
                    onSave={handleSave}
                    onDelete={handleDelete}
                    onClose={() => {
                        setEditingDeliverable(null);
                        setIsCreating(false);
                    }}
                />
            )}
        </div>
    );
};
