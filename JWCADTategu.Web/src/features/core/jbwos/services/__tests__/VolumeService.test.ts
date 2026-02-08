import { describe, it, expect } from 'vitest';
import { VolumeService, TaskVolume, VolumeSettings } from '../VolumeService';

describe('VolumeService (Sequential Packing Engine)', () => {

    const defaultSettings: VolumeSettings = {
        contexts: [
            {
                contextId: 'personal',
                weeklySchedule: [0, 4, 4, 4, 4, 4, 0] // 4h on weekdays
            },
            {
                contextId: 'companyA',
                weeklySchedule: [0, 8, 8, 8, 8, 8, 0] // 8h on weekdays
            }
        ],
        nothingDays: [],
        managementMode: 'Separation'
    };

    it('should pack a task backward from myDueDate', () => {
        const tasks: TaskVolume[] = [{
            id: 't1',
            title: '16h Task',
            projectId: 'p1',
            projectTitle: 'P1',
            estimatedTime: 16,
            dueDate: '2026-02-10',
            myDueDate: '2026-02-05', // Thursday
            contextId: 'companyA'
        }];

        const volumes = VolumeService.calculateDailyVolumes(tasks, defaultSettings, '2026-02-01', '2026-02-10');

        expect(volumes['2026-02-05'].loadByContext['companyA']).toBe(8);
        expect(volumes['2026-02-04'].loadByContext['companyA']).toBe(8);

        // Exact load ratio: (8 / 12) * 100 = 66.666666...
        expect(volumes['2026-02-05'].loadRatio).toBeGreaterThan(66);
        expect(volumes['2026-02-05'].loadRatio).toBeLessThan(67);
    });

    it('should calculate load ratios correctly when filtered', () => {
        const tasks: TaskVolume[] = [{
            id: 't1',
            estimatedTime: 4,
            dueDate: '2026-02-05',
            myDueDate: '2026-02-05',
            contextId: 'companyA',
            title: '', projectId: '', projectTitle: ''
        }];

        const volumes = VolumeService.calculateDailyVolumes(tasks, defaultSettings, '2026-02-05', '2026-02-05', 'companyA');
        expect(volumes['2026-02-05'].loadRatio).toBe(50);
    });

    it('should skip Nothing Days', () => {
        const settings: VolumeSettings = {
            ...defaultSettings,
            nothingDays: ['2026-02-04']
        };

        const tasks: TaskVolume[] = [{
            id: 't1',
            estimatedTime: 12,
            dueDate: '2026-02-10',
            myDueDate: '2026-02-05',
            contextId: 'companyA',
            title: '', projectId: '', projectTitle: ''
        }];

        const volumes = VolumeService.calculateDailyVolumes(tasks, settings, '2026-02-01', '2026-02-10');

        expect(volumes['2026-02-05'].loadByContext['companyA']).toBe(8);
        expect(volumes['2026-02-04'].loadByContext['companyA']).toBe(0);
        expect(volumes['2026-02-03'].loadByContext['companyA']).toBe(4);
    });

    it('should show card on DueDate', () => {
        const tasks: TaskVolume[] = [{
            id: 't1',
            estimatedTime: 4,
            dueDate: '2026-02-10',
            myDueDate: '2026-02-05',
            contextId: 'companyA',
            title: 'Card Task', projectId: '', projectTitle: ''
        }];

        const volumes = VolumeService.calculateDailyVolumes(tasks, defaultSettings, '2026-02-10', '2026-02-10');
        expect(volumes['2026-02-10'].tasksEndingOnThisDay).toHaveLength(1);
    });
});
