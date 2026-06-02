import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import '@testing-library/jest-dom';
import { CapacityBar } from '../CapacityBar';

describe('CapacityBar (R-034 Phase 1)', () => {
    it('0% のときルート要素は描画されるが内側のバーは描画されない', () => {
        const { container } = render(
            <CapacityBar totalMinutes={0} completedMinutes={0} capacityMinutes={480} />
        );
        const root = container.querySelector('[data-testid="capacity-bar"]');
        expect(root).toBeInTheDocument();
        // 中の塗りつぶしバーは未完了/完了ともに 0% なので描画されない
        expect(container.querySelectorAll('[data-testid^="capacity-bar-fill-"]').length).toBe(0);
    });

    it('50%（全部未完了）のとき未完了バーが 50% 幅で描画される', () => {
        const { container } = render(
            <CapacityBar totalMinutes={240} completedMinutes={0} capacityMinutes={480} />
        );
        const remaining = container.querySelector('[data-testid="capacity-bar-fill-remaining"]') as HTMLElement;
        expect(remaining).toBeInTheDocument();
        expect(remaining.style.width).toBe('50%');
        expect(remaining.className).toContain('bg-emerald-500');
        // 完了側は 0% なので描画されない
        expect(container.querySelector('[data-testid="capacity-bar-fill-completed"]')).toBeNull();
    });

    it('50%（うち半分完了）のとき完了 25% / 未完了 25% の 2 層構成になる', () => {
        const { container } = render(
            <CapacityBar totalMinutes={240} completedMinutes={120} capacityMinutes={480} />
        );
        const completed = container.querySelector('[data-testid="capacity-bar-fill-completed"]') as HTMLElement;
        const remaining = container.querySelector('[data-testid="capacity-bar-fill-remaining"]') as HTMLElement;
        expect(completed).toBeInTheDocument();
        expect(remaining).toBeInTheDocument();
        expect(completed.style.width).toBe('25%');
        expect(remaining.style.width).toBe('25%');
        expect(completed.className).toContain('bg-emerald-200');
        expect(remaining.className).toContain('bg-emerald-500');
    });

    it('100%（全完了）のとき完了バー 100% のみ描画', () => {
        const { container } = render(
            <CapacityBar totalMinutes={480} completedMinutes={480} capacityMinutes={480} />
        );
        const completed = container.querySelector('[data-testid="capacity-bar-fill-completed"]') as HTMLElement;
        expect(completed).toBeInTheDocument();
        expect(completed.style.width).toBe('100%');
        expect(container.querySelector('[data-testid="capacity-bar-fill-remaining"]')).toBeNull();
    });

    it('100% 超のとき全体が red-500 一色で 100% 幅', () => {
        const { container } = render(
            <CapacityBar totalMinutes={600} completedMinutes={100} capacityMinutes={480} />
        );
        const over = container.querySelector('[data-testid="capacity-bar-fill-over"]') as HTMLElement;
        expect(over).toBeInTheDocument();
        expect(over.style.width).toBe('100%');
        expect(over.className).toContain('bg-red-500');
        expect(container.querySelector('[data-testid="capacity-bar-fill-completed"]')).toBeNull();
        expect(container.querySelector('[data-testid="capacity-bar-fill-remaining"]')).toBeNull();
    });

    it('capacityMinutes が 0 のときは何も描画しない（ゼロ除算回避）', () => {
        const { container } = render(
            <CapacityBar totalMinutes={120} completedMinutes={60} capacityMinutes={0} />
        );
        expect(container.querySelectorAll('[data-testid^="capacity-bar-fill-"]').length).toBe(0);
    });

    it('ルート要素は absolute bottom-0 と h-1 を持つ（セル下端 4px）', () => {
        const { container } = render(
            <CapacityBar totalMinutes={120} completedMinutes={0} capacityMinutes={480} />
        );
        const root = container.querySelector('[data-testid="capacity-bar"]') as HTMLElement;
        expect(root.className).toContain('absolute');
        expect(root.className).toContain('bottom-0');
        expect(root.className).toContain('h-1');
    });

    it('数値・タイトル属性（ツールチップ）は持たない', () => {
        const { container } = render(
            <CapacityBar totalMinutes={240} completedMinutes={120} capacityMinutes={480} />
        );
        const root = container.querySelector('[data-testid="capacity-bar"]') as HTMLElement;
        expect(root.getAttribute('title')).toBeNull();
        expect(root.textContent).toBe('');
    });
});
