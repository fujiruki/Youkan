import { renderHook } from '@testing-library/react';
import { usePlugin } from './usePlugin';
import { useAuth } from '../../auth/providers/AuthProvider';
import { describe, it, expect, vi, Mock } from 'vitest';

// Mock useAuth
vi.mock('../../auth/providers/AuthProvider', () => ({
    useAuth: vi.fn(),
}));

describe('usePlugin Hook', () => {
    it('should return false if no tenant is logged in', () => {
        (useAuth as Mock).mockReturnValue({ tenant: null });
        const { result } = renderHook(() => usePlugin('manufacturing'));
        expect(result.current).toBe(false);
    });

    it('should return true when plugin is enabled in tenant config', () => {
        (useAuth as Mock).mockReturnValue({
            tenant: {
                config: {
                    plugins: { manufacturing: true }
                }
            }
        });
        const { result } = renderHook(() => usePlugin('manufacturing'));
        expect(result.current).toBe(true);
    });

    it('should return false when plugin is disabled in tenant config', () => {
        (useAuth as Mock).mockReturnValue({
            tenant: {
                config: {
                    plugins: { manufacturing: false }
                }
            }
        });
        const { result } = renderHook(() => usePlugin('manufacturing'));
        expect(result.current).toBe(false);
    });

    it('should return false when config is undefined', () => {
        (useAuth as Mock).mockReturnValue({
            tenant: { config: undefined }
        });
        const { result } = renderHook(() => usePlugin('tategu'));
        expect(result.current).toBe(false);
    });
});
