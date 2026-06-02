import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { SkipBack, Play, Pause, SkipForward, Square, X } from 'lucide-react';
import { useSpeechSynthesis } from '../../hooks/useSpeechSynthesis';
import { useYoukanViewModel } from '../../viewmodels/useYoukanViewModel';
import { useFilter } from '../../contexts/FilterContext';
import { useAuth } from '@/features/core/auth/providers/AuthProvider';
import { getPerspectiveLabel } from '../../logic/perspectiveLabel';
import { DecisionDetailModal } from '../Modal/DecisionDetailModal';
import type { Item } from '../../types';
import { isItemDone, COMPLETED_ITEM_CLASS } from '../../logic/statusUtils';

const LONG_PRESS_DELAY = 500; // ms

type SpeechItem = Item & { groupLabel: string };

type Props = {
  isOpen: boolean;
  onClose: () => void;
};

/**
 * 読み上げ文言を生成する。
 * - projectTitle が無い（= Inbox 相当）場合: タイトルだけ
 * - 直前のアイテムと同じ projectTitle の場合: タイトルだけ（連続するプロジェクト名を冗長にしない）
 * - それ以外: 「{プロジェクト名} の {タイトル}」
 */
const speechText = (item: SpeechItem, prevItem?: SpeechItem): string => {
  const proj = item.projectTitle;
  if (!proj || (prevItem && prevItem.projectTitle === proj)) {
    return item.title;
  }
  return `${proj} の ${item.title}`;
};

