import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { Item } from '../../../types';
import { StatusDot } from '../OverviewItem';

const item = (status: Item['status'], due_date?: string): Item => ({
    id: status, title: status, status, due_date, focusOrder: 0, isEngaged: false,
    statusUpdatedAt: 0, interrupt: false, weight: 1, createdAt: 0, updatedAt: 0,
});

const dotClass = (value: Item) => {
    const { container, unmount } = render(<StatusDot item={value} today="2026-08-29" />);
    const className = container.querySelector('[data-testid="overview-status-dot"]')!.className;
    unmount();
    return className;
};

describe('OverviewItem StatusDot (R-159)', () => {
    it('inbox は緑、someday はグレー', () => {
        expect(dotClass(item('inbox'))).toContain('bg-emerald-300');
        expect(dotClass(item('someday'))).toContain('bg-slate-300');
    });

    it('期限超過は inbox の緑より淡い赤を優先する', () => {
        expect(dotClass(item('inbox', '2026-08-28'))).toContain('bg-rose-300');
    });
});
