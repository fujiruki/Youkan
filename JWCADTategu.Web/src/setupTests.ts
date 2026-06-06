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

// モック: Element.scrollTo / scrollIntoView / window.scrollTo（jsdom 未実装対策）
if (typeof Element !== 'undefined') {
	if (!(Element.prototype as any).scrollTo) {
		(Element.prototype as any).scrollTo = function () { };
	}
	if (!(Element.prototype as any).scrollIntoView) {
		(Element.prototype as any).scrollIntoView = function () { };
	}
}
if (typeof window !== 'undefined' && !window.scrollTo) {
	window.scrollTo = (() => { }) as any;
}

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

// モック: fetch（テスト個別にモック上書き可能）
// 相対パス '/api/...' を URL parse 失敗させないため、Unhandled Rejection を防止する
if (typeof globalThis.fetch === 'function') {
	const originalFetch = globalThis.fetch.bind(globalThis);
	globalThis.fetch = ((input: any, init?: any) => {
		try {
			if (typeof input === 'string' && input.startsWith('/')) {
				// 相対パスは jsdom 環境では Invalid URL になるため、ネットワーク到達失敗扱いで Reject
				return Promise.reject(new Error('Network unavailable in tests: ' + input));
			}
		} catch { /* noop */ }
		return originalFetch(input, init);
	}) as typeof fetch;
}

// モック: DependencyRepository（テスト時は依存関係 API を呼ばず空配列を返す）
vi.mock('@/features/core/youkan/repositories/DependencyRepository', () => ({
	DependencyRepository: class {
		async getDependencies() { return []; }
		async createDependency() { return { id: '', sourceItemId: '', targetItemId: '' }; }
		async deleteDependency() { return; }
	}
}));

// モック: useAuth
vi.mock('@/features/core/auth/providers/AuthProvider', async (importOriginal) => {
	const actual = await importOriginal();
	return {
		...actual as any,
		useAuth: vi.fn(() => ({
			isAuthenticated: true,
			user: { id: 'test-user', name: 'Test User' },
			tenant: { id: 'test-tenant', name: 'Test Tenant' },
			joinedTenants: [],
			login: vi.fn(),
			logout: vi.fn(),
		}))
	};
});
