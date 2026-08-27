import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
	DndContext,
	DragOverlay,
	useSensors,
	useSensor,
	PointerSensor,
	KeyboardSensor,
	pointerWithin,
	DragStartEvent,
	DragEndEvent,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { Printer } from 'lucide-react';
import { useOverviewItems } from './useOverviewItems';
import { OverviewItem } from './OverviewItem';
import { InlineAddRow } from './InlineAddRow';
import { ViewControls } from './ViewControls';
import { QuickInputWidget } from '../Inputs/QuickInputWidget';
import { ContextMenu } from '../Common/ContextMenu';
import { useItemContextMenu } from '../../hooks/useItemContextMenu';
import { DependencyRepository } from '../../repositories/DependencyRepository';
import { YOUKAN_KEYS } from '../../../session/youkanKeys';
import { useFilter } from '../../contexts/FilterContext';
import { useAuth } from '../../../auth/providers/AuthProvider';
import { getSelectedTenantId } from '../../logic/filterUtils';
import { getInlineAddInsertIndex } from './inlineAddPosition';
import { Item } from '../../types';
import { decisionToStatus } from '../../logic/decisionResolution';
import { computeDragMoveOutcome } from '../../logic/dragMove';
import { useToast } from '../../../../../contexts/ToastContext';
import { useBeaverIntegration, useWorkPackageSummary } from '../../viewmodels/useBeaverIntegration';

interface OverviewBoardProps {
	viewModel: any;
	activeProject?: any | null;
	onOpenItem: (item: any) => void;
	hideCompleted?: boolean;
	onNavigateToFlow?: (projectId: string) => void;
}

