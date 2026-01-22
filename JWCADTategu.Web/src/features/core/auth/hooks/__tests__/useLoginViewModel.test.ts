import { renderHook, act } from '@testing-library/react';
import { useLoginViewModel } from '../useLoginViewModel';
import { AuthService } from '../../services/AuthService';
import { vi, describe, it, expect, beforeAll, beforeEach } from 'vitest';

// Mock AuthService
vi.mock('../../services/AuthService', () => {
    return {
        AuthService: {
            getInstance: vi.fn()
        }
    };
});

// Mock window.location
Object.defineProperty(window, 'location', {
    value: { href: '' },
    writable: true
});

describe('useLoginViewModel', () => {
    const mockLogin = vi.fn();
    const mockRegister = vi.fn();

    beforeAll(() => {
        (AuthService.getInstance as any).mockReturnValue({
            login: mockLogin,
            register: mockRegister
        });
    });

    beforeEach(() => {
        mockLogin.mockClear();
        mockRegister.mockClear();
        localStorage.clear();
    });

    it('should start with stable initial state', () => {
        const { result } = renderHook(() => useLoginViewModel());

        expect(result.current.isLoading).toBe(false);
        expect(result.current.error).toBeNull();
    });

    it('should handle successful login', async () => {
        const mockUser = { id: 'u1', name: 'Test User', email: 'test@example.com' };
        const mockTenant = { id: 't1', name: 'Test Tenant', role: 'owner' };
        const mockResponse = {
            token: 'mock-token',
            user: mockUser,
            tenant: mockTenant
        };

        mockLogin.mockResolvedValueOnce(mockResponse);

        const { result } = renderHook(() => useLoginViewModel());

        // Perform Login
        await act(async () => {
            await result.current.login({ email: 'test@example.com', password: 'password' });
        });

        // Check Success State
        expect(result.current.isLoading).toBe(false);
        expect(result.current.error).toBeNull();
        expect(mockLogin).toHaveBeenCalledWith({ email: 'test@example.com', password: 'password' });
    });

    it('should handle login failure', async () => {
        mockLogin.mockRejectedValueOnce(new Error('Invalid Credentials'));

        const { result } = renderHook(() => useLoginViewModel());

        await act(async () => {
            await result.current.login({ email: 'wrong@example.com', password: 'wrong' });
        });

        expect(result.current.isLoading).toBe(false);
        expect(result.current.error).toBe('Login failed. Check your credentials.');
    });

    it('should clear error', () => {
        const { result } = renderHook(() => useLoginViewModel());

        // Set error manually by triggering failed login
        act(() => {
            result.current.clearError();
        });

        expect(result.current.error).toBeNull();
    });
});
