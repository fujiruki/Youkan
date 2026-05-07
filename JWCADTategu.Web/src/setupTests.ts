import '@testing-library/jest-dom';
import { vi } from 'vitest';

// モック: SpeechSynthesisUtterance
if (typeof SpeechSynthesisUtterance === 'undefined') {
	class SpeechSynthesisUtteranceMock {
		text: string;
		lang: string = 'ja-JP';
		rate: number = 1;
		pitch: number = 1;
		volume: number = 1;
		onstart: ((e: Event) => void) | null = null;
		onend: ((e: Event) => void) | null = null;
		onerror: ((e: Event) => void) | null = null;
		constructor(text: string) { this.text = text; }
	}
	(global as any).SpeechSynthesisUtterance = SpeechSynthesisUtteranceMock;
}

// モック: speechSynthesis（未定義の場合）
if (typeof window.speechSynthesis === 'undefined') {
	Object.defineProperty(window, 'speechSynthesis', {
		writable: true,
		value: {
			speak: vi.fn(),
			pause: vi.fn(),
			resume: vi.fn(),
			cancel: vi.fn(),
			speaking: false,
			pending: false,
			paused: false,
		},
	});
}

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
