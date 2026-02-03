import React, { useState, useEffect } from 'react';
import { useNewspaperItems } from './useNewspaperItems';
import { NewspaperItem } from './NewspaperItem';
import { ViewControls } from './ViewControls';
import { QuickInputWidget } from '../Inputs/QuickInputWidget';
import { ContextMenu } from '../GlobalBoard/ContextMenu';
// import { useAuth } from '../../../auth/providers/AuthProvider'; // Fixed path

interface NewspaperBoardProps {
    viewModel: any; // Type from hook return
    activeProject?: any | null; // From Dashboard
    onOpenItem: (item: any) => void;
}

export const NewspaperBoard: React.FC<NewspaperBoardProps> = ({ viewModel, activeProject, onOpenItem }) => {
    // const { joinedTenants } = useAuth(); // Unused for now
    const items = useNewspaperItems(viewModel, activeProject);

    // View State (Persisted)
    const [fontSize, setFontSize] = useState(() => parseInt(localStorage.getItem('jbwos_newspaper_fontsize') || '11'));
    const [columnCount, setColumnCount] = useState(() => parseInt(localStorage.getItem('jbwos_newspaper_columns') || '3'));

    useEffect(() => {
        localStorage.setItem('jbwos_newspaper_fontsize', fontSize.toString());
    }, [fontSize]);

    useEffect(() => {
        localStorage.setItem('jbwos_newspaper_columns', columnCount.toString());
    }, [columnCount]);

    // Context Menu State
    const [contextMenu, setContextMenu] = useState<{ x: number, y: number, itemId: string } | null>(null);
    const [overridesProjectContext, setOverridesProjectContext] = useState<any | null>(null);
    const [quickInputKey, setQuickInputKey] = useState(0); // To force re-autoFocus

    const handleContextMenu = (e: React.MouseEvent, itemId: string) => {
        e.preventDefault();
        setContextMenu({ x: e.clientX, y: e.clientY, itemId });
    };

    // [NEW] Handle Delete Key for ContextMenu target
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Delete' && contextMenu?.itemId) {
                viewModel.deleteItem(contextMenu.itemId);
                setContextMenu(null);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [contextMenu, viewModel]);

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

            {/* Controls Header (Floating or Fixed) */}
            <div className="flex-none px-4 py-2 flex justify-end relative z-20 pointer-events-none">
                <div className="pointer-events-auto">
                    <ViewControls
                        fontSize={fontSize}
                        setFontSize={setFontSize}
                        columnCount={columnCount}
                        setColumnCount={setColumnCount}
                    />
                </div>
            </div>

            {/* Main Content Area (Horizontal Scroll, No Vertical) */}
            <div className="flex-1 overflow-x-auto overflow-y-hidden px-4 pb-4 scrollbar-thin scrollbar-thumb-slate-300 dark:scrollbar-thumb-slate-700">
                <div
                    className="h-full py-2"
                    style={{
                        columnCount: columnCount,
                        columnFill: 'auto',
                        columnGap: '2em',
                        columnRule: '1px dashed rgba(200, 200, 200, 0.2)',
                        fontSize: `${fontSize}px`,
                        width: 'max-content',
                        minWidth: '100%',
                        maxHeight: '100%' // Ensure no vertical spill
                    }}
                >
                    {/* Quick Input (Inside Columns) */}
                    <div className="break-inside-avoid mb-[1em] p-[0.5em] bg-white dark:bg-slate-800 rounded shadow-sm border border-slate-200 dark:border-slate-700">
                        <QuickInputWidget
                            key={quickInputKey}
                            viewModel={viewModel}
                            projectContext={overridesProjectContext || (activeProject ? {
                                id: activeProject.cloudId || activeProject.id,
                                name: activeProject.name,
                                tenantId: activeProject.tenantId
                            } : null)}
                            placeholder={overridesProjectContext ? `${overridesProjectContext.name}に追加...` : "Alt+D to add..."}
                            autoFocus={quickInputKey > 0}
                            className="bg-transparent border-none p-0 shadow-none"
                            onRequestFallbackOpen={() => { }}
                            onOpenItem={onOpenItem}
                        />
                    </div>

                    {items.map(wrapper => (
                        <NewspaperItem
                            key={wrapper.id}
                            wrapper={wrapper}
                            onClick={(item) => {
                                onOpenItem(item);
                            }}
                            onContextMenu={handleContextMenu}
                            onAddChild={(projItem) => {
                                setOverridesProjectContext({
                                    id: projItem.projectId, // isHeader items have projectId set in useNewspaperItems
                                    name: projItem.title,
                                    tenantId: projItem.tenantId
                                });
                                setQuickInputKey(k => k + 1);
                            }}
                        />
                    ))}

                </div>
            </div>

            {contextMenu && (
                <ContextMenu
                    x={contextMenu.x}
                    y={contextMenu.y}
                    itemId={contextMenu.itemId}
                    onClose={() => setContextMenu(null)}
                    actions={[
                        {
                            label: 'プロジェクト化',
                            onClick: () => {
                                // TODO: Open Project Create Modal with this item as seed?
                                // For now just log or basic logic if VM supports it
                                console.log('Projectize', contextMenu.itemId);
                                // Ideally: viewModel.openProjectModal(item)
                            }
                        },
                        { separator: true }, // Visual Separator if supported by ContextMenu, otherwise ignored
                        {
                            label: '今日やる (Focus)',
                            onClick: () => { viewModel.updateItem(contextMenu.itemId, { status: 'focus' }); }
                        },
                        {
                            label: 'とりかかる (Execute)',
                            onClick: () => { viewModel.setEngaged(contextMenu.itemId, true); }
                        },
                        {
                            label: '保留 (Pending)',
                            onClick: () => { viewModel.updateItem(contextMenu.itemId, { status: 'pending' }); }
                        },
                        {
                            label: '待機 (Waiting)',
                            onClick: () => { viewModel.updateItem(contextMenu.itemId, { status: 'waiting' }); }
                        },
                        { separator: true },
                        {
                            label: 'アーカイブ',
                            onClick: () => { viewModel.archiveItem(contextMenu.itemId); }
                        },
                        {
                            label: '削除',
                            danger: true,
                            onClick: () => { viewModel.deleteItem(contextMenu.itemId); }
                        }
                    ].filter(Boolean) as any} // Cast for separator support if needed
                />
            )}
        </div>
    );
};
