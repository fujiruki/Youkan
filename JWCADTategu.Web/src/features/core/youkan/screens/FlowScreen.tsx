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

import { FlowItemNode } from '../components/Flow/FlowItemNode';
import { ProjectGroupNode } from '../components/Flow/ProjectGroupNode';
import { UnplacedItemList, type UnplacedItemListHandle } from '../components/Flow/UnplacedItemList';
import { buildGroupNodes } from '../components/Flow/flowGrouping';
import { shouldIgnoreKeyEvent, getLinkedNodeId } from '../components/Flow/useFlowKeyboard';
import { DependencyRepository } from '../repositories/DependencyRepository';
import { ApiClient } from '../../../../api/client';
import type { Item, Dependency } from '../types';
import { useToast } from '../../../../contexts/ToastContext';

const nodeTypes = {
  flowItem: FlowItemNode,
  projectGroup: ProjectGroupNode,
};
const dependencyRepo = new DependencyRepository();

// ノードの重なり判定用閾値（ピクセル）
const OVERLAP_THRESHOLD = 80;

interface FlowScreenProps {
  activeProjectId?: string;
  onOpenItem?: (item: Item) => void;
}

const FlowCanvas: React.FC<FlowScreenProps> = ({ activeProjectId, onOpenItem }) => {
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
  // ドラッグ開始位置の記録（重ねてリンク用）
  const dragStartPositions = useRef<Map<string, { x: number; y: number }>>(new Map());

  const fetchData = useCallback(async () => {
    try {
      const [itemsRes, deps] = await Promise.all([
        ApiClient.getAllItems({ scope: 'aggregated', ...(activeProjectId ? { project_id: activeProjectId } : {}) }),
        dependencyRepo.getDependencies(),
      ]);
      setAllItems(itemsRes);
      setDependencies(deps);
    } catch (err) {
      console.error('[FlowScreen] データ取得失敗:', err);
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

  // タイトル変更ハンドラ
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

  // ノードとエッジの構築（グループ化含む）
  useEffect(() => {
    const { groupNodes, childMappings } = buildGroupNodes(placedItems);
    const childMap = new Map(childMappings.map((c) => [c.itemId, c]));

    const itemNodes: Node[] = placedItems.map((item) => {
      const mapping = childMap.get(item.id);
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

    const newEdges: Edge[] = dependencies.map((dep) => ({
      id: dep.id,
      source: dep.sourceItemId,
      target: dep.targetItemId,
      animated: true,
      style: { stroke: '#6366f1', strokeWidth: 2 },
    }));

    // グループノードが先、子ノードが後（描画順のため）
    setNodes([...groupNodes, ...itemNodes]);
    setEdges(newEdges);
  }, [placedItems, dependencies, editingNodeId, newNodeId, handleTitleChange, handleEditComplete, setNodes, setEdges]);

  const updateItemMeta = useCallback(async (itemId: string, metaUpdate: Record<string, unknown>) => {
    const item = allItems.find((i) => i.id === itemId);
    const currentMeta = item?.meta || {};
    const newMeta = { ...currentMeta, ...metaUpdate };
    await ApiClient.updateItem(itemId, { meta: newMeta } as Partial<Item>);
  }, [allItems]);

  // 選択状態の追跡
  const onSelectionChange: OnSelectionChangeFunc = useCallback(({ nodes, edges }) => {
    setSelectedNodeIds(nodes.map((n) => n.id));
    setSelectedEdgeIds(edges.map((e) => e.id));
  }, []);

  // ドラッグ開始時の位置記録
  const onNodeDragStart: OnNodeDrag = useCallback((_event, node) => {
    dragStartPositions.current.set(node.id, { ...node.position });
  }, []);

  // ドラッグ完了時: 位置保存＋重ねてリンク判定
  const onNodeDragStop: OnNodeDrag = useCallback(
    async (_event, draggedNode) => {
      // グループノードは無視
      if (draggedNode.id.startsWith('group-')) return;

      // 重ねてリンク判定
      const allNodes = nodes.filter((n) => n.type === 'flowItem' && n.id !== draggedNode.id);
      let overlappingNode: Node | undefined;
      for (const otherNode of allNodes) {
        // 親ノードが同じ場合は相対座標で判定、そうでない場合はフロー座標で判定
        const dx = draggedNode.position.x - otherNode.position.x;
        const dy = draggedNode.position.y - otherNode.position.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance < OVERLAP_THRESHOLD) {
          overlappingNode = otherNode;
          break;
        }
      }

      if (overlappingNode) {
        // リンク作成: overlappingNode → draggedNode（「AのあとB」）
        try {
          const dep = await dependencyRepo.createDependency(overlappingNode.id, draggedNode.id);
          setDependencies((prev) => [...prev, dep]);
          showToast({ type: 'success', title: 'リンク作成', message: `依存関係を追加しました`, duration: 2000 });
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          if (msg.includes('400') || msg.toLowerCase().includes('circular')) {
            showToast({ type: 'error', title: '循環参照エラー', message: '依存関係が循環するため接続できません', duration: 5000 });
          }
        }

        // ドラッグしたノードを元の位置に戻す
        const startPos = dragStartPositions.current.get(draggedNode.id);
        if (startPos) {
          setNodes((nds) =>
            nds.map((n) =>
              n.id === draggedNode.id ? { ...n, position: startPos } : n
            )
          );
        }
      } else {
        // 通常の位置保存
        await updateItemMeta(draggedNode.id, { flow_x: draggedNode.position.x, flow_y: draggedNode.position.y });
      }

      dragStartPositions.current.delete(draggedNode.id);
    },
    [nodes, updateItemMeta, showToast, setNodes]
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
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes('400') || msg.toLowerCase().includes('circular')) {
          showToast({ type: 'error', title: '循環参照エラー', message: '依存関係が循環するため接続できません', duration: 5000 });
        } else {
          showToast({ type: 'error', title: '接続エラー', message: msg, duration: 5000 });
        }
      }
    },
    [setEdges, showToast]
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
      await updateItemMeta(itemId, { flow_x: position.x, flow_y: position.y });

      setAllItems((prev) =>
        prev.map((item) =>
          item.id === itemId
            ? { ...item, meta: { ...(item.meta || {}), flow_x: position.x, flow_y: position.y } }
            : item
        )
      );
    },
    [screenToFlowPosition, updateItemMeta]
  );

  // --- キーボードショートカット ---
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
        } as Partial<Item>);

        const newItemId = result.id;

        // 位置設定
        await ApiClient.updateItem(newItemId, { meta: { flow_x: newX, flow_y: newY } } as Partial<Item>);

        // 依存関係作成
        const dep = await dependencyRepo.createDependency(parentNodeId, newItemId);

        // ローカルステート更新
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
          meta: { flow_x: newX, flow_y: newY },
        };

        setAllItems((prev) => [...prev, newItem]);
        setDependencies((prev) => [...prev, dep]);

        // 新規ノードのテキスト入力を開始
        setNewNodeId(newItemId);
      } catch (err) {
        console.error('[FlowScreen] ノード追加失敗:', err);
        showToast({ type: 'error', title: 'ノード追加失敗', message: String(err), duration: 5000 });
      }
    },
    [allItems, showToast]
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
          // エッジが選択されている場合
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
          // ノードが選択されている場合: flow座標クリアで未配置に戻す
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
          // ReactFlowの選択解除
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
            // 2つのノードが選択されていればリンク作成
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
        onNodeDragStop={onNodeDragStop}
        onNodesDelete={onNodesDelete}
        onEdgesDelete={onEdgesDelete}
        onSelectionChange={onSelectionChange}
        onDragOver={onDragOver}
        onDrop={onDrop}
        nodeTypes={nodeTypes}
        fitView
        deleteKeyCode={null}
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
              case 'done': return '#10b981';
              default: return '#94a3b8';
            }
          }}
          className="!bg-white/80 !border-slate-200"
        />
      </ReactFlow>
      <UnplacedItemList ref={unplacedListRef} items={unplacedItems} />
    </div>
  );
};

export const FlowScreen: React.FC<FlowScreenProps> = ({ activeProjectId, onOpenItem }) => {
  return (
    <ReactFlowProvider>
      <FlowCanvas activeProjectId={activeProjectId} onOpenItem={onOpenItem} />
    </ReactFlowProvider>
  );
};
