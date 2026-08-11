import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent, screen } from '@testing-library/react';
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

describe('FlowItemNode: Enter連続追加UXフロー（R-074）', () => {
    it('新規ノードはタイトル入力欄が自動的に編集状態になる（既存実装の確認）', () => {
        renderNode();
        const titleInput = screen.getByDisplayValue('既存タイトル');
        expect(titleInput).toBeInTheDocument();
    });

    it('タイトル編集中にTabを押すと、タイトルが確定され目安時間欄にフォーカスが移る', () => {
        const nodeData = renderNode();
        const titleInput = screen.getByDisplayValue('既存タイトル') as HTMLInputElement;

        fireEvent.change(titleInput, { target: { value: '新しいタイトル' } });
        fireEvent.keyDown(titleInput, { key: 'Tab' });

        expect(nodeData.onTitleChange).toHaveBeenCalledWith('item-1', '新しいタイトル');
        expect(nodeData.onEditComplete).toHaveBeenCalledWith('item-1');

        const timeInput = screen.getByPlaceholderText('1h') as HTMLInputElement;
        expect(timeInput).toBeInTheDocument();
        expect(document.activeElement).toBe(timeInput);
    });

    it('Tab経由で開いた目安時間欄にEnterを押すと、目安時間が保存されonChainCreateが呼ばれる', () => {
        const nodeData = renderNode();
        const titleInput = screen.getByDisplayValue('既存タイトル') as HTMLInputElement;
        fireEvent.keyDown(titleInput, { key: 'Tab' });

        const timeInput = screen.getByPlaceholderText('1h') as HTMLInputElement;
        fireEvent.change(timeInput, { target: { value: '30m' } });
        fireEvent.keyDown(timeInput, { key: 'Enter' });

        expect(nodeData.onEstimatedMinutesChange).toHaveBeenCalledWith('item-1', 30);
        expect(nodeData.onChainCreate).toHaveBeenCalledWith('item-1');
    });

    it('通常の目安時間クリック編集（Tab経由でない）ではEnterを押してもonChainCreateは呼ばれない', () => {
        const nodeData = renderNode({ isNewNode: false, isEditing: false });
        const timeBadge = screen.getByText('--');
        fireEvent.click(timeBadge);

        const timeInput = screen.getByPlaceholderText('1h') as HTMLInputElement;
        fireEvent.change(timeInput, { target: { value: '45m' } });
        fireEvent.keyDown(timeInput, { key: 'Enter' });

        expect(nodeData.onEstimatedMinutesChange).toHaveBeenCalledWith('item-1', 45);
        expect(nodeData.onChainCreate).not.toHaveBeenCalled();
    });
});
