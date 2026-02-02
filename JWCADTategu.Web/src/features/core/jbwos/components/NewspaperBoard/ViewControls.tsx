import React from 'react';

interface ViewControlsProps {
    fontSize: number;
    setFontSize: (size: number) => void;
    columnCount: number;
    setColumnCount: (count: number) => void;
}

export const ViewControls: React.FC<ViewControlsProps> = ({ fontSize, setFontSize, columnCount, setColumnCount }) => {
    return (
        <div className="flex items-center gap-4 bg-white/90 dark:bg-slate-900/90 backdrop-blur px-4 py-2 rounded-full border border-slate-200 dark:border-slate-700 shadow-sm">
            {/* Font Size Slider */}
            <div className="flex items-center gap-2">
                <span className="text-[10px] uppercase font-bold text-slate-400">文字サイズ</span>
                <input
                    type="range"
                    min="8"
                    max="20" // Expanded range
                    step="1"
                    value={fontSize}
                    onChange={(e) => setFontSize(parseInt(e.target.value))}
                    className="w-20 accent-indigo-500 cursor-pointer h-1 bg-slate-200 rounded-lg appearance-none"
                />
                <span className="text-xs font-mono text-slate-500 w-4 text-right">{fontSize}</span>
            </div>

            <div className="w-px h-4 bg-slate-200 dark:bg-slate-700" />

            {/* Column Count Slider */}
            <div className="flex items-center gap-2">
                <span className="text-[10px] uppercase font-bold text-slate-400">列数</span>
                <input
                    type="range"
                    min="1"
                    max="10"
                    step="1"
                    value={columnCount}
                    onChange={(e) => setColumnCount(parseInt(e.target.value))}
                    className="w-20 accent-indigo-500 cursor-pointer h-1 bg-slate-200 rounded-lg appearance-none"
                />
                <span className="text-xs font-mono text-slate-500 w-4 text-right">{columnCount}</span>
            </div>
        </div>
    );
};
