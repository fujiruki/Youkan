import React, { useState, useEffect, useRef } from 'react';
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
	const items = useOverviewItems(viewModel, activeProject, hideCompleted, showSomeday);

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

	const { menuState: contextMenu, handleContextMenu, closeMenu } = useItemContextMenu({
		onDelete: (id) => viewModel.deleteItem(id)
	});

	// --- R-092: 前に挿入 / 後に挿入（ガントの submitInlineInsert と同等） ---
	const [inlineInsert, setInlineInsert] = useState<{ itemId: string; position: 'before' | 'after' } | null>(null);
	const inlineInsertSubmittingRef = useRef(false);

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

		inlineInsertSubmittingRef.current = true;
		try {
			const newItemId = await viewModel.throwIn(title, sourceItem.tenantId, sourceItem.projectId);

			if (newItemId) {
				// R-084相当: 既存の依存関係を新規アイテム経由に繋ぎ変える（削除＋作成）
				const repo = new DependencyRepository();
				const existingDeps = await repo.getDependencies(sourceItem.id).catch(() => []);
				const relevantDeps = inlineInsert.position === 'after'
					? existingDeps.filter(d => d.sourceItemId === sourceItem.id)
					: existingDeps.filter(d => d.targetItemId === sourceItem.id);

				for (const dep of relevantDeps) {
					await repo.deleteDependency(dep.id).catch(() => undefined);
					if (inlineInsert.position === 'after') {
						await repo.createDependency(newItemId, dep.targetItemId).catch(() => undefined);
					} else {
						await repo.createDependency(dep.sourceItemId, newItemId).catch(() => undefined);
					}
				}

				await repo.createDependency(
					inlineInsert.position === 'after' ? sourceItem.id : newItemId,
					inlineInsert.position === 'after' ? newItemId : sourceItem.id
				).catch(() => undefined);
			}
		} catch (error) {
			console.error('Inline insert failed', error);
		} finally {
			inlineInsertSubmittingRef.current = false;
			setInlineInsert(null);
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
		<div data-testid="overview-layout" className="h-full flex flex-col bg-slate-50 dark:bg-slate-900 overflow-hidden">

			<div className="flex-none relative z-20">
				<ViewControls
					fontSize={fontSize}
					columnCount={columnCount}
					titleLimit={titleLimit}
					onChangeFontSize={setFontSize}
					onChangeColumnCount={setColumnCount}
					onChangeTitleLimit={setTitleLimit}
					showSomeday={showSomeday}
					onChangeShowSomeday={setShowSomeday}
				/>
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
								onNavigateToFlow={onNavigateToFlow}
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
						{ separator: true },
						{
							label: '今日やる (Focus)',
							onClick: () => { viewModel.updateItem(contextMenu.targetId!, { status: 'focus' }); }
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
						{ separator: true },
						{
							label: 'アーカイブ',
							onClick: () => { viewModel.archiveItem(contextMenu.targetId!); }
						},
						{
							label: 'ゴミ箱 (Del)',
							danger: true,
							onClick: () => { viewModel.deleteItem(contextMenu.targetId!); }
						}
					].filter(Boolean) as any}
				/>
			)}
		</div>
	);
};
