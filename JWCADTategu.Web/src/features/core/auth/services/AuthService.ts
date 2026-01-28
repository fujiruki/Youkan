import { BackendAuthResponse, LoginCredentials, RegisterCredentials } from '../types';
import { ApiClient } from '../../../../api/client';

export class AuthService {
    private static instance: AuthService;
    private readonly TOKEN_KEY = 'jbwos_token';

    private constructor() { }

    public static getInstance(): AuthService {
        if (!AuthService.instance) {
            AuthService.instance = new AuthService();
        }
        return AuthService.instance;
    }

    // [v22] User account login
    public async loginUser(credentials: LoginCredentials): Promise<BackendAuthResponse> {
        const response = await ApiClient.request<BackendAuthResponse>('POST', '/auth/login/user', credentials);
        if (response.token) {
            localStorage.setItem(this.TOKEN_KEY, response.token);
        }
        return response;
    }

    // [v22] Company/Tenant account login
    public async loginTenant(credentials: LoginCredentials): Promise<BackendAuthResponse> {
        const response = await ApiClient.request<BackendAuthResponse>('POST', '/auth/login/tenant', credentials);
        if (response.token) {
            localStorage.setItem(this.TOKEN_KEY, response.token);
        }
        return response;
    }

    // Legacy login (defaults to user login)
    public async login(credentials: LoginCredentials): Promise<BackendAuthResponse> {
        return this.loginUser(credentials);
    }

    public async register(credentials: RegisterCredentials): Promise<BackendAuthResponse> {
        const response = await ApiClient.request<BackendAuthResponse>('POST', '/auth/register', credentials);
        if (response.token) {
            localStorage.setItem(this.TOKEN_KEY, response.token);
        }
        return response;
    }

    // [v24] Switch tenant context
    public async switchTenant(tenantId: string | null): Promise<any> {
        const response = await ApiClient.request<any>('POST', '/auth/switch-tenant', { tenant_id: tenantId });
        if (response.token) {
            localStorage.setItem(this.TOKEN_KEY, response.token);
        }
        return response;
    }

    public async me(): Promise<BackendAuthResponse | null> {
        try {
            return await ApiClient.request<BackendAuthResponse>('GET', '/auth/me');
        } catch (error) {
            console.error("Failed to fetch user info:", error);
            return null;
        }
    }

    public getToken(): string | null {
        return localStorage.getItem(this.TOKEN_KEY);
    }

    public logout(): void {
        localStorage.removeItem(this.TOKEN_KEY);
    }
}
