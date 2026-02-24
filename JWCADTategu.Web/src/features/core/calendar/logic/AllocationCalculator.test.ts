
import { describe, it, expect } from 'vitest';
import { calculateAllocations } from './AllocationCalculator';
import { Item } from '../../youkan/types';
import { format } from 'date-fns';

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
        const result = calculateAllocations([item], () => 480);

        expect(result['2026-02-01']).toBeDefined();
        expect(result['2026-02-01'].minutes).toBe(240);
        expect(result['2026-02-01'].items[0].item.id).toBe('1');
    });

    it('should spill over to previous day if exceeding capacity', () => {
        // 960 mins (2 days full capacity) due on 2026-02-03
        const item = mockItem('2', '2026-02-03', 960);
        const result = calculateAllocations([item], () => 480);

        expect(result['2026-02-03'].minutes).toBe(480);
        expect(result['2026-02-02'].minutes).toBe(480);
    });

    it('should stack multiple items on same day', () => {
        // Task A: 240m on 2/5
        // Task B: 120m on 2/5
        const itemA = mockItem('A', '2026-02-05', 240);
        const itemB = mockItem('B', '2026-02-05', 120);

        const result = calculateAllocations([itemA, itemB], () => 480);

        expect(result['2026-02-05'].minutes).toBe(360);
        expect(result['2026-02-05'].items.length).toBe(2);
    });

    it('should skip days with 0 capacity (Simulation of Holiday)', () => {
        // Mock capacity function: 2026-02-08 (Sun) is 0, others 480
        const getCapacity = (date: Date) => {
            const day = date.getDay();
            if (day === 0) return 0; // Sunday Holiday
            return 480;
        };

        // Task: 960m (2 days). Due Mon 2026-02-09.
        // Expect:
        // Mon 02-09: 480
        // Sun 02-08: 0 (Skip)
        // Sat 02-07: 480
        const item = mockItem('HolidayTest', '2026-02-09', 960);
        const result = calculateAllocations([item], getCapacity);

        expect(result['2026-02-09'].minutes).toBe(480);
        expect(result['2026-02-08']).toBeUndefined(); // Should be skipped (or 0)
        expect(result['2026-02-07'].minutes).toBe(480);
    });

    it('should respect dynamic capacity per day', () => {
        // Case:
        // 2026-03-01: 240m (Half day)
        // 2026-02-28: 480m (Full day)
        // Task: 600m. Due 2026-03-01.

        const getCapacity = (date: Date) => {
            const str = format(date, 'yyyy-MM-dd');
            if (str === '2026-03-01') return 240;
            return 480;
        };

        const item = mockItem('DynamicCap', '2026-03-01', 600);
        const result = calculateAllocations([item], getCapacity);

        // 03-01: Allocates max 240. Remaining 360.
        // 02-28: Allocates remaining 360 (fits in 480).
        expect(result['2026-03-01'].minutes).toBe(240);
        expect(result['2026-02-28'].minutes).toBe(360);
    });
});

