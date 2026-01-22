import { useState } from 'react';
import { AuthService } from '../services/AuthService';
import { LoginCredentials, RegisterCredentials } from '../types';

export const useLoginViewModel = () => {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const login = async (creds: LoginCredentials) => {
        setIsLoading(true);
        setError(null);
        try {
            const service = AuthService.getInstance();
            const res = await service.login(creds);
            localStorage.setItem('jbwos_user', JSON.stringify(res.user));
            localStorage.setItem('jbwos_tenant', JSON.stringify(res.tenant));
            window.location.href = '/';
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
            window.location.href = '/';
        } catch (e) {
            setError('Registration failed. Email may be taken.');
        } finally {
            setIsLoading(false);
        }
    };

    return {
        isLoading,
        error,
        login,
        register
    };
};
