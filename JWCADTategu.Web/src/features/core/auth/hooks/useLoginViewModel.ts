import { useState } from 'react';
import { AuthService } from '../services/AuthService';
import { LoginCredentials, RegisterCredentials } from '../types';
import { useAuth } from '../providers/AuthProvider';

export const useLoginViewModel = () => {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const { logout: authLogout } = useAuth(); // Get from AuthProvider

    const logout = () => {
        authLogout();
        // Clear debug items just in case
        localStorage.removeItem('jbwos_user');
        localStorage.removeItem('jbwos_tenant');
        window.location.reload();
    };

    const login = async (creds: LoginCredentials) => {
        setIsLoading(true);
        setError(null);
        try {
            const service = AuthService.getInstance();
            const res = await service.login(creds);
            localStorage.setItem('jbwos_user', JSON.stringify(res.user));
            localStorage.setItem('jbwos_tenant', JSON.stringify(res.tenant));
            // Reload to re-initialize App with AuthProvider
            window.location.reload();
        } catch (e) {
            setError('Login failed. Check your credentials.');
        } finally {
            setIsLoading(false);
        }
    };

    const register = async (creds: RegisterCredentials) => {
        setIsLoading(true);
        setError(null);
        try {
            const service = AuthService.getInstance();
            const res = await service.register(creds);

            localStorage.setItem('jbwos_user', JSON.stringify(res.user));
            localStorage.setItem('jbwos_tenant', JSON.stringify(res.tenant));
            window.location.reload();
        } catch (e) {
            setError('Registration failed. Email may be taken.');
        } finally {
            setIsLoading(false);
        }
    };

    const clearError = () => setError(null);

    const debugLogin = () => {
        setIsLoading(true);
        const dummyUser = {
            id: 'debug-user-001',
            name: 'Debug User',
            email: 'debug@example.com'
        };
        const dummyTenant = {
            id: 'debug-tenant-001',
            name: '株式会社 デバッグ建具',
            role: 'admin',
            address: '東京都新宿区デバッグ町1-2-3',
            phone: '03-1234-5678',
            invoiceNumber: 'T1234567890123',
            bankInfo: {
                bankName: 'デバッグ銀行 本店',
                accountType: '普通',
                accountNumber: '1234567',
                accountHolder: 'カ）デバッグタテグ'
            },
            closingDate: 20
        };

        localStorage.setItem('jbwos_user', JSON.stringify(dummyUser));
        localStorage.setItem('jbwos_tenant', JSON.stringify(dummyTenant));
        // Token is minimal mock
        localStorage.setItem('jbwos_token', 'mock-debug-token');

        window.location.reload();
    };

    return {
        isLoading,
        error,
        login,
        register,
        clearError,
        debugLogin,
        logout
    };
};
