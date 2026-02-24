import { db, Door, Project } from '../../../../db/db';
import { JudgableItem, JudgmentStatus, Item, CapacityConfig } from '../types';
import { Deliverable } from '../../../../features/plugins/manufacturing/types';
import { ApiClient } from '../../../../api/client';
import { YOUKAN_KEYS } from '../../session/youkanKeys';
import { v4 as uuidv4 } from 'uuid';

// src/features/youkan/repositories/YoukanRepository.ts

export const YoukanRepository = {
	// 1. Fetch all items (Hybrid: API Items + Local Doors)
	async getItemsByStatus(status: JudgmentStatus): Promise<JudgableItem[]> {
		// A. Fetch Items from Server API
		let apiItems: JudgableItem[] = [];
		try {
			const allItems = await ApiClient.getAllItems();
			apiItems = allItems.filter(i => i.status === status);
		} catch (e) {
			console.error('Failed to fetch from API:', e);
			// Fallback or empty? Empty for MVP to avoid mixed state confusion
		}

		// B. Fetch Doors from Local IndexedDB (Integration Logic)
		let doorItems: JudgableItem[] = [];
		try {
			const doors = await db.doors
				.where('judgmentStatus')
				.equals(status)
				.toArray();

			doorItems = await Promise.all(doors.map(async (d) => convertDoorToItem(d)));
		} catch (e) {
			console.error('Failed to fetch local doors:', e);
		}

		// C. Merge and Sort
		const merged = [...apiItems, ...doorItems];
		return merged.sort((a, b) => (b.statusUpdatedAt || 0) - (a.statusUpdatedAt || 0));
	},

	// 2. Add Item (To API)
	// [NEW] initialStatus: 'inbox' (default) or 'focus' (Ctrl+Enter)
	async addItemToInbox(title: string, tenantId?: string | null, projectId?: string | null, initialStatus: 'inbox' | 'focus' = 'inbox', assignedTo?: string): Promise<string> {
		const id = uuidv4();

		const newItem: Partial<JudgableItem> = {
			id,
			title,
			status: initialStatus, // [NEW] Use initialStatus
			tenantId,
			projectId,
			assignedTo, // [NEW]
			parentId: projectId // [FIX] Set parentId to link to Project (v21 Item-based Project)
		};

		try {
			await ApiClient.createItem(newItem);
		} catch (e) {
			console.warn('Failed to create Item via API:', e);
		}
		return id;
	},

	// 3. Update Status
	async updateStatus(id: string, status: JudgmentStatus): Promise<void> {
		// [Hybrid] Handle Virtual Door ID
		if (id.startsWith('door-')) {
			const doorId = parseInt(id.replace('door-', ''), 10);
			if (!isNaN(doorId)) {
				await db.doors.update(doorId, {
					judgmentStatus: status as any,
					updatedAt: new Date()
				});
				return;
			}
		}

		// [Hybrid] Handle Virtual Project ID [FIX]
		if (id.startsWith('project-')) {
			const projectId = parseInt(id.replace('project-', ''), 10);
			if (!isNaN(projectId)) {
				await db.projects.update(projectId, {
					judgmentStatus: status as any, // Project status mapped to JudgmentStatus
					updatedAt: new Date()
				});
				return;
			}
		}

		// Handled by API
		try {
			await ApiClient.updateItem(id, { status });
		} catch (e) {
			console.warn('Failed to update status via API:', e);
		}
	},

	// 4. Update Title
	async updateTitle(id: string, title: string): Promise<void> {
		// [Hybrid] Handle Virtual Door ID
		if (id.startsWith('door-')) {
			const doorId = parseInt(id.replace('door-', ''), 10);
			if (!isNaN(doorId)) {
				await db.doors.update(doorId, {
					name: title,
					updatedAt: new Date()
				});
				return;
			}
		}

		// [Hybrid] Handle Virtual Project ID [FIX]
		if (id.startsWith('project-')) {
			const projectId = parseInt(id.replace('project-', ''), 10);
			if (!isNaN(projectId)) {
				await db.projects.update(projectId, {
					name: title,
					updatedAt: new Date()
				});
				return;
			}
		}

		try {
			await ApiClient.updateItem(id, { title });
		} catch (e) {
			console.warn('Failed to update title via API:', e);
		}
	},

	// 5. Interrupt
	async markAsInterrupt(id: string): Promise<void> {
		if (id.startsWith('door-')) {
			const doorId = parseInt(id.replace('door-', ''), 10);
			await db.doors.update(doorId, {
				judgmentStatus: 'inbox',
				updatedAt: new Date()
			});
			return;
		}

		try {
			await ApiClient.updateItem(id, {
				status: 'inbox',
				interrupt: true as any // Cast for API compatibility
			});
		} catch (e) {
			console.warn('Failed to markAsInterrupt via API:', e);
		}
	},

	// 6. Delete
	async deleteItem(id: string): Promise<void> {
		if (id.startsWith('door-')) {
			const doorId = parseInt(id.replace('door-', ''), 10);
			if (!isNaN(doorId)) {
				await db.doors.delete(doorId); // Local: Hard Delete
				return;
			}
		}

		try {
			await ApiClient.deleteItem(id);
		} catch (e) {
			console.warn('Failed to deleteItem via API:', e);
		}
	},

	// 7. Archive & Trash
	async archiveItem(id: string): Promise<void> {
		if (id.startsWith('door-')) {
			const doorId = parseInt(id.replace('door-', ''), 10);
			if (!isNaN(doorId)) {
				await db.doors.update(doorId, {
					judgmentStatus: 'archive' as any,
					updatedAt: new Date()
				});
				return;
			}
		}

		try {
			await ApiClient.archiveItem(id);
		} catch (e) {
			console.warn('Failed to archiveItem via API:', e);
		}
	},

	async trashItem(id: string): Promise<void> {
		// [Hybrid] Legacy doors: Hard delete? Or implement local trash?
		// Legacy doors usually just use deleteItem.
		if (id.startsWith('door-')) {
			return this.deleteItem(id); // Legacy behavior
		}
		try {
			await ApiClient.trashItem(id);
		} catch (e) {
			console.warn('Failed to trashItem via API:', e);
		}
	},

	async restoreItem(id: string): Promise<void> {
		try {
			await ApiClient.restoreItem(id);
		} catch (e) {
			console.warn('Failed to restoreItem via API:', e);
		}
	},

	async destroyItem(id: string): Promise<void> {
		try {
			await ApiClient.destroyItem(id);
		} catch (e) {
			console.warn('Failed to destroyItem via API:', e);
		}
	},

	async getArchivedItems(projectId?: string): Promise<Item[]> {
		try {
			return await ApiClient.getAllItems({ project_id: projectId, show_archived: true });
		} catch (e) {
			console.error('Failed to getArchivedItems:', e);
			return [];
		}
	},

	async getTrashedItems(projectId?: string): Promise<Item[]> {
		try {
			return await ApiClient.getAllItems({ project_id: projectId, show_trash: true });
		} catch (e) {
			console.error('Failed to getTrashedItems:', e);
			return [];
		}
	},

	// 8. Dashboard Scope (Aggregated)
	async getDashboardItems(projectId?: string): Promise<JudgableItem[]> {
		try {
			// Fetch aggregated items (Personal + Company) from Server
			return await ApiClient.getAllItems({ scope: 'dashboard', project_id: projectId });
		} catch (e) {
			console.error('Failed to fetch Dashboard Items:', e);
			return [];
		}
	},

	// --- Phase 2: Backend Intelligence Methods ---

	// GDB Shelf View
	// GDB Shelf View
	async getGdbShelf(projectId?: string) {
		// 1. Fetch Server Data
		let apiShelf: { active: any[], preparation: any[], intent: any[], history: any[] } = { active: [], preparation: [], intent: [], history: [] };

		const mapApiItems = (items: any[]) => items.map(i => ({
			...i,
			isEngaged: i.isIntent ?? i.isEngaged ?? false
		}));

		try {
			const res = await ApiClient.getGdbShelf(projectId); // Pass Project ID
			if (res) {
				apiShelf = {
					active: mapApiItems(res.active || []),
					preparation: mapApiItems(res.preparation || []),
					intent: mapApiItems(res.intent || []),
					history: mapApiItems(res.history || [])
				};
			}
		} catch (e) {
			console.warn('Failed to fetch GDB from Server:', e);
		}

		// 2. Fetch Local Data (Projects & Doors)
		let localItems: JudgableItem[] = [];
		try {
			// Get Current User ID
			let userId = 'legacy_user';
			try {
				const u = JSON.parse(localStorage.getItem(YOUKAN_KEYS.USER) || '{}');
				if (u.id) userId = u.id;
			} catch { }

			// A. Projects (Treat as Inbox/Active if not archived)
			// Filter by userId
			// [NOTE] Projects themselves are not usually filtered by project (recursive?), 
			// but if we are in Project Focus, we probably don't want to see OTHER projects?
			// Let's assume we exclude Projects from Project Focus view for simplicity, or only show sub-projects?
			// Current spec: "そのプロジェクトに関するものだけが表示される"
			// So if projectId is set, we likely hide other project roots.
			const projects = await db.projects
				.where('userId').equals(userId)
				.filter(p => !p.isArchived)
				.toArray();

			// Fallback: If no userId index yet (or migrated legacy), try filtering manually for legacy
			// Actually indexed query is safer if migrated.

			let projectItems = projects.map(p => ({
				id: `project-${p.id}`,
				title: `📁 ${p.name}`, // Add icon to distinguish
				status: (p.judgmentStatus || 'inbox') as JudgmentStatus, // [FIX] Use persisted status
				updatedAt: new Date(p.updatedAt).getTime(),
				createdAt: new Date(p.createdAt).getTime(),
				category: 'project',
				type: 'project',
				isProject: true,
				focusOrder: 0,
				isEngaged: false
			} as JudgableItem));

			if (projectId) {
				// Hide other projects in project focus mode
				// Actually maybe we should hide projects entirely in project focus?
				// Or only show the current project?
				projectItems = projectItems.filter(p => p.id === `project-${projectId}`);
			}

			// B. Deliverables
			const deliverables = await db.deliverables.toArray();
			let deliverableItems = await Promise.all(deliverables.map(d => convertDeliverableToItem(d)));

			// [Migration/Fallback]
			const legacyDoors = await db.doors.filter(d => !d.deliverableId).toArray();
			let legacyDoorItems = await Promise.all(legacyDoors.map(d => convertDoorToItem(d)));

			// Filter Local Items by Project
			if (projectId) {
				// Need to filter deliverableItems and legacyDoorItems
				// But we need to resolve project name to project ID or vice versa?
				// convert functions return Item with projectId as NAME string... not ID.
				// Re-fetch project to get name?
				// Hack: Local items store projectId as ID integer usually in indexedDB.
				// deliverable.projectId is number.
				const pid = parseInt(projectId, 10);
				if (!isNaN(pid)) {
					deliverableItems = deliverableItems.filter(d => {
						// Deliverable source object (not Item) had projectId. We need to check source again?
						// Actually convertDeliverableToItem maps projectId -> project?.name.
						// We lost the ID in the Item conversion.
						// For correct filtering, we should filter BEFORE conversion or update conversion.
						// Since we have the raw arrays:
						// Use loose equality for safety against string/number mismatch in types vs runtime
						return (deliverables.find(raw => `deliverable-${raw.id}` === d.id)?.projectId as any) == pid;
					});
					legacyDoorItems = legacyDoorItems.filter(d => {
						return (legacyDoors.find(raw => `door-${raw.id}` === d.id)?.projectId as any) == pid;
					});
				}
			}

			localItems = [...projectItems, ...deliverableItems, ...legacyDoorItems];
		} catch (e) {
			console.error('Failed to fetch Local Data:', e);
		}

		// 3. Merge & Sort
		// Strategy: Categorize local items into Shelf buckets
		const mergedShelf = {
			// Inbox: 'inbox' + 'focus' (Stock/Generic Focus without date)
			active: [
				...(apiShelf.active || []),
				...localItems.filter(i => i.status === 'inbox' || i.status === 'focus' || !i.status)
			],
			// Waiting: 'waiting' + Legacy 'decision_hold' + Legacy 'scheduled'
			// (Note: 'ready' with date should strictly be in Calendar/Future, but if here, put in waiting or active? 
			//  Haruki says Future is separate. But 'scheduled' legacy was mostly "Future".
			//  Let's Mapping 'waiting' items here.)
			preparation: [
				...(apiShelf.preparation || []),
				// Legacy checks require casting if JudgmentStatus is strict
				...localItems.filter(i => (i.status as any) === 'waiting' || (i.status as any) === 'decision_hold')
			],
			// Pending: 'pending' + Legacy 'someday'/'intent'
			intent: [
				...(apiShelf.intent || []),
				...localItems.filter(i => (i.status as any) === 'pending' || (i.status as any) === 'someday' || (i.status as any) === 'intent')
			],
			// Log
			log: [
				...(apiShelf.history || []),
				...localItems.filter(i => (i.status as any) === 'done' || (i.status as any) === 'archive' || (i.status as any) === 'decision_rejected')
			]
		};

		const sortFn = (a: JudgableItem, b: JudgableItem) => (b.updatedAt || 0) - (a.updatedAt || 0);
		mergedShelf.active.sort(sortFn);
		mergedShelf.preparation.sort(sortFn);
		mergedShelf.intent.sort(sortFn);
		mergedShelf.log.sort(sortFn);

		return mergedShelf;
	},

	// Today View
	async getTodayView(projectId?: string) {
		const mapApiItems = (items: any[]) => items.map(i => ({
			...i,
			isEngaged: i.isIntent ?? i.isEngaged ?? false
		}));

		try {
			const res = await ApiClient.getTodayView(projectId);
			if (res) {
				return {
					commits: mapApiItems(res.commits || []),
					candidates: mapApiItems(res.candidates || []),
					execution: res.execution ? { ...res.execution, isEngaged: res.execution.isIntent ?? res.execution.isEngaged ?? false } : undefined
				};
			}
			return { commits: [], candidates: [], execution: undefined };
		} catch (e) {
			console.warn('Failed to fetch Today View from API, using Local Fallback:', e);

			try {
				// --- Local Fallback Logic (Hybrid) ---
				// Use explicit reference to allow mocking via object mutation in tests
				const localItems = await YoukanRepository.getGdbShelf(projectId); // [FIX] Pass Project ID

				if (!localItems || !localItems.active) {
					return { commits: [], candidates: [], execution: undefined };
				}

				const allItems = [...localItems.active, ...localItems.preparation, ...localItems.intent];

				const today = new Date();
				today.setHours(0, 0, 0, 0);

				const commits: Item[] = [];
				const candidates: Item[] = [];
				let execution: Item | undefined;

				for (const item of allItems) {
					// Logic: Focus + Flag = Commit
					// Logic: Focus + PrepDate <= Today = Candidate

					if (item.status === 'focus') {
						// Check Flags
						if (item.flags?.is_executing) {
							execution = item;
							commits.push(item);
						} else if (item.flags?.is_today_commit) {
							commits.push(item);
						} else if (item.prep_date) {
							// Check Date
							const pDate = new Date(item.prep_date * 1000);
							pDate.setHours(0, 0, 0, 0);
							if (pDate <= today) {
								candidates.push(item);
							}
						} else {
							// Focus with no date? -> Candidate (Stock)
							candidates.push(item);
						}
					}
				}

				// Sort
				commits.sort((a, b) => (a.weight || 0) - (b.weight || 0)); // High weight first? No, manual sort.

				return { commits, candidates, execution };
			} catch (fallbackError) {
				console.error('Failed to execute Local Fallback:', fallbackError);
				return { commits: [], candidates: [], execution: undefined };
			}
		}
	},

	// Decision Logic
	async resolveDecision(id: string, decision: 'yes' | 'hold' | 'no', note?: string) {
		// [Hybrid] Handle Local Updates (Projects/Doors)
		if (id.startsWith('project-')) {
			const projectId = parseInt(id.replace('project-', ''), 10);
			if (!isNaN(projectId)) {
				let status: JudgmentStatus = 'inbox';
				if (decision === 'hold') status = 'pending'; // Map hold to pending? Or waiting? 'hold' means "Pending" usually.
				// Wait, Haruki says Pending = Shelf. Waiting = Enveloped.
				// Decision 'hold' matches 'pending' (shelf) more than 'waiting'?
				// But actually 'hold' is usually "I can't decide yet" -> Information Waiting?
				// Let's map 'hold' -> 'pending' for safety as Shelf is safe.
				if (decision === 'yes') status = 'focus'; // Yes = Focus (Scheduled)

				if (decision === 'no' && note === 'someday') status = 'pending'; // Someday -> Pending
				if (decision === 'no' && note === 'archive') status = 'done'; // Archive -> Done
				await db.projects.update(projectId, {
					judgmentStatus: status as any,
					updatedAt: new Date()
				});
				return;
			}
		}
		if (id.startsWith('door-')) return;

		try {
			return await ApiClient.resolveDecision(id, decision, note);
		} catch (e) {
			console.warn('Failed to resolveDecision via API:', e);
		}
	},

	// Today Logic
	async commitToToday(id: string) {
		try {
			return await ApiClient.commitToToday(id);
		} catch (e) { console.warn(e); }
	},
	async startExecution(id: string) {
		try {
			return await ApiClient.startExecution(id);
		} catch (e) { console.warn(e); }
	},
	async completeItem(id: string) {
		try {
			return await ApiClient.completeItem(id);
		} catch (e) { console.warn(e); }
	},

	// Side Memo Logic
	async getMemos() {
		try {
			return await ApiClient.getMemos();
		} catch (e) {
			return [];
		}
	},
	async createMemo(content: string) {
		try {
			return await ApiClient.createMemo(content);
		} catch (e) {
			console.warn('Failed to create Memo via API:', e);
		}
	},
	async deleteMemo(id: string) {
		try {
			return await ApiClient.deleteMemo(id);
		} catch (e) {
			console.warn('Failed to delete Memo via API:', e);
		}
	},
	async moveMemoToInbox(id: string) {
		try {
			return await ApiClient.moveMemoToInbox(id);
		} catch (e) {
			console.warn('Failed to move Memo via API:', e);
		}
	},

	// Generic Update (For flexibility)
	async updateItem(id: string, data: Partial<Item>) {
		// [Hybrid] Handle Local Project ID
		if (id.startsWith('project-')) {
			const projectId = parseInt(id.replace('project-', ''), 10);
			if (!isNaN(projectId)) {
				// Map Item fields to Project fields
				const updates: any = {};
				if (data.status) updates.judgmentStatus = data.status;
				if (data.title) updates.name = data.title;

				updates.updatedAt = new Date();

				await db.projects.update(projectId, updates);
				return;
			}
		}

		// [Hybrid] Handle Deliverable ID
		if (id.startsWith('deliverable-')) {
			const deliverableId = id.replace('deliverable-', '');
			const updates: any = {};
			if (data.status) updates.judgmentStatus = data.status;
			if (data.title) updates.name = data.title;
			if (data.estimatedMinutes !== undefined) updates.estimatedWorkMinutes = data.estimatedMinutes;

			updates.updatedAt = Date.now();

			await db.deliverables.update(deliverableId, updates);
			return;
		}

		// [Legacy] Handle Local Door ID
		if (id.startsWith('door-')) {
			const doorId = parseInt(id.replace('door-', ''), 10);
			if (!isNaN(doorId)) {
				const updates: any = {};
				if (data.status) updates.judgmentStatus = data.status;
				if (data.title) updates.name = data.title;
				if (data.prep_date !== undefined) updates.prep_date = data.prep_date;
				if (data.estimatedMinutes !== undefined) updates.estimatedWorkMinutes = data.estimatedMinutes;
				if (data.work_days !== undefined) updates.manHours = data.work_days; // [FIX] Added mapping (manHours)

				updates.updatedAt = new Date(); // Legacy might expect Date object.
				await db.doors.update(doorId, updates);
				return;
			}
		}

		try {
			return await ApiClient.updateItem(id, data);
		} catch (e) {
			console.warn('Failed to update Item via API:', e);
		}
	},

	async createItem(item: Partial<Item>): Promise<string> {
		if (!item.id) {
			item.id = uuidv4();
		}

		try {
			await ApiClient.createItem(item);
		} catch (e) {
			console.warn('Failed to create Item via API:', e);
		}
		return item.id!;
	},

	async getSubTasks(parentId: string): Promise<Item[]> {
		try {
			// [Optimized] Use server-side filtering
			const allItems = await ApiClient.getAllItems({ parentId });
			return allItems;
		} catch (e) {
			return [];
		}
	},

	async getItemsBySourceId(sourceId: string): Promise<Item[]> {
		try {
			const allItems = await ApiClient.getAllItems();
			return allItems.filter(i => i.doorId === sourceId);
		} catch (e) {
			return [];
		}
	},

	async updateItemGeneric(id: string, updates: Partial<Item>): Promise<void> {
		try {
			await ApiClient.updateItem(id, updates);
		} catch (e) {
			console.warn('Failed to updateItemGeneric via API:', e);
		}
	},

	async getCapacityConfig(): Promise<CapacityConfig | null> {
		const record = await db.settings.get('capacity_config');
		return record ? record.value : null;
	},

	async saveCapacityConfig(config: CapacityConfig): Promise<void> {
		await db.settings.put({
			id: 'capacity_config',
			value: config,
			updatedAt: Date.now()
		});
	},

	async getMembers() {
		return await ApiClient.getMembers();
	},

	getProjects: async (scope?: 'personal' | 'company' | 'dashboard' | 'aggregated'): Promise<Item[]> => {
		// [Hybrid] Mock or use API if available
		return ApiClient.getProjects({ scope });
	},

	getJoinedTenants: async (): Promise<{ id: string; name: string; role: string }[]> => {
		return ApiClient.getJoinedTenants();
	}
};

