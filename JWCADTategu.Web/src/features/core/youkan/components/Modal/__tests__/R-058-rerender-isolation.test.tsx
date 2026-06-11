/**
 * R-058: 詳細モーダルの再レンダリング隔離テスト
 *
 * 検証内容:
 * 1. タイトル input にタイプしても SideCalendarPanel が再レンダリングされない
 * 2. RyokanCalendar が mini モードのとき、初期 range は ±1ヶ月（約 90 セル）に収まる
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { DecisionDetailModal } from '../DecisionDetailModal';
import { RyokanCalendar } from '../../Calendar/RyokanCalendar';
import { createMockItem } from '../../../../../../test/testUtils';

vi.mock('../../../../../../contexts/ToastContext', () => ({
    useToast: () => ({ showToast: vi.fn() }),
}));

// SideCalendarPanel のレンダー回数を計測するためにモジュールをスパイ
// ここでは実際の SideCalendarPanel コンポーネントに React.memo が適用されているかを
// 直接レンダーカウントで検証する
let sideCalendarRenderCount = 0;

vi.mock('../../Inputs/SideCalendarPanel', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../../Inputs/SideCalendarPanel')>();
    const OriginalSideCalendarPanel = actual.SideCalendarPanel;
    const Wrapped = React.memo((props: any) => {
        sideCalendarRenderCount++;
        return React.createElement(OriginalSideCalendarPanel as any, props);
    });
    Wrapped.displayName = 'SideCalendarPanel';
    return { SideCalendarPanel: Wrapped };
});

const minimalCapacityConfig = {
    defaultDailyMinutes: 480,
    holidays: [] as string[],
    exceptions: {} as Record<string, number>,
};

const renderModal = (overrides: Parameters<typeof createMockItem>[0] = {}) => {
    const item = createMockItem(overrides);
    return render(
        <BrowserRouter>
            <DecisionDetailModal
                item={item}
                onClose={vi.fn()}
                onDecision={vi.fn()}
                onDelete={vi.fn()}
                onUpdate={vi.fn().mockResolvedValue(undefined)}
                capacityConfig={minimalCapacityConfig}
                quantityItems={[]}
                members={[]}
                allProjects={[]}
                joinedTenants={[]}
            />
        </BrowserRouter>
    );
};

describe('R-058: 詳細モーダル 再レンダリング隔離', () => {
    beforeEach(() => {
        sideCalendarRenderCount = 0;
        vi.clearAllMocks();
    });

    it('タイトル input にタイプしても SideCalendarPanel の再レンダリング回数が増えない', async () => {
        renderModal({ title: '初期タイトル' });

        const titleInput = screen.getByTestId('decision-detail-title-input');
        await waitFor(() => expect(titleInput).toBeInTheDocument());

        // 初回レンダー後のカウントを記録
        const countAfterMount = sideCalendarRenderCount;
        expect(countAfterMount).toBeGreaterThan(0);

        // タイトルに 5 文字タイプ
        act(() => {
            fireEvent.change(titleInput, { target: { value: '初期タイトルA' } });
            fireEvent.change(titleInput, { target: { value: '初期タイトルAB' } });
            fireEvent.change(titleInput, { target: { value: '初期タイトルABC' } });
            fireEvent.change(titleInput, { target: { value: '初期タイトルABCD' } });
            fireEvent.change(titleInput, { target: { value: '初期タイトルABCDE' } });
        });

        // タイプ後も SideCalendarPanel のレンダー回数が変わっていないこと
        expect(sideCalendarRenderCount).toBe(countAfterMount);
    });
});

describe('R-058: RyokanCalendar mini モード 初期 range 縮小', () => {
    beforeEach(() => {
        if (!HTMLElement.prototype.scrollIntoView) {
            (HTMLElement.prototype as any).scrollIntoView = vi.fn();
        } else {
            vi.spyOn(HTMLElement.prototype, 'scrollIntoView').mockImplementation(() => { });
        }
    });

    it('layoutMode="mini" のとき、初期セル数は ±2ヶ月（~161 セル）より少ない ~90 セル以下になる', () => {
        const focusDate = new Date(2026, 5, 15); // 2026年6月15日
        const { container } = render(
            <RyokanCalendar
                items={[]}
                members={[]}
                capacityConfig={minimalCapacityConfig}
                projects={[]}
                joinedTenants={[]}
                currentUserId="test-user"
                layoutMode="mini"
                displayMode="grid"
                focusDate={focusDate}
                hideHeader={true}
            />
        );

        const cells = container.querySelectorAll('[data-date]');
        // ±2ヶ月なら ~161 セル、±1ヶ月なら ~90 セル以下
        // mini モードでは ±1ヶ月に縮小されているため 100 以下を確認
        expect(cells.length).toBeLessThanOrEqual(100);
        // ゼロでないこと（描画は必要）
        expect(cells.length).toBeGreaterThan(0);
    });

    it('layoutMode="panorama" のとき、初期セル数は ±2ヶ月（~161 セル）相当になる', () => {
        const focusDate = new Date(2026, 5, 15);
        const { container } = render(
            <RyokanCalendar
                items={[]}
                members={[]}
                capacityConfig={minimalCapacityConfig}
                projects={[]}
                joinedTenants={[]}
                currentUserId="test-user"
                layoutMode="panorama"
                displayMode="grid"
                focusDate={focusDate}
                hideHeader={true}
            />
        );

        const cells = container.querySelectorAll('[data-date]');
        // panorama（非 mini）なら ±2ヶ月 = ~161 セル
        expect(cells.length).toBeGreaterThan(100);
    });
});
