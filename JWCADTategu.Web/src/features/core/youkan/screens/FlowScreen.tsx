import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
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
  BackgroundVariant,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { ArrowLeft, ChevronDown, Plus } from 'lucide-react';

import { FlowItemNode } from '../components/Flow/FlowItemNode';
import { ProjectGroupNode } from '../components/Flow/ProjectGroupNode';
import { EdgeContextMenu } from '../components/Flow/EdgeContextMenu';
import { UnplacedItemList, type UnplacedItemListHandle } from '../components/Flow/UnplacedItemList';
import { FlowProjectSelector } from '../components/Flow/FlowProjectSelector';
import { buildGroupNodes } from '../components/Flow/flowGrouping';
import { shouldIgnoreKeyEvent, getLinkedNodeId } from '../components/Flow/useFlowKeyboard';
import { DependencyRepository } from '../repositories/DependencyRepository';
import { calculateAutoPlacement, findNearestEdge, calculateEdgeMidpoint } from '../logic/flowAutoPlace';
import { ApiClient } from '../../../../api/client';
import type { Item, Dependency } from '../types';
import { useToast } from '../../../../contexts/ToastContext';

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
  activeProjectId?: string;
  onOpenItem?: (item: Item) => void;
  currentProjectId?: string;
}

const FlowCanvas: React.FC<FlowCanvasProps> = ({ activeProjectId, onOpenItem, currentProjectId }) => {
  const [allItems, setAllItems] = useState<Item[]>([]);
  const [dependencies, setDependencies] = useState<Dependency[]>([]);
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
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
  const [edgeContextMenu, setEdgeContextMenu] = useState<{ x: number; y: number; edgeId: string } | null>(null);
  const dragStartPositions = useRef<Map<string, { x: number; y: number }>>(new Map());
  const [highlightNodeId, setHighlightNodeId] = useState<string | null>(null);
  const [highlightEdgeId, setHighlightEdgeId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    const [itemsResult, depsResult] = await Promise.allSettled([
      ApiClient.getAllItems({ scope: 'aggregated', ...(activeProjectId ? { project_id: activeProjectId } : {}) }),
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
  }, [activeProjectId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const { placedItems, unplacedItems } = useMemo(() => {
    const placed: Item[] = [];
    const unplaced: Item[] = [];
    for (const item of allItems) {
      if (item.meta?.flow_x != null && item.meta?.flow_y != null) {
        placed.push(item);
      } else {
        unplaced.push(item);
      }
    }
    return { placedItems: placed, unplacedItems: unplaced };
  }, [allItems]);

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

  useEffect(() => {
    const { groupNodes, childMappings } = buildGroupNodes(placedItems);
    const childMap = new Map(childMappings.map((c) => [c.itemId, c]));

    const itemNodes: Node[] = placedItems.map((item) => {
      const mapping = childMap.get(item.id);
      const isHighlighted = highlightNodeId === item.id;
      const baseNode: Node = {
        id: item.id,
        type: 'flowItem',
        position: mapping
          ? mapping.relativePosition
          : { x: item.meta!.flow_x, y: item.meta!.flow_y },
        data: {
          item,
          isEditing: editingNodeId === item.id,
          isNewNode: newNodeId === item.id,
          isHighlighted,
          onTitleChange: handleTitleChange,
          onEditComplete: handleEditComplete,
        },
      };
      if (mapping) {
        baseNode.parentId = mapping.parentId;
        baseNode.extent = 'parent' as const;
        baseNode.expandParent = true;
      }
      return baseNode;
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
  }, [placedItems, dependencies, editingNodeId, newNodeId, highlightNodeId, highlightEdgeId, handleTitleChange, handleEditComplete, setNodes, setEdges]);

  const updateItemMeta = useCallback(async (itemId: string, metaUpdate: Record<string, unknown>) => {
    const item = allItems.find((i) => i.id === itemId);
    const currentMeta = item?.meta || {};
    const newMeta = { ...currentMeta, ...metaUpdate };
    await ApiClient.updateItem(itemId, { meta: newMeta } as Partial<Item>);
  }, [allItems]);

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
      const nearest = findNearestEdge(position, edges, nodePositions, EDGE_INSERT_THRESHOLD);
      if (!nearest) return false;

      try {
        await dependencyRepo.deleteDependency(nearest.edge.id);
        setDependencies((prev) => prev.filter((d) => d.id !== nearest.edge.id));

        const dep1 = await dependencyRepo.createDependency(nearest.edge.source, itemId);
        const dep2 = await dependencyRepo.createDependency(itemId, nearest.edge.target);
        setDependencies((prev) => [...prev, dep1, dep2]);

        const sourcePos = nodePositions.get(nearest.edge.source);
        const targetPos = nodePositions.get(nearest.edge.target);
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

        const oldEdgeSource = nearest.edge.source;
        const oldEdgeTarget = nearest.edge.target;
        showToast({
          type: 'success',
          title: 'エッジ挿入',
          message: 'フローに挿入しました',
          duration: 3000,
          action: {
            label: '取り消し',
            onClick: async () => {
              try {
                await dependencyRepo.deleteDependency(dep1.id);
                await dependencyRepo.deleteDependency(dep2.id);
                const restored = await dependencyRepo.createDependency(oldEdgeSource, oldEdgeTarget);
                setDependencies((prev) => [
                  ...prev.filter((d) => d.id !== dep1.id && d.id !== dep2.id),
                  restored,
                ]);
              } catch (e) {
                console.error('[FlowScreen] エッジ挿入取り消し失敗:', e);
              }
            },
          },
        });
        return true;
      } catch (err) {
        console.error('[FlowScreen] エッジ挿入失敗:', err);
        showToast({ type: 'error', title: 'エッジ挿入失敗', message: String(err), duration: 5000 });
        return false;
      }
    },
    [edges, getNodePositions, updateItemMeta, showToast]
  );

  const onNodeDragStart: OnNodeDrag = useCallback((_event, node) => {
    dragStartPositions.current.set(node.id, { ...node.position });
  }, []);

  const onNodeDrag: OnNodeDrag = useCallback(
    (_event, draggedNode) => {
      if (draggedNode.id.startsWith('group-')) return;

      const allFlowNodes = nodes.filter((n) => n.type === 'flowItem' && n.id !== draggedNode.id);
      let foundNodeId: string | null = null;
      for (const otherNode of allFlowNodes) {
        const dx = draggedNode.position.x - otherNode.position.x;
        const dy = draggedNode.position.y - otherNode.position.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance < OVERLAP_THRESHOLD) {
          foundNodeId = otherNode.id;
          break;
        }
      }

      let foundEdgeId: string | null = null;
      if (!foundNodeId) {
        const nodePositions = getNodePositions();
        const nearest = findNearestEdge(draggedNode.position, edges, nodePositions, EDGE_INSERT_THRESHOLD);
        if (nearest) {
          foundEdgeId = nearest.edge.id;
        }
      }

      setHighlightNodeId(foundNodeId);
      setHighlightEdgeId(foundEdgeId);
    },
    [nodes, edges, getNodePositions]
  );

  const onNodeDragStop: OnNodeDrag = useCallback(
    async (_event, draggedNode) => {
      if (draggedNode.id.startsWith('group-')) return;

      const allFlowNodes = nodes.filter((n) => n.type === 'flowItem' && n.id !== draggedNode.id);
      let overlappingNode: Node | undefined;
      for (const otherNode of allFlowNodes) {
        const dx = draggedNode.position.x - otherNode.position.x;
        const dy = draggedNode.position.y - otherNode.position.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance < OVERLAP_THRESHOLD) {
          overlappingNode = otherNode;
          break;
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
          }
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
        }
      }

      dragStartPositions.current.delete(draggedNode.id);
      setHighlightNodeId(null);
      setHighlightEdgeId(null);
    },
    [nodes, updateItemMeta, showToast, setNodes, handleEdgeInsert]
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

  const createNodeBelow = useCallback(
    async (parentNodeId: string, offsetX = 0) => {
      const parentItem = allItems.find((i) => i.id === parentNodeId);
      if (!parentItem) return;

      const parentX = (parentItem.meta?.flow_x as number) || 0;
      const parentY = (parentItem.meta?.flow_y as number) || 0;
      const newX = parentX + offsetX;
      const newY = parentY + 120;

      try {
        const result = await ApiClient.createItem({
          title: '新規アイテム',
          status: 'inbox',
          ...(currentProjectId ? { projectId: currentProjectId } : {}),
        } as Partial<Item>);

        const newItemId = result.id;
        await ApiClient.updateItem(newItemId, { meta: { flow_x: newX, flow_y: newY } } as Partial<Item>);
        const dep = await dependencyRepo.createDependency(parentNodeId, newItemId);

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
          meta: { flow_x: newX, flow_y: newY },
        };

        setAllItems((prev) => [...prev, newItem]);
        setDependencies((prev) => [...prev, dep]);
        setNewNodeId(newItemId);
      } catch (err) {
        console.error('[FlowScreen] ノード追加失敗:', err);
        showToast({ type: 'error', title: 'ノード追加失敗', message: String(err), duration: 5000 });
      }
    },
    [allItems, showToast, currentProjectId]
  );

  // A-6: 空白エリアダブルクリックで新規タスク作成
  const handlePaneDoubleClick = useCallback(
    async (event: React.MouseEvent) => {
      const position = screenToFlowPosition({ x: event.clientX, y: event.clientY });
      try {
        const result = await ApiClient.createItem({
          title: '新規アイテム',
          status: 'inbox',
          ...(currentProjectId ? { projectId: currentProjectId } : {}),
        } as Partial<Item>);
        const newItemId = result.id;
        await ApiClient.updateItem(newItemId, { meta: { flow_x: position.x, flow_y: position.y } } as Partial<Item>);

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
          meta: { flow_x: position.x, flow_y: position.y },
        };
        setAllItems((prev) => [...prev, newItem]);
        setNewNodeId(newItemId);
      } catch (err) {
        console.error('[FlowScreen] ダブルクリック新規タスク作成失敗:', err);
        showToast({ type: 'error', title: '作成失敗', message: String(err), duration: 5000 });
      }
    },
    [screenToFlowPosition, currentProjectId, showToast]
  );

  // A-6: +ボタンで新規タスク作成
  const handleAddButtonClick = useCallback(async () => {
    try {
      const result = await ApiClient.createItem({
        title: '新規アイテム',
        status: 'inbox',
        ...(currentProjectId ? { projectId: currentProjectId } : {}),
      } as Partial<Item>);
      const newItemId = result.id;
      await ApiClient.updateItem(newItemId, { meta: { flow_x: 100, flow_y: 100 } } as Partial<Item>);

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
        meta: { flow_x: 100, flow_y: 100 },
      };
      setAllItems((prev) => [...prev, newItem]);
      setNewNodeId(newItemId);
    } catch (err) {
      console.error('[FlowScreen] +ボタン新規タスク作成失敗:', err);
      showToast({ type: 'error', title: '作成失敗', message: String(err), duration: 5000 });
    }
  }, [currentProjectId, showToast]);

  // A-7: ノードダブルクリック → 詳細モーダル
  const handleNodeDoubleClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      if (node.id.startsWith('group-')) return;
      if (onOpenItem) {
        const item = allItems.find((i) => i.id === node.id);
        if (item) onOpenItem(item);
      }
    },
    [allItems, onOpenItem]
  );

  const handleKeyDown = useCallback(
    async (event: KeyboardEvent) => {
      if (shouldIgnoreKeyEvent(event)) return;

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
            await updateItemMeta(selectedNode, { flow_x: null, flow_y: null });
            setAllItems((prev) =>
              prev.map((item) =>
                item.id === selectedNode
                  ? { ...item, meta: { ...(item.meta || {}), flow_x: null, flow_y: null } }
                  : item
              )
            );
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
          if (selectedNode && onOpenItem) {
            const item = allItems.find((i) => i.id === selectedNode);
            if (item) onOpenItem(item);
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
    [selectedNodeIds, selectedEdgeIds, allItems, edges, createNodeBelow, updateItemMeta, fitView, onOpenItem, showToast, setNodes, setEdges]
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
        edgesFocusable
        multiSelectionKeyCode="Control"
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
      <UnplacedItemList ref={unplacedListRef} items={unplacedItems} onAutoPlace={handleAutoPlace} isAutoPlacing={isAutoPlacing} />
      <button
        onClick={handleAddButtonClick}
        className="absolute bottom-4 right-4 w-10 h-10 bg-indigo-500 hover:bg-indigo-600 text-white rounded-full shadow-lg flex items-center justify-center transition-colors z-10"
        title="新規タスク追加"
      >
        <Plus size={20} />
      </button>
      {edgeContextMenu && (
        <EdgeContextMenu
          x={edgeContextMenu.x}
          y={edgeContextMenu.y}
          edgeId={edgeContextMenu.edgeId}
          onDelete={handleEdgeContextMenuDelete}
          onClose={closeEdgeContextMenu}
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

export const FlowScreen: React.FC<FlowScreenProps> = ({ activeProjectId, onOpenItem, initialProjectId }) => {
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

  // プロジェクト選択画面（A-1/A-2）
  if (selectedProjectId === null) {
    return (
      <FlowProjectSelector
        items={selectorItems}
        onSelectProject={handleSelectProject}
        onSelectAll={handleSelectAll}
      />
    );
  }

  const effectiveProjectId = selectedProjectId === '__all__'
    ? activeProjectId
    : selectedProjectId;

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
            activeProjectId={effectiveProjectId}
            onOpenItem={onOpenItem}
            currentProjectId={selectedProjectId === '__all__' ? undefined : selectedProjectId}
          />
        </ReactFlowProvider>
      </div>
    </div>
  );
};
