import { render, screen, fireEvent } from '@testing-library/react';
import { FocusCard } from '../FocusCard';
import { Item } from '../../../types';
import '@testing-library/jest-dom';

const mockItem: Item = {
    id: '1',
    title: 'Test Task',
    status: 'focus',
    createdAt: 0,
    updatedAt: 0,
    statusUpdatedAt: 0,
    focusOrder: 0,
    isEngaged: false,
    weight: 1,
    interrupt: false,
    // Enriched fields
    tenantName: 'Test Company',
    projectTitle: 'Test Project'
} as Item;

describe('FocusCard', () => {
    it('renders project and tenant info correctly', () => {
        render(
            <FocusCard
                item={mockItem}
                onSetEngaged={jest.fn()}
                onComplete={jest.fn()}
                onDrop={jest.fn()}
                onSkip={jest.fn()}
                onClick={jest.fn()}
            />
        );

        expect(screen.getByText('Test Company')).toBeInTheDocument();
        expect(screen.getByText('Test Project')).toBeInTheDocument();
        expect(screen.getByText('Test Task')).toBeInTheDocument();
    });

    it('renders "Private" if tenantName is missing', () => {
        const privateItem = { ...mockItem, tenantName: undefined, projectTitle: undefined } as Item;
        render(
            <FocusCard
                item={privateItem}
                onSetEngaged={jest.fn()}
                onComplete={jest.fn()}
                onDrop={jest.fn()}
                onSkip={jest.fn()}
                onClick={jest.fn()}
            />
        );

        expect(screen.getByText('Private')).toBeInTheDocument();
    });
});
