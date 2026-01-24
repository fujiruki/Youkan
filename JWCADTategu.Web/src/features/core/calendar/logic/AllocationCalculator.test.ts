
import { describe, it, expect } from 'vitest';
import { calculateAllocations } from './AllocationCalculator';
import { Item } from '../../jbwos/types';

describe('AllocationCalculator', () => {
    const mockItem = (id: string, due: string, mins: number): Item => ({
        id,
        title: `Task ${id}`,
        estimatedMinutes: mins,
        due_date: due,
        status: 'confirmed',
        createdAt: 0,
        updatedAt: 0,
        // minimal required props
        interrupt: false,
        weight: 1
    } as any);

    it('should allocate single task entirely to due date if within capacity', () => {
        const item = mockItem('1', '2026-02-01', 240);
        const result = calculateAllocations([item], 480);

        expect(result['2026-02-01']).toBeDefined();
        expect(result['2026-02-01'].minutes).toBe(240);
        expect(result['2026-02-01'].items[0].item.id).toBe('1');
    });

    it('should spill over to previous day if exceeding capacity', () => {
        // 960 mins (2 days full capacity) due on 2026-02-03
        const item = mockItem('2', '2026-02-03', 960);
        const result = calculateAllocations([item], 480);

        expect(result['2026-02-03'].minutes).toBe(480);
        expect(result['2026-02-02'].minutes).toBe(480);
    });

    it('should stack multiple items on same day', () => {
        // Task A: 240m on 2/5
        // Task B: 120m on 2/5
        const itemA = mockItem('A', '2026-02-05', 240);
        const itemB = mockItem('B', '2026-02-05', 120);

        const result = calculateAllocations([itemA, itemB], 480);

        expect(result['2026-02-05'].minutes).toBe(360);
        expect(result['2026-02-05'].items.length).toBe(2);
    });

    it('should skip weekends if configured (Simple implementation assumption)', () => {
        // Friday(2/6) -> Thursday(2/5)
        // If due Sunday(2/8), logic usually shifts start to Friday?
        // Let's assume input items are already valid, but backwards allocation skips Sat/Sun.
        // Task: 960m due Monday 2026-02-09
        // Mon: 480m
        // Sun: Skip
        // Sat: Skip
        // Fri: 480m
        const item = mockItem('W', '2026-02-09', 960);
        calculateAllocations([item], 480); // Implicit weekend skip? or explicit option?

        // We will implement explicit weekend skip later. 
        // For basic TDD, let's verify spillover first.
    });
});
