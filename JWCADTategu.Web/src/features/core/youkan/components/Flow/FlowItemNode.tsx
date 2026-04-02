import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { Item } from '../../types';

export interface FlowItemNodeData {
  item: Item;
}

const statusColors: Record<string, { bg: string; border: string; text: string }> = {
  inbox: { bg: 'bg-slate-100', border: 'border-slate-300', text: 'text-slate-700' },
  focus: { bg: 'bg-indigo-100', border: 'border-indigo-400', text: 'text-indigo-800' },
  pending: { bg: 'bg-amber-100', border: 'border-amber-400', text: 'text-amber-800' },
  waiting: { bg: 'bg-orange-100', border: 'border-orange-400', text: 'text-orange-800' },
  done: { bg: 'bg-emerald-100', border: 'border-emerald-400', text: 'text-emerald-800' },
};

const FlowItemNodeComponent = ({ data }: NodeProps) => {
  const nodeData = data as unknown as FlowItemNodeData;
  const item = nodeData.item;
  const colors = statusColors[item.status] || statusColors.inbox;

  return (
    <div
      className={`px-4 py-2 rounded-lg border-2 shadow-sm min-w-[140px] max-w-[220px] ${colors.bg} ${colors.border}`}
    >
      <Handle type="target" position={Position.Top} className="!bg-slate-400 !w-3 !h-3" />
      <div className="flex flex-col gap-1">
        <span className={`text-xs font-bold ${colors.text} truncate`}>{item.title}</span>
        <span className="text-[9px] text-slate-400 uppercase tracking-wider">{item.status}</span>
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-slate-400 !w-3 !h-3" />
    </div>
  );
};

export const FlowItemNode = memo(FlowItemNodeComponent);
