import '@testing-library/jest-dom';
import { vi } from 'vitest';

// モック: ResizeObserver
global.ResizeObserver = class {
	observe() { }
	unobserve() { }
	disconnect() { }
};

// モック: matchMedia
Object.defineProperty(window, 'matchMedia', {
	writable: true,
	value: vi.fn().mockImplementation(query => ({
		matches: false,
		media: query,
		onchange: null,
		addListener: vi.fn(),
		removeListener: vi.fn(),
		addEventListener: vi.fn(),
		removeEventListener: vi.fn(),
		dispatchEvent: vi.fn(),
	})),
});

// モック: useAuth
vi.mock('@/features/core/auth/providers/AuthProvider', async (importOriginal) => {
	const actual = await importOriginal();
	return {
		...actual as any,
		useAuth: vi.fn(() => ({
			isAuthenticated: true,
			user: { id: 'test-user', name: 'Test User' },
			tenant: { id: 'test-tenant', name: 'Test Tenant' },
			login: vi.fn(),
			logout: vi.fn(),
		}))
	};
});
