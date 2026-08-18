import { describe, it, expect, vi, beforeEach } from 'vitest';
import { YoukanRepository } from './YoukanRepository';
import { ApiClient } from '../../../../api/client';

/**
 * R-137: getGdbShelf のユーザー特定は localStorage['youkan_user']（Cookieセッション認証では常に空）を
 * 参照しない。このRepository（ローカルDexie版）はgetRepository()が常にCloudYoukanRepositoryを返すため
 * 本番では到達しないが、テストの後方互換のため固定値'legacy_user'で db.projects を問い合わせることを確認する。
 */

vi.mock('../../../../api/client', () => ({
	ApiClient: {
		getGdbShelf: vi.fn().mockResolvedValue(null),
	}
}));

const equalsSpy = vi.fn().mockReturnValue({
	filter: () => ({ toArray: vi.fn().mockResolvedValue([]) })
});
const whereSpy = vi.fn().mockReturnValue({ equals: equalsSpy });

vi.mock('../../../../db/db', () => ({
	db: {
		projects: {
			where: (...args: any[]) => whereSpy(...args)
		},
		deliverables: {
			toArray: vi.fn().mockResolvedValue([])
		},
		doors: {
			filter: () => ({ toArray: vi.fn().mockResolvedValue([]) })
		}
	}
}));

describe('R-137: YoukanRepository.getGdbShelf のuserId解決', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		localStorage.clear();
	});

	it('localStorageにyoukan_userが設定されていても、db.projectsは固定のlegacy_userで問い合わせる', async () => {
		localStorage.setItem('youkan_user', JSON.stringify({ id: 'should-not-be-used' }));

		await YoukanRepository.getGdbShelf();

		expect(whereSpy).toHaveBeenCalledWith('userId');
		expect(equalsSpy).toHaveBeenCalledWith('legacy_user');
	});

	it('localStorageが空でも同じくlegacy_userで問い合わせる', async () => {
		await YoukanRepository.getGdbShelf();

		expect(equalsSpy).toHaveBeenCalledWith('legacy_user');
	});
});
