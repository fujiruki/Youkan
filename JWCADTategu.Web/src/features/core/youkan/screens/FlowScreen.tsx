import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  ReactFlow,
  ReactFlowProvider,
  Controls,
  Background,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
  useReactFlow,
  type Node,
  type Edge,
  type OnConnect,
  type OnNodeDrag,
  type OnNodesDelete,
  type OnEdgesDelete,
  type OnSelectionChangeFunc,
  type OnNodesChange,
  BackgroundVariant,
  MarkerType,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { ArrowLeft, ChevronDown, Plus, Maximize, Printer, Undo2, LayoutGrid, CalendarRange, ArrowUpDown } from 'lucide-react';

import { FlowItemNode } from '../components/Flow/FlowItemNode';
import { ProjectGroupNode } from '../components/Flow/ProjectGroupNode';
import { DateBandNode } from '../components/Flow/DateBandNode';
import { EdgeContextMenu } from '../components/Flow/EdgeContextMenu';
import { UnplacedItemList, type UnplacedItemListHandle } from '../components/Flow/UnplacedItemList';
import { ContextMenu } from '../components/Common/ContextMenu';
import { buildItemContextMenuActions } from '../hooks/buildItemContextMenuActions';
import { FlowProjectSelector } from '../components/Flow/FlowProjectSelector';
import { buildGroupNodes } from '../components/Flow/flowGrouping';
import { shouldIgnoreKeyEvent, getLinkedNodeId } from '../components/Flow/useFlowKeyboard';
import { DependencyRepository } from '../repositories/DependencyRepository';
import { calculateAutoPlacement, findNearestEdge, calculateEdgeMidpoint, type PlacementResult } from '../logic/flowAutoPlace';
import { calculateDateBands, calculateDateGroupLayout, type DateBand } from '../logic/flowDateGrouping';
import { calculateAutoArrange } from '../logic/flowAutoArrange';
import { calculateVerticalCompact } from '../logic/flowVerticalCompact';
import { ApiClient } from '../../../../api/client';
import type { Item, Dependency } from '../types';
import { useToast } from '../../../../contexts/ToastContext';
import { useFilter } from '../contexts/FilterContext';
import { DecisionDetailModal } from '../components/Modal/DecisionDetailModal';

const nodeTypes = {
  flowItem: FlowItemNode,
  projectGroup: ProjectGroupNode,
  dateBand: DateBandNode,
};

// R-109: 日付区間の帯（1本おきに色を変えて区間の境目を見せる）
const DATE_BAND_COLORS = ['rgba(99, 102, 241, 0.05)', 'rgba(148, 163, 184, 0.10)'];
// R-114: 自動整理の縦間隔スライダーの記憶先
const GAP_Y_STORAGE_KEY = 'youkan_flow_arrange_gap_y';
const GAP_Y_DEFAULT = 35;
const GAP_Y_MIN = 10;
const GAP_Y_MAX = 100;
const dependencyRepo = new DependencyRepository();

const OVERLAP_THRESHOLD = 40;
const EDGE_INSERT_THRESHOLD = 50;

const DEPENDENCY_EDGE_STYLE = { stroke: '#6366f1', strokeWidth: 2 };
const DEPENDENCY_EDGE_HIGHLIGHT_STYLE = { stroke: '#3b82f6', strokeWidth: 4 };
const DEPENDENCY_EDGE_MARKER_END = { type: MarkerType.ArrowClosed };
// R-086: 選択中のedgeを発光させるグロー表現（drop-shadowを二重に重ねて光暈を強調）
const DEPENDENCY_EDGE_SELECTED_GLOW = 'drop-shadow(0 0 4px #3b82f6) drop-shadow(0 0 8px #3b82f6)';

// 依存関係からedgeを構築する唯一の変換ロジック（描画箇所全てがここを通る）
function dependencyToEdge(dep: Dependency, isHighlighted: boolean, isSelected: boolean = false): Edge {
  const baseStyle = isHighlighted ? DEPENDENCY_EDGE_HIGHLIGHT_STYLE : DEPENDENCY_EDGE_STYLE;
  return {
    id: dep.id,
    source: dep.sourceItemId,
    target: dep.targetItemId,
    animated: false,
    interactionWidth: 20,
    markerEnd: DEPENDENCY_EDGE_MARKER_END,
    selected: isSelected,
    style: isSelected ? { ...baseStyle, filter: DEPENDENCY_EDGE_SELECTED_GLOW } : baseStyle,
  };
}

interface FlowScreenProps {
  activeProjectId?: string;
  onOpenItem?: (item: Item) => void;
  initialProjectId?: string | null;
}

interface FlowCanvasProps {
  onOpenItem?: (item: Item) => void;
  currentProjectId?: string;
}