export const OverviewBoard: React.FC<OverviewBoardProps> = ({ viewModel, activeProject, onOpenItem, hideCompleted = false, onNavigateToFlow }) => {
	const { filterMode } = useFilter();
	const { joinedTenants } = useAuth();
	const [showSomeday, setShowSomeday] = useState(false);
	// R-127: 全体一覧フィルタ「要判断」（buildReviewQueueの対象のみ表示）
	const [needsReviewOnly, setNeedsReviewOnly] = useState(false);
	// R-129: 全体一覧フィルタ「着手遅れ」（最遅着手日を過ぎた項目のみ表示）
	const [lateStartOnly, setLateStartOnly] = useState(false);
	const items = useOverviewItems(viewModel, activeProject, hideCompleted, showSomeday, needsReviewOnly, lateStartOnly);

	// R-156: 全体一覧Beaver連携バッジ（表示のみ。同期・負荷計算ロジックには触れない）
	const { overview: beaverOverview, linkByProjectId } = useBeaverIntegration();
	const workPackageSummary = useWorkPackageSummary(beaverOverview);
	const isBeaverLinkedProject = (projectId: string): boolean =>
		linkByProjectId.has(String(projectId)) || workPackageSummary.has(String(projectId));

	const [inlineAddProjectId, setInlineAddProjectId] = useState<string | null>(null);

	// header が消えたら state をリセット
	useEffect(() => {
		if (inlineAddProjectId) {
			const exists = items.some(w => w.type === 'header' && w.projectId === inlineAddProjectId);
			if (!exists) setInlineAddProjectId(null);
		}
	}, [items, inlineAddProjectId]);

	const [fontSize, setFontSize] = useState<number>(() => {
		const saved = localStorage.getItem(YOUKAN_KEYS.OVERVIEW_FONTSIZE);
		return saved ? parseInt(saved) : 11;
	});
	const [columnCount, setColumnCount] = useState<number>(() => {
		const saved = localStorage.getItem(YOUKAN_KEYS.OVERVIEW_COLUMNS);
		return saved ? parseInt(saved) : 3;
	});
	const [titleLimit, setTitleLimit] = useState<number>(() => {
		const saved = localStorage.getItem(YOUKAN_KEYS.OVERVIEW_TITLE_LIMIT);
		return saved ? parseInt(saved) : 20;
	});

	useEffect(() => {
		localStorage.setItem(YOUKAN_KEYS.OVERVIEW_FONTSIZE, fontSize.toString());
	}, [fontSize]);

	useEffect(() => {
		localStorage.setItem(YOUKAN_KEYS.OVERVIEW_COLUMNS, columnCount.toString());
	}, [columnCount]);

	useEffect(() => {
		localStorage.setItem(YOUKAN_KEYS.OVERVIEW_TITLE_LIMIT, titleLimit.toString());
	}, [titleLimit]);

	// R-155: ToastProviderの外でレンダーされる既存テスト等でも例外にならないよう、
	// 新規のトースト機構は作らず既存useToastをフォールバック付きで利用する
	let showToast: (toast: any) => void = () => { };
	try {
		({ showToast } = useToast());
	} catch {
		// ToastProvider未配下（既存テスト等）ではトースト表示をno-opにする
	}

	// --- R-155: 全体一覧ドラッグでプロジェクト移動 ---
	const sensors = useSensors(
		useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
		useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
	);
	const [activeDragId, setActiveDragId] = useState<string | null>(null);

	// hierarchy.ts の親子解決規則と同一のallItems（タスク＋プロジェクト）を、
	// 現在表示中のitemsから組み立てる（collectDescendantIds・resolveRootProjectIdで共有）
	const { allItemsFlat, allHeaderProjects } = useMemo(() => {
		const tasks: Item[] = [];
		const projects: Item[] = [];
		items.forEach(w => {
			if (w.type === 'item') tasks.push(w.item);
			else if (w.type === 'header') projects.push(w.project);
		});
		return { allItemsFlat: [...tasks, ...projects], allHeaderProjects: projects };
	}, [items]);

	const activeDraggedItem: Item | null = useMemo(() => {
		if (!activeDragId) return null;
		const w = items.find(w => w.type === 'item' && w.item.id === activeDragId);
		return w && w.type === 'item' ? w.item : null;
	}, [activeDragId, items]);

	const computeDropDisabled = (headerProject: Item): boolean => {
		if (!activeDraggedItem) return false;
		const outcome = computeDragMoveOutcome(activeDraggedItem, headerProject, allItemsFlat, allHeaderProjects);
		return !outcome.allowed;
	};

	const handleDragStart = (event: DragStartEvent) => {
		setActiveDragId(String(event.active.id));
	};

	const handleDragEnd = async (event: DragEndEvent) => {
		const { active, over } = event;
		setActiveDragId(null);
		if (!over) return;

		const taskId = String(active.id);
		const overId = String(over.id);
		if (!overId.startsWith('header-')) return;

		const draggedWrapper = items.find(w => w.type === 'item' && w.item.id === taskId);
		if (!draggedWrapper || draggedWrapper.type !== 'item') return;
		const draggedItem = draggedWrapper.item;

		const headerWrapper = items.find(w => w.type === 'header' && w.id === overId);
		if (!headerWrapper || headerWrapper.type !== 'header') return;
		const targetProject = headerWrapper.project;

		// フロント側の最終防御（UI上はdisabledで到達しないはずだが念のため）
		const outcome = computeDragMoveOutcome(draggedItem, targetProject, allItemsFlat, allHeaderProjects);
		if (!outcome.allowed) return;

		const previousUpdates = {
			projectId: draggedItem.projectId ?? null,
			parentId: draggedItem.parentId ?? null,
		};

		const result: any = await viewModel.updateItem(taskId, outcome.updates);

		if (result && result.success === false) {
			// R-155: 独自のロールバック機構は作らず、既存updateItemを逆方向に呼ぶだけで元へ戻す
			await viewModel.updateItem(taskId, previousUpdates);
			showToast({
				type: 'error',
				title: '移動に失敗しました',
				message: result.error?.message,
			});
			return;
		}

		showToast({
			type: 'success',
			title: `「${draggedItem.title}」を「${targetProject.title}」へ移動しました`,
			action: {
				label: '元に戻す',
				onClick: () => { viewModel.updateItem(taskId, previousUpdates); },
			},
		});
	};

	const { menuState: contextMenu, handleContextMenu, closeMenu } = useItemContextMenu({
		onDelete: (id) => viewModel.deleteItem(id)
	});

	// --- R-092: 前に挿入 / 後に挿入（ガントの submitInlineInsert と同等） ---
	const [inlineInsert, setInlineInsert] = useState<{ itemId: string; position: 'before' | 'after' } | null>(null);
	const inlineInsertSubmittingRef = useRef(false);
	// R-094-B: タイトル確定直後、この行の目安時間欄を自動編集状態にする（連続入力チェーン）
	const [chainAutoEditItemId, setChainAutoEditItemId] = useState<string | null>(null);

	const findItemById = (id: string): Item | null => {
		const w = items.find(w => (w.type === 'item' && w.item.id === id) || (w.type === 'header' && w.projectId === id));
		if (!w) return null;
		return w.type === 'item' ? w.item : w.project;
	};

	const startInlineInsert = (itemId: string, position: 'before' | 'after') => {
		setInlineInsert({ itemId, position });
		closeMenu();
	};

	const submitInlineInsert = async (title: string) => {
		if (inlineInsertSubmittingRef.current || !inlineInsert) return;
		const sourceItem = findItemById(inlineInsert.itemId);
		if (!sourceItem) {
			setInlineInsert(null);
			return;
		}

		const position = inlineInsert.position;
		inlineInsertSubmittingRef.current = true;
		let newItemId: string | null = null;
		try {
			newItemId = await viewModel.throwIn(title, sourceItem.tenantId, sourceItem.projectId);

			if (newItemId) {
				// R-084相当: 既存の依存関係を新規アイテム経由に繋ぎ変える（削除＋作成）
				const repo = new DependencyRepository();
				const existingDeps = await repo.getDependencies(sourceItem.id).catch(() => []);
				const relevantDeps = position === 'after'
					? existingDeps.filter(d => d.sourceItemId === sourceItem.id)
					: existingDeps.filter(d => d.targetItemId === sourceItem.id);

				for (const dep of relevantDeps) {
					await repo.deleteDependency(dep.id).catch(() => undefined);
					if (position === 'after') {
						await repo.createDependency(newItemId, dep.targetItemId).catch(() => undefined);
					} else {
						await repo.createDependency(dep.sourceItemId, newItemId).catch(() => undefined);
					}
				}

				await repo.createDependency(
					position === 'after' ? sourceItem.id : newItemId,
					position === 'after' ? newItemId : sourceItem.id
				).catch(() => undefined);
			}
		} catch (error) {
			console.error('Inline insert failed', error);
		} finally {
			inlineInsertSubmittingRef.current = false;
			if (newItemId) {
				// R-094-B: 連続入力チェーン。作成行の目安時間欄を自動編集状態にしつつ、
				// 次の挿入位置（今作成した行の前/後）に新しい空インライン行を出す
				setChainAutoEditItemId(newItemId);
				setInlineInsert({ itemId: newItemId, position });
			} else {
				setInlineInsert(null);
			}
		}
	};

	const quickInputProjectContext = (() => {
		if (activeProject) {
			return {
				id: activeProject.cloudId || String(activeProject.id),
				title: activeProject.name,
				name: activeProject.name,
				tenantId: activeProject.tenantId
			};
		}
		const tenantId = getSelectedTenantId(filterMode);
		if (tenantId) {
			const tenant = joinedTenants.find((t: any) => String(t.id) === tenantId);
			if (tenant) {
				const displayName = (tenant as any).title || tenant.name;
				return {
					title: displayName,
					name: displayName,
					tenantId
				};
			}
		}
		return null;
	})();

	// インライン入力行を挿入した描画用配列を構築
	const buildRows = () => {
		let result = items;

		if (inlineAddProjectId) {
			const insertIdx = getInlineAddInsertIndex(items, inlineAddProjectId);
			if (insertIdx !== -1) {
				const header = items.find(w => w.type === 'header' && w.projectId === inlineAddProjectId);
				const headerDepth = header ? header.depth : 0;

				result = [...result];
				result.splice(insertIdx, 0, {
					id: `__inline-add-${inlineAddProjectId}`,
					type: '__inlineAdd' as any,
					projectId: inlineAddProjectId,
					depth: headerDepth + 1,
				} as any);
			}
		}

		if (inlineInsert) {
			const targetIdx = result.findIndex(w => (w.type === 'item' && w.item.id === inlineInsert.itemId) || (w.type === 'header' && w.projectId === inlineInsert.itemId));
			if (targetIdx !== -1) {
				const target = result[targetIdx];
				const insertAt = inlineInsert.position === 'before' ? targetIdx : targetIdx + 1;
				result = [...result];
				result.splice(insertAt, 0, {
					id: `__inline-insert-${inlineInsert.position}-${inlineInsert.itemId}`,
					type: '__inlineInsert' as any,
					depth: target.depth,
				} as any);
			}
		}

		return result;
	};

	const rows = buildRows();

	return (
		<DndContext sensors={sensors} collisionDetection={pointerWithin} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
			<div data-testid="overview-layout" className="h-full flex flex-col bg-slate-50 dark:bg-slate-900 overflow-hidden">

			<div className="no-print flex-none relative z-20 flex items-center gap-2">
				<ViewControls
					fontSize={fontSize}
					columnCount={columnCount}
					titleLimit={titleLimit}
					onChangeFontSize={setFontSize}
					onChangeColumnCount={setColumnCount}
					onChangeTitleLimit={setTitleLimit}
					showSomeday={showSomeday}
					onChangeShowSomeday={setShowSomeday}
					needsReviewOnly={needsReviewOnly}
					onChangeNeedsReviewOnly={setNeedsReviewOnly}
					lateStartOnly={lateStartOnly}
					onChangeLateStartOnly={setLateStartOnly}
				/>
				{/* R-098: 印刷ボタン */}
				<button
					type="button"
					onClick={() => window.print()}
					title="印刷"
					className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-black rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400 transition-all active:scale-95"
				>
					<Printer className="w-3.5 h-3.5" />
					<span>印刷</span>
				</button>
			</div>

			<div
				ref={(el) => {
					if (el) {
						el.onwheel = (e) => {
							if (e.deltaY !== 0) {
								el.scrollLeft += e.deltaY;
								e.preventDefault();
							}
						};
					}
				}}
				className="flex-1 overflow-x-auto overflow-y-hidden px-4 pb-4 scrollbar-thin scrollbar-thumb-slate-300 dark:scrollbar-thumb-slate-700 select-none"
			>
				<div
					className="h-full py-2"
					style={{
						columnCount: columnCount,
						columnFill: 'auto',
						columnGap: '2em',
						columnRule: '1px dashed rgba(200, 200, 200, 0.2)',
						fontSize: `${fontSize}px`,
						columnWidth: `${fontSize * 15}px`,
						width: 'max-content',
						minWidth: '100%'
					}}
				>
					<div className="break-inside-avoid mb-[0.5em] p-[0.5em] bg-white dark:bg-slate-800 rounded shadow-sm border border-slate-200 dark:border-slate-700">
						<QuickInputWidget
							viewModel={viewModel}
							projectContext={quickInputProjectContext}
							placeholder="Alt+D to add..."
							autoFocus={false}
							className="bg-transparent border-none p-0 shadow-none"
							onRequestFallbackOpen={() => { }}
							onOpenItem={onOpenItem}
						/>
					</div>

					{rows.map(wrapper => {
						if ((wrapper as any).type === '__inlineInsert' && inlineInsert) {
							const w = wrapper as any;
							return (
								<InlineAddRow
									key={w.id}
									depth={w.depth}
									placeholder={inlineInsert.position === 'before' ? '前に追加...' : '後に追加...'}
									// R-094-B: 直前に作成した行の目安時間欄が編集中の間はこの行へフォーカスを奪わない
									autoFocus={chainAutoEditItemId !== inlineInsert.itemId}
									onSubmit={(title) => { submitInlineInsert(title); }}
									onCancel={() => setInlineInsert(null)}
								/>
							);
						}

						if ((wrapper as any).type === '__inlineAdd') {
							const w = wrapper as any;
							const header = items.find(h => h.type === 'header' && h.projectId === w.projectId);
							const project = header?.type === 'header' ? header.project : null;
							return (
								<InlineAddRow
									key={w.id}
									depth={w.depth}
									onSubmit={(title) => {
										if (project) {
											viewModel.throwIn(title, project.tenantId, String(project.id));
										}
										setInlineAddProjectId(null);
									}}
									onCancel={() => setInlineAddProjectId(null)}
								/>
							);
						}

						return (
							<OverviewItem
								key={wrapper.id}
								wrapper={wrapper as any}
								titleLimit={titleLimit}
								onClick={(item) => {
									onOpenItem(item);
								}}
								onContextMenu={handleContextMenu}
								onStartInlineAdd={(projectId) => {
									setInlineAddProjectId(projectId);
								}}
								onUpdateEstimatedMinutes={(itemId, minutes) => {
									viewModel.updateItem(itemId, { estimatedMinutes: minutes });
								}}
								autoStartTimeEdit={(wrapper as any).type === 'item' && (wrapper as any).item.id === chainAutoEditItemId}
								onAutoTimeEditDone={() => setChainAutoEditItemId(null)}
								onNavigateToFlow={onNavigateToFlow}
								dropDisabled={(wrapper as any).type === 'header' ? computeDropDisabled((wrapper as any).project) : undefined}
							isBeaverLinked={(wrapper as any).type === 'header' ? isBeaverLinkedProject((wrapper as any).projectId) : undefined}
							/>
						);
					})}

				</div>
			</div>

			{contextMenu && (
				<ContextMenu
					x={contextMenu.x}
					y={contextMenu.y}
					itemId={contextMenu.targetId!}
					onClose={closeMenu}
					actions={[
						{
							label: 'プロジェクト化',
							onClick: () => {
								viewModel.projectizeItem(contextMenu.targetId!);
							}
						},
						{
							label: '前に挿入 (a)',
							shortcut: 'a',
							onClick: () => startInlineInsert(contextMenu.targetId!, 'before')
						},
						{
							label: '後に挿入 (b)',
							shortcut: 'b',
							onClick: () => startInlineInsert(contextMenu.targetId!, 'after')
						},
						{
							label: '今日やる (Focus)',
							onClick: () => { viewModel.updateItem(contextMenu.targetId!, { status: 'focus' }); }
						},
						{
							label: '後日着手 (h)',
							shortcut: 'h',
							onClick: () => { viewModel.updateItem(contextMenu.targetId!, { status: decisionToStatus('later') }); }
						},
						{
							label: 'とりかかる (Execute)',
							onClick: () => { viewModel.setEngaged(contextMenu.targetId!, true); }
						},
						{
							label: '保留（外的要因待ち）(Pending)',
							onClick: () => { viewModel.updateItem(contextMenu.targetId!, { status: 'pending' }); }
						},
						{
							label: '💭 いつかやる (Someday)',
							onClick: () => { viewModel.moveToSomeday(contextMenu.targetId!); }
						},
						{
							label: '待機 (Waiting)',
							onClick: () => { viewModel.updateItem(contextMenu.targetId!, { status: 'waiting' }); }
						},
						{
							label: '完了にする (d)',
							shortcut: 'd',
							onClick: () => { viewModel.updateItem(contextMenu.targetId!, { status: 'done' }); }
						},
						{
							label: 'アーカイブ',
							onClick: () => { viewModel.archiveItem(contextMenu.targetId!); }
						},
						{
							label: 'ゴミ箱 (Del)',
							danger: true,
							onClick: () => { viewModel.deleteItem(contextMenu.targetId!); }
						}
					]}
				/>
			)}
		</div>
		<DragOverlay>
			{activeDraggedItem ? (
				<div className="px-2 py-1 rounded shadow-lg bg-white dark:bg-slate-800 border border-indigo-300 dark:border-indigo-700 text-[11px] font-bold text-slate-700 dark:text-slate-200">
					{activeDraggedItem.title}
				</div>
			) : null}
		</DragOverlay>
	</DndContext>
	);
};
