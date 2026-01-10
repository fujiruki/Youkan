import React from 'react';
import { DoorTextureSpecs, MaterialTexture, MaterialType, GrainDirection } from '../../domain/DoorSpecs';
import { ChevronDown, ChevronRight, Palette } from 'lucide-react';
import clsx from 'clsx';

interface TextureSettingsPanelProps {
    specs: DoorTextureSpecs;
    onChange: (specs: DoorTextureSpecs) => void;
}

export const TextureSettingsPanel: React.FC<TextureSettingsPanelProps> = ({ specs, onChange }) => {

    const updateSpec = (key: keyof DoorTextureSpecs, updates: Partial<MaterialTexture>) => {
        onChange({
            ...specs,
            [key]: { ...specs[key], ...updates }
        });
    };

    return (
        <div className="flex flex-col gap-4 text-xs text-slate-300">
            <h3 className="font-bold text-slate-400 uppercase tracking-widest px-2 mt-4">Visual Settings</h3>

            {/* Quick Presets (Future) */}

            {/* Parts List */}
            <div className="flex flex-col gap-2">
                <TextureSection label="縦框 (Stile)" spec={specs.stile} onChange={(v) => updateSpec('stile', v)} />
                <TextureSection label="上桟 (Top Rail)" spec={specs.topRail} onChange={(v) => updateSpec('topRail', v)} />
                <TextureSection label="下桟 (Bottom Rail)" spec={specs.bottomRail} onChange={(v) => updateSpec('bottomRail', v)} />
                <TextureSection label="中桟 (Middle Rail)" spec={specs.middleRail} onChange={(v) => updateSpec('middleRail', v)} />
                <TextureSection label="束 (Tsuka)" spec={specs.tsuka} onChange={(v) => updateSpec('tsuka', v)} />
                <TextureSection label="組子 (Kumiko)" spec={specs.kumiko} onChange={(v) => updateSpec('kumiko', v)} />
                <TextureSection label="鏡板 (Panel)" spec={specs.panel} onChange={(v) => updateSpec('panel', v)} />
                <TextureSection label="ガラス (Glass)" spec={specs.glass} onChange={(v) => updateSpec('glass', v)} />
            </div>
        </div>
    );
};

const TextureSection: React.FC<{
    label: string;
    spec: MaterialTexture;
    onChange: (v: Partial<MaterialTexture>) => void;
}> = ({ label, spec, onChange }) => {
    const [isOpen, setIsOpen] = React.useState(false);

    return (
        <div className="border border-slate-700 rounded bg-slate-800/50 overflow-hidden">
            <button
                className="w-full flex items-center justify-between p-2 hover:bg-slate-700 transition"
                onClick={() => setIsOpen(!isOpen)}
            >
                <div className="flex items-center gap-2">
                    <div
                        className="w-3 h-3 rounded-full border border-slate-600"
                        style={{ backgroundColor: spec.color, opacity: spec.opacity }}
                    />
                    <span className="font-bold">{label}</span>
                </div>
                {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </button>

            {isOpen && (
                <div className="p-3 bg-slate-900/50 flex flex-col gap-3 border-t border-slate-700">

                    {/* Material Type */}
                    <div className="flex flex-col gap-1">
                        <label className="text-[10px] uppercase text-slate-500">Material</label>
                        <select
                            value={spec.material}
                            onChange={(e) => onChange({ material: e.target.value as MaterialType })}
                            className="bg-slate-800 border border-slate-600 rounded px-2 py-1 text-xs outline-none focus:border-emerald-500"
                        >
                            <option value="wood">Wood (木)</option>
                            <option value="glass">Glass (ガラス)</option>
                            <option value="shoji">Shoji (障子)</option>
                            <option value="paper">Paper (紙)</option>
                            <option value="none">None</option>
                        </select>
                    </div>

                    {/* Color Picker */}
                    <div className="flex flex-col gap-1">
                        <label className="text-[10px] uppercase text-slate-500">Color</label>
                        <div className="flex items-center gap-2">
                            <input
                                type="color"
                                value={spec.color || '#ffffff'}
                                onChange={(e) => onChange({ color: e.target.value })}
                                className="w-8 h-8 rounded border-none cursor-pointer bg-transparent"
                            />
                            <span className="text-xs font-mono text-slate-500">{spec.color}</span>
                        </div>
                    </div>

                    {/* Wood Specifics */}
                    {spec.material === 'wood' && (
                        <>
                            <div className="flex flex-col gap-1">
                                <label className="text-[10px] uppercase text-slate-500">Grain Direction</label>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => onChange({ grainDir: 'vertical' })}
                                        className={clsx(
                                            "flex-1 py-1 rounded border text-xs",
                                            spec.grainDir === 'vertical' ? "bg-emerald-900 border-emerald-500 text-white" : "border-slate-700 text-slate-500"
                                        )}
                                    >
                                        縦 (Vet)
                                    </button>
                                    <button
                                        onClick={() => onChange({ grainDir: 'horizontal' })}
                                        className={clsx(
                                            "flex-1 py-1 rounded border text-xs",
                                            spec.grainDir === 'horizontal' ? "bg-emerald-900 border-emerald-500 text-white" : "border-slate-700 text-slate-500"
                                        )}
                                    >
                                        横 (Hor)
                                    </button>
                                </div>
                            </div>
                        </>
                    )}

                    {/* Glass Specifics */}
                    {spec.material === 'glass' && (
                        <div className="flex flex-col gap-1">
                            <label className="text-[10px] uppercase text-slate-500">Opacity: {spec.opacity}</label>
                            <input
                                type="range"
                                min="0" max="1" step="0.1"
                                value={spec.opacity || 0.3}
                                onChange={(e) => onChange({ opacity: parseFloat(e.target.value) })}
                                className="w-full"
                            />
                        </div>
                    )}

                </div>
            )}
        </div>
    );
};
