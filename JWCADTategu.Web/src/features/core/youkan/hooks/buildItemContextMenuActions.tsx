import React from 'react';
import { Edit2, FolderPlus, CheckCircle2, Clock, AlertCircle, Trash2, ListPlus } from 'lucide-react';

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
	/** R-125/R-143: 後日着手（decisionToStatus('later')→todo）。「今日やる」直下に常時表示、shortcut h */
	onResolveLater: (id: string) => void;
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
			label: '前に挿入 (a)',
			icon: <ListPlus size={14} />,
			onClick: () => callbacks.onInsertBefore!(itemId),
			shortcut: 'a',
		}] : []),
		...(callbacks.onInsertAfter ? [{
			label: '後に挿入 (b)',
			icon: <ListPlus size={14} />,
			onClick: () => callbacks.onInsertAfter!(itemId),
			shortcut: 'b',
		}] : []),
		{
			label: '今日やる (Done Today)',
			icon: <CheckCircle2 size={14} className="text-green-500" />,
			onClick: () => callbacks.onResolveYes(itemId),
		},
		// R-125/R-143: 後日着手（やると決めたが今日はやらない）
		{
			label: '後日着手 (h)',
			icon: <Clock size={14} className="text-teal-500" />,
			onClick: () => callbacks.onResolveLater(itemId),
			shortcut: 'h',
		},
		...(callbacks.onMarkDone ? [{
			label: '完了にする (d)',
			icon: <CheckCircle2 size={14} className="text-slate-600" />,
			onClick: () => callbacks.onMarkDone!(itemId),
			shortcut: 'd',
		}] : []),
		{
			// R-124: 右クリックメニューは表示幅に余裕があるため広い文言（キャンセル・断った）を使う。
			// 「キャンセル」だけの婉曲表現を避け、「断った」という判断行為を必ず残す
			label: 'キャンセル・断った',
			icon: <AlertCircle size={14} className="text-rose-500" />,
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
