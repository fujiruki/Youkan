import { renderHook } from '@testing-library/react';
import { useSmartContext } from '../useSmartContext';

describe('useSmartContext', () => {
    it('returns global filter when no item is selected', () => {
        const { result } = renderHook(() => useSmartContext({ item: null, globalFilter: 'all' }));
        expect(result.current).toBe('all');

        const { result: result2 } = renderHook(() => useSmartContext({ item: null, globalFilter: 'company' }));
        expect(result2.current).toBe('company');
    });

    it('returns "personal" context for private items', () => {
        const privateItem = { isPrivate: true };

        // Even if global is 'all' or 'company', a private item implies personal context
        const { result } = renderHook(() => useSmartContext({ item: privateItem, globalFilter: 'all' }));
        expect(result.current).toBe('personal');

        const { result: result2 } = renderHook(() => useSmartContext({ item: privateItem, globalFilter: 'company' }));
        expect(result2.current).toBe('personal');
    });

    it('returns "company" context for public (work) items when global is specific', () => {
        const publicItem = { isPrivate: false };

        // If global is 'personal', switch to 'company' for work item
        const { result } = renderHook(() => useSmartContext({ item: publicItem, globalFilter: 'personal' }));
        expect(result.current).toBe('company');

        // If global is 'company', keep 'company'
        const { result: result2 } = renderHook(() => useSmartContext({ item: publicItem, globalFilter: 'company' }));
        expect(result2.current).toBe('company');
    });

    it('returns "all" context for public items if global is "all"', () => {
        // If viewing All, and picking a work item, usually acceptable to stay in All to see total load
        const publicItem = { isPrivate: false };
        const { result } = renderHook(() => useSmartContext({ item: publicItem, globalFilter: 'all' }));
        expect(result.current).toBe('all');
    });
});
