import { useState } from 'react';
import { AuthService } from '../services/AuthService';
import { LoginCredentials } from '../types';
import { useAuth } from '../providers/AuthProvider';

export const useLoginViewModel = () => {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const { logout: authLogout } = useAuth();

    const logout = () => {
        authLogout();
        localStorage.removeItem('jbwos_user');
        localStorage.removeItem('jbwos_tenant');
        window.location.href = './login';
    };

    // [v22] Support both user and tenant login
    const login = async (creds: LoginCredentials, accountType: 'user' | 'tenant' = 'user') => {
        setIsLoading(true);
        setError(null);
        try {
            const service = AuthService.getInstance();
            const res = accountType === 'tenant'
                ? await service.loginTenant(creds)
                : await service.loginUser(creds);

            if (res.user) {
                localStorage.setItem('jbwos_user', JSON.stringify(res.user));
            }
            if (res.tenant) {
                localStorage.setItem('jbwos_tenant', JSON.stringify(res.tenant));
            }
            localStorage.setItem('jbwos_account_type', accountType);
            window.location.reload();
        } catch (e) {
            setError(accountType === 'tenant'
                ? '会社アカウントのログインに失敗しました。メールアドレスとパスワードを確認してください。'
                : 'ユーザーアカウントのログインに失敗しました。メールアドレスとパスワードを確認してください。');
        } finally {
            setIsLoading(false);
        }
    };

    // Modified register function supporting 'type'
    const register = async (name: string, email: string, pass: string, type: 'user' | 'proprietor' | 'company' = 'user', companyName?: string) => {
        setIsLoading(true);
        setError(null);
        try {
            const service = AuthService.getInstance();
            const data = await service.register({ name, email, password: pass, type, company_name: companyName });

            if (data.token) {
                // Success - set local storage same as login (AuthService already sets token, but we set user/tenant here too)
                localStorage.setItem('jbwos_user', JSON.stringify(data.user));
                localStorage.setItem('jbwos_tenant', JSON.stringify(data.tenant));

                // Reload to init auth or navigate
                window.location.href = './'; // Relative path
            } else {
                window.location.href = './login?registered=true'; // Relative path
            }
        } catch (e: any) {
            setError(e.message || 'Registration failed.');
        } finally {
            setIsLoading(false);
        }
    };

    const clearError = () => setError(null);

    // Keep debug login for verification
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
            config: { plugins: { manufacturing: true, tategu: true } } // Debug with plugins
        };

        localStorage.setItem('jbwos_user', JSON.stringify(dummyUser));
        localStorage.setItem('jbwos_tenant', JSON.stringify(dummyTenant));

        // [FIX] Inject Token for AuthProvider
        localStorage.setItem('jbwos_token', 'mock-debug-token');
        localStorage.setItem('auth_token', 'mock-debug-token');

        window.location.reload();
    };

    return {
        isLoading,
        error,
        loading: isLoading, // Alias for component compatibility
        login,
        register,
        clearError,
        debugLogin,
        logout
    };
};
