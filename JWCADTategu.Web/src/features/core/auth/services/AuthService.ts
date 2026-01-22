import { AuthResponse, LoginCredentials, RegisterCredentials } from '../types';

const API_BASE = '/api';

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

    // Helper method for making authenticated requests
    private async request<T>(method: string, path: string, body?: any): Promise<T> {
        const token = this.getToken();
        const headers: HeadersInit = {
            'Content-Type': 'application/json',
        };

        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        const options: RequestInit = {
            method,
            headers,
            body: body ? JSON.stringify(body) : undefined,
        };

        const response = await fetch(`${API_BASE}${path}`, options);

        if (!response.ok) {
            const error = await response.json().catch(() => ({ message: 'Unknown Error' }));
            throw new Error(error.message || error.error || 'Request Failed');
        }

        return response.json();
    }

    public async login(credentials: LoginCredentials): Promise<AuthResponse> {
        const response = await this.request<AuthResponse>('POST', '/auth/login', credentials);
        if (response.token) {
            localStorage.setItem(this.TOKEN_KEY, response.token);
        }
        return response;
    }

    public async register(credentials: RegisterCredentials): Promise<AuthResponse> {
        const response = await this.request<AuthResponse>('POST', '/auth/register', credentials);
        if (response.token) {
            localStorage.setItem(this.TOKEN_KEY, response.token);
        }
        return response;
    }

    public async me(): Promise<AuthResponse | null> {
        try {
            return await this.request<AuthResponse>('GET', '/auth/me');
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
