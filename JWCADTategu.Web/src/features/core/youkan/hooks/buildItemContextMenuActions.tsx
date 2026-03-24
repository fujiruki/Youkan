import React from 'react';
import { Edit2, FolderPlus, CheckCircle2, AlertCircle, Trash2 } from 'lucide-react';

export interface ContextMenuAction {
	label: string;
	onClick: () => void;
	danger?: boolean;
	icon?: React.ReactNode;
}

export interface ItemContextMenuCallbacks {
	onOpenDetail: (id: string) => void;
	onMakeProject: (id: string) => void;
	onResolveYes: (id: string) => void;
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
		{
			label: '今日やる (Done Today)',
			icon: <CheckCircle2 size={14} className="text-green-500" />,
			onClick: () => callbacks.onResolveYes(itemId),
		},
		{
			label: '断る (Rejected)',
			icon: <AlertCircle size={14} className="text-amber-500" />,
			onClick: () => callbacks.onResolveNo(itemId),
		},
		{
			label: '完全削除 (Delete)',
			icon: <Trash2 size={14} />,
			danger: true,
			onClick: () => callbacks.onDelete(itemId),
		},
	];
}
