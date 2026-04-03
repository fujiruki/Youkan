import { memo, useState, useRef, useEffect, useCallback } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { Item } from '../../types';

export interface FlowItemNodeData {
  item: Item;
  isEditing?: boolean;
  isNewNode?: boolean;
  isHighlighted?: boolean;
  onTitleChange?: (itemId: string, newTitle: string) => void;
  onEditComplete?: (itemId: string) => void;
}

const statusColors: Record<string, { bg: string; border: string; text: string }> = {
  inbox: { bg: 'bg-slate-100', border: 'border-slate-300', text: 'text-slate-700' },
  focus: { bg: 'bg-indigo-100', border: 'border-indigo-400', text: 'text-indigo-800' },
  pending: { bg: 'bg-amber-100', border: 'border-amber-400', text: 'text-amber-800' },
  waiting: { bg: 'bg-orange-100', border: 'border-orange-400', text: 'text-orange-800' },
  done: { bg: 'bg-emerald-100', border: 'border-emerald-400', text: 'text-emerald-800' },
};

const FlowItemNodeComponent = ({ data, selected }: NodeProps) => {
  const nodeData = data as unknown as FlowItemNodeData;
  const item = nodeData.item;
  const colors = statusColors[item.status] || statusColors.inbox;
  const [editValue, setEditValue] = useState(item.title);
  const inputRef = useRef<HTMLInputElement>(null);

  const isEditing = nodeData.isEditing || nodeData.isNewNode;

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleSubmit = useCallback(() => {
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== item.title) {
      nodeData.onTitleChange?.(item.id, trimmed);
    }
    nodeData.onEditComplete?.(item.id);
  }, [editValue, item.id, item.title, nodeData]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      e.stopPropagation();
      if (e.key === 'Enter') {
        handleSubmit();
      } else if (e.key === 'Escape') {
        setEditValue(item.title);
        nodeData.onEditComplete?.(item.id);
      }
    },
    [handleSubmit, item.title, item.id, nodeData]
  );

  const highlightRing = nodeData.isHighlighted ? 'ring-2 ring-blue-400 ring-offset-1' : '';
  const selectedRing = selected ? 'ring-2 ring-indigo-500 ring-offset-1' : highlightRing;

  return (
    <div
      className={`px-4 py-2 rounded-lg border-2 shadow-sm min-w-[140px] max-w-[220px] ${colors.bg} ${colors.border} ${selectedRing}`}
    >
      <Handle type="target" position={Position.Top} className="!bg-slate-400 !w-3 !h-3" />
      <div className="flex flex-col gap-1">
        {isEditing ? (
          <input
            ref={inputRef}
            type="text"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={handleSubmit}
            onKeyDown={handleKeyDown}
            className={`text-xs font-bold ${colors.text} bg-transparent border-b border-current outline-none w-full`}
          />
        ) : (
          <span className={`text-xs font-bold ${colors.text} truncate`}>{item.title}</span>
        )}
        <span className="text-[9px] text-slate-400 uppercase tracking-wider">{item.status}</span>
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-slate-400 !w-3 !h-3" />
    </div>
  );
};

export const FlowItemNode = memo(FlowItemNodeComponent);
