import { memo } from 'react';
import type { NodeProps } from '@xyflow/react';
import { formatHours } from '../../logic/flowDateGrouping';

export interface DateBandNodeData {
  label: string;
  /** R-148: 帯ラベル先頭に添える案件名（案件なしの帯は undefined） */
  projectName?: string;
  totalMinutes: number;
  criticalMinutes: number;
  remainingMinutes: number;
  hasIncomplete: boolean;
}

const DateBandNodeComponent = ({ data }: NodeProps) => {
  const nodeData = data as unknown as DateBandNodeData;

  return (
    <div className="w-full h-full relative select-none">
      <div className="absolute top-2 left-3 text-left leading-tight">
        {/* ラベル行は帯左端の余白（LABEL_MARGIN_WIDTH=140）に収める。案件名は残り幅で省略し、日付は常に全表示 */}
        <div className="text-[13px] font-bold text-slate-600 flex items-baseline gap-1 whitespace-nowrap max-w-[128px]">
          {nodeData.projectName && (
            <span className="text-slate-400 font-normal min-w-0 flex-1 truncate" title={nodeData.projectName}>{nodeData.projectName}</span>
          )}
          <span className="shrink-0">{nodeData.label}</span>
        </div>
        <div className="text-[13px] font-bold text-slate-700">合計 {formatHours(nodeData.totalMinutes)}</div>
        <div className="text-[12px] text-slate-500">最短 {formatHours(nodeData.criticalMinutes)}</div>
        {nodeData.hasIncomplete && (
          <div className="text-[12px] text-slate-500">残り {formatHours(nodeData.remainingMinutes)}</div>
        )}
      </div>
    </div>
  );
};

export const DateBandNode = memo(DateBandNodeComponent);
