import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

describe('Basic Test', () => {
    it('should pass', () => {
        expect(1 + 1).toBe(2);
    });

    it('can render a simple element', () => {
        render(<div>Hello Test</div>);
        expect(screen.getByText('Hello Test')).toBeInTheDocument();
    });
});
