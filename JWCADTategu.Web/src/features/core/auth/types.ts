export interface AuthUser {
	id: string;
	name: string;
	email: string;
	isRepresentative?: boolean;
	activeTaskId?: string; // [JBWOS] Current Focus Pointer
	accountType?: 'user' | 'tenant'; // [FIX] Added account type
	preferences?: any;
}

export interface Tenant {
	id: string;
	/** @deprecated Use title instead */
	name: string;
	title: string; // Unified Title
	role: string;
	representativeName?: string;
	representativeEmail?: string;
}

export interface JbwosTenant extends Tenant {
	// Basic Info
	address?: string;
	address_zip?: string;
	phone?: string;
	invoiceNumber?: string; // T+13桁

	// Commerce
	bankInfo?: {
		bankName: string;
		accountType: string;
		accountNumber: string;
		accountHolder: string;
	};

	// Settings
	closingDate?: number; // 締め日

	// Plugin Configuration
	config?: TenantConfig;
}

export interface TenantConfig {
	plugins: {
		manufacturing: boolean; // 製造業向け機能
		tategu: boolean;       // 建具エディタ (Requires manufacturing)
		[key: string]: boolean;
	};
}

export interface AuthResponse {
	token: string;
	user: AuthUser;
	tenant: Tenant;
}

export interface BackendAuthUser {
	id: string;
	name: string;
	email: string;
	is_representative: boolean;
	preferences?: any;
	sub?: string; // from me()
}

export interface BackendAuthResponse {
	token?: string;
	user: BackendAuthUser;
	tenant: Tenant | null;
	joinedTenants?: Tenant[];
	valid?: boolean;
}

export interface LoginCredentials {
	email: string;
	password: string;
}

export interface RegisterCredentials {
	name: string;
	email: string;
	password: string;
	type?: 'user' | 'proprietor' | 'company';
	company_name?: string;
	personal_email?: string; // For proprietor: separate email for user account
}
