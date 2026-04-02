import { useCallback, useRef } from 'react';
import type { Edge } from '@xyflow/react';

/**
 * テキスト入力中のキーイベントを無視すべきか判定
 */
export function shouldIgnoreKeyEvent(event: KeyboardEvent): boolean {
  const target = event.target as HTMLElement;
  if (!target) return false;
  const tag = target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (target.isContentEditable) return true;
  return false;
}

/**
 * エッジ構造に沿って方向キーで移動する際のターゲットノードID取得
 * - ArrowDown: sourceが現在ノードのエッジの最初のtarget
 * - ArrowUp: targetが現在ノードのエッジの最初のsource
 * - ArrowRight: sourceが現在ノードのエッジの2番目のtarget（分岐先）
 * - ArrowLeft: targetが現在ノードのエッジの2番目のsource
 */
export function getLinkedNodeId(
  currentNodeId: string,
  direction: 'ArrowUp' | 'ArrowDown' | 'ArrowLeft' | 'ArrowRight',
  edges: Edge[]
): string | undefined {
  if (direction === 'ArrowDown' || direction === 'ArrowRight') {
    const targets = edges
      .filter((e) => e.source === currentNodeId)
      .map((e) => e.target);
    if (direction === 'ArrowDown') return targets[0];
    if (direction === 'ArrowRight') return targets[1] ?? targets[0];
  }
  if (direction === 'ArrowUp' || direction === 'ArrowLeft') {
    const sources = edges
      .filter((e) => e.target === currentNodeId)
      .map((e) => e.source);
    if (direction === 'ArrowUp') return sources[0];
    if (direction === 'ArrowLeft') return sources[1] ?? sources[0];
  }
  return undefined;
}

export interface FlowKeyboardActions {
  onCreateBelow: (selectedNodeId: string) => void;
  onCreateBranch: (selectedNodeId: string) => void;
  onStartEdit: (selectedNodeId: string) => void;
  onDeleteSelected: () => void;
  onDeselectAll: () => void;
  onLinkSelected: () => void;
  onNavigate: (direction: 'ArrowUp' | 'ArrowDown' | 'ArrowLeft' | 'ArrowRight') => void;
  onOpenDetail: (selectedNodeId: string) => void;
  onFitView: () => void;
  onFocusQuickInput: () => void;
}

export function useFlowKeyboardHandler(
  getSelectedNodeId: () => string | undefined,
  getSelectedEdgeIds: () => string[],
  edges: Edge[],
  actions: FlowKeyboardActions
) {
  const editingRef = useRef(false);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (shouldIgnoreKeyEvent(event)) return;
      if (editingRef.current && event.key !== 'Escape') return;

      const selectedNodeId = getSelectedNodeId();

      switch (event.key) {
        case 'Enter': {
          event.preventDefault();
          if (selectedNodeId) actions.onCreateBelow(selectedNodeId);
          break;
        }
        case 'Tab': {
          event.preventDefault();
          if (selectedNodeId) actions.onCreateBranch(selectedNodeId);
          break;
        }
        case 'F2': {
          event.preventDefault();
          if (selectedNodeId) {
            editingRef.current = true;
            actions.onStartEdit(selectedNodeId);
          }
          break;
        }
        case 'Delete':
        case 'Backspace': {
          // ReactFlowのデフォルト削除と連動するため、ここではエッジの場合のみ処理
          const selectedEdges = getSelectedEdgeIds();
          if (selectedEdges.length > 0) {
            event.preventDefault();
            actions.onDeleteSelected();
          } else if (selectedNodeId) {
            event.preventDefault();
            actions.onDeleteSelected();
          }
          break;
        }
        case 'Escape': {
          editingRef.current = false;
          actions.onDeselectAll();
          break;
        }
        case ' ': {
          event.preventDefault();
          if (selectedNodeId) actions.onOpenDetail(selectedNodeId);
          break;
        }
        case 'Home': {
          event.preventDefault();
          actions.onFitView();
          break;
        }
        case 'ArrowUp':
        case 'ArrowDown':
        case 'ArrowLeft':
        case 'ArrowRight': {
          if (selectedNodeId) {
            event.preventDefault();
            actions.onNavigate(event.key as 'ArrowUp' | 'ArrowDown' | 'ArrowLeft' | 'ArrowRight');
          }
          break;
        }
        default: {
          // Ctrl+L: リンク作成
          if (event.ctrlKey && event.key === 'l') {
            event.preventDefault();
            actions.onLinkSelected();
          }
          // Ctrl+I: Quick Inputフォーカス
          if (event.ctrlKey && event.key === 'i') {
            event.preventDefault();
            actions.onFocusQuickInput();
          }
          break;
        }
      }
    },
    [getSelectedNodeId, getSelectedEdgeIds, edges, actions]
  );

  const stopEditing = useCallback(() => {
    editingRef.current = false;
  }, []);

  return { handleKeyDown, stopEditing, editingRef };
}
