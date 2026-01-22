import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { AuthUser, Tenant } from '../types';
import { AuthService } from '../services/AuthService';

interface AuthContextType {
    user: AuthUser | null;
    tenant: Tenant | null;
    isAuthenticated: boolean;
    isLoading: boolean; // Added
    login: (user: AuthUser, tenant: Tenant, token: string) => void;
    logout: () => void;
    checkAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<AuthUser | null>(null);
    const [tenant, setTenant] = useState<Tenant | null>(null);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [isLoading, setIsLoading] = useState(true); // Initial true

    const checkAuth = async () => {
        const token = AuthService.getInstance().getToken();
        if (!token) {
            setIsAuthenticated(false);
            setIsLoading(false);
            return;
        }

        try {
            // Verify token with backend /api/auth/me
            const response = await fetch('/api/auth/me', {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (response.ok) {
                const data = await response.json();
                // Backend /me returns { valid: true, user: { ...payload } }
                // Payload has user and tenant info (see AuthController)
                if (data.valid && data.user) {
                    setUser({
                        id: data.user.sub,
                        name: data.user.name,
                        email: data.user.email
                    });
                    setTenant({
                        id: data.user.tenant_id,
                        name: 'Current Tenant', // Payload might not have name if simple
                        role: data.user.role
                    });
                    setIsAuthenticated(true);
                }
            } else {
                logout();
            }
        } catch (e) {
            logout();
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        checkAuth();
    }, []);

    const login = (newUser: AuthUser, newTenant: Tenant, token: string) => {
        setUser(newUser);
        setTenant(newTenant);
        setIsAuthenticated(true);
        localStorage.setItem('jbwos_token', token);
    };

    const logout = () => {
        setUser(null);
        setTenant(null);
        setIsAuthenticated(false);
        localStorage.removeItem('jbwos_token');
        // AuthService.getInstance().logout(); // If implemented
    };

    return (
        <AuthContext.Provider value={{ user, tenant, isAuthenticated, isLoading, login, logout, checkAuth }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
