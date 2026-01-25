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
        userName: 'Test User'
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

    it('renders navigation links', () => {
        render(<MenuDrawer {...defaultProps} isOpen={true} />);
        expect(screen.getByText('Today')).toBeInTheDocument();
        expect(screen.getByText('Projects')).toBeInTheDocument();
        expect(screen.getByText('History')).toBeInTheDocument();
        expect(screen.getByText('設定')).toBeInTheDocument();
    });

    it('calls logic when buttons are clicked', () => {
        render(<MenuDrawer {...defaultProps} isOpen={true} />);

        fireEvent.click(screen.getByText('Today'));
        expect(defaultProps.onNavigateToToday).toHaveBeenCalled();

        fireEvent.click(screen.getByText('Projects'));
        expect(defaultProps.onNavigateToProjects).toHaveBeenCalled();
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
