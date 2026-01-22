import { renderHook, act } from '@testing-library/react';
import { useLoginViewModel } from '../useLoginViewModel';
import { AuthService } from '../../services/AuthService';
import { LoginCredentials, AuthResponse } from '../../types';
import { vi } from 'vitest';

// Mock AuthService
vi.mock('../../services/AuthService', () => {
    return {
        AuthService: {
            getInstance: vi.fn()
        }
    };
});

describe('useLoginViewModel', () => {
    const mockLogin = vi.fn();

    beforeAll(() => {
        (AuthService.getInstance as any).mockReturnValue({
            login: mockLogin
        });
    });

    beforeEach(() => {
        mockLogin.mockClear();
    });

    it('should start with stable initial state', () => {
        const { result } = renderHook(() => useLoginViewModel());

        expect(result.current.isLoading).toBe(false);
        expect(result.current.error).toBeNull();
        expect(result.current.user).toBeNull();
    });

    it('should handle successful login', async () => {
        const mockUser = { id: 'u1', name: 'Test User', email: 'test@example.com' };
        const mockTenant = { id: 't1', name: 'Test Tenant', role: 'owner' };
        const mockResponse: AuthResponse = {
            token: 'mock-token',
            user: mockUser,
            tenant: mockTenant
        };

        mockLogin.mockResolvedValueOnce(mockResponse);

        const { result } = renderHook(() => useLoginViewModel());

        // Perform Login
        await act(async () => {
            await result.current.login('test@example.com', 'password');
        });

        // Check Success State
        expect(result.current.isLoading).toBe(false);
        expect(result.current.error).toBeNull();
        expect(result.current.user).toEqual(mockUser);
        expect(result.current.tenant).toEqual(mockTenant);
        expect(mockLogin).toHaveBeenCalledWith({ email: 'test@example.com', password: 'password' });
    });

    it('should handle login failure', async () => {
        mockLogin.mockRejectedValueOnce(new Error('Invalid Credentials'));

        const { result } = renderHook(() => useLoginViewModel());

        await act(async () => {
            await result.current.login('wrong@example.com', 'wrong');
        });

        expect(result.current.isLoading).toBe(false);
        expect(result.current.error).toBe('Invalid Credentials');
        expect(result.current.user).toBeNull();
    });
});
