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
        window.location.href = '/login';
    };

    const login = async (creds: LoginCredentials) => {
        setIsLoading(true);
        setError(null);
        try {
            const service = AuthService.getInstance();
            const res = await service.login(creds);
            localStorage.setItem('jbwos_user', JSON.stringify(res.user));
            localStorage.setItem('jbwos_tenant', JSON.stringify(res.tenant));
            window.location.reload();
        } catch (e) {
            setError('Login failed. Check your credentials.');
        } finally {
            setIsLoading(false);
        }
    };

    // Modified register function supporting 'type'
    const register = async (name: string, email: string, pass: string, type: 'user' | 'proprietor' | 'company' = 'user', companyName?: string) => {
        setIsLoading(true);
        setError(null);
        try {
            // We use fetch directly here or update AuthService. using fetch to match plan logic for now.
            // Ideally should go through AuthService but for speed/consistency with plan:
            const apiRes = await fetch('/api/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, email, password: pass, type, company_name: companyName }),
            });

            if (!apiRes.ok) {
                const errData = await apiRes.json();
                throw new Error(errData.error || 'Registration failed');
            }

            const data = await apiRes.json();

            if (data.token) {
                // Success - set local storage same as login
                localStorage.setItem('jbwos_token', data.token); // Store token if AuthProvider uses it
                localStorage.setItem('jbwos_user', JSON.stringify(data.user));
                localStorage.setItem('jbwos_tenant', JSON.stringify(data.tenant));

                // Reload to init auth or navigate
                window.location.href = '/';
            } else {
                // User created but no token (e.g. general user waiting for invite)
                // alert('アカウント作成完了。'); // Alert can be blocking/annoying
                // Navigate to login with query param for message?
                window.location.href = '/login?registered=true';
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
