import { describe, it, expect, vi } from 'vitest';

describe('dummy', () => {
    it('should pass', () => {
        expect(true).toBe(true);
    });

    it('should use mocks', () => {
        const fn = vi.fn();
        fn();
        expect(fn).toHaveBeenCalled();
    });
});
