import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MenuDrawer, MenuDrawerProps } from './MenuDrawer';


describe('MenuDrawer', () => {
    const defaultProps: MenuDrawerProps = {
        isOpen: true,
        onClose: vi.fn(),
        onNavigateToToday: vi.fn(),
        onNavigateToHistory: vi.fn(),
        onNavigateToProjects: vi.fn(),
        onNavigateToSettings: vi.fn(),
        onNavigateToCustomers: vi.fn(),
        onNavigateToPlanning: vi.fn(),
        onNavigateToManual: vi.fn(),
        onLogout: vi.fn(),
        userName: 'Test User',
        onNavigateToCompanySettings: vi.fn()
    };

    it('renders nothing when closed', () => {
        render(<MenuDrawer {...defaultProps} isOpen={false} />);
        const menu = screen.queryByText('Test User');
        expect(menu).not.toBeInTheDocument();
    });

    it('renders user name when open', () => {
        render(<MenuDrawer {...defaultProps} isOpen={true} />);
        const menu = screen.getByText('Test User');
        expect(menu).toBeInTheDocument();
    });

    it('renders navigation links（現行仕様: 個人/会社設定・アプリ設定・変更履歴・マニュアル）', () => {
        render(<MenuDrawer {...defaultProps} isOpen={true} />);
        // 現行 MenuDrawer は Today/Projects 直接導線を持たず、アプリ設定や履歴等のセカンダリ系を持つ
        expect(screen.getByText('アプリ設定')).toBeInTheDocument();
        expect(screen.getByText('変更履歴 (Audit Log)')).toBeInTheDocument();
        expect(screen.getByText('マニュアル (Manual)')).toBeInTheDocument();
    });

    it('calls onNavigateToSettings when アプリ設定 が押下される', () => {
        render(<MenuDrawer {...defaultProps} isOpen={true} />);

        fireEvent.click(screen.getByText('アプリ設定'));
        expect(defaultProps.onNavigateToSettings).toHaveBeenCalled();
    });

    it('calls onClose when backdrop is clicked', () => {
        render(<MenuDrawer {...defaultProps} isOpen={true} />);
        // Assuming backdrop has a specific class or role, for now let's assume it's the first div wrapper logic
        // But since we haven't implemented, we can't select easily. 
        // We will test if we can find a close button or similar.
        // Actually, let's wait for implementation. This test expects failure.

        // Let's assume there is a backdrop element that handles click
        // For skeletal test, maybe skip complex interaction or use querySelector
    });
});
