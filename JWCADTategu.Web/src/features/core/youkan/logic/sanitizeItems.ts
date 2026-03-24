import { Item } from '../types';

/**
 * アイテム配列からnull/undefined要素およびidが無効なアイテムを除去する。
 * @dnd-kit/sortable の SortableContext が内部で `'id' in item` チェックを行うため、
 * null要素が混入すると `typeof null === 'object'` → `'id' in null` で TypeError が発生する。
 * この関数をデータ取得直後やコンポーネント渡し前に適用することで防御する。
 */
export function sanitizeItems(items: (Item | null | undefined)[]): Item[] {
	return items.filter((item): item is Item =>
		item != null && typeof item === 'object' && !!item.id
	);
}
