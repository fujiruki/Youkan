import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { YoukanRepository } from '../features/core/youkan/repositories/YoukanRepository';
import { Item } from '../features/core/youkan/types';

// Mock ApiClient to always fail
vi.mock('../api/client', () => ({
    ApiClient: {
        getTodayView: vi.fn().mockRejectedValue(new Error('API 500')),
        getAllItems: vi.fn().mockResolvedValue([]), // Mock for recursive calls if any
        getGdbShelf: vi.fn().mockResolvedValue({ active: [], preparation: [], intent: [], history: [] }) // Default empty
    }
}));

// Mock DB to prevent Dexie errors/hangs
vi.mock('../../../../db/db', () => ({
    db: {
        projects: { filter: () => ({ toArray: async () => [] }) },
        deliverables: { toArray: async () => [] },
        doors: { filter: () => ({ toArray: async () => [] }) },
        settings: { get: async () => null, put: async () => { } }
    }
}));

// Manual Mock YoukanRepository.getGdbShelf
const originalGetGdbShelf = YoukanRepository.getGdbShelf;
const getShelfMock = vi.fn();

describe('TodayLogic Fallback (TDD)', () => {

    beforeEach(() => {
        vi.clearAllMocks();
        // Manual overwrite
        YoukanRepository.getGdbShelf = getShelfMock;
    });

    afterEach(() => {
        // Restore
        YoukanRepository.getGdbShelf = originalGetGdbShelf;
    });

    it('should categorize "Ready + Flag" as Commit', async () => {
        // Arrange
        const mockItems: Item[] = [
            { id: '1', title: 'Task A', status: 'ready', flags: { is_today_commit: true } } as any,
            { id: '2', title: 'Task B', status: 'ready', flags: { is_today_commit: false } } as any,
        ];

        getShelfMock.mockResolvedValueOnce({
            active: mockItems,
            preparation: [],
            intent: [],
            log: []
        });

        // Act
        let todayView;
        try {
            todayView = await YoukanRepository.getTodayView();
            console.log('Test Result View:', JSON.stringify(todayView, null, 2));
        } catch (e) {
            console.error('Test Execution Error:', e);
            throw e;
        }

        // Assert
        expect(todayView.commits).toHaveLength(1);
        expect(todayView.commits[0].id).toBe('1');
        expect(todayView.candidates).toHaveLength(1);
        expect(todayView.candidates[0].id).toBe('2');
    });

    it('should categorize "Ready + Today Prep Date" as Candidate', async () => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayTs = today.getTime() / 1000;

        const mockItems: Item[] = [
            { id: '1', title: 'Task A', status: 'ready', prep_date: todayTs } as any,
            { id: '2', title: 'Task B', status: 'ready', prep_date: todayTs + 86400 } as any, // Tomorrow
        ];

        getShelfMock.mockResolvedValueOnce({
            active: mockItems, // Normally ready+date is in active or prep, fallback looks at all
            preparation: [],
            intent: [],
            log: []
        });

        const todayView = await YoukanRepository.getTodayView();

        expect(todayView.candidates).toHaveLength(1); // Task A
        expect(todayView.candidates[0].id).toBe('1');
        // Task B is future, so not in Today Candidate (Strict Haruki: Only Today or Past)
    });

    it('should detect Execution item', async () => {
        const mockItems: Item[] = [
            { id: '1', title: 'Task A', status: 'ready', flags: { is_executing: true, is_today_commit: true } } as any,
        ];

        getShelfMock.mockResolvedValueOnce({ active: mockItems, preparation: [], intent: [], log: [] });

        const todayView = await YoukanRepository.getTodayView();

        expect(todayView.execution).toBeDefined();
        expect(todayView.execution?.id).toBe('1');
        expect(todayView.commits).toHaveLength(1); // Executing implies committed
    });
});
