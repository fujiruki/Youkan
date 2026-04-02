import type { Node } from '@xyflow/react';
import type { Item } from '../../types';

// プロジェクトグループ用の薄い背景色パレット
export const PROJECT_COLORS = [
  'rgba(99, 102, 241, 0.08)',   // indigo
  'rgba(16, 185, 129, 0.08)',   // emerald
  'rgba(245, 158, 11, 0.08)',   // amber
  'rgba(239, 68, 68, 0.08)',    // red
  'rgba(6, 182, 212, 0.08)',    // cyan
  'rgba(168, 85, 247, 0.08)',   // purple
  'rgba(236, 72, 153, 0.08)',   // pink
  'rgba(34, 197, 94, 0.08)',    // green
];

// プロジェクトグループの境界線色
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

// ノードの推定サイズ（FlowItemNodeのmin-width/padding相当）
const NODE_WIDTH = 180;
const NODE_HEIGHT = 60;
// グループのパディング
const GROUP_PADDING = 40;
const GROUP_HEADER_HEIGHT = 30;

export interface ChildMapping {
  itemId: string;
  parentId: string;
  relativePosition: { x: number; y: number };
}

export interface GroupBuildResult {
  groupNodes: Node[];
  childMappings: ChildMapping[];
}

export function buildGroupNodes(placedItems: Item[]): GroupBuildResult {
  // プロジェクトID別にアイテムをグループ化
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
  const childMappings: ChildMapping[] = [];
  let colorIndex = 0;

  for (const [projectId, group] of projectGroups) {
    // 子ノード群の境界矩形を計算
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const item of group.items) {
      const x = item.meta!.flow_x as number;
      const y = item.meta!.flow_y as number;
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
      draggable: true,
      selectable: false,
      zIndex: -1,
    });

    for (const item of group.items) {
      childMappings.push({
        itemId: item.id,
        parentId: groupId,
        relativePosition: {
          x: (item.meta!.flow_x as number) - groupX,
          y: (item.meta!.flow_y as number) - groupY,
        },
      });
    }

    colorIndex++;
  }

  return { groupNodes, childMappings };
}