export const SpeechView: React.FC<Props> = ({ isOpen, onClose }) => {
  const { isSpeaking, isPaused, isSupported, speak, pause, resume, stop } = useSpeechSynthesis();
  const vm = useYoukanViewModel();
  const { filterMode } = useFilter();
  const { joinedTenants } = useAuth();

  const [currentIndex, setCurrentIndex] = useState<number | null>(null);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);

  // 長押し → 詳細モーダル
  const [detailItem, setDetailItem] = useState<Item | null>(null);
  const longPressTimerRef = useRef<number | null>(null);
  const isLongPressedRef = useRef(false);

  const perspectiveLabel = getPerspectiveLabel(filterMode, joinedTenants);

  const speechItems = useMemo<SpeechItem[]>(() => {
    const groups = [
      { label: '実行中', items: vm.executionItem ? [vm.executionItem] : [] },
      { label: '今日やる（確定）', items: vm.todayCommits || [] },
      { label: '今日やる（候補）', items: vm.todayCandidates || [] },
      { label: 'Inbox', items: vm.gdbActive || [] },
      { label: 'Ready', items: vm.gdbPreparation || [] },
      { label: 'Pending', items: vm.gdbIntent || [] },
    ];
    return groups.flatMap(g => g.items.map(item => ({ ...item, groupLabel: g.label })));
  }, [vm.executionItem, vm.todayCommits, vm.todayCandidates, vm.gdbActive, vm.gdbPreparation, vm.gdbIntent]);

  const playAtIndex = useCallback((index: number) => {
    if (index < 0 || index >= speechItems.length) return;

    // 次のアイテムへ再帰的にチェーン再生（停止ボタンが押されるまで継続）
    const playFrom = (i: number) => {
      if (i < 0 || i >= speechItems.length) return;
      setCurrentIndex(i);
      const prevItem = i > 0 ? speechItems[i - 1] : undefined;
      speak(speechText(speechItems[i], prevItem), () => {
        const next = i + 1;
        if (next < speechItems.length) {
          playFrom(next);
        } else {
          setCurrentIndex(null);
        }
      });
    };

    playFrom(index);
  }, [speechItems, speak]);

  const handlePlay = () => {
    if (currentIndex === null) {
      playAtIndex(0);
    } else {
      resume();
    }
  };

  const handlePause = () => {
    pause();
  };

  const handlePrevious = () => {
    const target = currentIndex !== null ? Math.max(0, currentIndex - 1) : 0;
    playAtIndex(target);
  };

  const handleNext = () => {
    const target = currentIndex !== null ? currentIndex + 1 : 0;
    if (target < speechItems.length) {
      playAtIndex(target);
    }
  };

  const handleStop = () => {
    stop();
    setCurrentIndex(null);
  };

  const handleClose = () => {
    stop();
    setCurrentIndex(null);
    onClose();
  };

  useEffect(() => {
    if (!isOpen) {
      stop();
      setCurrentIndex(null);
    }
  }, [isOpen, stop]);

  useEffect(() => {
    stop();
    setCurrentIndex(null);
  }, [filterMode]);

  useEffect(() => {
    const el = currentIndex !== null ? itemRefs.current[currentIndex] : null;
    if (el && typeof el.scrollIntoView === 'function') {
      el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
  }, [currentIndex]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/95 backdrop-blur-sm flex flex-col">
      {/* ヘッダー */}
      <div className="fixed top-0 left-0 right-0 z-10 bg-slate-900/95 backdrop-blur-sm px-6 py-4 flex items-center justify-between border-b border-slate-700/50">
        <div className="flex flex-col">
          <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">タスク読み上げ</span>
          <span className="text-sm font-bold text-slate-200">{perspectiveLabel}</span>
        </div>
        <button
          onClick={handleClose}
          className="p-2 hover:bg-slate-700 rounded-lg transition-colors text-slate-400"
          title="閉じる"
          aria-label="閉じる"
        >
          <X size={20} />
        </button>
      </div>

      {/* スクロール可能なリスト */}
      <div className="flex-1 overflow-y-auto pt-20 pb-24 px-4">
        {!isSupported && (
          <p className="text-center text-slate-400 py-8">このブラウザは音声読み上げに対応していません。</p>
        )}
        {speechItems.length === 0 && (
          <p className="text-center text-slate-400 py-8">読み上げるアイテムがありません。</p>
        )}
        <div className="max-w-lg mx-auto space-y-2">
          {speechItems.map((item, index) => {
            const isActive = currentIndex === index;
            const handlePointerDown = () => {
              isLongPressedRef.current = false;
              longPressTimerRef.current = window.setTimeout(() => {
                isLongPressedRef.current = true;
                // 読み上げ中なら一時停止
                if (isSpeaking && !isPaused) pause();
                setDetailItem(item);
              }, LONG_PRESS_DELAY);
            };
            const handlePointerCancel = () => {
              if (longPressTimerRef.current !== null) {
                window.clearTimeout(longPressTimerRef.current);
                longPressTimerRef.current = null;
              }
            };
            const handleClick = () => {
              if (isLongPressedRef.current) {
                isLongPressedRef.current = false;
                return; // 長押し成立後の click は無効化
              }
              playAtIndex(index);
            };
            return (
              <div
                key={item.id}
                ref={el => { itemRefs.current[index] = el; }}
                className={`px-4 py-3 rounded-lg transition-all duration-300 cursor-pointer select-none ${
                  isActive
                    ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/30'
                    : 'text-slate-300 hover:bg-slate-800'
                }`}
                onClick={handleClick}
                onPointerDown={handlePointerDown}
                onPointerUp={handlePointerCancel}
                onPointerLeave={handlePointerCancel}
                onPointerCancel={handlePointerCancel}
                style={{ touchAction: 'manipulation' }}
              >
                <div className={`text-[10px] font-bold uppercase tracking-wider mb-0.5 ${isActive ? 'text-indigo-200' : 'text-slate-500'}`}>
                  {item.groupLabel}
                  {item.projectTitle && ` › ${item.projectTitle}`}
                </div>
                <div className={`text-sm font-medium ${isItemDone(item) ? COMPLETED_ITEM_CLASS : (isActive ? 'text-white' : '')}`}>
                  {item.title}
                </div>
                {item.due_date && (
                  <div className={`text-[10px] mt-0.5 ${isActive ? 'text-indigo-200' : 'text-slate-500'}`}>
                    納期: {item.due_date}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* コントロールバー */}
      <div className="fixed bottom-0 left-0 right-0 bg-slate-900/95 backdrop-blur-sm px-6 py-4 flex items-center justify-center gap-4 border-t border-slate-700/50">
        <button
          onClick={handlePrevious}
          disabled={!isSupported}
          className="p-3 hover:bg-slate-700 rounded-full transition-colors text-slate-300 disabled:opacity-40"
          aria-label="前へ"
          title="前へ"
        >
          <SkipBack size={20} />
        </button>

        {isSpeaking && !isPaused ? (
          <button
            onClick={handlePause}
            disabled={!isSupported}
            className="p-4 bg-indigo-600 hover:bg-indigo-500 rounded-full transition-colors text-white shadow-lg disabled:opacity-40"
            aria-label="一時停止"
            title="一時停止"
          >
            <Pause size={24} />
          </button>
        ) : (
          <button
            onClick={handlePlay}
            disabled={!isSupported || speechItems.length === 0}
            className="p-4 bg-indigo-600 hover:bg-indigo-500 rounded-full transition-colors text-white shadow-lg disabled:opacity-40"
            aria-label="再生"
            title="再生"
          >
            <Play size={24} />
          </button>
        )}

        <button
          onClick={handleNext}
          disabled={!isSupported}
          className="p-3 hover:bg-slate-700 rounded-full transition-colors text-slate-300 disabled:opacity-40"
          aria-label="次へ"
          title="次へ"
        >
          <SkipForward size={20} />
        </button>

        <button
          onClick={handleStop}
          disabled={!isSupported}
          className="p-3 hover:bg-slate-700 rounded-full transition-colors text-slate-400 disabled:opacity-40"
          aria-label="停止"
          title="停止"
        >
          <Square size={20} />
        </button>
      </div>

      {/* 長押しで開く詳細モーダル（遅延マウントで API過剰呼出を回避） */}
      {detailItem && (
        <DecisionDetailModal
          item={detailItem}
          onClose={() => setDetailItem(null)}
          onDecision={() => setDetailItem(null)}
          onDelete={async (id) => {
            await vm.deleteItem?.(id);
            setDetailItem(null);
          }}
          onUpdate={async (id, updates) => {
            await vm.updateItem?.(id, updates);
          }}
          allProjects={vm.allProjects || []}
          joinedTenants={joinedTenants as any}
        />
      )}
    </div>
  );
};
