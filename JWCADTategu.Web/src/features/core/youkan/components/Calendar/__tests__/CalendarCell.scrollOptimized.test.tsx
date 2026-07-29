import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { CalendarCell } from '../CalendarCell';

/**
 * R-068: 量感カレンダー本体（グリッドビュー）のスクロール性能改善
 *
 * ed3695a（詳細画面カレンダー）では volumeOnly のセルにのみ、
 * 装飾トランジション抑制（transition-none）と不要ペイント範囲抑制
 * （content-visibility: auto + contain: layout paint style）を適用した。
 *
 * 量感カレンダー本体（VolumeCalendarScreen）は volumeOnly=false のまま
 * アイテム一覧を表示するため、同じ最適化を volumeOnly に依存せず
 * 独立した scrollOptimized props で適用できるようにする。
 */

const baseDate = new Date('2026-06-03T00:00:00');

const baseProps = {
    date: baseDate,
    metric: undefined,
    isToday: false,
    isFirst: false,
    intensity: 0,
    isMini: false,
    isSelected: false,
    isPrep: false,
    isCommitPeriod: false,
    flashingIds: new Set<string>(),
    onAction: () => { },
    renderItemTitle: (i: any) => i.title,
};

describe('R-068: CalendarCell scrollOptimized', () => {
    it('scrollOptimized未指定・volumeOnly=false のときは通常の装飾トランジションを持つ', () => {
        const { container } = render(<CalendarCell {...baseProps} volumeOnly={false} />);
        const cell = container.querySelector('.calendar-cell');
        expect(cell).not.toBeNull();
        expect(cell?.className).toMatch(/transition-all/);
    });

    it('scrollOptimized=true・volumeOnly=false のときは装飾トランジションを抑制する', () => {
        const { container } = render(
            <CalendarCell {...baseProps} volumeOnly={false} scrollOptimized={true} />
        );
        const cell = container.querySelector('.calendar-cell');
        expect(cell).not.toBeNull();
        expect(cell?.className).toMatch(/transition-none/);
        expect(cell?.className).not.toMatch(/transition-all/);
    });

    it('scrollOptimized=true・volumeOnly=false のときは不要ペイント範囲を抑制する（content-visibility）', () => {
        const { container } = render(
            <CalendarCell {...baseProps} volumeOnly={false} scrollOptimized={true} />
        );
        const cell = container.querySelector('.calendar-cell');
        expect(cell).not.toBeNull();
        expect(cell?.className).toContain('[content-visibility:auto]');
    });
});
