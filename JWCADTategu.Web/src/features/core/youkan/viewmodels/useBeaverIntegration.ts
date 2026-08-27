import { useState, useEffect, useCallback, useMemo } from 'react';
import { BeaverApi, BeaverOverview, BeaverLink, BeaverWorkPackage } from '../../../../api/beaver';

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

/**
 * R-154: 分を時間表示に変換する（backend/services/BeaverCapacityService.php::formatHours と同じ丸め・末尾0除去）
 */
export const formatHours = (minutes: number): string => {
	const hours = Math.round((minutes / 60) * 10) / 10;
	return hours.toFixed(1).replace(/\.?0+$/, '') || '0';
};

const formatDecomposeLine = (baselineMinutes: number, decomposedMinutes: number, virtualResidualMinutes: number, overageMinutes: number): string => {
	if (overageMinutes > 0) {
		return `基準${formatHours(baselineMinutes)}h→現在計画${formatHours(decomposedMinutes)}h（+${formatHours(overageMinutes)}h）`;
	}
	return `分解済み${formatHours(decomposedMinutes)}h／未分解${formatHours(virtualResidualMinutes)}h`;
};

/**
 * R-154: 案件カードのwork_package段階分解1行（docs/SPEC/08_Beaver連携Y2.md §6.3・§11）
 * work_packagesが空ならnull（Y1表示を変えない）
 */
export const workPackageDecomposeLine = (link: BeaverLink): string | null => {
	if (link.workPackages.length === 0) return null;
	const baseline = link.baselineMinutes ?? 0;
	const decomposed = link.workPackages.reduce((sum, wp) => sum + wp.effectiveTotalMinutes, 0);
	const virtualResidual = Math.max(0, baseline - decomposed);
	const overage = Math.max(0, decomposed - baseline);
	return formatDecomposeLine(baseline, decomposed, virtualResidual, overage);
};

/** work_package行1件分の「基準◯h／分解済み◯h」1行（APIが返す値をそのまま文言化） */
export const workPackageRowLine = (wp: BeaverWorkPackage): string =>
	formatDecomposeLine(wp.baselineMinutes, wp.decomposedMinutes, wp.virtualResidualMinutes, wp.overageMinutes);

/** R-154: overviewの全work_packagesをyoukanItemIdでMap化する薄いフック */
export const useWorkPackageSummary = (overview: BeaverOverview | null): Map<string, BeaverWorkPackage> => {
	return useMemo(() => {
		const map = new Map<string, BeaverWorkPackage>();
		overview?.links.forEach(link => link.workPackages.forEach(wp => map.set(wp.youkanItemId, wp)));
		return map;
	}, [overview]);
};
