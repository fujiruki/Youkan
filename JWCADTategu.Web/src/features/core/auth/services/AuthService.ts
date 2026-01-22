import { AuthResponse, LoginCredentials } from '../types';

const API_BASE = '/api'; // Proxy handles this or absolute URL

export class AuthService {
    private static instance: AuthService;

    private constructor() { }

    public static getInstance(): AuthService {
        if (!AuthService.instance) {
            AuthService.instance = new AuthService();
        }
        return AuthService.instance;
    }

    public async login(credentials: LoginCredentials): Promise<AuthResponse> {
        const response = await fetch(`${API_BASE}/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(credentials),
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({ error: 'Unknown Error' }));
            throw new Error(error.message || error.error || 'Login Failed');
        }

        return response.json();
    }

    public getToken(): string | null {
        return localStorage.getItem('jbwos_token');
    }
}
