import { describe, it, expect, vi } from 'vitest';
import { runSequentialUpdates } from '../sequentialUpdates';

describe('runSequentialUpdates (R-138)', () => {
    it('IDを1件ずつ逐次実行する（前の呼び出しが完了する前に次を呼ばない）', async () => {
        const order: string[] = [];
        let resolveFirst: (() => void) | undefined;
        const updateOne = vi.fn((id: string) => {
            order.push(id);
            if (id === 'a') {
                return new Promise<void>((resolve) => { resolveFirst = resolve; });
            }
            return Promise.resolve();
        });

        const promise = runSequentialUpdates(['a', 'b', 'c'], updateOne);

        await new Promise((r) => setTimeout(r, 0));
        expect(order).toEqual(['a']);

        resolveFirst?.();
        const result = await promise;

        expect(order).toEqual(['a', 'b', 'c']);
        expect(result.failedIds).toEqual([]);
    });

    it('途中1件が失敗しても残りは続行し、失敗したIDだけ返す', async () => {
        const updateOne = vi.fn(async (id: string) => {
            if (id === 'b') throw new Error('failed');
        });

        const result = await runSequentialUpdates(['a', 'b', 'c'], updateOne);

        expect(updateOne).toHaveBeenCalledTimes(3);
        expect(result.failedIds).toEqual(['b']);
    });

    it('進捗コールバックがdone/totalで呼ばれる', async () => {
        const onProgress = vi.fn();
        await runSequentialUpdates(['a', 'b'], () => Promise.resolve(), onProgress);

        expect(onProgress).toHaveBeenNthCalledWith(1, 1, 2);
        expect(onProgress).toHaveBeenNthCalledWith(2, 2, 2);
    });
});
