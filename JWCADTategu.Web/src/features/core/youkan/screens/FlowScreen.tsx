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
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { ArrowLeft, ChevronDown, Plus } from 'lucide-react';

import { FlowItemNode } from '../components/Flow/FlowItemNode';
import { ProjectGroupNode } from '../components/Flow/ProjectGroupNode';
import { EdgeContextMenu } from '../components/Flow/EdgeContextMenu';
import { UnplacedItemList, type UnplacedItemListHandle } from '../components/Flow/UnplacedItemList';
import { ContextMenu } from '../components/PanoramaBoard/ContextMenu';
import { buildItemContextMenuActions } from '../hooks/buildItemContextMenuActions';
import { FlowProjectSelector } from '../components/Flow/FlowProjectSelector';
import { buildGroupNodes } from '../components/Flow/flowGrouping';
import { shouldIgnoreKeyEvent, getLinkedNodeId } from '../components/Flow/useFlowKeyboard';
import { DependencyRepository } from '../repositories/DependencyRepository';
import { calculateAutoPlacement, findNearestEdge, calculateEdgeMidpoint } from '../logic/flowAutoPlace';
import { ApiClient } from '../../../../api/client';
import type { Item, Dependency } from '../types';
import { useToast } from '../../../../contexts/ToastContext';
import { useFilter } from '../contexts/FilterContext';
import { DecisionDetailModal } from '../components/Modal/DecisionDetailModal';

const nodeTypes = {
  flowItem: FlowItemNode,
  projectGroup: ProjectGroupNode,
};
const dependencyRepo = new DependencyRepository();

const OVERLAP_THRESHOLD = 40;
const EDGE_INSERT_THRESHOLD = 50;

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

    const itemNodes: Node[] = placedItems.map((item) => {
      const isHighlighted = highlightNodeId === item.id;
      return {
        id: item.id,
        type: 'flowItem',
        position: { x: item.meta!.flow_x as number, y: item.meta!.flow_y as number },
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
        },
      } satisfies Node;
    });

    const newEdges: Edge[] = dependencies.map((dep) => {
      const isEdgeHighlighted = highlightEdgeId === dep.id;
      return {
        id: dep.id,
        source: dep.sourceItemId,
        target: dep.targetItemId,
        animated: true,
        interactionWidth: 20,
        style: isEdgeHighlighted
          ? { stroke: '#3b82f6', strokeWidth: 4 }
          : { stroke: '#6366f1', strokeWidth: 2 },
      };
    });

    setNodes([...groupNodes, ...itemNodes]);
    setEdges(newEdges);

    if (prevProjectRef.current !== currentProjectId) {
      prevProjectRef.current = currentProjectId ?? null;
      shouldFitViewRef.current = true;
    }
  }, [placedItems, dependencies, editingNodeId, newNodeId, highlightNodeId, highlightEdgeId, handleTitleChange, handleEditComplete, handleEstimatedMinutesChange, handleStartEditing, handleItemContextMenu, setNodes, setEdges, currentProjectId, fitView]);

  const updateItemMeta = useCallback(async (itemId: string, metaUpdate: Record<string, unknown>) => {
    const item = allItems.find((i) => i.id === itemId);
    const currentMeta = item?.meta || {};
    const newMeta = { ...currentMeta, ...metaUpdate };
    await ApiClient.updateItem(itemId, { meta: newMeta } as Partial<Item>);
  }, [allItems]);

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
    [edges, getNodePositions, updateItemMeta, showToast, setDependencies, setAllItems]
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
        for (const node of validNodes) {
          await updateItemMeta(node.id, { flow_x: node.position.x, flow_y: node.position.y });
        }
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
          setDependencies((prev) => [...prev, dep]);
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
          await updateItemMeta(draggedNode.id, { flow_x: draggedNode.position.x, flow_y: draggedNode.position.y });
          setAllItems(prev =>
            prev.map(item =>
              item.id === draggedNode.id
                ? { ...item, meta: { ...(item.meta || {}), flow_x: draggedNode.position.x, flow_y: draggedNode.position.y } }
                : item
            )
          );
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
    [nodes, updateItemMeta, showToast, setNodes, handleEdgeInsert, placedItems, setAllItems]
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
              animated: true,
              style: { stroke: '#6366f1', strokeWidth: 2 },
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
          setDependencies((prev) => [...prev, dep]);
        }
      } catch (err) {
        console.error('[FlowScreen] ノード追加失敗:', err);
        showToast({ type: 'error', title: 'ノード追加失敗', message: String(err), duration: 5000 });
      }
    },
    [allItems, showToast, createNewItem]
  );

  const handleOpenItemInternal = useCallback((item: Item) => {
    if (onOpenItem) {
      onOpenItem(item);
    } else {
      setSelectedItem(item);
    }
  }, [onOpenItem]);

  // A-6: 空白エリアダブルクリックで新規タスク作成
  const handlePaneDoubleClick = useCallback(
    async (event: React.MouseEvent) => {
      const position = screenToFlowPosition({ x: event.clientX, y: event.clientY });
      try {
        await createNewItem(position.x, position.y);
      } catch (err) {
        console.error('[FlowScreen] ダブルクリック新規タスク作成失敗:', err);
        showToast({ type: 'error', title: '作成失敗', message: String(err), duration: 5000 });
      }
    },
    [screenToFlowPosition, createNewItem, showToast]
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
    <div className="h-full w-full relative" ref={reactFlowWrapper} tabIndex={0}>
      <ReactFlow
        nodes={nodes}
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
        deleteKeyCode={null}
        zoomOnDoubleClick={false}
        selectionKeyCode="Shift"
        multiSelectionKeyCode="Shift"
        edgesFocusable
        className="bg-slate-50"
      >
        <Controls className="!bg-white !border-slate-200 !shadow-lg" />
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
          className="!bg-white/80 !border-slate-200"
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
        className="absolute bottom-4 right-4 w-10 h-10 bg-indigo-500 hover:bg-indigo-600 text-white rounded-full shadow-lg flex items-center justify-center transition-colors z-10"
        title="新規タスク追加"
      >
        <Plus size={20} />
      </button>
      <button
        onClick={() => setIsHelpOpen(true)}
        className="absolute top-3 right-3 flex items-center gap-1 px-3 py-1 text-xs text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors z-10"
        title="操作ガイド"
      >
        <span className="text-sm font-bold">?</span>
        <span>ヘルプ</span>
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
    <div className="flex items-center gap-3 px-4 py-2 bg-white border-b border-slate-200 shrink-0">
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
