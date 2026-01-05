import React from 'react';
import { DoorDimensions } from '../../../domain/DoorDimensions';
import { t } from '../../../i18n/labels';

interface SidebarProps {
    dimensions: DoorDimensions;
    onChange: (key: keyof DoorDimensions, value: number) => void;
    onBack?: () => void; // Made optional as Header handles back now, but keeping for compatibility if needed or removed logic
    viewMode: 'design' | 'pro';
}

// Components defined OUTSIDE to preserve identity and focus
const InputGroup = ({ label, children }: { label: string, children: React.ReactNode }) => (
    <div className="flex flex-col gap-1 mb-3">
        <label className="text-xs text-slate-500 font-medium">{label}</label>
        {children}
    </div>
);

const NumberInput = ({ dimensionKey, value, onChange, placeholder }: { dimensionKey: keyof DoorDimensions, value: number, onChange: (k: keyof DoorDimensions, v: number) => void, placeholder?: string }) => (
    <input
        type="number"
        className="w-full min-w-[70px] bg-slate-800 border border-slate-700 rounded px-2 py-1 text-sm text-slate-200 focus:border-emerald-500 outline-none transition-colors"
        value={value}
        onChange={(e) => onChange(dimensionKey, Number(e.target.value))}
        placeholder={placeholder}
        onFocus={(e) => e.target.select()}
    />
);

const SliderInput = ({ dimensionKey, value, onChange, min, max, step = 1 }: { dimensionKey: keyof DoorDimensions, value: number, onChange: (k: keyof DoorDimensions, v: number) => void, min: number, max: number, step?: number }) => (
    <div className="flex items-center gap-2">
        <input
            type="range"
            min={min}
            max={max}
            step={step}
            value={value}
            onChange={(e) => onChange(dimensionKey, Number(e.target.value))}
            className="flex-1 h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-emerald-500"
        />
        <span className="w-8 text-right text-sm font-bold text-emerald-400">{value}</span>
    </div>
);

