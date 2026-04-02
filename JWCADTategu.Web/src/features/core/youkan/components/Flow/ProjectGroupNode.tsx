import { memo } from 'react';
import type { NodeProps } from '@xyflow/react';

export interface ProjectGroupNodeData {
  label: string;
}

const ProjectGroupNodeComponent = ({ data }: NodeProps) => {
  const nodeData = data as unknown as ProjectGroupNodeData;

  return (
    <div className="w-full h-full relative">
      <div className="absolute top-2 left-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider select-none">
        {nodeData.label}
      </div>
    </div>
  );
};

export const ProjectGroupNode = memo(ProjectGroupNodeComponent);
