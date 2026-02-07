import React, { useMemo } from 'react';
import { useJBWOSViewModel } from '../../jbwos/viewmodels/useJBWOSViewModel';
import { VolumeCalendarGrid } from '../../jbwos/components/Layout/VolumeCalendarGrid';
import { TaskVolume, VolumeSettings } from '../../jbwos/services/VolumeService';
import { Loader2 } from 'lucide-react';

interface Props {
    onNavigateHome: () => void;
}

export const VolumeCalendarScreen: React.FC<Props> = ({ onNavigateHome }) => {
    const vm = useJBWOSViewModel();

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
                projectTitle: item.projectTitle || '個人',
                estimatedTime: (item.estimatedMinutes || 60) / 60, // Convert mins to hours
                startDate: item.due_date!, // Simple: assume one-day task for now OR use prep_date
                dueDate: item.due_date!
            }));
    }, [allItems]);

    // Adapter: CapacityConfig -> VolumeSettings
    const volumeSettings = useMemo<VolumeSettings>(() => ({
        workCapacity: vm.capacityConfig.defaultDailyMinutes / 60,
        lifeCapacity: 2, // Default
        managementMode: 'Separation' // Default
    }), [vm.capacityConfig]);

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
                />
            </div>
        </div>
    );
};
