import { renderHook, waitFor } from '@testing-library/react';
import React from 'react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { AuthProvider, useAuth } from '../AuthProvider';
import { AuthService } from '../../services/AuthService';

vi.mock('../../services/AuthService', () => ({
	AuthService: { getInstance: vi.fn() },
}));

// setupTests.ts が useAuth を固定値でモックしているため、ここでは実物に戻す
vi.mock('@/features/core/auth/providers/AuthProvider', async (importOriginal) => await importOriginal() as any);

const wrapper = ({ children }: { children: React.ReactNode }) => (
	<AuthProvider>{children}</AuthProvider>
);

describe('AuthProvider - auth-hub 共有セッション（R-096）', () => {
	const mockMe = vi.fn();
	const mockGetToken = vi.fn();

	beforeEach(() => {
		mockMe.mockReset();
		mockGetToken.mockReset();
		localStorage.clear();
		(AuthService.getInstance as any).mockReturnValue({
			me: mockMe,
			getToken: mockGetToken,
			logout: vi.fn(),
		});
	});

	it('localStorage にJWTが無くても /auth/me を問い合わせる（df_session Cookie はJSから見えないため）', async () => {
		mockGetToken.mockReturnValue(null);
		mockMe.mockResolvedValue({
			valid: true,
			user: { id: 'u_shared', name: '共有 太郎', email: 'shared@example.com', is_representative: false },
			tenant: null,
			joinedTenants: [],
		});

		const { result } = renderHook(() => useAuth(), { wrapper });

		await waitFor(() => expect(result.current.isLoading).toBe(false));
		expect(mockMe).toHaveBeenCalled();
		expect(result.current.isAuthenticated).toBe(true);
		expect(result.current.user?.id).toBe('u_shared');
	});

	it('JWTも df_session も無ければ未認証のままにする', async () => {
		mockGetToken.mockReturnValue(null);
		mockMe.mockResolvedValue(null);

		const { result } = renderHook(() => useAuth(), { wrapper });

		await waitFor(() => expect(result.current.isLoading).toBe(false));
		expect(result.current.isAuthenticated).toBe(false);
	});
});
