import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { QuantityCalendar } from './QuantityCalendar';
import { Item } from '../../types';

// Mock dependencies
vi.mock('framer-motion', () => ({
    motion: {
        div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
        path: ({ children, ...props }: any) => <path {...props}>{children}</path>,
    },
    AnimatePresence: ({ children }: any) => <>{children}</>,
}));

vi.mock('@dnd-kit/core', () => ({
    useDroppable: () => ({
        setNodeRef: vi.fn(),
        isOver: false,
    }),
}));

// Mock scrollIntoView
Element.prototype.scrollIntoView = vi.fn();

describe('QuantityCalendar Visualization', () => {
    // Helper to create test items
    const createTestItem = (overrides: Partial<Item>): Item => ({
        id: 'test-item-1',
        title: 'Test Task',
        status: 'inbox',
        createdAt: 1000,
        updatedAt: 1000,
        statusUpdatedAt: 1000,
        interrupt: false,
        weight: 1,
        ...overrides
    });

    const mockOnItemClick = vi.fn();

    it('renders User Reported Case: Due 1/29, Prep 1/27, Work 2 days', () => {
        // Setup Date: 2026/01/29 is Thursday. 1/27 is Tuesday.
        // We need to ensure the calendar renders these dates. 
        // QuantityCalendar renders from 6 months ago to 1 year ahead based on "Today".
        // We should mock system time to ensure 2026/01/29 is visible, or just rely on it being within range if we run this test "now".
        // To be safe, let's just rely on the component's wide range, but we need to find the cells.

        // Target:
        // Due: 2026-01-29 (Thu)
        // Prep: 2026-01-27 (Tue) (timestamp)
        // WorkDays: 2

        // Expected Visualization:
        // 1/29: Chip (Due), Heatmap (Due)
        // 1/28: No Chip, No Heatmap (Gap)
        // 1/27: No Chip (Prep), Heatmap (Prep)
        // 1/26: No Chip (Prep/Start), Heatmap (Prep)

        const dueStr = '2026-01-29T00:00:00';
        const prepDate = new Date('2026-01-27T00:00:00').getTime() / 1000;

        const item = createTestItem({
            due_date: dueStr,
            prep_date: prepDate,
            work_days: 2
        });

        render(<QuantityCalendar items={[item]} onItemClick={mockOnItemClick} capacityConfig={{}} onToggleHoliday={vi.fn()} />);

        // Check that only ONE chip exists (the Due Date chip)
        const chips = screen.queryAllByText('Test Task');
        expect(chips).toHaveLength(1);

        const chip = chips[0];
        expect(chip.className).toContain('bg-red-100');

        // If there was a chip for Prep, it would verify. But we asserted length 1.
        // So we know Prep dates DO NOT have chips. Correct.

        // Now about the Gap and Heatmap.
        // This is the core bug report: "1/28 should be empty, 1/27 should be colored".
        // How to verify Heatmap on specific date? 
        // We can look for the text "26" etc. but month matters.
        // Let's mock `getStartOfToday` to a fixed date so we know where dates fall?
        // If we mock today to 2026-01-26, then that cell is "Today". 
    });

    it('renders 3-day work duration correctly (Due 2/6, Prep 2/4, Work 1 but Est 3 days)', () => {
        // Target: Due 2026-02-06 (Fri), Prep 2026-02-04 (Wed)
        // WorkDays: 1 (Raw) but EstimatedMinutes: 1260 (21 hours = 3 days @ 7h/d)
        // Expected Logic (Backward from Prep):
        // 2/4 (Wed): Paint
        // 2/3 (Tue): Paint
        // 2/2 (Mon): Paint
        // 2/1 (Sun): Skip (if holiday config default) -> But wait, 2/1 is Sunday.
        // If 2/1 is Sunday and default config makes it holiday, we skip to 1/31 (Sat) or 1/30 (Fri).
        // Let's assume standard Sat/Sun are holidays.
        // 2026/2/2 is Mon. 2/3 Tue. 2/4 Wed. All Working Days.
        // So we expect: Tue Feb 03 2026, Mon Feb 02 2026, Wed Feb 04 2026 (Order depends on loop, code pushes in order of iteration)
        // Code Loop: 
        // 1. current = 2/4 (Wed). Not Holiday. Push. date-1 -> 2/3.
        // 2. current = 2/3 (Tue). Not Holiday. Push. date-1 -> 2/2.
        // 3. current = 2/2 (Mon). Not Holiday. Push. date-1 -> 2/1.
        // Loop ends (count=3).
        // Expect: "Wed Feb 04 2026, Tue Feb 03 2026, Mon Feb 02 2026"

        const dueStr = '2026-02-06T00:00:00';
        const prepDate = new Date('2026-02-04T00:00:00').getTime() / 1000;

        const item = createTestItem({
            id: 'test-item-3day-est',
            title: 'Coaster Comparator', // Must match filter in Debug Overlay (Coaster)
            due_date: dueStr,
            prep_date: prepDate,
            work_days: 1, // Intentional mismatch
            estimatedMinutes: 3 * 7 * 60 // 3 days
        });

        render(<QuantityCalendar items={[item]} onItemClick={mockOnItemClick} capacityConfig={{}} onToggleHoliday={vi.fn()} />);

        // Find Debug Info Block
        // We look for text "Calculated Dates:"
        // The Debug Overlay renders item.title, so we look for that.
        expect(screen.getByText('Coaster Comparator')).toBeDefined();

        // Check "WorkDays (Effective):"
        // Should be 3
        expect(screen.getByText('3')).toBeDefined(); // Amber bold text

        // Check Calculated Dates
        // Warning: Local time string format can vary. "Wed Feb 04 2026" is toDateString() format.
        // The code uses toDateString().
        const debugInfo = screen.getByText(/Calculated Dates:/);
        expect(debugInfo.textContent).toContain('Wed Feb 04 2026');
        expect(debugInfo.textContent).toContain('Tue Feb 03 2026');
        expect(debugInfo.textContent).toContain('Mon Feb 02 2026');
    });
});
