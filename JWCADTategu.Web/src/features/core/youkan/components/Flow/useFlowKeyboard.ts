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
