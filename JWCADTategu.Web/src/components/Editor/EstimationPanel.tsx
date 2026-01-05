import React, { useState } from 'react';
import { DoorDimensions } from '../../domain/DoorDimensions';
import { EstimationSettings } from '../../domain/EstimationSettings';
import { calculateCost } from '../../domain/EstimationService';
// icons
import { Calculator, Table2 } from 'lucide-react';

interface EstimationPanelProps {
    dimensions: DoorDimensions;
    settings: EstimationSettings;
    onSettingsChange: (settings: EstimationSettings) => void;
    onDimensionChange: (key: keyof DoorDimensions, value: any) => void;
}

export const EstimationPanel: React.FC<EstimationPanelProps> = ({ dimensions, settings, onSettingsChange, onDimensionChange }) => {
    const { items, totalCost, unitPrice } = calculateCost(dimensions, settings);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);

    // CSS Grid Layout for the pseudo-table
    // Columns: Name, Width, Depth, Length, Count, Hozo, Margins(W/L/T), Cost
    // Grid template: 
    // Name | Sizes (W x D x L) | Count | Hozo | Margins | Cost

    return (
        <div className="bg-slate-900 border-l border-slate-800 h-full flex flex-col text-slate-200 text-sm">
            {/* Header */}
            <div className="p-4 border-b border-slate-800 bg-slate-950 flex justify-between items-center">
                <h2 className="text-base font-bold flex items-center gap-2 text-emerald-400">
                    <Table2 size={20} />
                    積算見積書
                </h2>
                <button
                    onClick={() => setIsSettingsOpen(!isSettingsOpen)}
                    className="text-slate-500 hover:text-white transition-colors"
                >
                    <Calculator size={20} />
                </button>
            </div>

            {/* Global Settings (Collapsible) */}
            {isSettingsOpen && (
                <div className="p-4 bg-slate-800/50 border-b border-slate-700 space-y-3 animation-slide-down text-sm">
                    <h3 className="font-bold text-slate-300 mb-2">全体設定 (Global Settings)</h3>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="flex flex-col gap-1">
                            <label className="text-slate-500">平米単価 (円/m3)</label>
                            <input
                                type="number"
                                className="bg-slate-900 border border-slate-600 rounded px-2 py-1 text-right text-emerald-400 w-full"
                                value={settings.pricePerM3}
                                onChange={e => onSettingsChange({ ...settings, pricePerM3: Number(e.target.value) })}
                            />
                        </div>
                        <div className="flex flex-col gap-1">
                            <label className="text-slate-500">掛率 (Markup)</label>
                            <input
                                type="number" step="0.1"
                                className="bg-slate-900 border border-slate-600 rounded px-2 py-1 text-right text-emerald-400 w-full"
                                value={settings.markup}
                                onChange={e => onSettingsChange({ ...settings, markup: Number(e.target.value) })}
                            />
                        </div>
                    </div>

                    <div className="bg-slate-900 p-2 rounded border border-slate-700 mt-2">
                        <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">Safety Margins (mm)</div>
                        <div className="grid grid-cols-4 gap-2">
                            <div>
                                <label className="block text-xs text-slate-500">幅余裕</label>
                                <input type="number" min={0} className="w-full bg-slate-800 rounded px-1 text-right"
                                    value={settings.widthMargin}
                                    onChange={e => onSettingsChange({ ...settings, widthMargin: Math.max(0, Number(e.target.value)) })} />
                            </div>
                            <div>
                                <label className="block text-xs text-slate-500">長余裕</label>
                                <input type="number" min={0} className="w-full bg-slate-800 rounded px-1 text-right"
                                    value={settings.lengthMargin}
                                    onChange={e => onSettingsChange({ ...settings, lengthMargin: Math.max(0, Number(e.target.value)) })} />
                            </div>
                            <div>
                                <label className="block text-xs text-slate-500">厚余裕</label>
                                <input type="number" min={0} className="w-full bg-slate-800 rounded px-1 text-right"
                                    value={settings.thicknessMargin}
                                    onChange={e => onSettingsChange({ ...settings, thicknessMargin: Math.max(0, Number(e.target.value)) })} />
                            </div>
                            <div>
                                <label className="block text-xs text-slate-500">ホゾ(片)</label>
                                <input type="number" min={0} className="w-full bg-slate-800 rounded px-1 text-right"
                                    value={settings.hozoLength}
                                    onChange={e => onSettingsChange({ ...settings, hozoLength: Math.max(0, Number(e.target.value)) })} />
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Table Header */}
            {/* Updated Grid for Separate Dimensions */}
            <div className="grid grid-cols-[2fr_1fr_1fr_1fr_0.6fr_1fr_0.8fr_0.8fr_0.8fr_1.5fr_1.5fr] gap-1 px-2 py-2 bg-slate-900 border-b border-slate-800 text-[10px] text-slate-500 font-medium uppercase tracking-wider text-center">
                <div className="text-left">部材名</div>
                <div>幅</div>
                <div>見込</div>
                <div>長さ</div>
                <div>数</div>
                <div>ホゾ</div>
                <div>余W</div>
                <div>余T</div>
                <div>余L</div>
                <div>単価</div>
                <div className="text-right">金額</div>
            </div>

            {/* Table Body (Scrollable) */}
            <div className="flex-1 overflow-y-auto px-2 py-2 space-y-1">
                {items.map((item, idx) => {
                    const handleOverride = (field: keyof import('../../domain/DoorDimensions').EstimationOverride, val: number) => {
                        const currentOverrides = dimensions.estimationOverrides || {};
                        const itemOverride = currentOverrides[item.name] || {};

                        const newOverrides = {
                            ...currentOverrides,
                            [item.name]: { ...itemOverride, [field]: val }
                        };
                        onDimensionChange('estimationOverrides', newOverrides as any);
                    };

                    // 7 digits ~ 60-70px
                    const inputClass = "min-w-[70px] w-full bg-slate-800 rounded px-1 text-center text-emerald-400 focus:bg-slate-700 outline-none h-7 text-sm";
                    // 8 digits ~ 80-100px
                    const priceInputClass = "min-w-[90px] w-full bg-slate-800 rounded px-1 text-right text-emerald-400 focus:bg-slate-700 outline-none h-7 text-sm";
                    const marginInputClass = "min-w-[40px] w-full bg-slate-800 rounded px-1 text-center text-slate-400 focus:bg-slate-700 outline-none h-7 text-xs";

                    return (
                        <div key={idx} className="grid grid-cols-[2fr_1fr_1fr_1fr_0.6fr_1fr_0.8fr_0.8fr_0.8fr_1.5fr_1.5fr] gap-1 py-1 border-b border-slate-800/50 items-center hover:bg-slate-800/30 transition-colors text-xs">
                            {/* Name */}
                            <div className="font-medium text-emerald-100 truncate pl-1" title={item.name}>
                                {item.name}
                            </div>

                            {/* Width (Editable) */}
                            <div>
                                <input type="number" className={inputClass} value={item.width} onChange={(e) => handleOverride('width', Number(e.target.value))} />
                            </div>
                            {/* Depth (Editable) */}
                            <div>
                                <input type="number" className={inputClass} value={item.depth} onChange={(e) => handleOverride('depth', Number(e.target.value))} />
                            </div>
                            {/* Length (Editable) */}
                            <div>
                                <input type="number" className={inputClass} value={item.length} onChange={(e) => handleOverride('length', Number(e.target.value))} />
                            </div>

                            {/* Count */}
                            <div className="text-center text-slate-200">
                                {item.count}
                            </div>

                            {/* Hozo (Editable) */}
                            <div>
                                <input type="number" className={inputClass} value={item.hozo} onChange={(e) => handleOverride('hozo', Number(e.target.value))} />
                            </div>

                            {/* Margins W/T/L (Editable) */}
                            <div>
                                <input type="number" className={marginInputClass} value={item.margins.w} onChange={(e) => handleOverride('marginWidth', Number(e.target.value))} />
                            </div>
                            <div>
                                <input type="number" className={marginInputClass} value={item.margins.t} onChange={(e) => handleOverride('marginThickness', Number(e.target.value))} />
                            </div>
                            <div>
                                <input type="number" className={marginInputClass} value={item.margins.l} onChange={(e) => handleOverride('marginLength', Number(e.target.value))} />
                            </div>

                            {/* Unit Price (Editable) */}
                            <div>
                                <input type="number" className={priceInputClass} value={item.unitPrice} onChange={(e) => handleOverride('unitPrice', Number(e.target.value))} />
                            </div>

                            {/* Cost */}
                            <div className="text-right font-mono text-slate-300 pr-1">
                                {item.cost.toLocaleString()}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Footer Summary */}
            <div className="p-4 bg-slate-950 border-t border-slate-800">
                <div className="flex justify-between items-center text-xs mb-1">
                    <span className="text-slate-500">原価合計 (Cost)</span>
                    <span className="text-slate-300">¥ {totalCost.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-end">
                    <span className="text-base font-bold text-emerald-500">販売価格 (Price)</span>
                    <span className="text-2xl font-bold text-emerald-400 tracking-tight">
                        ¥ {unitPrice.toLocaleString()}
                    </span>
                </div>
                <div className="text-[10px] text-right text-slate-600 mt-1">
                    利益率 {(settings.markup * 100).toFixed(0)}% 込
                </div>
            </div>
        </div>
    );
};
