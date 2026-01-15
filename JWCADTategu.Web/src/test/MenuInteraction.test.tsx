import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { DecisionDetailModal } from '../features/core/jbwos/components/Modal/DecisionDetailModal';
import { createMockItem } from './testUtils';

// ToastContextのモック
vi.mock('../contexts/ToastContext', () => ({
    useToast: () => ({
        showToast: vi.fn(),
    }),
}));

describe('DecisionDetailModal Menu Interaction', () => {
    const mockItem = createMockItem({
        title: 'メニューテスト建具',
        status: 'inbox',
    });

    const mockFunc = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('「今回見送り」ボタンクリックでメニューが固定表示（トグル）される', () => {
        render(
            <BrowserRouter>
                <DecisionDetailModal
                    item={mockItem}
                    onClose={mockFunc}
                    onDecision={mockFunc}
                    onDelete={mockFunc}
                    onUpdate={mockFunc}
                />
            </BrowserRouter>
        );

        // ボタンを探す (テキストで検索)
        const menuButton = screen.getByText('今回見送り...').closest('button');
        expect(menuButton).toBeTruthy();

        // メニューコンテナを探す
        // "行き先を選択" はメニュー内の子要素。その親がメニューコンテナ。
        const menuLabel = screen.getByText('行き先を選択');
        const menuContainer = menuLabel.parentElement;

        expect(menuContainer).toBeTruthy();

        // クラスを確認 (最初は has 'hidden')
        expect(menuContainer?.className).toContain('hidden');

        // クリックして開く
        fireEvent.click(menuButton!);

        // クラスを確認 (blockに変わり、hiddenが消える)
        expect(menuContainer?.className).toContain('block');
        expect(menuContainer?.className).not.toContain('hidden');

        // もう一度クリックして閉じる
        fireEvent.click(menuButton!);
        expect(menuContainer?.className).toContain('hidden');
    });

    it('メニュー表示中に外部クリックで閉じる', () => {
        render(
            <BrowserRouter>
                <div>
                    <div data-testid="outside">Outside</div>
                    <DecisionDetailModal
                        item={mockItem}
                        onClose={mockFunc}
                        onDecision={mockFunc}
                        onDelete={mockFunc}
                        onUpdate={mockFunc}
                    />
                </div>
            </BrowserRouter>
        );

        const menuButton = screen.getByText('今回見送り...').closest('button');
        const menuLabel = screen.getByText('行き先を選択');
        const menuContainer = menuLabel.parentElement;

        // 開く
        fireEvent.click(menuButton!);
        expect(menuContainer?.className).toContain('block');

        // 外部をクリック
        fireEvent.mouseDown(screen.getByTestId('outside'));

        // 閉じたか確認
        expect(menuContainer?.className).toContain('hidden');
    });
});
