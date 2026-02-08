import React, { useMemo } from 'react';
import { useJBWOSViewModel } from '../../jbwos/viewmodels/useJBWOSViewModel';
import { VolumeCalendarGrid } from '../../jbwos/components/Layout/VolumeCalendarGrid';
import { TaskVolume, VolumeSettings } from '../../jbwos/services/VolumeService';
import { Loader2 } from 'lucide-react';
import { Item } from '../../jbwos/types';
import { DecisionDetailModal } from '../../jbwos/components/Modal/DecisionDetailModal';

interface Props {
    onNavigateHome: () => void;
}

export const VolumeCalendarScreen: React.FC<Props> = ({ onNavigateHome }) => {
    const vm = useJBWOSViewModel();
    const [selectedItem, setSelectedItem] = React.useState<Item | null>(null);

    // Aggregated items from all shelf zones
    const allItems = useMemo(() => [
        ...vm.gdbActive,
        ...vm.gdbPreparation,
        ...vm.gdbIntent,
        ...vm.todayCandidates,
        ...vm.todayCommits,
        ...(vm.executionItem ? [vm.executionItem] : [])
    ], [vm.gdbActive, vm.gdbPreparation, vm.gdbIntent, vm.todayCandidates, vm.todayCommits, vm.executionItem]);

    // Adapter: Item[] -> TaskVolume[]
    const taskVolumes = useMemo<TaskVolume[]>(() => {
        return allItems
            .filter(item => item.due_date) // Only items with deadlines
            .map(item => ({
                id: item.id,
                title: item.title,
                projectId: item.projectId || 'personal',
                projectTitle: item.projectTitle || (item.tenantId ? item.tenantName || '会社' : '個人'),
                estimatedTime: (item.estimatedMinutes || 60) / 60,
                dueDate: item.due_date!,
                myDueDate: (() => {
                    if (!item.prep_date) return item.due_date!;
                    const d = new Date(item.prep_date);
                    return !isNaN(d.getTime()) ? d.toISOString().split('T')[0] : item.due_date!;
                })(),
                contextId: item.tenantId || 'personal'
            }));
    }, [allItems]);

    // Adapter: CapacityConfig -> VolumeSettings
    const volumeSettings = useMemo<VolumeSettings>(() => ({
        contexts: [
            {
                contextId: 'personal',
                weeklySchedule: [0, 4, 4, 4, 4, 4, 0] // Mock default
            },
            // Note: If joinedTenants is needed here, we should fetch it via useAuth
        ],
        nothingDays: [],
        managementMode: 'Separation'
    }), []);

    if (vm.todayCandidates.length === 0 && vm.gdbActive.length === 0 && allItems.length === 0) {
        // Still loading or empty
        return (
            <div className="flex h-full items-center justify-center">
                <Loader2 className="animate-spin text-slate-400" />
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col bg-slate-50 dark:bg-slate-950 p-4 md:p-6 overflow-hidden">
            <div className="flex items-center justify-between mb-4">
                <button
                    onClick={onNavigateHome}
                    className="text-sm text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
                >
                    ← 戻る / ダッシュボード
                </button>
            </div>

            <div className="flex-grow overflow-hidden">
                <VolumeCalendarGrid
                    tasks={taskVolumes}
                    settings={volumeSettings}
                    onOpenItem={(id) => {
                        console.log('[VolumeCalendarScreen] onOpenItem called with ID:', id);
                        const all = [...vm.gdbActive, ...vm.gdbPreparation, ...vm.gdbIntent, ...vm.todayCandidates, ...vm.todayCommits, ...vm.allProjects];
                        const item = all.find(i => String(i.id) === String(id));
                        if (item) {
                            console.log('[VolumeCalendarScreen] Found item:', item.title);
                            setSelectedItem(item);
                        } else {
                            console.error('[VolumeCalendarScreen] Item not found:', id);
                        }
                    }}
                />
            </div>

            {selectedItem && (
                <DecisionDetailModal
                    item={selectedItem}
                    onClose={() => {
                        setSelectedItem(null);
                        vm.refreshAll();
                    }}
                    onDelete={async (id: string) => {
                        await vm.deleteItem(id);
                        setSelectedItem(null);
                        vm.refreshAll();
                    }}
                    onDecision={async (id: string, decision: 'yes' | 'hold' | 'no', note?: string, updates?: Partial<Item>) => {
                        await vm.resolveDecision(id, decision, note, updates);
                        setSelectedItem(null);
                        vm.refreshAll();
                    }}
                    onUpdate={async (id: string, updates: Partial<Item>) => {
                        await vm.updateItem(id, updates);
                        vm.refreshAll();
                    }}
                    onCreateSubTask={vm.createSubTask}
                    onGetSubTasks={vm.getSubTasks}
                    members={vm.members}
                    allProjects={vm.allProjects}
                    onOpenItem={setSelectedItem}
                    allWorkloadItems={allItems} // [v3.2]
                />
            )}
        </div>
    );
};
