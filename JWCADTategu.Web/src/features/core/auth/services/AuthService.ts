import { BackendAuthResponse, LoginCredentials, RegisterCredentials } from '../types';
import { ApiClient } from '../../../../api/client';

/**
 * [R-096] auth-hub（社内共通認証基盤）のベースパス。
 * 本番は同一オリジンの `/contents/auth/`、開発は Vite の proxy が :8009 へ中継するため、
 * 環境によらず相対パスのままでよい。
 */
const AUTH_HUB_BASE = '/contents/auth';

export class AuthService {
	private static instance: AuthService;
	private readonly TOKEN_KEY = 'youkan_token';

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

	/** auth-hub のログイン画面URL。ログイン後は Youkan へ戻る */
	public authHubLoginUrl(): string {
		const redirect = import.meta.env.BASE_URL || '/';
		return `${AUTH_HUB_BASE}/login?redirect=${encodeURIComponent(redirect)}`;
	}

	/**
	 * 独自JWTと auth-hub の共有セッションの両方を破棄する。
	 * df_session は HttpOnly でJSから消せないため、auth-hub にサーバー側で失効させる。
	 * 未ログインや auth-hub 停止時に画面を巻き込まないよう、失敗は握りつぶす。
	 */
	public async logout(): Promise<void> {
		localStorage.removeItem(this.TOKEN_KEY);
		try {
			await fetch(`${AUTH_HUB_BASE}/logout`, { method: 'POST', credentials: 'same-origin' });
		} catch {
			/* noop */
		}
	}
}
