import { Item } from '../types';

// R-0162 / R-0169: 容量計算には含めるが一覧・ガントには表示しないアイテム（納品前のBeaver標準タスクの請求）
export const isHiddenCalcOnlyItem = (item: Item): boolean =>
	item.generatedTaskRole === 'invoice' && item.status === 'pending';
