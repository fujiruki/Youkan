import { describe, it, expect } from 'vitest';
import { VolumeService, TaskVolume, VolumeSettings } from '../VolumeService';

describe('VolumeService', () => {

    const defaultSettings: VolumeSettings = {
        workCapacity: 8,
        lifeCapacity: 2,
        managementMode: 'Separation'
    };

    it('should calculate correct daily volume for a single task (Daily Split)', () => {
        const tasks: TaskVolume[] = [{
            id: 't1',
            title: 'Test Task',
            projectId: 'p1',
            projectTitle: 'Project A',
            estimatedTime: 10, // 10 hours
            startDate: '2026-02-01',
            dueDate: '2026-02-05' // 5 days (1, 2, 3, 4, 5)
        }];

        const volumes = VolumeService.calculateDailyVolumes(tasks, defaultSettings, '2026-02-01', '2026-02-05');

        // Check if evenly split: 10h / 5 days = 2h/day
        expect(volumes['2026-02-01'].workVolume).toBe(2);
        expect(volumes['2026-02-03'].workVolume).toBe(2);
        expect(volumes['2026-02-05'].workVolume).toBe(2);

        // Load ratio: 2h / 8h capacity = 25%
        expect(volumes['2026-02-01'].loadRatio).toBe(25);
    });

    it('should aggregate multiple tasks correctly', () => {
        const tasks: TaskVolume[] = [
            {
                id: 't1',
                title: 'Task A',
                projectId: 'p1',
                projectTitle: 'P1',
                estimatedTime: 8,
                startDate: '2026-02-01',
                dueDate: '2026-02-01' // 1 day, 8h
            },
            {
                id: 't2',
                title: 'Task B',
                projectId: 'p1',
                projectTitle: 'P1',
                estimatedTime: 4,
                startDate: '2026-02-01',
                dueDate: '2026-02-02' // 2 days, 2h/day
            }
        ];

        const volumes = VolumeService.calculateDailyVolumes(tasks, defaultSettings, '2026-02-01', '2026-02-02');

        // 2026-02-01: 8h (Task A) + 2h (Task B) = 10h
        expect(volumes['2026-02-01'].workVolume).toBe(10);
        // Load ratio: 10h / 8h capacity = 125%
        expect(volumes['2026-02-01'].loadRatio).toBe(125);

        // 2026-02-02: 2h (Task B)
        expect(volumes['2026-02-02'].workVolume).toBe(2);
        expect(volumes['2026-02-02'].loadRatio).toBe(25);
    });

    it('should respect Integration Mode (Total Capacity)', () => {
        const settings: VolumeSettings = {
            workCapacity: 8,
            lifeCapacity: 2,
            managementMode: 'Integration' // Total 10h
        };

        const tasks: TaskVolume[] = [{
            id: 't1',
            title: 'Heavy Task',
            projectId: 'p1',
            projectTitle: 'P1',
            estimatedTime: 10,
            startDate: '2026-02-01',
            dueDate: '2026-02-01'
        }];

        const volumes = VolumeService.calculateDailyVolumes(tasks, settings, '2026-02-01', '2026-02-01');

        // 10h task on 10h total capacity = 100% (not 125% if only workCapacity used)
        expect(volumes['2026-02-01'].loadRatio).toBe(100);
    });

    it('should handle tasks outside the requested date range', () => {
        const tasks: TaskVolume[] = [{
            id: 't1',
            title: 'Task',
            projectId: 'p1',
            projectTitle: 'P1',
            estimatedTime: 10,
            startDate: '2026-01-01',
            dueDate: '2026-01-01'
        }];

        // Requested range is in February
        const volumes = VolumeService.calculateDailyVolumes(tasks, defaultSettings, '2026-02-01', '2026-02-01');

        expect(volumes['2026-02-01'].workVolume).toBe(0);
        expect(volumes['2026-02-01'].tasks).toHaveLength(0);
    });
});
