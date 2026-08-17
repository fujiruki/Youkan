import { memo } from 'react';
import type { NodeProps } from '@xyflow/react';
import { formatHours } from '../../logic/flowDateGrouping';

export interface DateBandNodeData {
  label: string;
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
        <div className="text-[13px] font-bold text-slate-600">{nodeData.label}</div>
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
