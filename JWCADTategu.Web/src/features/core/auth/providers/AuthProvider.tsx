import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { AuthUser, Tenant } from '../types';
import { AuthService } from '../services/AuthService';
import { YOUKAN_KEYS } from '../../session/youkanKeys';

interface AuthContextType {
	user: AuthUser | null;
	tenant: Tenant | null;
	joinedTenants: Tenant[];
	isAuthenticated: boolean;
	isLoading: boolean;
	login: (user: AuthUser, tenant: Tenant, token: string) => void;
	logout: () => void;
	checkAuth: () => Promise<void>;
	switchTenant: (tenantId: string | null) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
	const [user, setUser] = useState<AuthUser | null>(null);
	const [tenant, setTenant] = useState<Tenant | null>(null);
	const [joinedTenants, setJoinedTenants] = useState<Tenant[]>([]);
	const [isAuthenticated, setIsAuthenticated] = useState(false);
	const [isLoading, setIsLoading] = useState(true); // Initial true

	const checkAuth = async () => {
		const token = AuthService.getInstance().getToken();
		if (!token) {
			setIsAuthenticated(false);
			setIsLoading(false);
			return;
		}

		// --- DEBUG BYPASS (Dev Only) ---
		if (import.meta.env.DEV && token === 'mock-debug-token') {
			console.log('AuthProvider: Debug Token detected. Bypassing API check.');
			const storedUser = localStorage.getItem(YOUKAN_KEYS.USER);
			const storedTenant = localStorage.getItem(YOUKAN_KEYS.TENANT);
			const storedJoined = localStorage.getItem(YOUKAN_KEYS.JOINED_TENANTS);

			if (storedUser) {
				try {
					const parsedUser = JSON.parse(storedUser);
					setUser(parsedUser);

					if (storedTenant) {
						setTenant(JSON.parse(storedTenant));
					} else {
						setTenant(null);
					}

					if (storedJoined) {
						setJoinedTenants(JSON.parse(storedJoined));
					}

					setIsAuthenticated(true);
				} catch (e) {
					console.error('Failed to parse debug user data', e);
					logout();
				}
			} else {
				logout();
			}
			setIsLoading(false);
			return;
		}
		// ---------------------

		try {
			// Use AuthService to get user info (handles correct API URL)
			const authService = AuthService.getInstance();
			const data = await authService.me();

			if (data && data.user) {
				setUser({
					id: data.user.id,
					name: data.user.name,
					email: data.user.email,
					isRepresentative: data.user.is_representative,
					preferences: data.user.preferences
				});
				// Ensure tenant info includes representative info if present
				setTenant(data.tenant ? {
					...data.tenant,
					representativeName: (data.tenant as any).representativeName,
					representativeEmail: (data.tenant as any).representativeEmail
				} : null);
				setJoinedTenants(data.joinedTenants || []);
				setIsAuthenticated(true);
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
		localStorage.setItem(YOUKAN_KEYS.TOKEN, token);
	};

	const logout = () => {
		setUser(null);
		setTenant(null);
		setJoinedTenants([]);
		setIsAuthenticated(false);
		localStorage.removeItem(YOUKAN_KEYS.TOKEN);
		// AuthService.getInstance().logout(); // If implemented
	};

	const switchTenant = async (tenantId: string | null) => {
		setIsLoading(true);
		try {
			await AuthService.getInstance().switchTenant(tenantId);
			await checkAuth(); // Refresh state with new token
		} catch (e) {
			console.error('Failed to switch tenant', e);
		} finally {
			setIsLoading(false);
		}
	};

	return (
		<AuthContext.Provider value={{ user, tenant, joinedTenants, isAuthenticated, isLoading, login, logout, checkAuth, switchTenant }}>
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