const FlowCanvas: React.FC<FlowCanvasProps> = ({ onOpenItem, currentProjectId }) => {
  const [allItems, setAllItems] = useState<Item[]>([]);
  const [dependencies, setDependencies] = useState<Dependency[]>([]);
  const [nodes, setNodes, _onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);
  const [selectedEdgeIds, setSelectedEdgeIds] = useState<string[]>([]);
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const [newNodeId, setNewNodeId] = useState<string | null>(null);
  const { screenToFlowPosition, fitView } = useReactFlow();
  const { showToast } = useToast();
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const unplacedListRef = useRef<UnplacedItemListHandle>(null);
  const [isAutoPlacing, setIsAutoPlacing] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [edgeContextMenu, setEdgeContextMenu] = useState<{ x: number; y: number; edgeId: string } | null>(null);
  const dragStartPositions = useRef<Map<string, { x: number; y: number }>>(new Map());
  const isDragging = useRef(false);
  const prevProjectRef = useRef<string | null>(null);
  const shouldFitViewRef = useRef(false);
  const [highlightNodeId, setHighlightNodeId] = useState<string | null>(null);
  const [highlightEdgeId, setHighlightEdgeId] = useState<string | null>(null);
  const [nodeContextMenu, setNodeContextMenu] = useState<{ x: number; y: number; itemId: string } | null>(null);
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  // R-109/R-113: 日付表示（帯の表示ON/OFFのみ。ノード位置は書き換えない）
  const [isDateGrouping, setIsDateGrouping] = useState(false);
  const positionBackup = useRef<Map<string, { x: number; y: number }> | null>(null);
  // R-112: 「元に戻す」の表示条件（日付整列・自動整理どちらの実行後もtrueになる）
  const [hasPositionBackup, setHasPositionBackup] = useState(false);
  // R-114: 自動整理の縦間隔（localStorageに記憶）
  const [gapY, setGapY] = useState<number>(() => {
    const saved = Number(localStorage.getItem(GAP_Y_STORAGE_KEY));
    return Number.isFinite(saved) && saved > 0 ? saved : GAP_Y_DEFAULT;
  });
  // R-074: 目安時間欄のEnterからの連鎖ノード作成用（後方で定義される createNodeBelow への参照）
  const createNodeBelowRef = useRef<(parentNodeId: string, offsetX?: number) => void>(() => {});

  const fetchData = useCallback(async () => {
    const [itemsResult, depsResult] = await Promise.allSettled([
      ApiClient.getAllItems({ scope: 'aggregated', ...(currentProjectId ? { project_id: currentProjectId } : {}) }),
      dependencyRepo.getDependencies(),
    ]);

    if (itemsResult.status === 'fulfilled') {
      setAllItems(itemsResult.value);
    } else {
      console.error('[FlowScreen] アイテム取得失敗:', itemsResult.reason);
    }

    if (depsResult.status === 'fulfilled') {
      setDependencies(depsResult.value);
    } else {
      console.error('[FlowScreen] 依存関係取得失敗:', depsResult.reason);
    }
  }, [currentProjectId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleItemContextMenu = useCallback((e: React.MouseEvent, itemId: string) => {
    e.preventDefault();
    setNodeContextMenu({ x: e.clientX, y: e.clientY, itemId });
  }, []);

  const closeNodeContextMenu = useCallback(() => setNodeContextMenu(null), []);

  const handleDeleteItem = useCallback(async (itemId: string) => {
    try {
      await ApiClient.deleteItem(itemId);
      setAllItems(prev => prev.filter(i => i.id !== itemId));
      setDependencies(prev => prev.filter(d => d.sourceItemId !== itemId && d.targetItemId !== itemId));
      showToast({ type: 'success', title: '削除完了', message: 'アイテムを削除しました', duration: 3000 });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      showToast({ type: 'error', title: '削除失敗', message: msg, duration: 5000 });
    }
  }, [showToast]);

  // 依存関係を持つアイテムIDのセット
  const itemIdsWithDeps = useMemo(() => {
    const ids = new Set<string>();
    for (const dep of dependencies) {
      ids.add(dep.sourceItemId);
      ids.add(dep.targetItemId);
    }
    return ids;
  }, [dependencies]);

  // 依存関係ありでflow座標未設定のアイテムに自動座標を付与
  const autoPlacedItems = useMemo(() => {
    const needsAutoPlace = allItems.filter(
      (item) =>
        (item.meta?.flow_x == null || item.meta?.flow_y == null) &&
        itemIdsWithDeps.has(item.id)
    );
    if (needsAutoPlace.length === 0) return [];

    const placements = calculateAutoPlacement(needsAutoPlace, dependencies);
    return placements;
  }, [allItems, dependencies, itemIdsWithDeps]);

  const { placedItems, unplacedItems } = useMemo(() => {
    const placed: Item[] = [];
    const unplaced: Item[] = [];
    for (const item of allItems) {
      if (item.meta?.flow_x != null && item.meta?.flow_y != null) {
        if (!currentProjectId || item.projectId === currentProjectId) {
          placed.push(item);
        }
      } else {
        // プロジェクトフィルタ: currentProjectIdが指定されている場合はそのプロジェクトのアイテムのみ
        if (currentProjectId) {
          if (item.projectId === currentProjectId) {
            unplaced.push(item);
          }
        } else {
          unplaced.push(item);
        }
      }
    }
    return { placedItems: placed, unplacedItems: unplaced };
  }, [allItems, currentProjectId]);

  // R-113: 日付表示ONの帯は、ノードの現在位置（ドラッグ中もnodesの位置を優先）にライブ追従する
  const dateBands = useMemo<DateBand[]>(() => {
    if (!isDateGrouping) return [];
    const positions = new Map<string, { x: number; y: number }>();
    const sizes = new Map<string, { width: number; height: number }>();
    for (const n of nodes) {
      if (n.type !== 'flowItem') continue;
      positions.set(n.id, n.position);
      if (n.measured?.width && n.measured?.height) {
        sizes.set(n.id, { width: n.measured.width, height: n.measured.height });
      }
    }
    const itemsWithLivePositions = placedItems.map((item) => {
      const pos = positions.get(item.id);
      if (!pos) return item;
      return { ...item, meta: { ...(item.meta || {}), flow_x: pos.x, flow_y: pos.y } };
    });
    return calculateDateBands(itemsWithLivePositions, dependencies, sizes);
  }, [isDateGrouping, placedItems, dependencies, nodes]);

  const handleTitleChange = useCallback(async (itemId: string, newTitle: string) => {
    try {
      await ApiClient.updateItem(itemId, { title: newTitle } as Partial<Item>);
      setAllItems((prev) =>
        prev.map((item) => (item.id === itemId ? { ...item, title: newTitle } : item))
      );
    } catch (err) {
      console.error('[FlowScreen] タイトル更新失敗:', err);
    }
  }, []);

  const handleEditComplete = useCallback((_itemId: string) => {
    setEditingNodeId(null);
    setNewNodeId(null);
  }, []);

  const handleStartEditing = useCallback((itemId: string) => {
    setEditingNodeId(itemId);
  }, []);

  const handleEstimatedMinutesChange = useCallback(async (itemId: string, minutes: number) => {
    try {
      await ApiClient.updateItem(itemId, { estimatedMinutes: minutes } as Partial<Item>);
      setAllItems((prev) =>
        prev.map((item) => (item.id === itemId ? { ...item, estimatedMinutes: minutes } : item))
      );
    } catch (err) {
      console.error('[FlowScreen] 目安時間更新失敗:', err);
    }
  }, []);

  useEffect(() => {
    if (isDragging.current) return;

    const { groupNodes } = buildGroupNodes(placedItems);

    // R-080調査で判明した関連不具合(docs/handover/R-077-analysis.md 2.): このuseEffectは
    // itemNodesを毎回ゼロから作り直すため、xyflowが内部管理するmeasured(計測済みサイズ)や
    // selected(選択状態)を引き継がず消してしまう。measuredが消えると新規ノードが
    // visibility:hiddenに固定され続け、タイトル欄へフォーカス・全選択できなくなる(R-080)。
    // 直前のnodes状態から引き継いで復元する
    setNodes((prevNodes) => {
      const prevById = new Map(prevNodes.map((n) => [n.id, n]));
      const itemNodes: Node[] = placedItems.map((item) => {
        const isHighlighted = highlightNodeId === item.id;
        const prev = prevById.get(item.id);
        return {
          id: item.id,
          type: 'flowItem',
          position: { x: item.meta!.flow_x as number, y: item.meta!.flow_y as number },
          ...(prev?.measured ? { measured: prev.measured } : {}),
          selected: prev?.selected ?? false,
          data: {
            item,
            isEditing: editingNodeId === item.id,
            isNewNode: newNodeId === item.id,
            isHighlighted,
            onTitleChange: handleTitleChange,
            onEditComplete: handleEditComplete,
            onEstimatedMinutesChange: handleEstimatedMinutesChange,
            onStartEditing: handleStartEditing,
            onContextMenu: handleItemContextMenu,
            onChainCreate: (itemId: string) => createNodeBelowRef.current(itemId, 0),
          },
        } satisfies Node;
      });
      return [...groupNodes, ...itemNodes];
    });

    const newEdges: Edge[] = dependencies.map((dep) =>
      dependencyToEdge(dep, highlightEdgeId === dep.id, selectedEdgeIds.includes(dep.id))
    );
    setEdges(newEdges);

    if (prevProjectRef.current !== currentProjectId) {
      prevProjectRef.current = currentProjectId ?? null;
      shouldFitViewRef.current = true;
    }
  }, [placedItems, dependencies, editingNodeId, newNodeId, highlightNodeId, highlightEdgeId, selectedEdgeIds, handleTitleChange, handleEditComplete, handleEstimatedMinutesChange, handleStartEditing, handleItemContextMenu, setNodes, setEdges, currentProjectId, fitView]);

  // R-113: 帯（dateBand型ノード）はuseNodesStateの管理外で、renderのたびにdateBandsから合成する。
  // stateに含めてしまうと、帯の更新→nodes変化→dateBands再計算→帯の再更新…という無限ループの
  // 危険があるため、純粋な派生値としてReactFlowのnodes propにだけ合成する
  const bandNodesForRender = useMemo<Node[]>(
    () =>
      dateBands.map((band, index) => ({
        id: `dateband-${band.dateKey}`,
        type: 'dateBand',
        position: { x: band.x, y: band.y },
        data: { label: band.label, totalMinutes: band.totalMinutes, criticalMinutes: band.criticalMinutes },
        style: {
          width: band.width,
          height: band.height,
          backgroundColor: DATE_BAND_COLORS[index % DATE_BAND_COLORS.length],
          borderBottom: '2px solid rgba(100, 116, 139, 0.35)',
          padding: 0,
        },
        draggable: false,
        selectable: false,
        zIndex: -2,
      })),
    [dateBands]
  );

  const nodesForRender = useMemo<Node[]>(
    () => [...bandNodesForRender, ...nodes],
    [bandNodesForRender, nodes]
  );

  const updateItemMeta = useCallback(async (itemId: string, metaUpdate: Record<string, unknown>) => {
    const item = allItems.find((i) => i.id === itemId);
    const currentMeta = item?.meta || {};
    const newMeta = { ...currentMeta, ...metaUpdate };
    await ApiClient.updateItem(itemId, { meta: newMeta } as Partial<Item>);
  }, [allItems]);

  // 依存関係の作成をローカルstateへ直接反映する（dependencies変更を検知して
  // nodes/edgesを再構築する派生useEffectはisDragging中スキップされるため、
  // それだけに頼るとedgeが描画されないまま取り残されることがある。onConnect
  // と同様にedgesへも即時反映することで、派生useEffectの実行タイミングに
  // 依存せずedgeの描画を保証する）
  const appendDependencyToState = useCallback((dep: Dependency) => {
    setDependencies((prev) => [...prev, dep]);
    setEdges((eds) => (eds.some((e) => e.id === dep.id) ? eds : [...eds, dependencyToEdge(dep, false)]));
  }, [setEdges]);

  useEffect(() => {
    if (isDragging.current) return;
    if (autoPlacedItems.length === 0) return;

    for (const p of autoPlacedItems) {
      updateItemMeta(p.itemId, { flow_x: p.flow_x, flow_y: p.flow_y }).catch((err) => {
        console.error(`[FlowScreen] 自動配置座標保存失敗 (${p.itemId}):`, err);
      });
    }

    setAllItems((prev) =>
      prev.map((item) => {
        const placement = autoPlacedItems.find((p) => p.itemId === item.id);
        if (!placement) return item;
        return {
          ...item,
          meta: { ...(item.meta || {}), flow_x: placement.flow_x, flow_y: placement.flow_y },
        };
      })
    );
  }, [autoPlacedItems, updateItemMeta]);

  const onNodesChange: OnNodesChange = useCallback((changes) => {
    _onNodesChange(changes);
    const hasDimensionChange = changes.some((c) => c.type === 'dimensions');
    if (hasDimensionChange && shouldFitViewRef.current) {
      shouldFitViewRef.current = false;
      requestAnimationFrame(() => {
        fitView({ duration: 300, padding: 0.1 });
      });
    }
  }, [_onNodesChange, fitView]);

  const onSelectionChange: OnSelectionChangeFunc = useCallback(({ nodes: selNodes, edges: selEdges }) => {
    setSelectedNodeIds(selNodes.map((n) => n.id));
    setSelectedEdgeIds(selEdges.map((e) => e.id));
  }, []);

  const getNodePositions = useCallback(() => {
    const positions = new Map<string, { x: number; y: number }>();
    for (const node of nodes) {
      if (node.type === 'flowItem') {
        positions.set(node.id, { x: node.position.x, y: node.position.y });
      }
    }
    return positions;
  }, [nodes]);

  const handleEdgeInsert = useCallback(
    async (itemId: string, position: { x: number; y: number }) => {
      const nodePositions = getNodePositions();
      const nearest = findNearestEdge(position, edges, nodePositions, EDGE_INSERT_THRESHOLD, itemId);
      if (!nearest) return false;

      const oldEdgeId = nearest.edge.id;
      const oldEdgeSource = nearest.edge.source;
      const oldEdgeTarget = nearest.edge.target;

      let dep1: Dependency | null = null;
      let dep2: Dependency | null = null;
      try {
        dep1 = await dependencyRepo.createDependency(oldEdgeSource, itemId);
        dep2 = await dependencyRepo.createDependency(itemId, oldEdgeTarget);
        await dependencyRepo.deleteDependency(oldEdgeId);
        setDependencies((prev) => [
          ...prev.filter((d) => d.id !== oldEdgeId),
          dep1!, dep2!,
        ]);
        setEdges((eds) => [
          ...eds.filter((e) => e.id !== oldEdgeId),
          dependencyToEdge(dep1!, false),
          dependencyToEdge(dep2!, false),
        ]);

        const sourcePos = nodePositions.get(oldEdgeSource);
        const targetPos = nodePositions.get(oldEdgeTarget);
        if (sourcePos && targetPos) {
          const mid = calculateEdgeMidpoint(sourcePos, targetPos);
          await updateItemMeta(itemId, { flow_x: mid.x, flow_y: mid.y });
          setAllItems((prev) =>
            prev.map((item) =>
              item.id === itemId
                ? { ...item, meta: { ...(item.meta || {}), flow_x: mid.x, flow_y: mid.y } }
                : item
            )
          );
        }

        showToast({
          type: 'success',
          title: 'エッジ挿入',
          message: 'フローに挿入しました',
          duration: 3000,
        });
        return true;
      } catch (err) {
        if (dep1) dependencyRepo.deleteDependency(dep1.id).catch(() => {});
        if (dep2) dependencyRepo.deleteDependency(dep2.id).catch(() => {});
        console.error('[FlowScreen] エッジ挿入失敗:', err);
        showToast({ type: 'error', title: 'エッジ挿入失敗', message: String(err), duration: 5000 });
        return false;
      }
    },
    [edges, getNodePositions, updateItemMeta, showToast, setDependencies, setEdges, setAllItems]
  );

  const onNodeDragStart: OnNodeDrag = useCallback((_event, _node, nodes) => {
    isDragging.current = true;
    for (const n of nodes) {
      dragStartPositions.current.set(n.id, { ...n.position });
    }
  }, []);

  const onNodeDrag: OnNodeDrag = useCallback(
    (_event, draggedNode, selectedNodes) => {
      if (draggedNode.id.startsWith('group-')) return;
      isDragging.current = true;

      if (selectedNodes.length > 1) return;

      const pos = draggedNode.position;

      const allFlowNodes = nodes.filter((n) => n.type === 'flowItem' && n.id !== draggedNode.id);
      const overlap = allFlowNodes.find((n) =>
        Math.hypot(pos.x - n.position.x, pos.y - n.position.y) < OVERLAP_THRESHOLD
      );

      if (overlap) {
        setHighlightNodeId(overlap.id);
        setHighlightEdgeId(null);
        return;
      }

      const nodePositions = getNodePositions();
      const nearest = findNearestEdge(pos, edges, nodePositions, EDGE_INSERT_THRESHOLD, draggedNode.id);
      setHighlightEdgeId(nearest?.edge.id ?? null);
      setHighlightNodeId(null);
    },
    [nodes, edges, getNodePositions]
  );

  const onNodeDragStop: OnNodeDrag = useCallback(
    async (_event, draggedNode, selectedNodes) => {
      if (draggedNode.id.startsWith('group-')) return;

      isDragging.current = false;

      // 複数選択まとめ移動: 全ノードの位置を保存（オーバーラップ/エッジ挿入はスキップ）
      if (selectedNodes.length > 1) {
        const validNodes = selectedNodes.filter(n => !n.id.startsWith('group-'));
        // R-108: サーバー保存を待つ間に選択解除等で再レンダリングが起きると、allItemsから
        // nodesを再構築する派生useEffectが移動前の座標でノードを上書きしてしまう。
        // 保存より先にローカル座標を（全ノード分まとめて）確定させる
        setAllItems(prev =>
          prev.map(item => {
            const moved = validNodes.find(n => n.id === item.id);
            if (!moved) return item;
            return { ...item, meta: { ...(item.meta || {}), flow_x: moved.position.x, flow_y: moved.position.y } };
          })
        );
        dragStartPositions.current.clear();
        setHighlightNodeId(null);
        setHighlightEdgeId(null);
        setNodes((currentNodes) => {
          const positionsMap = new Map<string, { x: number; y: number }>();
          for (const n of currentNodes) {
            if (n.type === 'flowItem') positionsMap.set(n.id, { x: n.position.x, y: n.position.y });
          }
          const { groupNodes } = buildGroupNodes(placedItems, positionsMap);
          const groupMap = new Map(groupNodes.map((g) => [g.id, g]));
          return currentNodes.map((n) => {
            const updated = groupMap.get(n.id);
            return updated ? { ...n, position: updated.position, style: updated.style } : n;
          });
        });
        for (const node of validNodes) {
          await updateItemMeta(node.id, { flow_x: node.position.x, flow_y: node.position.y });
        }
        return;
      }

      const allFlowNodes = nodes.filter((n) => n.type === 'flowItem' && n.id !== draggedNode.id);
      let overlappingNode: Node | undefined;
      let minDistance = OVERLAP_THRESHOLD;
      for (const otherNode of allFlowNodes) {
        const dx = draggedNode.position.x - otherNode.position.x;
        const dy = draggedNode.position.y - otherNode.position.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance < minDistance) {
          minDistance = distance;
          overlappingNode = otherNode;
        }
      }

      if (overlappingNode) {
        try {
          const dep = await dependencyRepo.createDependency(overlappingNode.id, draggedNode.id);
          appendDependencyToState(dep);
          const sourceTitle = (overlappingNode.data as Record<string, unknown>)?.item
            ? ((overlappingNode.data as Record<string, unknown>).item as Item).title
            : overlappingNode.id;
          const targetTitle = (draggedNode.data as Record<string, unknown>)?.item
            ? ((draggedNode.data as Record<string, unknown>).item as Item).title
            : draggedNode.id;
          showToast({
            type: 'success',
            title: '接続作成',
            message: `${sourceTitle} → ${targetTitle} を接続しました`,
            duration: 3000,
            action: {
              label: '取り消し',
              onClick: async () => {
                try {
                  await dependencyRepo.deleteDependency(dep.id);
                  setDependencies((prev) => prev.filter((d) => d.id !== dep.id));
                  setEdges((eds) => eds.filter((e) => e.id !== dep.id));
                } catch (e) {
                  console.error('[FlowScreen] 取り消し失敗:', e);
                }
              },
            },
          });
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          if (msg.includes('400') || msg.toLowerCase().includes('circular')) {
            showToast({ type: 'error', title: '循環参照エラー', message: '依存関係が循環するため接続できません', duration: 5000 });
          } else if (msg.includes('409') || msg.toLowerCase().includes('already exists')) {
            showToast({ type: 'error', title: '接続エラー', message: 'この依存関係は既に存在します', duration: 3000 });
          } else {
            showToast({ type: 'error', title: '接続エラー', message: msg, duration: 5000 });
          }

          const startPos = dragStartPositions.current.get(draggedNode.id);
          if (startPos) {
            setNodes((nds) =>
              nds.map((n) =>
                n.id === draggedNode.id ? { ...n, position: startPos } : n
              )
            );
          }
          dragStartPositions.current.delete(draggedNode.id);
          setHighlightNodeId(null);
          setHighlightEdgeId(null);
          return;
        }

        const startPos = dragStartPositions.current.get(draggedNode.id);
        if (startPos) {
          setNodes((nds) =>
            nds.map((n) =>
              n.id === draggedNode.id ? { ...n, position: startPos } : n
            )
          );
        }
      } else {
        const inserted = await handleEdgeInsert(draggedNode.id, draggedNode.position);
        if (!inserted) {
          // R-108と同じ理由で、サーバー保存より先にローカル座標を確定させる
          setAllItems(prev =>
            prev.map(item =>
              item.id === draggedNode.id
                ? { ...item, meta: { ...(item.meta || {}), flow_x: draggedNode.position.x, flow_y: draggedNode.position.y } }
                : item
            )
          );
          await updateItemMeta(draggedNode.id, { flow_x: draggedNode.position.x, flow_y: draggedNode.position.y });
        }
      }

      dragStartPositions.current.delete(draggedNode.id);
      setHighlightNodeId(null);
      setHighlightEdgeId(null);

      // グループノードの位置・サイズを再計算
      setNodes((currentNodes) => {
        const positionsMap = new Map<string, { x: number; y: number }>();
        for (const n of currentNodes) {
          if (n.type === 'flowItem') {
            positionsMap.set(n.id, { x: n.position.x, y: n.position.y });
          }
        }
        const { groupNodes } = buildGroupNodes(placedItems, positionsMap);
        const groupMap = new Map(groupNodes.map((g) => [g.id, g]));
        return currentNodes.map((n) => {
          const updated = groupMap.get(n.id);
          return updated ? { ...n, position: updated.position, style: updated.style } : n;
        });
      });
    },
    [nodes, updateItemMeta, showToast, setNodes, setEdges, handleEdgeInsert, placedItems, setAllItems, appendDependencyToState]
  );

  const onConnect: OnConnect = useCallback(
    async (connection) => {
      if (!connection.source || !connection.target) return;
      try {
        const dep = await dependencyRepo.createDependency(connection.source, connection.target);
        setEdges((eds) =>
          addEdge(
            {
              ...connection,
              id: dep.id,
              animated: false,
              markerEnd: DEPENDENCY_EDGE_MARKER_END,
              style: DEPENDENCY_EDGE_STYLE,
            },
            eds
          )
        );
        setDependencies((prev) => [...prev, dep]);
        const sourceItem = allItems.find((i) => i.id === connection.source);
        const targetItem = allItems.find((i) => i.id === connection.target);
        const srcName = sourceItem?.title || connection.source;
        const tgtName = targetItem?.title || connection.target;
        showToast({
          type: 'success',
          title: '接続作成',
          message: `${srcName} → ${tgtName} を接続しました`,
          duration: 3000,
          action: {
            label: '取り消し',
            onClick: async () => {
              try {
                await dependencyRepo.deleteDependency(dep.id);
                setDependencies((prev) => prev.filter((d) => d.id !== dep.id));
                setEdges((eds) => eds.filter((e) => e.id !== dep.id));
              } catch (e) {
                console.error('[FlowScreen] 接続取り消し失敗:', e);
              }
            },
          },
        });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes('400') || msg.toLowerCase().includes('circular')) {
          showToast({ type: 'error', title: '循環参照エラー', message: '依存関係が循環するため接続できません', duration: 5000 });
        } else {
          showToast({ type: 'error', title: '接続エラー', message: msg, duration: 5000 });
        }
      }
    },
    [setEdges, showToast, allItems]
  );

  const onEdgesDelete: OnEdgesDelete = useCallback(
    async (deletedEdges) => {
      for (const edge of deletedEdges) {
        try {
          await dependencyRepo.deleteDependency(edge.id);
          setDependencies((prev) => prev.filter((d) => d.id !== edge.id));
        } catch (err) {
          console.error('[FlowScreen] エッジ削除失敗:', err);
        }
      }
    },
    []
  );

  const onNodesDelete: OnNodesDelete = useCallback(
    async (deletedNodes) => {
      for (const node of deletedNodes) {
        if (node.id.startsWith('group-')) continue;
        await updateItemMeta(node.id, { flow_x: null, flow_y: null });
        setAllItems((prev) =>
          prev.map((item) =>
            item.id === node.id
              ? { ...item, meta: { ...(item.meta || {}), flow_x: null, flow_y: null } }
              : item
          )
        );
      }
    },
    [updateItemMeta]
  );

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      const itemId = e.dataTransfer.getData('application/youkan-flow-item');
      if (!itemId) return;

      const position = screenToFlowPosition({ x: e.clientX, y: e.clientY });

      const inserted = await handleEdgeInsert(itemId, position);
      if (inserted) return;

      await updateItemMeta(itemId, { flow_x: position.x, flow_y: position.y });

      setAllItems((prev) =>
        prev.map((item) =>
          item.id === itemId
            ? { ...item, meta: { ...(item.meta || {}), flow_x: position.x, flow_y: position.y } }
            : item
        )
      );
    },
    [screenToFlowPosition, updateItemMeta, handleEdgeInsert]
  );

  const handleEdgeContextMenu = useCallback(
    (event: React.MouseEvent, edge: Edge) => {
      event.preventDefault();
      setEdgeContextMenu({ x: event.clientX, y: event.clientY, edgeId: edge.id });
    },
    []
  );

  const handleEdgeContextMenuDelete = useCallback(
    async (edgeId: string) => {
      try {
        await dependencyRepo.deleteDependency(edgeId);
        setDependencies((prev) => prev.filter((d) => d.id !== edgeId));
        setEdges((eds) => eds.filter((e) => e.id !== edgeId));
        showToast({ type: 'success', title: '接続削除', message: '接続を削除しました', duration: 2000 });
      } catch (err) {
        console.error('[FlowScreen] エッジ削除失敗:', err);
        showToast({ type: 'error', title: '削除失敗', message: String(err), duration: 5000 });
      }
    },
    [showToast, setEdges]
  );

  const closeEdgeContextMenu = useCallback(() => {
    setEdgeContextMenu(null);
  }, []);

  // R-108と同じ理由で、サーバー保存より先にローカル座標を確定させる
  const applyPlacements = useCallback(async (placements: PlacementResult[]) => {
    setAllItems((prev) =>
      prev.map((item) => {
        const placement = placements.find((p) => p.itemId === item.id);
        if (!placement) return item;
        return {
          ...item,
          meta: { ...(item.meta || {}), flow_x: placement.flow_x, flow_y: placement.flow_y },
        };
      })
    );
    for (const p of placements) {
      try {
        await updateItemMeta(p.itemId, { flow_x: p.flow_x, flow_y: p.flow_y });
      } catch (err) {
        console.error(`[FlowScreen] 位置保存失敗 (${p.itemId}):`, err);
      }
    }
  }, [updateItemMeta]);

  // R-113: 日付表示のON/OFF。帯の表示切替のみで、ノード座標は一切書き換えない
  const handleToggleDateGrouping = useCallback((checked: boolean) => {
    setIsDateGrouping(checked);
  }, []);

  // R-112/R-114: プロジェクトごとに層分け・交差削減した配置へ整理する（日付表示ON中も使用可）
  const handleAutoArrange = useCallback(async () => {
    positionBackup.current = new Map(
      placedItems.map((item) => [
        item.id,
        { x: item.meta!.flow_x as number, y: item.meta!.flow_y as number },
      ])
    );
    setHasPositionBackup(true);
    const sizes = new Map(
      nodes
        .filter((n) => n.measured?.width && n.measured?.height)
        .map((n) => [n.id, { width: n.measured!.width!, height: n.measured!.height! }])
    );
    const placements = calculateAutoArrange(placedItems, dependencies, sizes, { gapY });
    shouldFitViewRef.current = true;
    await applyPlacements(placements);
  }, [placedItems, dependencies, nodes, gapY, applyPlacements]);

  // R-113:「日付整列」ボタン。横位置(flow_x)は変えず、縦方向だけ日付順の区間へ移動する。
  // 日付表示のON/OFF状態は変更しない
  const handleDateAlign = useCallback(async () => {
    positionBackup.current = new Map(
      placedItems.map((item) => [
        item.id,
        { x: item.meta!.flow_x as number, y: item.meta!.flow_y as number },
      ])
    );
    setHasPositionBackup(true);
    const placements = calculateDateGroupLayout(placedItems, dependencies);
    shouldFitViewRef.current = true;
    await applyPlacements(placements);
  }, [placedItems, dependencies, applyPlacements]);

  // R-118:「詰める」ボタン。並び順・横位置(flow_x)は変えず、上下方向の隙間だけを最小化する
  const handleCompact = useCallback(async () => {
    positionBackup.current = new Map(
      placedItems.map((item) => [
        item.id,
        { x: item.meta!.flow_x as number, y: item.meta!.flow_y as number },
      ])
    );
    setHasPositionBackup(true);
    const sizes = new Map(
      nodes
        .filter((n) => n.measured?.width && n.measured?.height)
        .map((n) => [n.id, { width: n.measured!.width!, height: n.measured!.height! }])
    );
    const placements = calculateVerticalCompact(placedItems, dependencies, sizes, { gapY });
    shouldFitViewRef.current = true;
    await applyPlacements(placements);
  }, [placedItems, dependencies, nodes, gapY, applyPlacements]);

  // R-114: 縦間隔スライダーの変更をlocalStorageに記憶する
  const handleGapYChange = useCallback((value: number) => {
    setGapY(value);
    localStorage.setItem(GAP_Y_STORAGE_KEY, String(value));
  }, []);

  // R-109/R-112/R-113: 日付整列または自動整理の適用直前の位置へ1段階戻す（日付表示のON/OFFは維持）
  const handleRestorePositions = useCallback(async () => {
    const backup = positionBackup.current;
    if (!backup) return;
    positionBackup.current = null;
    setHasPositionBackup(false);
    await applyPlacements(
      Array.from(backup, ([itemId, pos]) => ({ itemId, flow_x: pos.x, flow_y: pos.y }))
    );
  }, [applyPlacements]);

  const handleAutoPlace = useCallback(async () => {
    if (allItems.length === 0) return;
    setIsAutoPlacing(true);

    try {
      const placements = calculateAutoPlacement(allItems, dependencies);

      const existingDepKeys = new Set(
        dependencies.map((d) => `${d.sourceItemId}:${d.targetItemId}`)
      );

      let skippedCount = 0;
      for (const p of placements) {
        if (p.chainFrom) {
          const depKey = `${p.chainFrom}:${p.itemId}`;
          if (existingDepKeys.has(depKey)) {
            skippedCount++;
            continue;
          }
          try {
            const dep = await dependencyRepo.createDependency(p.chainFrom, p.itemId);
            setDependencies((prev) => [...prev, dep]);
            existingDepKeys.add(depKey);
          } catch {
            skippedCount++;
          }
        }
      }

      let positionErrors = 0;
      for (const p of placements) {
        try {
          await updateItemMeta(p.itemId, { flow_x: p.flow_x, flow_y: p.flow_y });
        } catch (err) {
          console.error(`[FlowScreen] 位置保存失敗 (${p.itemId}):`, err);
          positionErrors++;
        }
      }

      setAllItems((prev) =>
        prev.map((item) => {
          const placement = placements.find((p) => p.itemId === item.id);
          if (!placement) return item;
          return {
            ...item,
            meta: { ...(item.meta || {}), flow_x: placement.flow_x, flow_y: placement.flow_y },
          };
        })
      );

      const msg = `${placements.length}件を配置しました` +
        (skippedCount > 0 ? `（${skippedCount}件の依存関係をスキップ）` : '') +
        (positionErrors > 0 ? `（${positionErrors}件の位置保存エラー）` : '');
      showToast({ type: 'success', title: '自動配置完了', message: msg, duration: 3000 });

      setTimeout(() => fitView({ duration: 300 }), 100);
    } catch (err) {
      console.error('[FlowScreen] 自動配置失敗:', err);
      showToast({ type: 'error', title: '自動配置失敗', message: String(err), duration: 5000 });
      await fetchData();
    } finally {
      setIsAutoPlacing(false);
    }
  }, [allItems, dependencies, updateItemMeta, showToast, fitView, fetchData]);

  const createNewItem = useCallback(
    async (flowX: number, flowY: number): Promise<string | null> => {
      const result = await ApiClient.createItem({
        title: '新規アイテム',
        status: 'inbox',
        ...(currentProjectId ? { projectId: currentProjectId } : {}),
      } as Partial<Item>);
      const newItemId = result.id;
      await ApiClient.updateItem(newItemId, { meta: { flow_x: flowX, flow_y: flowY } } as Partial<Item>);

      const newItem: Item = {
        id: newItemId,
        title: '新規アイテム',
        status: 'inbox',
        focusOrder: 0,
        isEngaged: false,
        statusUpdatedAt: Date.now(),
        interrupt: false,
        weight: 1,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        projectId: currentProjectId || undefined,
        meta: { flow_x: flowX, flow_y: flowY },
      };
      setAllItems((prev) => [...prev, newItem]);
      setNewNodeId(newItemId);
      return newItemId;
    },
    [currentProjectId]
  );

  const createNodeBelow = useCallback(
    async (parentNodeId: string, offsetX = 0) => {
      const parentItem = allItems.find((i) => i.id === parentNodeId);
      if (!parentItem) return;

      const parentX = (parentItem.meta?.flow_x as number) || 0;
      const parentY = (parentItem.meta?.flow_y as number) || 0;

      try {
        const newItemId = await createNewItem(parentX + offsetX, parentY + 120);
        if (newItemId) {
          const dep = await dependencyRepo.createDependency(parentNodeId, newItemId);
          appendDependencyToState(dep);
        }
        return newItemId;
      } catch (err) {
        console.error('[FlowScreen] ノード追加失敗:', err);
        showToast({ type: 'error', title: 'ノード追加失敗', message: String(err), duration: 5000 });
        return null;
      }
    },
    [allItems, showToast, createNewItem, appendDependencyToState]
  );

  // R-074: ノードデータの onChainCreate はコンポーネント冒頭の edge 構築 useEffect から
  // 参照されるが、createNodeBelow はそれより後方で定義されるため ref 経由で受け渡す
  // （TDZ回避。createNodeBelow を前方へ移動する再構成より安全で差分も小さい）
  useEffect(() => {
    createNodeBelowRef.current = createNodeBelow;
  }, [createNodeBelow]);

  const handleOpenItemInternal = useCallback((item: Item) => {
    if (onOpenItem) {
      onOpenItem(item);
    } else {
      setSelectedItem(item);
    }
  }, [onOpenItem]);

  // A-6: 空白エリアダブルクリックで新規タスク作成
  // R-088: 選択ノードがある状態でのダブルクリックは、クリック位置と選択ノードのY座標を
  // 比較して依存関係を自動設定する（クリック位置が選択ノードより上なら新規ノードが前提、
  // 下なら選択ノードが前提）。依存関係作成は他の4経路（onConnect/createNodeBelow/
  // handleEdgeInsert/ドラッグ重なり自動接続）と同じ appendDependencyToState() を経由させ、
  // edgeを即座に反映させる（別実装するとedge非表示バグを再現するため必須）。
  const handlePaneDoubleClick = useCallback(
    async (event: React.MouseEvent) => {
      const position = screenToFlowPosition({ x: event.clientX, y: event.clientY });
      const selectedNodeId = selectedNodeIds[0];
      const selectedItem = selectedNodeId ? allItems.find((i) => i.id === selectedNodeId) : undefined;
      try {
        const newItemId = await createNewItem(position.x, position.y);
        if (newItemId && selectedItem) {
          const selectedY = (selectedItem.meta?.flow_y as number) || 0;
          const [sourceId, targetId] =
            position.y < selectedY ? [newItemId, selectedItem.id] : [selectedItem.id, newItemId];
          const dep = await dependencyRepo.createDependency(sourceId, targetId);
          appendDependencyToState(dep);
        }
      } catch (err) {
        console.error('[FlowScreen] ダブルクリック新規タスク作成失敗:', err);
        showToast({ type: 'error', title: '作成失敗', message: String(err), duration: 5000 });
      }
    },
    [screenToFlowPosition, createNewItem, showToast, selectedNodeIds, allItems, appendDependencyToState]
  );

  // A-6: +ボタンで新規タスク作成
  const handleAddButtonClick = useCallback(async () => {
    try {
      await createNewItem(100, 100);
    } catch (err) {
      console.error('[FlowScreen] +ボタン新規タスク作成失敗:', err);
      showToast({ type: 'error', title: '作成失敗', message: String(err), duration: 5000 });
    }
  }, [createNewItem, showToast]);

  // R-102: 印刷ボタン押下時点のfitViewは画面表示サイズを基準に計算されるが、
  // その後 window.print() で印刷用紙サイズへレイアウトが切り替わると、
  // 画面基準のズーム/パン位置がそのまま持ち越され、用紙の右端の細い帯にしか
  // 全体が収まらなくなる。印刷用レイアウトが確定するタイミング（beforeprint）で
  // 用紙サイズを基準に再度fitViewし直すことで、ブラウザのCtrl+P等ボタン以外からの
  // 印刷でも常に正しく全体を収める
  useEffect(() => {
    const handleBeforePrint = () => fitView({ duration: 0, padding: 0.1 });
    window.addEventListener('beforeprint', handleBeforePrint);
    return () => window.removeEventListener('beforeprint', handleBeforePrint);
  }, [fitView]);

  // R-101: 印刷。「全体を印刷したい」という要望のため、現在のズーム/パン位置に
  // 関わらず全ノードを収めてから印刷する。fitViewはduration 0（即時）で実行し、
  // アニメーション中に印刷ダイアログが開いて中途半端な表示になることを避ける
  const handlePrint = useCallback(() => {
    fitView({ duration: 0, padding: 0.1 });
    window.print();
  }, [fitView]);

  // A-7: ノードダブルクリック → 詳細モーダル
  const handleNodeDoubleClick = useCallback(
    (event: React.MouseEvent, node: Node) => {
      event.stopPropagation();
      if (node.id.startsWith('group-')) return;
      const item = allItems.find((i) => i.id === node.id);
      if (item) handleOpenItemInternal(item);
    },
    [allItems, handleOpenItemInternal]
  );

  const handleKeyDown = useCallback(
    async (event: KeyboardEvent) => {
      if (shouldIgnoreKeyEvent(event)) return;

      // ヘルプモーダルが開いている場合はEscapeで閉じる
      if (isHelpOpen && event.key === 'Escape') {
        setIsHelpOpen(false);
        return;
      }

      const selectedNode = selectedNodeIds[0];

      switch (event.key) {
        case 'Enter': {
          event.preventDefault();
          if (selectedNode) createNodeBelow(selectedNode, 0);
          break;
        }
        case 'Tab': {
          event.preventDefault();
          if (selectedNode) createNodeBelow(selectedNode, 200);
          break;
        }
        case 'F2': {
          event.preventDefault();
          if (selectedNode) setEditingNodeId(selectedNode);
          break;
        }
        case 'Delete':
        case 'Backspace': {
          if (nodeContextMenu) {
            event.preventDefault();
            handleDeleteItem(nodeContextMenu.itemId);
            closeNodeContextMenu();
            break;
          }
          if (selectedEdgeIds.length > 0) {
            event.preventDefault();
            for (const edgeId of selectedEdgeIds) {
              try {
                await dependencyRepo.deleteDependency(edgeId);
                setDependencies((prev) => prev.filter((d) => d.id !== edgeId));
                setEdges((eds) => eds.filter((e) => e.id !== edgeId));
              } catch (err) {
                console.error('[FlowScreen] エッジ削除失敗:', err);
              }
            }
            break;
          }
          if (selectedNode && !selectedNode.startsWith('group-')) {
            event.preventDefault();
            await handleDeleteItem(selectedNode);
          }
          break;
        }
        case 'Escape': {
          setEditingNodeId(null);
          setNewNodeId(null);
          setNodes((nds) => nds.map((n) => ({ ...n, selected: false })));
          setEdges((eds) => eds.map((e) => ({ ...e, selected: false })));
          break;
        }
        case ' ': {
          event.preventDefault();
          if (selectedNode) {
            const item = allItems.find((i) => i.id === selectedNode);
            if (item) handleOpenItemInternal(item);
          }
          break;
        }
        case 'Home': {
          event.preventDefault();
          fitView({ duration: 300 });
          break;
        }
        case 'ArrowUp':
        case 'ArrowDown':
        case 'ArrowLeft':
        case 'ArrowRight': {
          if (selectedNode) {
            event.preventDefault();
            const targetId = getLinkedNodeId(selectedNode, event.key as any, edges);
            if (targetId) {
              setNodes((nds) =>
                nds.map((n) => ({
                  ...n,
                  selected: n.id === targetId,
                }))
              );
            }
          }
          break;
        }
        default: {
          if (event.ctrlKey && event.key === 'l') {
            event.preventDefault();
            if (selectedNodeIds.length === 2) {
              try {
                const dep = await dependencyRepo.createDependency(selectedNodeIds[0], selectedNodeIds[1]);
                setDependencies((prev) => [...prev, dep]);
                showToast({ type: 'success', title: 'リンク作成', message: '依存関係を追加しました', duration: 2000 });
              } catch (err: unknown) {
                const msg = err instanceof Error ? err.message : String(err);
                showToast({ type: 'error', title: 'リンク作成失敗', message: msg, duration: 5000 });
              }
            } else {
              showToast({ type: 'warning', title: 'リンク作成', message: '2つのノードを選択してください', duration: 3000 });
            }
          }
          if (event.ctrlKey && event.key === 'i') {
            event.preventDefault();
            unplacedListRef.current?.focusInput();
          }
          break;
        }
      }
    },
    [selectedNodeIds, selectedEdgeIds, allItems, edges, createNodeBelow, updateItemMeta, fitView, handleOpenItemInternal, showToast, setNodes, setEdges, isHelpOpen, setIsHelpOpen, handleDeleteItem, nodeContextMenu, closeNodeContextMenu]
  );

  useEffect(() => {
    const wrapper = reactFlowWrapper.current;
    if (!wrapper) return;

    wrapper.addEventListener('keydown', handleKeyDown);
    return () => wrapper.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return (
    <div className="h-full w-full relative" ref={reactFlowWrapper} tabIndex={0} data-testid="flow-canvas-root">
      <ReactFlow
        nodes={nodesForRender}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeDragStart={onNodeDragStart}
        onNodeDrag={onNodeDrag}
        onNodeDragStop={onNodeDragStop}
        onNodesDelete={onNodesDelete}
        onEdgesDelete={onEdgesDelete}
        onSelectionChange={onSelectionChange}
        onEdgeContextMenu={handleEdgeContextMenu}
        onDragOver={onDragOver}
        onDrop={onDrop}
        onDoubleClick={handlePaneDoubleClick}
        onNodeDoubleClick={handleNodeDoubleClick}
        nodeTypes={nodeTypes}
        fitView
        minZoom={0.05}
        deleteKeyCode={null}
        zoomOnDoubleClick={false}
        selectionKeyCode="Shift"
        multiSelectionKeyCode="Shift"
        edgesFocusable
        className="bg-slate-50"
      >
        <Controls className="!bg-white !border-slate-200 !shadow-lg no-print" />
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#cbd5e1" />
        <MiniMap
          nodeColor={(node) => {
            if (node.type === 'projectGroup') return 'transparent';
            const item = (node.data as Record<string, unknown>)?.item as Item | undefined;
            if (!item) return '#94a3b8';
            switch (item.status) {
              case 'focus': return '#6366f1';
              case 'pending': return '#f59e0b';
              case 'waiting': return '#f97316';
              case 'done': return '#9ca3af';
              default: return '#94a3b8';
            }
          }}
          className="!bg-white/80 !border-slate-200 no-print"
        />
      </ReactFlow>
      {allItems.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
          <div className="text-center">
            <p className="text-sm text-slate-400 font-medium">アイテムがありません</p>
            <p className="text-xs text-slate-300 mt-1">ダブルクリックまたは右下の＋ボタンで追加</p>
          </div>
        </div>
      )}
      <UnplacedItemList ref={unplacedListRef} items={unplacedItems} onAutoPlace={handleAutoPlace} isAutoPlacing={isAutoPlacing} onContextMenu={handleItemContextMenu} />
      <button
        onClick={handleAddButtonClick}
        className="absolute bottom-4 right-4 w-10 h-10 bg-indigo-500 hover:bg-indigo-600 text-white rounded-full shadow-lg flex items-center justify-center transition-colors z-10 no-print"
        title="新規タスク追加"
      >
        <Plus size={20} />
      </button>
      <button
        onClick={() => setIsHelpOpen(true)}
        className="absolute top-3 right-3 flex items-center gap-1 px-3 py-1 text-xs text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors z-10 no-print"
        title="操作ガイド"
      >
        <span className="text-sm font-bold">?</span>
        <span>ヘルプ</span>
      </button>
      <button
        onClick={() => fitView({ duration: 300, padding: 0.1 })}
        className="absolute top-12 right-3 flex items-center gap-1 px-3 py-1 text-xs text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors z-10 no-print"
        title="全体表示"
      >
        <Maximize size={12} />
        <span>全体</span>
      </button>
      <button
        onClick={handlePrint}
        className="absolute top-[84px] right-3 flex items-center gap-1 px-3 py-1 text-xs text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors z-10 no-print"
        title="印刷"
      >
        <Printer size={12} />
        <span>印刷</span>
      </button>
      <label className="absolute top-[116px] right-3 flex items-center gap-1 px-3 py-1 text-xs text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors z-10 cursor-pointer no-print">
        <input
          type="checkbox"
          checked={isDateGrouping}
          onChange={(e) => handleToggleDateGrouping(e.target.checked)}
          className="accent-indigo-500"
        />
        <span>日付表示</span>
      </label>
      {hasPositionBackup && (
        <button
          onClick={handleRestorePositions}
          className="absolute top-[148px] right-3 flex items-center gap-1 px-3 py-1 text-xs text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors z-10 no-print"
          title="適用前の配置に戻す"
        >
          <Undo2 size={12} />
          <span>元に戻す</span>
        </button>
      )}
      <div className="absolute top-[180px] right-3 flex items-center gap-2 z-10 no-print">
        <input
          type="range"
          min={GAP_Y_MIN}
          max={GAP_Y_MAX}
          value={gapY}
          onChange={(e) => handleGapYChange(Number(e.target.value))}
          title="自動整理の縦間隔"
          className="w-16 accent-indigo-500"
        />
        <button
          onClick={handleAutoArrange}
          className="flex items-center gap-1 px-3 py-1 text-xs text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
          title="ノードが重ならず・エッジ交差が少ない配置へ自動整理"
        >
          <LayoutGrid size={12} />
          <span>自動整理</span>
        </button>
      </div>
      <button
        onClick={handleDateAlign}
        className="absolute top-[212px] right-3 flex items-center gap-1 px-3 py-1 text-xs text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors z-10 no-print"
        title="横位置は変えず、縦方向だけ日付の区間へ整列"
      >
        <CalendarRange size={12} />
        <span>日付整列</span>
      </button>
      <button
        onClick={handleCompact}
        className="absolute top-[244px] right-3 flex items-center gap-1 px-3 py-1 text-xs text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors z-10 no-print"
        title="並び順・横位置を変えず、縦の隙間だけを詰める"
      >
        <ArrowUpDown size={12} />
        <span>詰める</span>
      </button>
      {isHelpOpen && (
        <div
          className="absolute inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={() => setIsHelpOpen(false)}
        >
          <div
            className="bg-white rounded-xl shadow-2xl p-6 max-w-md w-full mx-4 max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-slate-800">フロー操作ガイド</h2>
              <button
                onClick={() => setIsHelpOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-xl leading-none"
              >
                ×
              </button>
            </div>
            <div className="space-y-3">
              <section>
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">マウス操作</h3>
                <table className="w-full text-xs text-slate-700">
                  <tbody className="divide-y divide-slate-100">
                    {[
                      ['ノードをドラッグ', '位置を移動して保存'],
                      ['サイドリストからドラッグ', 'キャンバスに配置'],
                      ['ノードをダブルクリック', '詳細モーダルを開く'],
                      ['ハンドル（●）をドラッグ', '依存関係（矢印）を追加'],
                      ['エッジを右クリック', '依存関係を削除'],
                      ['目安時間をクリック', 'インライン編集（1h / 30m / 90）'],
                    ].map(([op, desc]) => (
                      <tr key={op}>
                        <td className="py-1.5 pr-3 font-medium text-slate-600 whitespace-nowrap">{op}</td>
                        <td className="py-1.5 text-slate-500">{desc}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
              <section>
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">キーボード</h3>
                <table className="w-full text-xs text-slate-700">
                  <tbody className="divide-y divide-slate-100">
                    {[
                      ['Enter', '選択ノードの次に新規タスク追加'],
                      ['Tab', '選択ノードの右下に新規タスク追加（分岐）'],
                      ['F2', '選択ノードのタイトル編集'],
                      ['Delete', 'アイテムを削除'],
                      ['↑ ↓ ← →', '依存関係を辿ってノード移動'],
                      ['Home', '全ノードを画面にフィット'],
                    ].map(([key, desc]) => (
                      <tr key={key}>
                        <td className="py-1.5 pr-3 font-mono font-medium text-indigo-600 whitespace-nowrap">{key}</td>
                        <td className="py-1.5 text-slate-500">{desc}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            </div>
          </div>
        </div>
      )}
      {edgeContextMenu && (
        <EdgeContextMenu
          x={edgeContextMenu.x}
          y={edgeContextMenu.y}
          edgeId={edgeContextMenu.edgeId}
          onDelete={handleEdgeContextMenuDelete}
          onClose={closeEdgeContextMenu}
        />
      )}
      {nodeContextMenu && (
        <ContextMenu
          x={nodeContextMenu.x}
          y={nodeContextMenu.y}
          itemId={nodeContextMenu.itemId}
          onClose={closeNodeContextMenu}
          actions={buildItemContextMenuActions(nodeContextMenu.itemId, {
            onOpenDetail: (id) => {
              const item = allItems.find(i => i.id === id);
              if (item) handleOpenItemInternal(item);
              closeNodeContextMenu();
            },
            onMakeProject: async (id) => {
              await ApiClient.updateItem(id, { isProject: true });
              setAllItems(prev => prev.map(i => i.id === id ? { ...i, isProject: true } : i));
            },
            onResolveYes: async (id) => {
              await ApiClient.resolveDecision(id, 'yes');
              await fetchData();
            },
            onMarkDone: async (id) => {
              await ApiClient.updateItem(id, { status: 'done' });
              setAllItems(prev => prev.map(i => i.id === id ? { ...i, status: 'done' } : i));
            },
            onResolveNo: async (id) => {
              await ApiClient.resolveDecision(id, 'no', 'history');
              await fetchData();
            },
            onDelete: (id) => { handleDeleteItem(id); },
          })}
        />
      )}
      {selectedItem && (
        <DecisionDetailModal
          item={selectedItem}
          onClose={() => setSelectedItem(null)}
          onDecision={async (id, decision) => {
            await ApiClient.resolveDecision(id, decision === 'yes' ? 'yes' : 'no');
            setSelectedItem(null);
            await fetchData();
          }}
          onDelete={async (id) => {
            await handleDeleteItem(id);
            setSelectedItem(null);
          }}
          onUpdate={async (id, updates) => {
            await ApiClient.updateItem(id, updates);
            setAllItems(prev => prev.map(i => i.id === id ? { ...i, ...updates } : i));
            setSelectedItem(prev => prev?.id === id ? { ...prev, ...updates } : prev);
          }}
        />
      )}
    </div>
  );
};

// A-3: プロジェクト選択ヘッダー
const FlowHeader: React.FC<{
  projectTitle: string;
  allProjects: { id: string; title: string }[];
  onBack: () => void;
  onSwitchProject: (projectId: string) => void;
}> = ({ projectTitle, allProjects, onBack, onSwitchProject }) => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as HTMLElement)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="flex items-center gap-3 px-4 py-2 bg-white border-b border-slate-200 shrink-0 no-print">
      <button
        onClick={onBack}
        className="flex items-center gap-1 text-sm text-slate-500 hover:text-indigo-600 transition-colors"
      >
        <ArrowLeft size={16} />
        <span>一覧</span>
      </button>
      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => setIsDropdownOpen(!isDropdownOpen)}
          className="flex items-center gap-1 text-sm font-bold text-slate-700 hover:text-indigo-600 transition-colors"
        >
          <span>{projectTitle}</span>
          <ChevronDown size={14} />
        </button>
        {isDropdownOpen && allProjects.length > 0 && (
          <div className="absolute top-full left-0 mt-1 w-56 bg-white border border-slate-200 rounded-lg shadow-lg z-50 max-h-64 overflow-auto">
            {allProjects.map((p) => (
              <button
                key={p.id}
                onClick={() => {
                  onSwitchProject(p.id);
                  setIsDropdownOpen(false);
                }}
                className="block w-full text-left px-3 py-2 text-sm text-slate-600 hover:bg-indigo-50 hover:text-indigo-700 truncate"
              >
                {p.title}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export const FlowScreen: React.FC<FlowScreenProps> = ({ onOpenItem, initialProjectId }) => {
  const { filterMode } = useFilter();

  // A-2: プロジェクト選択ステート
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(() => {
    if (initialProjectId !== undefined && initialProjectId !== null) return initialProjectId;
    // A-4: URLからプロジェクトID取得
    const path = window.location.pathname;
    const match = path.match(/\/flows\/([^/]+)/);
    return match ? decodeURIComponent(match[1]) : null;
  });

  const [selectorItems, setSelectorItems] = useState<Item[]>([]);
  const [projectList, setProjectList] = useState<{ id: string; title: string }[]>([]);

  useEffect(() => {
    ApiClient.getAllItems({ scope: 'aggregated' }).then((items) => {
      setSelectorItems(items);
      const map = new Map<string, string>();
      for (const item of items) {
        if (item.projectId && !map.has(item.projectId)) {
          map.set(item.projectId, item.projectTitle || item.projectId);
        }
      }
      setProjectList(Array.from(map.entries()).map(([id, title]) => ({ id, title })));
    }).catch((err) => {
      console.error('[FlowScreen] プロジェクト一覧取得失敗:', err);
    });
  }, []);

  // A-4: URL更新
  const updateUrl = useCallback((projectId: string | null) => {
    const basePath = import.meta.env.BASE_URL || '/contents/Youkan/';
    const normalizedBase = basePath.endsWith('/') ? basePath : basePath + '/';
    if (projectId) {
      window.history.pushState({ view: 'flows', projectId }, '', `${normalizedBase}flows/${encodeURIComponent(projectId)}`);
    } else {
      window.history.pushState({ view: 'flows' }, '', `${normalizedBase}flows`);
    }
  }, []);

  // A-4: ブラウザ戻る対応
  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      const state = event.state;
      if (state?.view === 'flows') {
        setSelectedProjectId(state.projectId || null);
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const handleSelectProject = useCallback((projectId: string) => {
    setSelectedProjectId(projectId);
    updateUrl(projectId);
  }, [updateUrl]);

  const handleSelectAll = useCallback(() => {
    setSelectedProjectId('__all__');
    updateUrl('__all__');
  }, [updateUrl]);

  const handleBack = useCallback(() => {
    setSelectedProjectId(null);
    updateUrl(null);
  }, [updateUrl]);

  const handleSwitchProject = useCallback((projectId: string) => {
    setSelectedProjectId(projectId);
    updateUrl(projectId);
  }, [updateUrl]);

  const filteredSelectorItems = useMemo(() => {
    if (filterMode === 'all') return selectorItems;
    if (filterMode === 'personal') return selectorItems.filter(i => !i.tenantId);
    if (filterMode === 'company') return selectorItems.filter(i => !!i.tenantId);
    return selectorItems.filter(i => i.tenantId === filterMode);
  }, [selectorItems, filterMode]);

  // プロジェクト選択画面（A-1/A-2）
  if (selectedProjectId === null) {
    return (
      <FlowProjectSelector
        items={filteredSelectorItems}
        onSelectProject={handleSelectProject}
        onSelectAll={handleSelectAll}
      />
    );
  }

  const currentProjectTitle = selectedProjectId === '__all__'
    ? '全プロジェクト'
    : projectList.find((p) => p.id === selectedProjectId)?.title || selectedProjectId;

  return (
    <div className="h-full w-full flex flex-col">
      <FlowHeader
        projectTitle={currentProjectTitle}
        allProjects={projectList}
        onBack={handleBack}
        onSwitchProject={handleSwitchProject}
      />
      <div className="flex-1 overflow-hidden">
        <ReactFlowProvider>
          <FlowCanvas
            onOpenItem={onOpenItem}
            currentProjectId={selectedProjectId === '__all__' ? undefined : selectedProjectId}
          />
        </ReactFlowProvider>
      </div>
    </div>
  );
};
