import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent, screen, waitFor } from '@testing-library/react';
import { ReactFlowProvider } from '@xyflow/react';
import { FlowItemNode, type FlowItemNodeData } from '../FlowItemNode';
import type { Item } from '../../../types';

const baseItem: Item = {
    id: 'item-1',
    title: '既存タイトル',
    status: 'inbox',
    focusOrder: 0,
    isEngaged: false,
    statusUpdatedAt: 0,
    interrupt: false,
    weight: 1,
    createdAt: 0,
    updatedAt: 0,
    estimatedMinutes: undefined,
};

const renderNode = (data: Partial<FlowItemNodeData> = {}) => {
    const nodeData: FlowItemNodeData = {
        item: baseItem,
        isNewNode: true,
        onTitleChange: vi.fn(),
        onEditComplete: vi.fn(),
        onEstimatedMinutesChange: vi.fn(),
        onStartEditing: vi.fn(),
        onChainCreate: vi.fn(),
        ...data,
    };
    render(
        <ReactFlowProvider>
            <FlowItemNode
                id="item-1"
                data={nodeData as unknown as Record<string, unknown>}
                selected={false}
                type="flowItem"
                dragging={false}
                zIndex={0}
                isConnectable
                positionAbsoluteX={0}
                positionAbsoluteY={0}
            />
        </ReactFlowProvider>
    );
    return nodeData;
};

/**
 * R-085: フロー目安時間更新エラー「Database Error during update」の根本原因
 *
 * Tab経由の目安時間欄でEnterを押すと、目安時間保存(onEstimatedMinutesChange、
 * PUT /items/{id})とチェーン作成(onChainCreate、POST /items ほか)が
 * awaitなしで同時に発火していた。本番PHPエラーログでは両リクエストが同一秒に
 * SQLiteへ書き込みを試み、後着側が
 * "SQLSTATE[HY000]: General error: 5 database is locked" で失敗していたことを確認済み。
 *
 * 目安時間の保存が完了する前にonChainCreateが呼ばれてはならない。
 */
describe('FlowItemNode: R-085 目安時間保存とチェーン作成の同時書き込み防止', () => {
    it('目安時間の保存(Promise)が完了するまでonChainCreateを呼ばない', async () => {
        let resolveSave: (() => void) | undefined;
        const savePromise = new Promise<void>((resolve) => {
            resolveSave = resolve;
        });
        const onEstimatedMinutesChange = vi.fn().mockReturnValue(savePromise);
        const nodeData = renderNode({ onEstimatedMinutesChange });

        const titleInput = screen.getByDisplayValue('既存タイトル') as HTMLInputElement;
        fireEvent.keyDown(titleInput, { key: 'Tab' });

        const timeInput = screen.getByPlaceholderText('1h') as HTMLInputElement;
        fireEvent.change(timeInput, { target: { value: '30m' } });
        fireEvent.keyDown(timeInput, { key: 'Enter' });

        expect(onEstimatedMinutesChange).toHaveBeenCalledWith('item-1', 30);
        // 保存がまだ完了していない間はonChainCreateを呼んではいけない
        // (同時に呼ぶと、PUT /items/{id}とPOST /itemsが並行してSQLiteへ書き込み、
        //  "database is locked" の原因になる)
        expect(nodeData.onChainCreate).not.toHaveBeenCalled();

        resolveSave!();

        await waitFor(() => {
            expect(nodeData.onChainCreate).toHaveBeenCalledWith('item-1');
        });
    });

    it('目安時間保存が失敗しても(rejectしても)チェーン作成は継続される', async () => {
        const onEstimatedMinutesChange = vi.fn().mockRejectedValue(new Error('network error'));
        const nodeData = renderNode({ onEstimatedMinutesChange });

        const titleInput = screen.getByDisplayValue('既存タイトル') as HTMLInputElement;
        fireEvent.keyDown(titleInput, { key: 'Tab' });

        const timeInput = screen.getByPlaceholderText('1h') as HTMLInputElement;
        fireEvent.change(timeInput, { target: { value: '30m' } });
        fireEvent.keyDown(timeInput, { key: 'Enter' });

        await waitFor(() => {
            expect(nodeData.onChainCreate).toHaveBeenCalledWith('item-1');
        });
    });
});

/**
 * R-089: R-085修正後も本番で低頻度（5回中1回程度）に同種の
 * "Database Error during update" が再発していた残存事象。
 *
 * 実ブラウザでは、Enter確定→保存完了→isTimeEditing=falseになりinput要素が
 * DOMから削除される際、フォーカスが当たっていた要素にblurイベントが発火する
 * (フォーカス中の要素がDOMから除去された場合のUA標準挙動)。
 * この時、onBlur={handleTimeEditConfirm}が再度呼ばれ、同一itemIdへ
 * PUT /items/{id}が二重発火していた。本番PHPエラーログでも同一item idへの
 * リクエストが同一秒に2件記録され、後着側が「database is locked」で
 * 失敗していたことを確認済み。
 */
describe('FlowItemNode: R-089 Enter確定後のonBlur再発火による二重PUT防止', () => {
    it('Enter確定直後にonBlurが発火しても、目安時間の保存は1回しか行わない', async () => {
        const onEstimatedMinutesChange = vi.fn().mockResolvedValue(undefined);
        const nodeData = renderNode({ onEstimatedMinutesChange });

        const titleInput = screen.getByDisplayValue('既存タイトル') as HTMLInputElement;
        fireEvent.keyDown(titleInput, { key: 'Tab' });

        const timeInput = screen.getByPlaceholderText('1h') as HTMLInputElement;
        fireEvent.change(timeInput, { target: { value: '30m' } });
        fireEvent.keyDown(timeInput, { key: 'Enter' });
        // 保存が完了する前(=input要素がまだDOM上に残っている段階)でも、
        // 実ブラウザのDOM除去に伴うblur発火を模して直接blurイベントを発生させる
        fireEvent.blur(timeInput);

        await waitFor(() => {
            expect(nodeData.onChainCreate).toHaveBeenCalledWith('item-1');
        });

        expect(onEstimatedMinutesChange).toHaveBeenCalledTimes(1);
    });
});
