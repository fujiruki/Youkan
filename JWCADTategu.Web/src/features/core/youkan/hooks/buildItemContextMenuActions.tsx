import React from 'react';
import { Edit2, FolderPlus, CheckCircle2, AlertCircle, Trash2, ListPlus } from 'lucide-react';

export interface ContextMenuAction {
	label: string;
	onClick: () => void;
	danger?: boolean;
	icon?: React.ReactNode;
	shortcut?: string;
}

export interface ItemContextMenuCallbacks {
	onOpenDetail: (id: string) => void;
	onMakeProject: (id: string) => void;
	onResolveYes: (id: string) => void;
	onInsertBefore?: (id: string) => void;
	onInsertAfter?: (id: string) => void;
	onMarkDone?: (id: string) => void;
	onResolveNo: (id: string) => void;
	onDelete: (id: string) => void;
}

export function buildItemContextMenuActions(
	itemId: string,
	callbacks: ItemContextMenuCallbacks
): ContextMenuAction[] {
	return [
		{
			label: '詳細 / 名前変更',
			icon: <Edit2 size={14} />,
			onClick: () => callbacks.onOpenDetail(itemId),
		},
		{
			label: 'プロジェクト化',
			icon: <FolderPlus size={14} />,
			onClick: () => callbacks.onMakeProject(itemId),
		},
		...(callbacks.onInsertBefore ? [{
			label: '前に挿入',
			icon: <ListPlus size={14} />,
			onClick: () => callbacks.onInsertBefore!(itemId),
		}] : []),
		...(callbacks.onInsertAfter ? [{
			label: '後に挿入',
			icon: <ListPlus size={14} />,
			onClick: () => callbacks.onInsertAfter!(itemId),
		}] : []),
		{
			label: '今日やる (Done Today)',
			icon: <CheckCircle2 size={14} className="text-green-500" />,
			onClick: () => callbacks.onResolveYes(itemId),
		},
		...(callbacks.onMarkDone ? [{
			label: '完了にする (d)',
			icon: <CheckCircle2 size={14} className="text-slate-600" />,
			onClick: () => callbacks.onMarkDone!(itemId),
			shortcut: 'd',
		}] : []),
		{
			label: '断る (Rejected)',
			icon: <AlertCircle size={14} className="text-amber-500" />,
			onClick: () => callbacks.onResolveNo(itemId),
		},
		{
			label: 'ゴミ箱 (Del)',
			icon: <Trash2 size={14} />,
			danger: true,
			onClick: () => callbacks.onDelete(itemId),
			shortcut: 'Delete',
		},
	];
}
