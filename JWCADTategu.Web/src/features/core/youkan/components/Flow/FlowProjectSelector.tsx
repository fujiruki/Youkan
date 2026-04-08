import { useMemo } from 'react';
import { Folder, ArrowRight, LayoutGrid } from 'lucide-react';
import type { Item } from '../../types';

export interface ProjectSummary {
  projectId: string;
  projectTitle: string;
  taskCount: number;
  doneCount: number;
  completionRate: number;
  nearestDueDate: string | null;
}

interface FlowProjectSelectorProps {
  items: Item[];
  onSelectProject: (projectId: string) => void;
  onSelectAll: () => void;
}

export function buildProjectSummaries(items: Item[]): ProjectSummary[] {
  const map = new Map<string, { title: string; total: number; done: number; nearestDue: string | null }>();

  for (const item of items) {
    if (!item.projectId) continue;
    const pid = item.projectId;
    const entry = map.get(pid) || {
      title: item.projectTitle || pid,
      total: 0,
      done: 0,
      nearestDue: null as string | null,
    };
    entry.total++;
    if (item.status === 'done') entry.done++;
    if (item.due_date && (!entry.nearestDue || item.due_date < entry.nearestDue)) {
      entry.nearestDue = item.due_date;
    }
    map.set(pid, entry);
  }

  return Array.from(map.entries())
    .map(([projectId, data]) => ({
      projectId,
      projectTitle: data.title,
      taskCount: data.total,
      doneCount: data.done,
      completionRate: data.total > 0 ? Math.round((data.done / data.total) * 100) : 0,
      nearestDueDate: data.nearestDue,
    }))
    .sort((a, b) => b.taskCount - a.taskCount);
}

export const FlowProjectSelector: React.FC<FlowProjectSelectorProps> = ({
  items,
  onSelectProject,
  onSelectAll,
}) => {
  const summaries = useMemo(() => buildProjectSummaries(items), [items]);

  return (
    <div className="h-full w-full bg-slate-50 overflow-auto p-6">
      <div className="max-w-4xl mx-auto">
        <h2 className="text-lg font-bold text-slate-700 mb-4">フローチャート - プロジェクト選択</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <button
            onClick={onSelectAll}
            className="flex items-center gap-3 p-4 bg-white border-2 border-dashed border-slate-300 rounded-lg hover:border-indigo-400 hover:bg-indigo-50 transition-colors text-left group"
          >
            <LayoutGrid size={24} className="text-slate-400 group-hover:text-indigo-500 shrink-0" />
            <div>
              <div className="font-bold text-slate-700 group-hover:text-indigo-700">全プロジェクト</div>
              <div className="text-xs text-slate-400">従来の一括フロー表示</div>
            </div>
          </button>

          {summaries.map((s) => (
            <button
              key={s.projectId}
              onClick={() => onSelectProject(s.projectId)}
              className="flex items-center gap-3 p-4 bg-white border border-slate-200 rounded-lg hover:border-indigo-400 hover:shadow-md transition-all text-left group"
            >
              <Folder size={24} className="text-indigo-400 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="font-bold text-slate-700 truncate">{s.projectTitle}</div>
                <div className="flex items-center gap-2 text-xs text-slate-400 mt-1">
                  <span>{s.taskCount}件</span>
                  <span className="text-emerald-500">{s.completionRate}%</span>
                  {s.nearestDueDate && <span className="text-amber-500">{s.nearestDueDate}</span>}
                </div>
                <div className="w-full bg-slate-100 rounded-full h-1 mt-1.5">
                  <div
                    className="bg-emerald-400 rounded-full h-1 transition-all"
                    style={{ width: `${s.completionRate}%` }}
                  />
                </div>
              </div>
              <ArrowRight size={16} className="text-slate-300 group-hover:text-indigo-500 shrink-0" />
            </button>
          ))}
        </div>

        {summaries.length === 0 && (
          <div className="text-center text-slate-400 mt-8">
            <p>プロジェクトに紐づいたタスクがありません</p>
          </div>
        )}
      </div>
    </div>
  );
};
