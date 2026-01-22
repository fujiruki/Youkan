import { AuthResponse, LoginCredentials, RegisterCredentials } from '../types';
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

    public async login(credentials: LoginCredentials): Promise<AuthResponse> {
        const response = await ApiClient.request<AuthResponse>('POST', '/auth/login', credentials);
        if (response.token) {
            localStorage.setItem(this.TOKEN_KEY, response.token);
        }
        return response;
    }

    public async register(credentials: RegisterCredentials): Promise<AuthResponse> {
        const response = await ApiClient.request<AuthResponse>('POST', '/auth/register', credentials);
        if (response.token) {
            localStorage.setItem(this.TOKEN_KEY, response.token);
        }
        return response;
    }

    public async me(): Promise<AuthResponse | null> {
        try {
            return await ApiClient.request<AuthResponse>('GET', '/auth/me');
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
