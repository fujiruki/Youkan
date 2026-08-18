import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockRequest = vi.fn();
vi.mock('../../../../../../api/client', () => ({
    ApiClient: { request: (...args: unknown[]) => mockRequest(...args) },
}));

import { ApiTokenSection } from '../ApiTokenSection';

// R-140 / 03_画面設計.md §20: 個人設定「外部連携トークン」
describe('ApiTokenSection (R-140)', () => {
    beforeEach(() => {
        mockRequest.mockReset();
    });

    const mockList = (rows: unknown[]) => {
        mockRequest.mockImplementation((method: string, path: string) => {
            if (method === 'GET' && path === '/user/api-tokens') return Promise.resolve(rows);
            return Promise.resolve({});
        });
    };

    it('0件なら「発行済みのトークンはありません」を表示する', async () => {
        mockList([]);
        render(<ApiTokenSection />);
        expect(await screen.findByText('発行済みのトークンはありません')).toBeInTheDocument();
    });

    it('一覧: ラベル・発行 M/d・最終利用 M/d（未使用は —）・失効ボタンを1行で表示する', async () => {
        const created = Math.floor(new Date('2026-08-01T12:00:00').getTime() / 1000);
        const used = Math.floor(new Date('2026-08-18T09:00:00').getTime() / 1000);
        mockList([
            { id: 'tok_1', label: '番頭', created_at: created, last_used_at: used },
            { id: 'tok_2', label: '未使用', created_at: created, last_used_at: null },
        ]);
        render(<ApiTokenSection />);
        expect(await screen.findByText('番頭')).toBeInTheDocument();
        expect(screen.getAllByText(/発行 8\/1/)).toHaveLength(2);
        expect(screen.getByText(/最終利用 8\/18/)).toBeInTheDocument();
        expect(screen.getByText(/最終利用 —/)).toBeInTheDocument();
        expect(screen.getAllByRole('button', { name: '失効' })).toHaveLength(2);
    });

    it('発行: ラベルを入れて［発行］→ 平文トークンを1回表示し、コピーボタンと注意書きを出す。一覧にも追加される', async () => {
        let listed: unknown[] = [];
        mockRequest.mockImplementation((method: string, path: string, body?: { label: string }) => {
            if (method === 'GET' && path === '/user/api-tokens') return Promise.resolve(listed);
            if (method === 'POST' && path === '/user/api-tokens') {
                listed = [{ id: 'tok_new', label: body!.label, created_at: 1, last_used_at: null }];
                return Promise.resolve({ id: 'tok_new', label: body!.label, token: 'abc123secret' });
            }
            return Promise.resolve({});
        });
        render(<ApiTokenSection />);
        await screen.findByText('発行済みのトークンはありません');

        fireEvent.change(screen.getByPlaceholderText('ラベル（例: 番頭）'), { target: { value: '番頭' } });
        fireEvent.click(screen.getByRole('button', { name: '発行' }));

        expect(await screen.findByText('abc123secret')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'コピー' })).toBeInTheDocument();
        expect(screen.getByText('この画面を離れると再表示できません')).toBeInTheDocument();
        expect(await screen.findByText('番頭')).toBeInTheDocument();
        expect(mockRequest).toHaveBeenCalledWith('POST', '/user/api-tokens', { label: '番頭' });
    });

    it('ラベルが空なら発行ボタンは無効', async () => {
        mockList([]);
        render(<ApiTokenSection />);
        await screen.findByText('発行済みのトークンはありません');
        expect(screen.getByRole('button', { name: '発行' })).toBeDisabled();
    });

    it('失効: window.confirm を使わず行内の「失効しますか？［はい］［いいえ］」→ はい で DELETE、行が消える', async () => {
        const confirmSpy = vi.spyOn(window, 'confirm');
        mockList([{ id: 'tok_1', label: '番頭', created_at: 1, last_used_at: null }]);
        render(<ApiTokenSection />);
        await screen.findByText('番頭');

        fireEvent.click(screen.getByRole('button', { name: '失効' }));
        expect(screen.getByText('失効しますか？')).toBeInTheDocument();
        expect(confirmSpy).not.toHaveBeenCalled();

        fireEvent.click(screen.getByRole('button', { name: 'いいえ' }));
        expect(screen.queryByText('失効しますか？')).not.toBeInTheDocument();
        expect(screen.getByText('番頭')).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: '失効' }));
        fireEvent.click(screen.getByRole('button', { name: 'はい' }));
        await waitFor(() => expect(screen.queryByText('番頭')).not.toBeInTheDocument());
        expect(mockRequest).toHaveBeenCalledWith('DELETE', '/user/api-tokens/tok_1');
        expect(await screen.findByText('発行済みのトークンはありません')).toBeInTheDocument();
        confirmSpy.mockRestore();
    });
});
