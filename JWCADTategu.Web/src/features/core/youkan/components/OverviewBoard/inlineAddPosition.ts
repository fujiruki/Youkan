import { calculateStartLimit } from '../../logic/sorting';
import type { OverviewItemWrapper } from './useOverviewItems';

/**
 * 指定プロジェクトの「期限なし群の末尾直後」の挿入インデックスを返す。
 * header が見つからない場合は -1 を返す。
 * 期限なしアイテムが 0 件の場合は header 直後（header の index + 1）を返す。
 */
export const getInlineAddInsertIndex = (wrappers: OverviewItemWrapper[], projectId: string): number => {
    const headerIdx = wrappers.findIndex(
        w => w.type === 'header' && w.projectId === projectId
    );
    if (headerIdx === -1) return -1;

    const headerDepth = wrappers[headerIdx].depth;
    let lastNoDeadlineEnd = headerIdx + 1; // フォールバック: header直後

    let i = headerIdx + 1;
    while (i < wrappers.length) {
        const w = wrappers[i];

        // このプロジェクトのスコープ外（同じ depth 以下の別 header）に到達したら停止
        if (w.type === 'header' && w.depth <= headerDepth) break;

        if (w.type === 'item') {
            const isDirectChild = w.depth === headerDepth + 1;
            if (isDirectChild) {
                const startLimit = calculateStartLimit(w.item);
                if (startLimit === null) {
                    // 期限なしアイテム: このアイテムのサブツリーの末尾まで走査
                    const subtreeEnd = findSubtreeEnd(wrappers, i, w.depth);
                    lastNoDeadlineEnd = subtreeEnd;
                    i = subtreeEnd;
                    continue;
                } else {
                    // 期限ありアイテムが始まったのでグループ走査終了
                    break;
                }
            }
        }

        i++;
    }

    return lastNoDeadlineEnd;
};

/**
 * wrappers[startIdx] のアイテムを起点として、そのサブツリー（depth > itemDepth の連続要素）の
 * 末尾の次のインデックスを返す。サブツリーがない場合は startIdx + 1 を返す。
 * ただし、type='header' は深さに関係なくサブツリーの境界とみなす。
 */
const findSubtreeEnd = (wrappers: OverviewItemWrapper[], startIdx: number, itemDepth: number): number => {
    let i = startIdx + 1;
    while (i < wrappers.length) {
        const w = wrappers[i];
        if (w.type === 'header') break;
        if (w.depth <= itemDepth) break;
        i++;
    }
    return i;
};
