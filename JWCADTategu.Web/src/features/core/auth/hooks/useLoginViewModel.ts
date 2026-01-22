import { useState, useCallback } from 'react';
import { AuthService } from '../services/AuthService';
import { AuthUser, Tenant } from '../types';

export const useLoginViewModel = () => {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [user, setUser] = useState<AuthUser | null>(null);
    const [tenant, setTenant] = useState<Tenant | null>(null);

    const login = useCallback(async (email: string, password: string) => {
        setIsLoading(true);
        setError(null);

        try {
            const service = AuthService.getInstance();
            const response = await service.login({ email, password });

            setUser(response.user);
            setTenant(response.tenant);

            // Store token typically handled here or in Provider
            localStorage.setItem('jbwos_token', response.token);

            return true;
        } catch (err: any) {
            setError(err.message || 'An error occurred');
            return false;
        } finally {
            setIsLoading(false);
        }
    }, []);

    const logout = useCallback(() => {
        localStorage.removeItem('jbwos_token');
        setUser(null);
        setTenant(null);
    }, []);

    return {
        login,
        logout,
        isLoading,
        error,
        user,
        tenant
    };
};
