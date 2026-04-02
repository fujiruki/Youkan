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
  BackgroundVariant,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { FlowItemNode } from '../components/Flow/FlowItemNode';
import { UnplacedItemList } from '../components/Flow/UnplacedItemList';
import { DependencyRepository } from '../repositories/DependencyRepository';
import { ApiClient } from '../../../../api/client';
import type { Item, Dependency } from '../types';
import { useToast } from '../../../../contexts/ToastContext';

const nodeTypes = { flowItem: FlowItemNode };
const dependencyRepo = new DependencyRepository();

interface FlowScreenProps {
  activeProjectId?: string;
}

const FlowCanvas: React.FC<FlowScreenProps> = ({ activeProjectId }) => {
  const [allItems, setAllItems] = useState<Item[]>([]);
  const [dependencies, setDependencies] = useState<Dependency[]>([]);
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const { screenToFlowPosition } = useReactFlow();
  const { showToast } = useToast();
  const reactFlowWrapper = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    const newNodes: Node[] = placedItems.map((item) => ({
      id: item.id,
      type: 'flowItem',
      position: { x: item.meta!.flow_x, y: item.meta!.flow_y },
      data: { item },
    }));

    const newEdges: Edge[] = dependencies.map((dep) => ({
      id: dep.id,
      source: dep.sourceItemId,
      target: dep.targetItemId,
      animated: true,
      style: { stroke: '#6366f1', strokeWidth: 2 },
    }));

    setNodes(newNodes);
    setEdges(newEdges);
  }, [placedItems, dependencies, setNodes, setEdges]);

  const updateItemMeta = useCallback(async (itemId: string, metaUpdate: Record<string, unknown>) => {
    const item = allItems.find((i) => i.id === itemId);
    const currentMeta = item?.meta || {};
    const newMeta = { ...currentMeta, ...metaUpdate };
    await ApiClient.updateItem(itemId, { meta: newMeta } as Partial<Item>);
  }, [allItems]);

  const onNodeDragStop: OnNodeDrag = useCallback(
    async (_event, node) => {
      await updateItemMeta(node.id, { flow_x: node.position.x, flow_y: node.position.y });
    },
    [updateItemMeta]
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

  return (
    <div className="h-full w-full relative" ref={reactFlowWrapper}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeDragStop={onNodeDragStop}
        onNodesDelete={onNodesDelete}
        onEdgesDelete={onEdgesDelete}
        onDragOver={onDragOver}
        onDrop={onDrop}
        nodeTypes={nodeTypes}
        fitView
        deleteKeyCode="Delete"
        className="bg-slate-50"
      >
        <Controls className="!bg-white !border-slate-200 !shadow-lg" />
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#cbd5e1" />
        <MiniMap
          nodeColor={(node) => {
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
      <UnplacedItemList items={unplacedItems} />
    </div>
  );
};

export const FlowScreen: React.FC<FlowScreenProps> = ({ activeProjectId }) => {
  return (
    <ReactFlowProvider>
      <FlowCanvas activeProjectId={activeProjectId} />
    </ReactFlowProvider>
  );
};
