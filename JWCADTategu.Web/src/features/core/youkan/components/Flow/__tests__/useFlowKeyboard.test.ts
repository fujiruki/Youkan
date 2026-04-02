import { describe, it, expect, vi } from 'vitest';
import { shouldIgnoreKeyEvent, getLinkedNodeId } from '../useFlowKeyboard';
import type { Edge } from '@xyflow/react';

describe('shouldIgnoreKeyEvent', () => {
  it('inputタグ内のイベントは無視する', () => {
    const event = { target: { tagName: 'INPUT' } } as unknown as KeyboardEvent;
    expect(shouldIgnoreKeyEvent(event)).toBe(true);
  });

  it('textareaタグ内のイベントは無視する', () => {
    const event = { target: { tagName: 'TEXTAREA' } } as unknown as KeyboardEvent;
    expect(shouldIgnoreKeyEvent(event)).toBe(true);
  });

  it('contentEditable要素のイベントは無視する', () => {
    const event = {
      target: { tagName: 'DIV', isContentEditable: true },
    } as unknown as KeyboardEvent;
    expect(shouldIgnoreKeyEvent(event)).toBe(true);
  });

  it('通常のdivのイベントは無視しない', () => {
    const event = {
      target: { tagName: 'DIV', isContentEditable: false },
    } as unknown as KeyboardEvent;
    expect(shouldIgnoreKeyEvent(event)).toBe(false);
  });
});

describe('getLinkedNodeId', () => {
  const edges: Edge[] = [
    { id: 'e1', source: 'a', target: 'b' },
    { id: 'e2', source: 'a', target: 'c' },
    { id: 'e3', source: 'd', target: 'a' },
  ];

  it('ArrowDownで下流ノードを取得する', () => {
    expect(getLinkedNodeId('a', 'ArrowDown', edges)).toBe('b');
  });

  it('ArrowUpで上流ノードを取得する', () => {
    expect(getLinkedNodeId('a', 'ArrowUp', edges)).toBe('d');
  });

  it('ArrowRightで次の下流ノードを取得する', () => {
    expect(getLinkedNodeId('a', 'ArrowRight', edges)).toBe('c');
  });

  it('接続先がない場合はundefinedを返す', () => {
    expect(getLinkedNodeId('b', 'ArrowDown', edges)).toBeUndefined();
  });
});
