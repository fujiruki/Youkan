import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { ReactFlowProvider } from '@xyflow/react';
import { FlowItemNode, type FlowItemNodeData } from '../FlowItemNode';
import type { Item } from '../../../types';

const baseItem: Item = {
    id: 'item-1',
    title: 'タイトル',
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

const renderNode = (status: Item['status']) => {
    const nodeData: FlowItemNodeData = {
        item: { ...baseItem, status },
    };
    const { container } = render(
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
    return container.firstElementChild as HTMLElement;
};

describe('FlowItemNode: R-132 todoノードの配色', () => {
    it('R-159: inbox は緑、todo は既存の通常色を維持する', () => {
        const inboxNode = renderNode('inbox');
        const todoNode = renderNode('todo');

        expect(inboxNode.className).toContain('bg-emerald-50');
        expect(todoNode.className).toContain('bg-slate-100');
    });

    it('R-159: someday はグレーになる', () => {
        expect(renderNode('someday').className).toContain('bg-slate-100');
    });

    it('todoノードにteal系の専用色クラスが含まれない', () => {
        const todoNode = renderNode('todo');
        expect(todoNode.className).not.toMatch(/teal/);
    });
});
