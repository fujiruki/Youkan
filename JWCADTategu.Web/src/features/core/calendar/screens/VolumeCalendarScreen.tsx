import React, { useState, useEffect } from 'react';
import { useVolumeCalendarViewModel } from '../viewmodels/useVolumeCalendarViewModel';
import { RyokanCalendar } from '../../jbwos/components/Calendar/RyokanCalendar';
import { Loader2, AlertCircle } from 'lucide-react';
import { useAuth } from '../../auth/providers/AuthProvider';
import { DecisionDetailModal } from '../../jbwos/components/Modal/DecisionDetailModal';
import { Item } from '../../jbwos/types';
import { ApiClient } from '../../../../api/client';

interface Props {
    onNavigateHome: () => void;
    activeProjectId?: string | null;
    activeTenantId?: string | null;
}

export const VolumeCalendarScreen: React.FC<Props> = ({
    onNavigateHome,
    activeProjectId,
    activeTenantId
}) => {
    const auth = useAuth();
    const [selectedItem, setSelectedItem] = useState<Item | null>(null);
    const [viewMode, setViewMode] = useState<'grid' | 'timeline' | 'gantt'>(() => {
        return (localStorage.getItem('jbwos_calendar_view_mode') as any) || 'gantt';
    });

    useEffect(() => {
        const handleModeChange = (e: CustomEvent<{ mode: 'grid' | 'timeline' | 'gantt' }>) => {
            if (e.detail?.mode) setViewMode(e.detail.mode);
        };
        window.addEventListener('jbwos-calendar-view-mode-change', handleModeChange as EventListener);
        return () => window.removeEventListener('jbwos-calendar-view-mode-change', handleModeChange as EventListener);
    }, []);

    const {
        items, members, projects, loading, error,
        startOfMonth,
        handlePrevMonth, handleNextMonth, refresh,
        capacityConfig // [NEW]
    } = useVolumeCalendarViewModel({
        projectId: activeProjectId,
        tenantId: activeTenantId
    });

    const handleUpdate = async (id: string, updates: Partial<Item>) => {
        try {
            await ApiClient.updateItem(id, updates);
            await refresh();
        } catch (e) {
            console.error('Update failed', e);
        }
    };

    const handleDelete = async (id: string) => {
        try {
            await ApiClient.deleteItem(id);
            setSelectedItem(null);
            await refresh();
        } catch (e) {
            console.error('Delete failed', e);
        }
    };

    const handleDecision = async (id: string, decision: 'yes' | 'hold' | 'no', note?: string, updates?: Partial<Item>) => {
        try {
            // 1. Apply updates first (if any)
            if (updates && Object.keys(updates).length > 0) {
                await ApiClient.updateItem(id, updates);
            }

            // 2. Resolve Decision (Server handles status and logs)
            await ApiClient.resolveDecision(id, decision, note);

            setSelectedItem(null);
            await refresh();
        } catch (e) {
            console.error('Decision failed', e);
        }
    };

    if (loading && !items.length) {
        return (
            <div className="flex items-center justify-center p-20 text-slate-500 gap-2 h-full bg-slate-50 dark:bg-slate-900">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>読み込み中...</span>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex items-center justify-center p-20 text-red-500 gap-2 h-full bg-slate-50 dark:bg-slate-900">
                <AlertCircle className="w-5 h-5" />
                <span>{error}</span>
                <button onClick={refresh} className="text-blue-500 underline text-sm">再試行</button>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-900 overflow-hidden">
            {/* Header Section (Simplified) */}
            <div className="flex-none p-4 flex items-center justify-between bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 z-20">
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                        <button onClick={handlePrevMonth} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full font-bold">
                            ←
                        </button>
                        <span className="font-bold text-lg min-w-[120px] text-center">
                            {startOfMonth.getFullYear()}年 {startOfMonth.getMonth() + 1}月
                        </span>
                        <button onClick={handleNextMonth} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full font-bold">
                            →
                        </button>
                    </div>
                    <button onClick={onNavigateHome} className="text-sm text-slate-500 hover:text-slate-700 font-bold ml-4">
                        戻る
                    </button>
                </div>
                <div className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">
                    {activeProjectId ? "Project Focused" : activeTenantId ? "Company Focused" : "Personal Focus"}
                </div>
            </div>

            <div className="flex-1 overflow-hidden relative">
                <RyokanCalendar
                    items={items || []}
                    members={members || []}
                    projects={projects || []}
                    focusedProjectId={activeProjectId}
                    focusedTenantId={activeTenantId}
                    currentUserId={auth.user?.id}
                    onItemClick={setSelectedItem}
                    displayMode={viewMode}
                    onUpdateItem={handleUpdate}
                    capacityConfig={capacityConfig} // [NEW]
                    joinedTenants={auth.joinedTenants} // [NEW]
                />
            </div>

            {selectedItem && (
                <DecisionDetailModal
                    item={selectedItem}
                    onClose={() => setSelectedItem(null)}
                    onUpdate={handleUpdate}
                    onDelete={handleDelete}
                    onDecision={handleDecision}
                    members={members}
                    allProjects={projects}
                    joinedTenants={auth.joinedTenants || []} // [FIX] Pass joined tenants
                    onOpenItem={setSelectedItem}
                    quantityItems={items}
                    filterMode={activeTenantId ? 'company' : 'personal'}
                    capacityConfig={capacityConfig} // [FIX] Pass capacity config
                />
            )}
        </div>
    );
};
