import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ManufacturingProjectFields } from './ManufacturingProjectFields';
import * as useRecentClientNamesModule from '../viewmodels/useRecentClientNames';

vi.mock('../viewmodels/useRecentClientNames');

describe('ManufacturingProjectFields', () => {
    const mockSetClientName = vi.fn();
    const mockSetGrossProfitTarget = vi.fn();
    const mockFetch = vi.fn();

    const defaultProps = {
        clientName: '',
        setClientName: mockSetClientName,
        grossProfitTarget: '0',
        setGrossProfitTarget: mockSetGrossProfitTarget,
    };

    beforeEach(() => {
        vi.clearAllMocks();
        vi.spyOn(useRecentClientNamesModule, 'useRecentClientNames').mockReturnValue({
            names: ['株式会社テスト', '田中工務店', '佐藤建設'],
            fetch: mockFetch,
            loading: false,
        });
    });

    it('ChevronDownボタンが存在する', () => {
        render(<ManufacturingProjectFields {...defaultProps} />);
        expect(screen.getByRole('button', { name: /顧客名候補を表示/ })).toBeInTheDocument();
    });

    it('ドロップダウンボタン押下でリストが表示される', async () => {
        render(<ManufacturingProjectFields {...defaultProps} />);

        fireEvent.click(screen.getByRole('button', { name: /顧客名候補を表示/ }));

        await waitFor(() => {
            expect(screen.getByText('株式会社テスト')).toBeInTheDocument();
            expect(screen.getByText('田中工務店')).toBeInTheDocument();
            expect(screen.getByText('佐藤建設')).toBeInTheDocument();
        });
    });

    it('ドロップダウンボタン押下時にfetchが呼ばれる', async () => {
        render(<ManufacturingProjectFields {...defaultProps} />);

        fireEvent.click(screen.getByRole('button', { name: /顧客名候補を表示/ }));

        expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('項目クリックでsetClientNameが呼ばれドロップダウンが閉じる', async () => {
        render(<ManufacturingProjectFields {...defaultProps} />);

        fireEvent.click(screen.getByRole('button', { name: /顧客名候補を表示/ }));

        await waitFor(() => {
            expect(screen.getByText('株式会社テスト')).toBeInTheDocument();
        });

        fireEvent.click(screen.getByText('株式会社テスト'));

        expect(mockSetClientName).toHaveBeenCalledWith('株式会社テスト');

        await waitFor(() => {
            expect(screen.queryByText('株式会社テスト')).not.toBeInTheDocument();
        });
    });

    it('入力欄に文字があると部分一致で絞り込まれる', async () => {
        render(<ManufacturingProjectFields {...defaultProps} clientName="テスト" />);

        fireEvent.click(screen.getByRole('button', { name: /顧客名候補を表示/ }));

        await waitFor(() => {
            expect(screen.getByText('株式会社テスト')).toBeInTheDocument();
            expect(screen.queryByText('田中工務店')).not.toBeInTheDocument();
            expect(screen.queryByText('佐藤建設')).not.toBeInTheDocument();
        });
    });

    it('Escapeキーでドロップダウンが閉じる', async () => {
        render(<ManufacturingProjectFields {...defaultProps} />);

        fireEvent.click(screen.getByRole('button', { name: /顧客名候補を表示/ }));

        await waitFor(() => {
            expect(screen.getByText('株式会社テスト')).toBeInTheDocument();
        });

        fireEvent.keyDown(document, { key: 'Escape' });

        await waitFor(() => {
            expect(screen.queryByText('株式会社テスト')).not.toBeInTheDocument();
        });
    });
});
