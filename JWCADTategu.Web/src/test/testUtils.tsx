import { render } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import type { Item } from '../features/jbwos/types';

/**
 * テスト用のProviderでラップしてレンダリング
 */
export const renderWithProviders = (ui: React.ReactElement) => {
    return render(<BrowserRouter>{ui}</BrowserRouter>);
};

/**
 * モックアイテムの作成
 */
export const createMockItem = (overrides: Partial<Item> = {}): Item => {
    const now = new Date();
    return {
        id: `test-${Date.now()}-${Math.random()}`,
        title: 'テストアイテム',
        status: 'inbox',
        statusUpdatedAt: now.getTime(),
        interrupt: false,
        weight: 1,
        createdAt: now.getTime(),
        updatedAt: now.getTime(),
        ...overrides,
    };
};

/**
 * 複数のモックアイテムを作成
 */
export const createMockItems = (count: number, overrides: Partial<Item> = {}): Item[] => {
    return Array.from({ length: count }, (_, i) =>
        createMockItem({
            title: `テストアイテム${i + 1}`,
            ...overrides,
        })
    );
};

/**
 * キーボードイベントのシミュレート
 */
export const pressKey = (element: HTMLElement, key: string, modifiers: { ctrl?: boolean; alt?: boolean; shift?: boolean } = {}) => {
    const event = new KeyboardEvent('keydown', {
        key,
        ctrlKey: modifiers.ctrl,
        altKey: modifiers.alt,
        shiftKey: modifiers.shift,
        bubbles: true,
        cancelable: true,
    });
    element.dispatchEvent(event);
};

/**
 * 指定時間待機（アニメーション等）
 */
export const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
