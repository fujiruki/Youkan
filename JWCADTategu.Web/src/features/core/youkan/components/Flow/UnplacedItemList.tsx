import React, { memo, forwardRef, useImperativeHandle, useRef } from 'react';
import type { Item } from '../../types';

interface UnplacedItemListProps {
  items: Item[];
  onAutoPlace?: () => void;
  isAutoPlacing?: boolean;
}

export interface UnplacedItemListHandle {
  focusInput: () => void;
}

const UnplacedItemListComponent = forwardRef<UnplacedItemListHandle, UnplacedItemListProps>(
  ({ items, onAutoPlace, isAutoPlacing }, ref) => {
    const inputRef = useRef<HTMLInputElement>(null);

    useImperativeHandle(ref, () => ({
      focusInput: () => {
        inputRef.current?.focus();
      },
    }));

    const onDragStart = (e: React.DragEvent, itemId: string) => {
      e.dataTransfer.setData('application/youkan-flow-item', itemId);
      e.dataTransfer.effectAllowed = 'move';
    };

    return (
      <div className="fixed top-28 right-4 z-50 w-56 max-h-[60vh] bg-white/95 backdrop-blur border border-slate-200 rounded-xl shadow-xl overflow-hidden">
        <div className="px-3 py-2 bg-slate-50 border-b border-slate-200">
          <h3 className="text-[11px] font-black text-slate-500 uppercase tracking-wider">
            未配置 ({items.length})
          </h3>
        </div>
        {items.length > 0 && onAutoPlace && (
          <div className="px-2 py-1.5 border-b border-slate-200">
            <button
              onClick={onAutoPlace}
              disabled={isAutoPlacing}
              className="w-full px-3 py-1.5 text-[11px] font-bold text-white bg-indigo-500 hover:bg-indigo-600 disabled:bg-slate-300 rounded-lg transition-colors"
            >
              {isAutoPlacing ? '配置中...' : '全て自動配置'}
            </button>
          </div>
        )}
        <div className="overflow-y-auto max-h-[calc(60vh-40px)] p-2 space-y-1">
          {items.map((item) => (
            <div
              key={item.id}
              draggable
              onDragStart={(e) => onDragStart(e, item.id)}
              className="px-3 py-2 bg-slate-50 hover:bg-indigo-50 rounded-lg cursor-grab active:cursor-grabbing border border-slate-200 hover:border-indigo-300 transition-colors"
            >
              <span className="text-xs font-semibold text-slate-700 truncate block">{item.title}</span>
              <span className="text-[9px] text-slate-400 uppercase">{item.status}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }
);

UnplacedItemListComponent.displayName = 'UnplacedItemList';

export const UnplacedItemList = memo(UnplacedItemListComponent);
