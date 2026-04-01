import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QuickInputWidget } from '../QuickInputWidget';

const mockViewModel = {
    throwIn: vi.fn(),
    allProjects: [],
    gdbActive: [],
    gdbPreparation: [],
    gdbIntent: [],
    todayCandidates: [],
    todayCommits: [],
};

describe('QuickInputWidget スタイル', () => {
    it('inputのフォントサイズがem単位で親に追従すること（text-smを使わない）', () => {
        const { container } = render(
            <QuickInputWidget
                viewModel={mockViewModel}
                onOpenItem={vi.fn()}
                placeholder="test"
            />
        );
        const input = container.querySelector('input') as HTMLInputElement;
        expect(input).toBeTruthy();
        // text-sm（固定14px）ではなくtext-[1em]（親追従）を使うこと
        expect(input.className).not.toContain('text-sm');
        expect(input.className).toContain('text-[1em]');
    });

    it('inputのパディングがem単位であること', () => {
        const { container } = render(
            <QuickInputWidget
                viewModel={mockViewModel}
                onOpenItem={vi.fn()}
            />
        );
        const input = container.querySelector('input') as HTMLInputElement;
        // 固定px/rem単位ではなくem単位のパディング
        expect(input.className).toContain('pl-[0.7em]');
        expect(input.className).toContain('pr-[2.5em]');
        expect(input.className).toContain('py-[0.4em]');
    });
});
