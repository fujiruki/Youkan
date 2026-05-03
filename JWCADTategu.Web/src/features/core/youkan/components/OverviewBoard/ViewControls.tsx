import React from 'react';

interface ViewControlsProps {
    fontSize: number;
    columnCount: number;
    titleLimit: number;
    onChangeFontSize: (size: number) => void;
    onChangeColumnCount: (count: number) => void;
    onChangeTitleLimit: (limit: number) => void;
    showSomeday?: boolean;
    onChangeShowSomeday?: (value: boolean) => void;
}

export const ViewControls: React.FC<ViewControlsProps> = ({
    fontSize,
    columnCount,
    titleLimit,
    onChangeFontSize,
    onChangeColumnCount,
    onChangeTitleLimit,
    showSomeday = false,
    onChangeShowSomeday
}) => {
    return (
        <div className="flex items-center gap-6 px-4 py-2 bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-800 text-[10px] text-slate-500 overflow-x-auto whitespace-nowrap scrollbar-none">
            <div className="flex items-center gap-2">
                <span>文字サイズ: {fontSize}px</span>
                <input
                    type="range" min="8" max="24" step="1"
                    value={fontSize}
                    onChange={(e) => onChangeFontSize(Number(e.target.value))}
                    className="w-20 accent-blue-500"
                />
            </div>
            <div className="flex items-center gap-2 border-l border-slate-200 dark:border-slate-800 pl-4">
                <span>列数: {columnCount}</span>
                <input
                    type="range" min="1" max="10" step="1"
                    value={columnCount}
                    onChange={(e) => onChangeColumnCount(Number(e.target.value))}
                    className="w-20 accent-blue-500"
                />
            </div>
            <div className="flex items-center gap-2 border-l border-slate-200 dark:border-slate-800 pl-4">
                <span>タイトル制限: {titleLimit}文字</span>
                <input
                    type="range" min="5" max="50" step="1"
                    value={titleLimit}
                    onChange={(e) => onChangeTitleLimit(Number(e.target.value))}
                    className="w-20 accent-blue-500"
                />
            </div>
            {onChangeShowSomeday && (
                <div className="flex items-center gap-2 border-l border-slate-200 dark:border-slate-800 pl-4">
                    <button
                        onClick={() => onChangeShowSomeday(!showSomeday)}
                        className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-bold border transition-colors ${showSomeday
                            ? 'bg-purple-100 border-purple-300 text-purple-700 dark:bg-purple-900/40 dark:border-purple-700 dark:text-purple-300'
                            : 'bg-white border-slate-200 text-slate-400 hover:border-purple-300 hover:text-purple-500 dark:bg-slate-800 dark:border-slate-700'
                        }`}
                        title="いつかやる（Someday）の表示切替"
                    >
                        <span>💭</span>
                        <span>いつかやる</span>
                    </button>
                </div>
            )}
        </div>
    );
};
