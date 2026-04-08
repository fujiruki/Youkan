import type { Node } from '@xyflow/react';
import type { Item } from '../../types';

export const PROJECT_COLORS = [
  'rgba(99, 102, 241, 0.08)',
  'rgba(16, 185, 129, 0.08)',
  'rgba(245, 158, 11, 0.08)',
  'rgba(239, 68, 68, 0.08)',
  'rgba(6, 182, 212, 0.08)',
  'rgba(168, 85, 247, 0.08)',
  'rgba(236, 72, 153, 0.08)',
  'rgba(34, 197, 94, 0.08)',
];

const PROJECT_BORDER_COLORS = [
  'rgba(99, 102, 241, 0.25)',
  'rgba(16, 185, 129, 0.25)',
  'rgba(245, 158, 11, 0.25)',
  'rgba(239, 68, 68, 0.25)',
  'rgba(6, 182, 212, 0.25)',
  'rgba(168, 85, 247, 0.25)',
  'rgba(236, 72, 153, 0.25)',
  'rgba(34, 197, 94, 0.25)',
];

const NODE_WIDTH = 180;
const NODE_HEIGHT = 60;
const GROUP_PADDING = 40;
const GROUP_HEADER_HEIGHT = 30;

export interface GroupBuildResult {
  groupNodes: Node[];
}

/**
 * アイテムの絶対座標からグループノード（視覚的な背景枠のみ）を構築する。
 * 子ノードにparentIdは設定しない。
 * positionsMapが渡された場合はReactFlowのノード位置を使用する（ドラッグ後の再計算用）。
 */
export function buildGroupNodes(
  placedItems: Item[],
  positionsMap?: Map<string, { x: number; y: number }>,
): GroupBuildResult {
  const projectGroups = new Map<string, { title: string; items: Item[] }>();

  for (const item of placedItems) {
    if (!item.projectId) continue;
    const existing = projectGroups.get(item.projectId);
    if (existing) {
      existing.items.push(item);
    } else {
      projectGroups.set(item.projectId, {
        title: item.projectTitle || item.projectId,
        items: [item],
      });
    }
  }

  const groupNodes: Node[] = [];
  let colorIndex = 0;

  for (const [projectId, group] of projectGroups) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const item of group.items) {
      const pos = positionsMap?.get(item.id);
      const x = pos ? pos.x : (item.meta!.flow_x as number);
      const y = pos ? pos.y : (item.meta!.flow_y as number);
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x + NODE_WIDTH);
      maxY = Math.max(maxY, y + NODE_HEIGHT);
    }

    const groupX = minX - GROUP_PADDING;
    const groupY = minY - GROUP_PADDING - GROUP_HEADER_HEIGHT;
    const groupWidth = (maxX - minX) + GROUP_PADDING * 2;
    const groupHeight = (maxY - minY) + GROUP_PADDING * 2 + GROUP_HEADER_HEIGHT;

    const groupId = `group-${projectId}`;
    const bgColor = PROJECT_COLORS[colorIndex % PROJECT_COLORS.length];
    const borderColor = PROJECT_BORDER_COLORS[colorIndex % PROJECT_BORDER_COLORS.length];

    groupNodes.push({
      id: groupId,
      type: 'projectGroup',
      position: { x: groupX, y: groupY },
      data: { label: group.title },
      style: {
        width: groupWidth,
        height: groupHeight,
        backgroundColor: bgColor,
        border: `2px dashed ${borderColor}`,
        borderRadius: 12,
        padding: 0,
      },
      draggable: false,
      selectable: false,
      zIndex: -1,
    });

    colorIndex++;
  }

  return { groupNodes };
}
