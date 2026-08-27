import { ApiClient } from './client';

/**
 * R-153: Beaver連携 API ラッパー
 *
 * - エンドポイントは docs/SPEC/07_Beaver連携.md §5・§7.3・§8 に準拠
 * - .env 未設定時は 503 が返る（呼び出し側で縮退し、Beaver UI を出さない）
 */
export interface BeaverFeasibility {
	feasible: boolean;
	shortageMinutes: number;
	earliestCompletionDate: string | null;
	deadline: string | null;
	message: string;
}

export interface BeaverWorkPackage {
	externalWorkPackageId: string;
	youkanItemId: string;
	label: string;
	category: string | null;
	baselineMinutes: number;
	decomposedMinutes: number;
	effectiveTotalMinutes: number;
	virtualResidualMinutes: number;
	overageMinutes: number;
	syncState: 'ok' | 'missing_upstream';
}

export interface BeaverLink {
	externalProjectId: number;
	youkanProjectId: string;
	name: string;
	sourceStatus: string | null;
	syncState: 'ok' | 'missing_upstream' | 'target_missing';
	deliveryDate: string | null;
	baselineMinutes: number | null;
	baselineSource: string | null;
	feasibility: BeaverFeasibility | null;
	workPackages: BeaverWorkPackage[];
}

export interface BeaverOverview {
	links: BeaverLink[];
	lastSyncedAt: number | null;
	lastError: string | null;
}

export interface BeaverSyncResult {
	synced?: number;
	created?: number;
	updated?: number;
	skipped?: boolean;
	lastSyncedAt: number | null;
	error: string | null;
}

interface BeaverFeasibilityRow {
	feasible: boolean;
	shortage_minutes: number;
	earliest_completion_date: string | null;
	deadline: string | null;
	message: string;
}

// R-154: docs/SPEC/08_Beaver連携Y2.md §10 の work_packages 応答形
interface BeaverWorkPackageRow {
	external_work_package_id: string;
	youkan_item_id: string;
	label: string;
	category: string | null;
	baseline_minutes: number;
	decomposed_minutes: number;
	effective_total_minutes: number;
	virtual_residual_minutes: number;
	overage_minutes: number;
	sync_state: BeaverWorkPackage['syncState'];
}

// backend/services/BeaverCapacityService.php buildOverview() の実応答形（source_*/check）
interface BeaverLinkRow {
	external_project_id: number;
	youkan_project_id: string;
	source_name: string;
	source_status: string | null;
	sync_state: BeaverLink['syncState'];
	source_delivery_date: string | null;
	baseline_minutes: number | null;
	baseline_source: string | null;
	check: BeaverFeasibilityRow | null;
	work_packages?: BeaverWorkPackageRow[];
}

const toWorkPackage = (row: BeaverWorkPackageRow): BeaverWorkPackage => ({
	externalWorkPackageId: row.external_work_package_id,
	youkanItemId: row.youkan_item_id,
	label: row.label,
	category: row.category,
	baselineMinutes: row.baseline_minutes,
	decomposedMinutes: row.decomposed_minutes,
	effectiveTotalMinutes: row.effective_total_minutes,
	virtualResidualMinutes: row.virtual_residual_minutes,
	overageMinutes: row.overage_minutes,
	syncState: row.sync_state,
});

const toLink = (row: BeaverLinkRow): BeaverLink => ({
	externalProjectId: row.external_project_id,
	youkanProjectId: row.youkan_project_id,
	name: row.source_name,
	sourceStatus: row.source_status,
	syncState: row.sync_state,
	deliveryDate: row.source_delivery_date,
	baselineMinutes: row.baseline_minutes,
	baselineSource: row.baseline_source,
	feasibility: row.check ? {
		feasible: row.check.feasible,
		shortageMinutes: row.check.shortage_minutes,
		earliestCompletionDate: row.check.earliest_completion_date,
		deadline: row.check.deadline,
		message: row.check.message,
	} : null,
	workPackages: (row.work_packages ?? []).map(toWorkPackage),
});

export const BeaverApi = {
	async sync(mode: 'diff' | 'full', force: boolean): Promise<BeaverSyncResult> {
		const res = await ApiClient.request<any>('POST', '/integrations/beaver/sync', { mode, force }, true);
		return {
			synced: res.synced,
			created: res.created,
			updated: res.updated,
			skipped: res.skipped,
			lastSyncedAt: res.last_synced_at ?? null,
			error: res.error ?? null,
		};
	},

	async getOverview(): Promise<BeaverOverview> {
		const res = await ApiClient.request<any>('GET', '/integrations/beaver/overview', undefined, true);
		return {
			links: (res.links ?? []).map(toLink),
			lastSyncedAt: res.last_synced_at ?? null,
			lastError: res.last_error ?? null,
		};
	},
};
