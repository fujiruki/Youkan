/**
 * R-137: CompanySettingsScreen の権限判定（isAdmin・自分自身の除外）は
 * useAuth（/auth/me）由来のuser/tenantで行う。Cookieセッション認証では常に空の
 * localStorage['youkan_user']/['youkan_tenant']へは、もうフォールバックしないことを確認する。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { CompanySettingsScreen } from './CompanySettingsScreen';

vi.mock('../../../../api/client', () => ({
	ApiClient: {
		request: vi.fn(),
	}
}));

describe('R-137: CompanySettingsScreen の権限判定は useAuth 由来のuser/tenantで行う', () => {
	beforeEach(async () => {
		vi.clearAllMocks();
		localStorage.clear();
		const { ApiClient } = await import('../../../../api/client');
		vi.mocked(ApiClient.request).mockResolvedValue([
			{ id: 'test-user', email: 'me@example.com', display_name: '自分', role: 'admin', joined_at: '2026-01-01' },
			{ id: 'other-user', email: 'other@example.com', display_name: '他人', role: 'user', joined_at: '2026-01-02' },
		]);
	});

	it('localStorageにyoukan_user/youkan_tenantが無くても、useAuthのtenantがあれば招待フォームが有効になる', async () => {
		// setupTests.ts のグローバル useAuth モック: user.id='test-user', tenant.id='test-tenant'
		render(<CompanySettingsScreen onNavigateHome={vi.fn()} />);

		await waitFor(() => {
			expect(screen.getByText('自分')).toBeInTheDocument();
		});

		const emailInput = screen.getByPlaceholderText('colleague@example.com') as HTMLInputElement;
		expect(emailInput.disabled).toBe(false);
	});

	it('localStorageにyoukan_user/youkan_tenantが無くても、useAuthのuser.idと一致する自分自身には削除ボタンが出ない', async () => {
		render(<CompanySettingsScreen onNavigateHome={vi.fn()} />);

		await waitFor(() => {
			expect(screen.getByText('自分')).toBeInTheDocument();
		});

		const selfRow = screen.getByText('自分').closest('tr');
		const otherRow = screen.getByText('他人').closest('tr');

		expect(selfRow?.querySelector('[title="Remove user from company"]')).toBeNull();
		expect(otherRow?.querySelector('[title="Remove user from company"]')).not.toBeNull();
	});
});
