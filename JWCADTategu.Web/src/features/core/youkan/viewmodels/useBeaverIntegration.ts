import { useState, useEffect, useCallback, useMemo } from 'react';
import { BeaverApi, BeaverOverview, BeaverLink } from '../../../../api/beaver';

/**
 * R-153: Beaver連携の画面表示時同期＋overview取得（docs/SPEC/07_Beaver連携.md §9）
 *
 * - 表示時: sync(diff, force=false) → overview 取得（syncがクールダウンskippedでもoverviewは取る）
 * - 失敗（.env未設定の503含む）時は overview=null とし、Beaver UI を一切出さない
 */
export const useBeaverIntegration = () => {
	const [overview, setOverview] = useState<BeaverOverview | null>(null);
	const [syncing, setSyncing] = useState(false);
	const [syncFailed, setSyncFailed] = useState(false);

	const fetchOverview = useCallback(async () => {
		try {
			setOverview(await BeaverApi.getOverview());
		} catch {
			setOverview(null);
		}
	}, []);

	useEffect(() => {
		let cancelled = false;
		(async () => {
			try {
				await BeaverApi.sync('diff', false);
			} catch {
				// 同期失敗でもoverview取得は試みる（overviewも失敗すればUI非表示）
			}
			if (!cancelled) await fetchOverview();
		})();
		return () => { cancelled = true; };
	}, [fetchOverview]);

	const syncNow = useCallback(async () => {
		setSyncing(true);
		try {
			const res = await BeaverApi.sync('full', true);
			setSyncFailed(!!res.error);
		} catch {
			setSyncFailed(true);
		} finally {
			setSyncing(false);
		}
		await fetchOverview();
	}, [fetchOverview]);

	const linkByProjectId = useMemo(() => {
		const map = new Map<string, BeaverLink>();
		overview?.links.forEach(link => map.set(String(link.youkanProjectId), link));
		return map;
	}, [overview]);

	return { overview, linkByProjectId, syncNow, syncing, syncFailed };
};

/** リンク1件の結論1行（要確認 > 判定message の優先順） */
export const beaverConclusion = (link: BeaverLink): { text: string; shortage: boolean } | null => {
	if (link.syncState === 'missing_upstream') return { text: 'Beaver側から消えています・要確認', shortage: false };
	if (link.sourceStatus === 'キャンセル') return { text: 'Beaverでキャンセル・要確認', shortage: false };
	if (link.feasibility) return { text: link.feasibility.message, shortage: !link.feasibility.feasible };
	return null;
};

export const formatBeaverSyncedAt = (lastSyncedAt: number | null): string => {
	if (!lastSyncedAt) return 'なし';
	return new Date(lastSyncedAt * 1000).toLocaleString(undefined, {
		month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit',
	});
};
