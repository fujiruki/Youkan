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
        // 実際のReactFlowはノードを`.react-flow__node`でラップし、計測完了まで
        // visibility:hiddenを付与する（R-080）。単体テストでも同じ構造を再現する
        <div className="react-flow__node">
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
        </div>
    );
    return nodeData;
};

describe('FlowItemNode: R-079 タイトル編集中のドラッグ誤爆防止', () => {
    it('タイトル編集inputのmousedownはノードドラッグへ伝播しない', () => {
        renderNode({ isNewNode: false, isEditing: true });
        const titleInput = screen.getByDisplayValue('既存タイトル');

        const event = new MouseEvent('mousedown', { bubbles: true, cancelable: true });
        const stopPropagationSpy = vi.spyOn(event, 'stopPropagation');
        fireEvent(titleInput, event);

        expect(stopPropagationSpy).toHaveBeenCalled();
    });
});

describe('FlowItemNode: R-133 タイトル編集中の2回目クリックでキャレット位置', () => {
    it('タイトル編集inputにreact-flowのnodragクラスが付与され、node全体のドラッグ・選択に巻き込まれない', () => {
        renderNode({ isNewNode: false, isEditing: true });
        const titleInput = screen.getByDisplayValue('既存タイトル');

        expect(titleInput.className.split(' ')).toContain('nodrag');
    });
});

describe('FlowItemNode: R-080 新規ノードのタイトルはxyflow可視化後にフォーカス・全選択される', () => {
    it('xyflow計測中(visibility:hidden)はfocus/selectを呼ばず、style変化(可視化)後に呼ぶ', () => {
        let visible = false;
        const styleSpy = vi.spyOn(window, 'getComputedStyle').mockImplementation(() => (
            { visibility: visible ? 'visible' : 'hidden' } as CSSStyleDeclaration
        ));
        const focusSpy = vi.spyOn(HTMLElement.prototype, 'focus');
        const selectSpy = vi.spyOn(HTMLInputElement.prototype, 'select');

        renderNode();

        // 可視化されるまではfocus/selectを呼ばない
        expect(focusSpy).not.toHaveBeenCalled();
        expect(selectSpy).not.toHaveBeenCalled();

        // xyflowの計測が完了しノード要素のstyleが変化(visibility:hidden解除)したことを模する
        visible = true;
        const nodeEl = screen.getByDisplayValue('既存タイトル').closest('.react-flow__node') as HTMLElement;
        nodeEl.setAttribute('style', `${nodeEl.getAttribute('style') ?? ''};visibility:visible`);

        return new Promise<void>((resolve) => {
            queueMicrotask(() => {
                expect(focusSpy).toHaveBeenCalled();
                expect(selectSpy).toHaveBeenCalled();
                styleSpy.mockRestore();
                focusSpy.mockRestore();
                selectSpy.mockRestore();
                resolve();
            });
        });
    });
});
