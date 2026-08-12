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
  onEstimatedMinutesChange?: (itemId: string, minutes: number) => void | Promise<void>;
  onStartEditing?: (itemId: string) => void;
  onContextMenu?: (e: React.MouseEvent, itemId: string) => void;
  onChainCreate?: (itemId: string) => void;
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
  // タイトル編集からTabで目安時間欄に来た場合のみtrue。
  // この状態でEnterを押すと、目安時間確定に加えて次のノードを連鎖作成する
  const [chainOnConfirm, setChainOnConfirm] = useState(false);

  useEffect(() => {
    if (!isEditing || !inputRef.current) return;
    const el = inputRef.current;
    // R-080: 新規ノードはxyflowの初回計測が完了するまでノード要素に
    // visibility:hiddenが付与される。その間にfocus()を呼んでも黙って失敗し
    // 「タイトルが選択状態」にならない。計測完了(=styleの変化)を待ってから確定する。
    // rAF/setTimeoutでのポーリングはバックグラウンドタブでスロットリングされ
    // 遅延しうるため、DOM変化を直接監視するMutationObserverを使う
    const tryFocus = () => {
      if (window.getComputedStyle(el).visibility === 'hidden') return false;
      el.focus();
      el.select();
      return true;
    };
    if (tryFocus()) return;

    const target = el.closest('.react-flow__node') as HTMLElement | null;
    if (!target) return;
    const observer = new MutationObserver(() => {
      if (tryFocus()) observer.disconnect();
    });
    observer.observe(target, { attributes: true, attributeFilter: ['style'] });
    return () => observer.disconnect();
  }, [isEditing]);

  useEffect(() => {
    if (isTimeEditing && timeInputRef.current) {
      timeInputRef.current.focus();
      timeInputRef.current.select();
    }
  }, [isTimeEditing]);

  // R-089: input要素にonKeyDown(Enter)とonBlurの両方からhandleTimeEditConfirmが
  // 配線されている。Enter確定→保存完了→isTimeEditing=falseによりinput要素が
  // DOMから削除されると、実ブラウザはフォーカス中要素の除去に伴いblurイベントを
  // 発火する。このblurが古い(=削除される直前の)DOMノードに紐づいた
  // handleTimeEditConfirmの古いクロージャを再度呼び出し、同一itemIdへの
  // PUT /items/{id}が二重発火していた(本番PHPエラーログで同一item idへの
  // リクエストが同一秒に2件記録され、後着側が"database is locked"で失敗)。
  // 1回の編集セッション(開始→確定/キャンセル)につき確定は1回のみに制限するrefで防ぐ
  const hasConfirmedRef = useRef(false);

  const handleTimeEditStart = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    hasConfirmedRef.current = false;
    setTimeInputValue(formatMinutes(item.estimatedMinutes) || '');
    setIsTimeEditing(true);
  }, [item.estimatedMinutes]);

  // R-085: 保存が完了するまで待ち合わせられるようPromiseを返す。
  // 呼び出し元(Enterのチェーン作成)がawaitせず並行実行すると、目安時間の
  // PUT /items/{id}とチェーン作成のPOST /itemsがほぼ同時にSQLiteへ書き込みを
  // 試み、"database is locked" エラーの原因になっていた(本番PHPエラーログで確認済み)
  const handleTimeEditConfirm = useCallback(async () => {
    if (hasConfirmedRef.current) return;
    hasConfirmedRef.current = true;
    const minutes = parseTimeInput(timeInputValue);
    if (minutes !== null && minutes !== item.estimatedMinutes) {
      try {
        await nodeData.onEstimatedMinutesChange?.(item.id, minutes);
      } catch {
        // 呼び出し元(FlowScreen)で既にエラー表示・ログ済み。
        // ここで止めるとチェーン作成(次ノード追加)まで巻き添えになるため握りつぶす
      }
    }
    setIsTimeEditing(false);
  }, [timeInputValue, item.estimatedMinutes, item.id, nodeData]);

  const handleTimeEditCancel = useCallback(() => {
    hasConfirmedRef.current = true;
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
      } else if (e.key === 'Tab') {
        // R-074: タイトル確定後、目安時間欄へフォーカス移動（連続追加フローの一環）
        e.preventDefault();
        handleSubmit();
        setTimeInputValue(formatMinutes(item.estimatedMinutes) || '');
        setChainOnConfirm(true);
        setIsTimeEditing(true);
      }
    },
    [handleSubmit, item.title, item.id, item.estimatedMinutes, nodeData]
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
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
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
                if (e.key === 'Enter') {
                  e.preventDefault();
                  const shouldChain = chainOnConfirm;
                  if (shouldChain) setChainOnConfirm(false);
                  // R-085: 目安時間の保存が完了してからチェーン作成する(同時書き込み防止)
                  void handleTimeEditConfirm().then(() => {
                    if (shouldChain) nodeData.onChainCreate?.(item.id);
                  });
                }
                else if (e.key === 'Escape') { handleTimeEditCancel(); setChainOnConfirm(false); }
              }}
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
              onBlur={() => { handleTimeEditConfirm(); setChainOnConfirm(false); }}
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
