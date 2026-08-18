/**
 * R-105: ガント時間軸タイムライン表示のブロック横位置計算。
 *
 * その日に「何分割り当てられるか」（QuantityEngine の日単位バックワード割当）は変更せず、
 * 「その割当が何時何分から始まるか」だけを決める。
 */

/** 1日の分数 */
export const DAY_MINUTES = 1440;

export interface DailyAllocationEntry {
	itemId: string;
	allocatedMinutes: number;
}

export interface TimeBlockLayout {
	/** その日の 0:00 からの開始オフセット（分） */
	startOffsetMinutes: number;
	/** 描画上の幅（分）。割当分をそのまま保つ（上限 1440。はみ出し時は開始位置を左へずらして右端を 24:00 に揃える） */
	displayWidthMinutes: number;
	/** 24:00 をはみ出しているか（警告マーク表示用） */
	overflow: boolean;
}

/**
 * 1日分の割当エントリを行順（＝依存関係順）に走査し、各ブロックの横位置を決める。
 *
 * @param orderedEntries その日に割当のあるアイテム。依存関係順に並んでいる前提
 * @param predecessorsOf そのアイテムの前提となるアイテムIDを返す
 * @param manualOffsetOf ユーザーがドラッグで手動調整した開始オフセット分（未調整なら undefined）
 */
export function computeDailyTimeBlockLayout(
	orderedEntries: DailyAllocationEntry[],
	predecessorsOf: (itemId: string) => string[],
	manualOffsetOf: (itemId: string) => number | undefined,
): Map<string, TimeBlockLayout> {
	const ends = new Map<string, number>();
	const result = new Map<string, TimeBlockLayout>();

	for (const entry of orderedEntries) {
		const manual = manualOffsetOf(entry.itemId);
		// 同日に先行タスクの割当があればその直後、なければその日の先頭
		const auto = predecessorsOf(entry.itemId).reduce((max, pid) => Math.max(max, ends.get(pid) ?? 0), 0);
		const desired = Math.max(manual ?? auto, 0);
		const alloc = entry.allocatedMinutes;
		// R-145: 24:00 をはみ出す場合は幅を保ったまま右端を 24:00 に揃える（F-40）
		const overflow = desired + alloc > DAY_MINUTES;
		const start = overflow ? Math.max(0, DAY_MINUTES - alloc) : desired;

		result.set(entry.itemId, {
			startOffsetMinutes: start,
			displayWidthMinutes: Math.min(alloc, DAY_MINUTES),
			overflow,
		});
		ends.set(entry.itemId, Math.min(start + alloc, DAY_MINUTES));
	}

	return result;
}
