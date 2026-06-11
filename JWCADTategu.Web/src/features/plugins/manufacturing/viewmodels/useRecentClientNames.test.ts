import { renderHook, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useRecentClientNames } from './useRecentClientNames';
import { ApiClient } from '../../../../api/client';

vi.mock('../../../../api/client', () => ({
    ApiClient: {
        getProjects: vi.fn(),
    },
}));

describe('useRecentClientNames', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('初期状態では空配列を返す', () => {
        (ApiClient.getProjects as any).mockResolvedValue([]);
        const { result } = renderHook(() => useRecentClientNames());
        expect(result.current.names).toEqual([]);
    });

    it('重複を除去して新しい順に最大30件の顧客名を返す', async () => {
        const now = new Date('2024-01-01T00:00:00Z');
        const projects = [
            { id: 'p1', clientName: '株式会社A', updatedAt: '2024-01-31T00:00:00Z' },
            { id: 'p2', clientName: '株式会社B', updatedAt: '2024-01-30T00:00:00Z' },
            { id: 'p3', clientName: '株式会社A', updatedAt: '2024-01-29T00:00:00Z' }, // 重複
            { id: 'p4', clientName: '', updatedAt: '2024-01-28T00:00:00Z' }, // 空文字
            { id: 'p5', clientName: null, updatedAt: '2024-01-27T00:00:00Z' }, // null
            { id: 'p6', clientName: '  ', updatedAt: '2024-01-26T00:00:00Z' }, // スペースのみ
            ...Array.from({ length: 29 }, (_, i) => ({
                id: `extra${i}`,
                clientName: `顧客${String(i + 1).padStart(2, '0')}`,
                updatedAt: new Date(now.getTime() + i * 1000).toISOString(),
            })),
        ];
        (ApiClient.getProjects as any).mockResolvedValue(projects);

        const { result } = renderHook(() => useRecentClientNames());
        await act(async () => {
            result.current.fetch();
        });

        await waitFor(() => {
            expect(result.current.names.length).toBeLessThanOrEqual(30);
        });

        // 重複・空文字・nullが除外されていること
        expect(result.current.names.filter(n => n === '株式会社A').length).toBe(1);
        expect(result.current.names).not.toContain('');
        expect(result.current.names).not.toContain(null);
        expect(result.current.names).not.toContain('  ');

        // 最大30件
        expect(result.current.names.length).toBeLessThanOrEqual(30);
    });

    it('31件以上のプロジェクトでも最大30件に絞られる', async () => {
        const projects = Array.from({ length: 40 }, (_, i) => ({
            id: `p${i}`,
            clientName: `顧客${String(i + 1).padStart(2, '0')}`,
            updatedAt: new Date(2024, 0, i + 1).toISOString(),
        }));
        (ApiClient.getProjects as any).mockResolvedValue(projects);

        const { result } = renderHook(() => useRecentClientNames());
        await act(async () => {
            result.current.fetch();
        });

        await waitFor(() => {
            expect(result.current.names.length).toBe(30);
        });
    });

    it('updatedAt降順（最新が先頭）で返す', async () => {
        const projects = [
            { id: 'p1', clientName: '古い顧客', updatedAt: '2024-01-01T00:00:00Z' },
            { id: 'p2', clientName: '新しい顧客', updatedAt: '2024-06-01T00:00:00Z' },
            { id: 'p3', clientName: '中間顧客', updatedAt: '2024-03-01T00:00:00Z' },
        ];
        (ApiClient.getProjects as any).mockResolvedValue(projects);

        const { result } = renderHook(() => useRecentClientNames());
        await act(async () => {
            result.current.fetch();
        });

        await waitFor(() => {
            expect(result.current.names[0]).toBe('新しい顧客');
            expect(result.current.names[1]).toBe('中間顧客');
            expect(result.current.names[2]).toBe('古い顧客');
        });
    });

    it('APIエラー時は空配列を維持する', async () => {
        (ApiClient.getProjects as any).mockRejectedValue(new Error('Network Error'));

        const { result } = renderHook(() => useRecentClientNames());
        await act(async () => {
            result.current.fetch();
        });

        await waitFor(() => {
            expect(result.current.names).toEqual([]);
        });
    });
});
