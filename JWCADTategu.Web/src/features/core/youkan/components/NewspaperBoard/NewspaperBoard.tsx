import React, { useState, useEffect } from 'react';
import { useNewspaperItems } from './useNewspaperItems';
import { NewspaperItem } from './NewspaperItem';
import { ViewControls } from './ViewControls';
import { QuickInputWidget } from '../Inputs/QuickInputWidget';
import { ContextMenu } from '../GlobalBoard/ContextMenu';
import { useItemContextMenu } from '../../hooks/useItemContextMenu';
import { YOUKAN_KEYS } from '../../../session/youkanKeys';

interface NewspaperBoardProps {
	viewModel: any; // Type from hook return
	activeProject?: any | null; // From Dashboard
	onOpenItem: (item: any) => void;
	hideCompleted?: boolean;
}

export const NewspaperBoard: React.FC<NewspaperBoardProps> = ({ viewModel, activeProject, onOpenItem, hideCompleted = false }) => {
	// const { joinedTenants } = useAuth(); // Unused for now
	const items = useNewspaperItems(viewModel, activeProject, hideCompleted);

	// View State (Persisted)
	const [fontSize, setFontSize] = useState<number>(() => {
		const saved = localStorage.getItem(YOUKAN_KEYS.NEWSPAPER_FONTSIZE);
		return saved ? parseInt(saved) : 11;
	});
	const [columnCount, setColumnCount] = useState<number>(() => {
		const saved = localStorage.getItem(YOUKAN_KEYS.NEWSPAPER_COLUMNS);
		return saved ? parseInt(saved) : 3;
	});
	// [NEW] Title Character Limit Setting
	const [titleLimit, setTitleLimit] = useState<number>(() => {
		const saved = localStorage.getItem(YOUKAN_KEYS.NEWSPAPER_TITLE_LIMIT);
		return saved ? parseInt(saved) : 20;
	});

	useEffect(() => {
		localStorage.setItem(YOUKAN_KEYS.NEWSPAPER_FONTSIZE, fontSize.toString());
	}, [fontSize]);

	useEffect(() => {
		localStorage.setItem(YOUKAN_KEYS.NEWSPAPER_COLUMNS, columnCount.toString());
	}, [columnCount]);

	useEffect(() => {
		localStorage.setItem(YOUKAN_KEYS.NEWSPAPER_TITLE_LIMIT, titleLimit.toString());
	}, [titleLimit]);

	// Context Menu State
	const stripId = (id: string) => id.replace('virtual-header-', '');
	const { menuState: contextMenu, handleContextMenu, closeMenu } = useItemContextMenu({
		onDelete: (id) => viewModel.deleteItem(stripId(id))
	});

	// [REMOVED] overridesProjectContext and quickInputKey - replaced by inline input in NewspaperItem

	// Quick Input: Needs to be integrated into the layout or floating?
	// Design says: "Header area or first item".
	// Implementation Plan: "Renders QuickInputWidget as the first item."
	// BUT we have a hook returning items. We can just render it before the columns usually, or inside the columns?
	// If inside columns, it flows. 
	// Let's render it sticky top left or inside the flow.
	// Inside flow logic: Newspaper Layout usually flows text.
	// If we put it OUTSIDE the columns, it stays top.
	// If we put it INSIDE, it might end up at bottom of col 1.
	// Let's float it? Or sticky header?
	// The design mentioned: "Items sorted: QuickInput (virtual)"
	// So it should be the very first element inside the columns.

	return (
		<div className="h-full flex flex-col bg-slate-50 dark:bg-slate-900 overflow-hidden">

			{/* Controls Header */}
			<div className="flex-none relative z-20">
				<ViewControls
					fontSize={fontSize}
					columnCount={columnCount}
					titleLimit={titleLimit}
					onChangeFontSize={setFontSize}
					onChangeColumnCount={setColumnCount}
					onChangeTitleLimit={setTitleLimit}
				/>
			</div>

			{/* Main Content Area (Horizontal Scroll is Primary - Newspaper Style) */}
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
						// [FIX] Layout: Ensure content flows horizontally
						columnWidth: `${fontSize * 25}px`,
						width: 'max-content',
						minWidth: '100%'
					}}
				>
					{/* Quick Input (Inside Columns) */}
					<div className="break-inside-avoid mb-[0.5em] p-[0.5em] bg-white dark:bg-slate-800 rounded shadow-sm border border-slate-200 dark:border-slate-700">
						<QuickInputWidget
							viewModel={viewModel}
							projectContext={activeProject ? {
								id: activeProject.cloudId || String(activeProject.id),
								name: activeProject.name,
								tenantId: activeProject.tenantId
							} : null}
							placeholder="Alt+D to add..."
							autoFocus={false}
							className="bg-transparent border-none p-0 shadow-none"
							onRequestFallbackOpen={() => { }}
							onOpenItem={onOpenItem}
						/>
					</div>

					{items.map(wrapper => (
						<NewspaperItem
							key={wrapper.id}
							wrapper={wrapper}
							titleLimit={titleLimit}
							onClick={(item) => {
								onOpenItem(item);
							}}
							onContextMenu={handleContextMenu}
							onAddChild={(projItem, title) => {
								const projectId = projItem.id.startsWith('virtual-header-')
									? projItem.id.replace('virtual-header-', '')
									: String(projItem.id);
								viewModel.throwIn(title, projItem.tenantId, projectId);
							}}
						/>
					))}

				</div>
			</div>

			{contextMenu && (
				<ContextMenu
					x={contextMenu.x}
					y={contextMenu.y}
					itemId={stripId(contextMenu.targetId!)}
					onClose={closeMenu}
					actions={[
						{
							label: 'プロジェクト化',
							onClick: () => {
								viewModel.projectizeItem(stripId(contextMenu.targetId!));
							}
						},
						{ separator: true }, // Visual Separator if supported by ContextMenu, otherwise ignored
						{
							label: '今日やる (Focus)',
							onClick: () => { viewModel.updateItem(stripId(contextMenu.targetId!), { status: 'focus' }); }
						},
						{
							label: 'とりかかる (Execute)',
							onClick: () => { viewModel.setEngaged(stripId(contextMenu.targetId!), true); }
						},
						{
							label: '保留 (Pending)',
							onClick: () => { viewModel.updateItem(stripId(contextMenu.targetId!), { status: 'pending' }); }
						},
						{
							label: '待機 (Waiting)',
							onClick: () => { viewModel.updateItem(stripId(contextMenu.targetId!), { status: 'waiting' }); }
						},
						{
							label: '完了 (Done)',
							onClick: () => { viewModel.updateItem(stripId(contextMenu.targetId!), { status: 'done' }); }
						},
						{ separator: true },
						{
							label: 'アーカイブ',
							onClick: () => { viewModel.archiveItem(stripId(contextMenu.targetId!)); }
						},
						{
							label: '削除',
							danger: true,
							onClick: () => { viewModel.deleteItem(stripId(contextMenu.targetId!)); }
						}
					].filter(Boolean) as any} // Cast for separator support if needed
				/>
			)}
		</div>
	);
};