// Helper function (Simulated private)
async function convertDoorToItem(door: Door): Promise<Item> {
	let project: Project | undefined;
	if (door.projectId) {
		project = await db.projects.get(door.projectId);
	}

	return {
		id: `door-${door.id}`,
		title: door.name,
		// Map legacy door status: ready -> focus
		status: (door.judgmentStatus === 'ready' ? 'focus' : (door.judgmentStatus || 'inbox')) as JudgmentStatus,
		statusUpdatedAt: new Date(door.updatedAt).getTime(), // Robust conversion
		interrupt: false,
		weight: door.weight || 1,
		projectId: project?.name,
		waitingReason: door.waitingReason,
		doorId: String(door.id),
		category: door.category || 'door',
		type: 'start',
		thumbnail: door.thumbnail,
		createdAt: new Date(door.createdAt).getTime(), // Robust conversion
		updatedAt: new Date(door.updatedAt).getTime(), // Robust conversion
		estimatedMinutes: door.estimatedWorkMinutes || 0, // [FIX] Added mapping
		work_days: door.manHours || 1, // [FIX] Added mapping (manHours)
		memo: door.tag + (project ? ` @${project.name}` : ''),
		focusOrder: 0,
		isEngaged: false
	};
}

async function convertDeliverableToItem(deliverable: Deliverable): Promise<Item> {
	let project: Project | undefined;
	if (deliverable.projectId) {
		project = await db.projects.get(deliverable.projectId);
	}

	// Deliverable timestamps are definitely numbers in Types, but robust check doesn't hurt.
	const createdAt = typeof deliverable.createdAt === 'number' ? deliverable.createdAt : new Date(deliverable.createdAt).getTime();
	const updatedAt = typeof deliverable.updatedAt === 'number' ? deliverable.updatedAt : new Date(deliverable.updatedAt).getTime();
	const statusUpdatedAt = deliverable.statusUpdatedAt
		? (typeof deliverable.statusUpdatedAt === 'number' ? deliverable.statusUpdatedAt : new Date(deliverable.statusUpdatedAt).getTime())
		: updatedAt;

	return {
		id: `deliverable-${deliverable.id}`,
		title: deliverable.name,
		status: (deliverable.status || 'inbox') as JudgmentStatus,
		statusUpdatedAt: statusUpdatedAt,
		interrupt: false,
		weight: 1,
		projectId: project?.name,
		doorId: deliverable.id,
		category: 'production',
		type: 'start',
		createdAt: createdAt,
		updatedAt: updatedAt,
		estimatedMinutes: deliverable.estimatedWorkMinutes,
		due_date: undefined,
		dueStatus: undefined,
		memo: (deliverable.description || '') + (project ? ` @${project.name}` : ''),
		focusOrder: 0,
		isEngaged: false
	};
}
