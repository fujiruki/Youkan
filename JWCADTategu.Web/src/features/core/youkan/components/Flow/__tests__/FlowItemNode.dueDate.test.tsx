import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ReactFlowProvider } from '@xyflow/react';
import { FlowItemNode, type FlowItemNodeData } from '../FlowItemNode';
import type { Item } from '../../../types';

const baseItem: Item = {
    id: 'item-1',
    title: 'テストアイテム',
    status: 'inbox',
    focusOrder: 0,
    isEngaged: false,
    statusUpdatedAt: 0,
    interrupt: false,
    weight: 1,
    createdAt: 0,
    updatedAt: 0,
};

const renderNode = (item: Item) => {
    const nodeData: FlowItemNodeData = {
        item,
        onTitleChange: vi.fn(),
        onEditComplete: vi.fn(),
        onEstimatedMinutesChange: vi.fn(),
        onStartEditing: vi.fn(),
        onChainCreate: vi.fn(),
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
};

describe('FlowItemNode: R-104/R-107 納期・マイ期限の1行表示', () => {
    it('納期・マイ期限がともに未設定なら日付要素を出さない', () => {
        renderNode({ ...baseItem, due_date: null, prep_date: null });
        expect(screen.queryByTitle(/顧客納期/)).not.toBeInTheDocument();
        expect(screen.queryByTitle(/マイ期限/)).not.toBeInTheDocument();
    });

    it('顧客納期(due_date)のみ設定時はラベルなしのM/d形式で表示する', () => {
        renderNode({ ...baseItem, due_date: '2026-09-03', prep_date: null });
        expect(screen.getByText('9/3')).toBeInTheDocument();
        expect(screen.queryByTitle(/マイ期限/)).not.toBeInTheDocument();
    });

    it('マイ期限(prep_date)のみ設定時はラベルなしのM/d形式で表示する', () => {
        const prepUnix = Math.floor(new Date('2026-09-10T00:00:00').getTime() / 1000);
        renderNode({ ...baseItem, due_date: null, prep_date: prepUnix });
        expect(screen.getByText('9/10')).toBeInTheDocument();
        expect(screen.queryByTitle(/顧客納期/)).not.toBeInTheDocument();
    });

    it('両方設定時は両方の日付を表示する', () => {
        const prepUnix = Math.floor(new Date('2026-09-10T00:00:00').getTime() / 1000);
        renderNode({ ...baseItem, due_date: '2026-09-03', prep_date: prepUnix });
        expect(screen.getByText('9/3')).toBeInTheDocument();
        expect(screen.getByText('9/10')).toBeInTheDocument();
    });

    it('「納期」「期限」のラベルテキストは表示しない', () => {
        const prepUnix = Math.floor(new Date('2026-09-10T00:00:00').getTime() / 1000);
        renderNode({ ...baseItem, due_date: '2026-09-03', prep_date: prepUnix });
        expect(screen.queryByText(/納期\s/)).not.toBeInTheDocument();
        expect(screen.queryByText(/期限\s/)).not.toBeInTheDocument();
    });

    it('顧客納期は赤系、マイ期限はインジゴ系の配色でガント画面と一貫性を持たせる', () => {
        const prepUnix = Math.floor(new Date('2026-09-10T00:00:00').getTime() / 1000);
        renderNode({ ...baseItem, due_date: '2026-09-03', prep_date: prepUnix });
        expect(screen.getByText('9/3').className).toMatch(/red/);
        expect(screen.getByText('9/10').className).toMatch(/indigo/);
    });

    it('ステータス・目安時間・日付が同一の行（同じ親要素）に並ぶ', () => {
        const prepUnix = Math.floor(new Date('2026-09-10T00:00:00').getTime() / 1000);
        renderNode({ ...baseItem, estimatedMinutes: 60, due_date: '2026-09-03', prep_date: prepUnix });
        const row = screen.getByText('inbox').parentElement;
        expect(row).toContainElement(screen.getByText('1h'));
        expect(row).toContainElement(screen.getByText('9/3'));
        expect(row).toContainElement(screen.getByText('9/10'));
    });
});
