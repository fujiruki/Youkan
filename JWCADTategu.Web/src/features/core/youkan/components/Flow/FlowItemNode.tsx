import React, { memo, useState, useRef, useEffect, useCallback } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { Item } from '../../types';
import { formatMinutes, parseTimeInput } from '../../logic/timeParser';
import { isItemDone, COMPLETED_ITEM_CLASS } from '../../logic/statusUtils';

export interface FlowItemNodeData {
  item: Item;
  isEditing?: boolean;
  isNewNode?: boolean;
  isHighlighted?: boolean;
  onTitleChange?: (itemId: string, newTitle: string) => void;
  onEditComplete?: (itemId: string) => void;
  onEstimatedMinutesChange?: (itemId: string, minutes: number) => void;
  onStartEditing?: (itemId: string) => void;
  onContextMenu?: (e: React.MouseEvent, itemId: string) => void;
}

const statusColors: Record<string, { bg: string; border: string; text: string }> = {
  inbox: { bg: 'bg-slate-100', border: 'border-slate-300', text: 'text-slate-700' },
  focus: { bg: 'bg-indigo-100', border: 'border-indigo-400', text: 'text-indigo-800' },
  pending: { bg: 'bg-amber-100', border: 'border-amber-400', text: 'text-amber-800' },
  waiting: { bg: 'bg-orange-100', border: 'border-orange-400', text: 'text-orange-800' },
  done: { bg: 'bg-gray-100', border: 'border-gray-300', text: 'text-gray-400' },
};

const FlowItemNodeComponent = ({ data, selected }: NodeProps) => {
  const nodeData = data as unknown as FlowItemNodeData;
  const item = nodeData.item;
  const colors = statusColors[item.status] || statusColors.inbox;
  const [editValue, setEditValue] = useState(item.title);
  const inputRef = useRef<HTMLInputElement>(null);

  const isEditing = nodeData.isEditing || nodeData.isNewNode;
  const [isTimeEditing, setIsTimeEditing] = useState(false);
  const [timeInputValue, setTimeInputValue] = useState('');
  const timeInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  useEffect(() => {
    if (isTimeEditing && timeInputRef.current) {
      timeInputRef.current.focus();
      timeInputRef.current.select();
    }
  }, [isTimeEditing]);

  const handleTimeEditStart = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setTimeInputValue(formatMinutes(item.estimatedMinutes) || '');
    setIsTimeEditing(true);
  }, [item.estimatedMinutes]);

  const handleTimeEditConfirm = useCallback(() => {
    const minutes = parseTimeInput(timeInputValue);
    if (minutes !== null && minutes !== item.estimatedMinutes) {
      nodeData.onEstimatedMinutesChange?.(item.id, minutes);
    }
    setIsTimeEditing(false);
  }, [timeInputValue, item.estimatedMinutes, item.id, nodeData]);

  const handleTimeEditCancel = useCallback(() => {
    setIsTimeEditing(false);
  }, []);

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
  const done = isItemDone(item);
  const doneOpacity = done ? 'opacity-50' : '';

  return (
    <div
      className={`px-4 py-px rounded-lg border-2 shadow-sm min-w-[140px] max-w-[220px] ${colors.bg} ${colors.border} ${selectedRing} ${doneOpacity}`}
      onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); nodeData.onContextMenu?.(e, item.id); }}
    >
      <Handle type="target" position={Position.Top} className="!bg-slate-400 !w-3 !h-3" />
      <div className="flex flex-col gap-[2px]">
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
          <span
            className={`text-xs font-bold truncate ${done ? COMPLETED_ITEM_CLASS : colors.text}`}
            onClick={(e) => {
              if (selected) {
                e.stopPropagation();
                nodeData.onStartEditing?.(item.id);
              }
            }}
          >
            {item.title}
          </span>
        )}
        <div className="flex items-center gap-1">
          <span className="text-[9px] text-slate-400 uppercase tracking-wider">{item.status}</span>
          {isTimeEditing ? (
            <input
              ref={timeInputRef}
              type="text"
              value={timeInputValue}
              onChange={(e) => setTimeInputValue(e.target.value)}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === 'Enter') { e.preventDefault(); handleTimeEditConfirm(); }
                else if (e.key === 'Escape') { handleTimeEditCancel(); }
              }}
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
              onBlur={handleTimeEditConfirm}
              placeholder="1h"
              className="w-[3.5em] text-[9px] px-[0.2em] py-0 border border-amber-300 rounded bg-white focus:outline-none focus:ring-1 focus:ring-amber-500 text-center"
            />
          ) : (
            <span
              className={`text-[9px] px-1 rounded font-mono cursor-pointer ${formatMinutes(item.estimatedMinutes) ? 'bg-amber-100 text-amber-600' : 'text-slate-300 hover:text-slate-400'}`}
              onClick={handleTimeEditStart}
              onMouseDown={(e) => e.stopPropagation()}
            >
              {formatMinutes(item.estimatedMinutes) || '--'}
            </span>
          )}
        </div>
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-slate-400 !w-3 !h-3" />
    </div>
  );
};

export const FlowItemNode = memo(FlowItemNodeComponent);
