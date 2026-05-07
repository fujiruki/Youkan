import React, { useMemo } from 'react';
import { SimpleModal } from '../Modal/SimpleModal';
import { useYoukanViewModel } from '../../viewmodels/useYoukanViewModel';
import { useFilter } from '../../contexts/FilterContext';
import { useAuth } from '@/features/core/auth/providers/AuthProvider';
import { useToast } from '@/contexts/ToastContext';
import { buildForAiMarkdown } from '../../logic/forAiExporter';
import { getPerspectiveLabel } from '../../logic/perspectiveLabel';
import { copyToClipboard, downloadMarkdown } from '@/lib/clipboard';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export const ForAiModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const vm = useYoukanViewModel();
  const { filterMode } = useFilter();
  const { joinedTenants } = useAuth();
  const { showToast } = useToast();

  const perspectiveLabel = getPerspectiveLabel(filterMode, joinedTenants);

  const groups = useMemo(() => [
    { groupTitle: '実行中', items: vm.executionItem ? [vm.executionItem] : [] },
    { groupTitle: '今日やる（確定）', items: vm.todayCommits || [] },
    { groupTitle: '今日やる（候補）', items: vm.todayCandidates || [] },
    { groupTitle: 'Inbox', items: vm.gdbActive || [] },
    { groupTitle: 'Ready', items: vm.gdbPreparation || [] },
    { groupTitle: 'Pending', items: vm.gdbIntent || [] },
  ], [vm.executionItem, vm.todayCommits, vm.todayCandidates, vm.gdbActive, vm.gdbPreparation, vm.gdbIntent]);

  const markdown = useMemo(() => buildForAiMarkdown({
    perspectiveLabel,
    today: new Date(),
    groups,
  }), [perspectiveLabel, groups]);

  const handleCopy = async () => {
    const success = await copyToClipboard(markdown);
    if (success) {
      showToast({ type: 'success', title: 'コピーしました' });
    } else {
      showToast({ type: 'error', title: 'コピーに失敗しました' });
    }
  };

  const handleDownload = () => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    const filename = `Youkan_${perspectiveLabel}_${yyyy}-${mm}-${dd}.md`;
    downloadMarkdown(markdown, filename);
  };

  return (
    <SimpleModal isOpen={isOpen} onClose={onClose} title="AIに状況を渡す">
      <div className="flex flex-col gap-4 p-6">
        <div className="text-sm text-slate-500 dark:text-slate-400">
          立場: <span className="font-bold text-slate-700 dark:text-slate-200">{perspectiveLabel}</span>
        </div>
        <textarea
          readOnly
          value={markdown}
          className="w-full font-mono text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg p-3 resize-none overflow-auto text-slate-700 dark:text-slate-300"
          style={{ height: '50vh' }}
          aria-label="生成されたMarkdown"
        />
        <div className="flex gap-3 justify-end">
          <button
            onClick={handleCopy}
            className="px-4 py-2 text-sm font-bold bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors"
            aria-label="クリップボードへコピー"
          >
            📋 クリップボードへコピー
          </button>
          <button
            onClick={handleDownload}
            className="px-4 py-2 text-sm font-bold bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
            aria-label="mdダウンロード"
          >
            ⬇️ md ダウンロード
          </button>
        </div>
      </div>
    </SimpleModal>
  );
};
