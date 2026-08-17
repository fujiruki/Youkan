import { ApiClient } from '../../../../api/client';
import { JudgableItem, JudgmentStatus, GdbShelf } from '../types';
import { Decision } from '../logic/decisionResolution';

// Cloud-First Repository Implementation
// Uses Unified Backend API (/api/items)

export const CloudYoukanRepository = {

	// 1. Fetch all items (Aggregated)
	getAllItems: async (): Promise<JudgableItem[]> => {
		try {
			// Use Aggregated Scope to get Personal + Company items
			return await ApiClient.getAllItems({ scope: 'aggregated' });
		} catch (e) {
			console.error('CloudRepo: Fetch Failed', e);
			throw e;
		}
	},

	// 2. Fetch by Status (Filtering on client side for now, or could use API filter)
	getItemsByStatus: async (status: JudgmentStatus): Promise<JudgableItem[]> => {
		try {
			const allItems = await ApiClient.getAllItems({ scope: 'aggregated' });
			return allItems
				.filter(i => i.status === status)
				.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
		} catch (e) {
			console.error('CloudRepo: Fetch Failed', e);
			throw e;
		}
	},

	// 3. Add Item (Inbox or Focus)
	// [NEW] initialStatus: 'inbox' (default) or 'focus' (Ctrl+Enter)
	addItemToInbox: async (title: string, tenantId?: string | null, projectId?: string | null, initialStatus: 'inbox' | 'focus' = 'inbox', assignedTo?: string): Promise<string> => {
		const res = await ApiClient.createItem({ title, status: initialStatus, tenantId, projectId, assignedTo });
		return res.id;
	},

	// 4. Update Status
	updateStatus: async (id: string, status: JudgmentStatus): Promise<void> => {
		await ApiClient.updateItem(id, { status });
	},

	// 5. GDB Shelf (Aggregated View)
	getGdbShelf: async (projectId?: string, scope?: 'aggregated' | 'dashboard' | 'personal' | 'company'): Promise<GdbShelf> => {
		// [REFINE] Some backends return empty for children when project_id is specified.
		// To ensure we can build the full hierarchy client-side, we fetch 'aggregated' scope.
		// We avoid project_id filter at API level if focused, trusting hierarchy.ts to filter correctly.
		const resolvedScope = projectId ? 'aggregated' : (scope || 'dashboard');
		const allItems = await ApiClient.getAllItems({
			scope: resolvedScope,
			...(projectId ? { project_id: projectId } : {}),
		});

		// R-124: cancelled（旧: decision_rejected）はどのバケットにも一致せず
		// シェルフから消えていた（全体一覧から却下アイテムが消える不具合の直接原因）。
		// 完了(done)と同じ「履歴」バケットへ分類する。decision_rejectedは
		// データ移行していない既存アイテムの表示互換のため合わせて拾う
		const isCancelled = (status: unknown) => status === 'cancelled' || status === 'decision_rejected';
		// R-125: decision_hold（旧「判断保留」）はpendingに概念上吸収する。
		// 新規書き込みは行わないが、DBマイグレーション未反映の既存データも表示互換として拾う
		const isPending = (status: unknown) => status === 'pending' || status === 'decision_hold';
		// R-125バグ修正: DecisionController.phpの「今日やる」がJudgmentStatus型外のレガシー値
		// confirmedを書き込んでいたバグ（§4.4.1違反）により生成された既存データが、
		// どのバケットにも一致せずシェルフから消えないよう、focus相当として拾う（読み取り互換のみ）
		const isActiveFocus = (status: unknown) => status === 'inbox' || status === 'focus' || status === 'confirmed';

		// Categorize based on Youkan Logic
		return {
			// [FIX] Include 'focus' items in active list to prevent disappearance from GDB views if not in Today View
			active: allItems.filter(i => isActiveFocus(i.status)),
			todo: allItems.filter(i => (i.status as string) === 'todo'), // R-125: 後日着手バケット
			preparation: allItems.filter(i => i.status === 'waiting'),
			intent: allItems.filter(i => isPending(i.status)),
			someday: allItems.filter(i => i.status === 'someday'), // R-029: Someday バケット
			log: allItems.filter(i => i.status === 'done' || isCancelled(i.status))
		};
	},

	// 6. Today View
	getTodayView: async (projectId?: string, scope?: 'aggregated' | 'dashboard' | 'personal' | 'company'): Promise<{ commits: JudgableItem[]; candidates: JudgableItem[]; execution: JudgableItem | null }> => {
		try {
			const res = await ApiClient.getTodayView(projectId, scope);
			return {
				commits: res.commits || [],
				candidates: res.candidates || [],
				execution: res.execution || null
			};
		} catch (e) {
			console.error('CloudRepo: GetTodayView Failed', e);
			return { commits: [], candidates: [], execution: null };
		}
	},

	// Standard Operations
	updateTitle: async (id: string, title: string) => {
		await ApiClient.updateItem(id, { title });
	},

	markAsInterrupt: async (id: string, isInterrupt: boolean) => {
		await ApiClient.updateItem(id, { interrupt: isInterrupt });
	},

	deleteItem: async (id: string) => {
		await ApiClient.deleteItem(id);
	},

	archiveItem: async (id: string) => {
		return await ApiClient.archiveItem(id);
	},

	trashItem: async (id: string) => {
		try {
			return await ApiClient.trashItem(id);
		} catch (e) {
			console.warn('Failed to trashItem via CloudYoukanRepository:', e);
			throw e;
		}
	},

	restoreItem: async (id: string) => {
		return await ApiClient.restoreItem(id);
	},

	destroyItem: async (id: string) => {
		return await ApiClient.destroyItem(id);
	},

	getArchivedItems: async (projectId?: string, scope?: string) => {
		return await ApiClient.getAllItems({ project_id: projectId, show_archived: true, scope: scope as any });
	},

	getTrashedItems: async (projectId?: string, scope?: string) => {
		return await ApiClient.getAllItems({ project_id: projectId, show_trash: true, scope: scope as any });
	},

	// Decisions
	resolveDecision: async (id: string, decision: Decision, note?: string, rdd?: number) => {
		await ApiClient.resolveDecision(id, decision, note, rdd);
	},

	// Execution
	commitToToday: async (id: string) => {
		await ApiClient.commitToToday(id);
	},

	startExecution: async (id: string) => {
		await ApiClient.startExecution(id);
	},

	completeItem: async (id: string) => {
		await ApiClient.completeItem(id);
	},

	// Memos
	getMemos: async () => ApiClient.getMemos(),

	createMemo: async (content: string) => ApiClient.createMemo(content),

	deleteMemo: async (id: string) => ApiClient.deleteMemo(id),

	moveMemoToInbox: async (id: string) => ApiClient.moveMemoToInbox(id),

	fetchItemsByIds: async (ids: string[]): Promise<JudgableItem[]> => {
		return await ApiClient.fetchItemsByIds(ids);
	},

	// Generic Update
	updateItem: async (id: string, updates: Partial<JudgableItem>) => {
		return await ApiClient.updateItem(id, updates);
	},

	createItem: async (item: Partial<JudgableItem>) => {
		const res = await ApiClient.createItem(item);
		return res.id;
	},

	// Subtasks
	getSubTasks: async (parentId: string): Promise<JudgableItem[]> => {
		return await ApiClient.getAllItems({ parentId });
	},

	getMembers: async () => {
		return await ApiClient.getMembers();
	},

	// Factory
	getItemsBySourceId: async (_sourceId: string) => {
		return [];
	},

	updateItemGeneric: async (id: string, updates: any) => {
		await ApiClient.updateItem(id, updates);
	},

	getCapacityConfig: async () => {
		try {
			const profile = await ApiClient.getUserProfile();
			const prefs = profile.preferences ? (typeof profile.preferences === 'string' ? JSON.parse(profile.preferences) : profile.preferences) : {};

			const baseConfig: any = {
				defaultDailyMinutes: profile.daily_capacity_minutes || 480,
				holidays: [],
				exceptions: {}
			};

			if (prefs.capacity_profile) {
				const cp = prefs.capacity_profile;
				if (cp.standardWeeklyPattern) baseConfig.standardWeeklyPattern = cp.standardWeeklyPattern;
				if (cp.defaultCompanyWeeklyPattern) baseConfig.defaultCompanyWeeklyPattern = cp.defaultCompanyWeeklyPattern;
				if (cp.dailyCompanyExceptions) baseConfig.dailyCompanyExceptions = cp.dailyCompanyExceptions;
				if (cp.exceptions && Object.keys(cp.exceptions).length > 0) baseConfig.exceptions = cp.exceptions;
			}
			return baseConfig;
		} catch (e) {
			console.error('CloudRepo: GetCapacityConfig Failed', e);
			return { defaultDailyMinutes: 480, holidays: [], exceptions: {} };
		}
	},

	getProjects: async (scope?: 'personal' | 'company' | 'dashboard' | 'aggregated'): Promise<JudgableItem[]> => {
		const projects = await ApiClient.getProjects({ scope });
		return (projects || []).map(p => ({
			...p,
			title: p.title || p.name,
		}));
	},

	getJoinedTenants: async (): Promise<{ id: string; name: string; role: string }[]> => {
		return await ApiClient.getJoinedTenants();
	},

	saveCapacityConfig: async (config: any) => {
		try {
			const profile = await ApiClient.getUserProfile();
			const prefs = profile.preferences ? (typeof profile.preferences === 'string' ? JSON.parse(profile.preferences) : profile.preferences) : {};
			prefs.capacity_profile = config;
			await ApiClient.updateUserProfile({
				preferences: prefs,
				daily_capacity_minutes: config.defaultDailyMinutes
			});
		} catch (e) {
			console.error('CloudRepo: SaveCapacityConfig Failed', e);
			throw e;
		}
	}
};
