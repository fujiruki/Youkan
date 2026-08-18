export interface SequentialUpdateResult {
    failedIds: string[];
}

/**
 * R-138: 複数件のIDに対する更新を1件ずつ逐次実行する（並行送信しない）汎用ヘルパー。
 * SQLiteは単一ライターのため、並行PUTが多数同時到達すると busy_timeout を超えて
 * 一部が失敗する（R-121と同根）。for-ofでawaitし、同時書き込みそのものを起こさない。
 * 失敗したIDは失敗させたまま残りを続行し、呼び出し元が失敗分だけ再試行できるように返す。
 */
export async function runSequentialUpdates(
    ids: string[],
    updateOne: (id: string) => void | Promise<void>,
    onProgress?: (done: number, total: number) => void
): Promise<SequentialUpdateResult> {
    const total = ids.length;
    const failedIds: string[] = [];
    for (let i = 0; i < total; i++) {
        const id = ids[i];
        try {
            await updateOne(id);
        } catch {
            failedIds.push(id);
        }
        onProgress?.(i + 1, total);
    }
    return { failedIds };
}