export const Sidebar: React.FC<SidebarProps> = ({ dimensions, onChange, viewMode }) => {

    return (
        <div className="w-80 bg-slate-900 border-r border-slate-800 flex flex-col h-full shrink-0">
            {/* Old Back Button Area - Removed as Header has Home button */}
            {/* <div className="p-4 border-b border-slate-800 flex items-center">...</div> */}

            <div className="overflow-y-auto flex-1 p-4 space-y-6">

                {/* 1. Basic Dimensions (Always Visible) */}
                <details className="group" open>
                    <summary className="text-sm font-bold text-slate-300 cursor-pointer list-none flex justify-between items-center mb-2">
                        <span>{t.editor.dimensions}</span>
                        <span className="group-open:rotate-180 transition-transform">▼</span>
                    </summary>
                    <div className="pl-2 border-l-2 border-slate-700 space-y-2">
                        <InputGroup label={t.editor.width + " (mm)"}>
                            <NumberInput dimensionKey="width" value={dimensions.width} onChange={onChange} />
                        </InputGroup>
                        <InputGroup label={t.editor.height + " (mm)"}>
                            <NumberInput dimensionKey="height" value={dimensions.height} onChange={onChange} />
                        </InputGroup>
                        <InputGroup label={t.editor.depth + " (mm)"}>
                            <NumberInput dimensionKey="depth" value={dimensions.depth} onChange={onChange} />
                        </InputGroup>
                    </div>
                </details>

                {/* 2. Design Mode Content */}
                {viewMode === 'design' && (
                    <div className="animation-fade-in">
                        <div className="text-xs font-bold text-emerald-500 uppercase tracking-wider mb-2 mt-6">Design Configuration</div>

                        <div className="bg-slate-800/50 p-3 rounded border border-slate-800 space-y-4">
                            <InputGroup label="中桟の本数 (Middle Rails)">
                                <SliderInput dimensionKey="middleRailCount" value={dimensions.middleRailCount} onChange={onChange} min={0} max={10} />
                            </InputGroup>

                            {dimensions.middleRailCount === 1 && (
                                <InputGroup label="中桟位置 (Position)">
                                    <div className="flex flex-col gap-1">
                                        <div className="text-[10px] text-slate-500 mb-1">中桟上端ー下桟下端距離</div>
                                        <SliderInput
                                            dimensionKey="middleRailPosition"
                                            value={dimensions.middleRailPosition || (dimensions.height / 2)}
                                            onChange={onChange}
                                            min={dimensions.bottomRailWidth}
                                            max={dimensions.height - dimensions.topRailWidth}
                                            step={10}
                                        />
                                    </div>
                                </InputGroup>
                            )}

                            <InputGroup label="束の本数 (Tsuka)">
                                <SliderInput dimensionKey="tsukaCount" value={dimensions.tsukaCount || 0} onChange={onChange} min={0} max={10} />
                            </InputGroup>

                            <InputGroup label="組子タテ本数 (Kumiko Vert)">
                                <SliderInput dimensionKey="kumikoVertCount" value={dimensions.kumikoVertCount || 0} onChange={onChange} min={0} max={20} />
                            </InputGroup>
                            <InputGroup label="組子ヨコ本数 (Kumiko Horiz)">
                                <SliderInput dimensionKey="kumikoHorizCount" value={dimensions.kumikoHorizCount || 0} onChange={onChange} min={0} max={20} />
                            </InputGroup>
                        </div>
                    </div>
                )}

                {/* 3. Pro Mode Content */}
                {viewMode === 'pro' && (
                    <div className="animation-fade-in space-y-6">
                        {/* Details Group */}
                        <details className="group" open>
                            <summary className="text-sm font-bold text-sky-400 cursor-pointer list-none flex justify-between items-center mb-2">
                                <span>詳細寸法 (Details)</span>
                                <span className="group-open:rotate-180 transition-transform">▼</span>
                            </summary>
                            <div className="pl-2 border-l-2 border-slate-800 space-y-2">
                                <InputGroup label="縦框見付 (Stile Width)">
                                    <NumberInput dimensionKey="stileWidth" value={dimensions.stileWidth} onChange={onChange} />
                                </InputGroup>
                                <InputGroup label="上桟見付 (Top Rail)">
                                    <NumberInput dimensionKey="topRailWidth" value={dimensions.topRailWidth} onChange={onChange} />
                                </InputGroup>
                                <InputGroup label="下桟見付 (Bottom Rail)">
                                    <NumberInput dimensionKey="bottomRailWidth" value={dimensions.bottomRailWidth} onChange={onChange} />
                                </InputGroup>
                            </div>
                        </details>

                        {/* Grid/Kumiko Group - Numeric Control */}
                        <details className="group" open>
                            <summary className="text-sm font-bold text-sky-400 cursor-pointer list-none flex justify-between items-center mb-2">
                                <span>中桟・束・組子詳細 (Grid Specs)</span>
                                <span className="group-open:rotate-180 transition-transform">▼</span>
                            </summary>
                            <div className="pl-2 border-l-2 border-slate-800 space-y-2">
                                <InputGroup label="中桟本数 (Count)">
                                    <NumberInput dimensionKey="middleRailCount" value={dimensions.middleRailCount} onChange={onChange} />
                                </InputGroup>
                                <InputGroup label="中桟見付 (Width)">
                                    <NumberInput dimensionKey="middleRailWidth" value={dimensions.middleRailWidth} onChange={onChange} />
                                </InputGroup>
                                <InputGroup label="中桟高さ (Height from Bottom)">
                                    <NumberInput
                                        dimensionKey="middleRailPosition"
                                        value={dimensions.middleRailPosition || 0}
                                        onChange={onChange}
                                        placeholder="0 (Auto)"
                                    />
                                </InputGroup>
                                <div className="h-px bg-slate-800 my-2"></div>
                                <InputGroup label="束本数 (Tsuka Count)">
                                    <NumberInput dimensionKey="tsukaCount" value={dimensions.tsukaCount || 0} onChange={onChange} />
                                </InputGroup>
                                <InputGroup label="束見付 (Tsuka Width)">
                                    <NumberInput dimensionKey="tsukaWidth" value={dimensions.tsukaWidth || 30} onChange={onChange} />
                                </InputGroup>
                                <div className="h-px bg-slate-800 my-2"></div>
                                <InputGroup label="組子タテ本数 (K-Vert Count)">
                                    <NumberInput dimensionKey="kumikoVertCount" value={dimensions.kumikoVertCount || 0} onChange={onChange} />
                                </InputGroup>
                                <InputGroup label="組子タテ見付 (K-Vert Width)">
                                    <NumberInput dimensionKey="kumikoVertWidth" value={dimensions.kumikoVertWidth || 6} onChange={onChange} />
                                </InputGroup>
                                <InputGroup label="組子ヨコ本数 (K-Horiz Count)">
                                    <NumberInput dimensionKey="kumikoHorizCount" value={dimensions.kumikoHorizCount || 0} onChange={onChange} />
                                </InputGroup>
                                <InputGroup label="組子ヨコ見付 (K-Horiz Width)">
                                    <NumberInput dimensionKey="kumikoHorizWidth" value={dimensions.kumikoHorizWidth || 6} onChange={onChange} />
                                </InputGroup>
                            </div>
                        </details>
                    </div>
                )}

            </div>

            {/* App Version / Settings Link */}
            <div className="p-4 border-t border-slate-800 text-center">
                <span className="text-[10px] text-slate-600">JWCAD Tategu v1.0</span>
            </div>
        </div>
    );
};
