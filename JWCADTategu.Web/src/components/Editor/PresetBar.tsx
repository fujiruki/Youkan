import React from 'react';
import { DoorDimensions } from '../../domain/DoorDimensions';
import { Square, LayoutTemplate, Power, Maximize, Grid, User } from 'lucide-react';

interface PresetBarProps {
    currentDimensions: DoorDimensions;
    onChange: (dims: DoorDimensions) => void;
    showHumanScale: boolean;
    onToggleHumanScale: (show: boolean) => void;
}

export const PresetBar: React.FC<PresetBarProps> = ({ currentDimensions, onChange, showHumanScale, onToggleHumanScale }) => {

    const apply = (overrides: Partial<DoorDimensions>) => {
        onChange({
            ...currentDimensions,
            ...overrides,
        });
    };

    const presets = [
        {
            id: 'flush',
            label: 'フラッシュ',
            icon: <Square size={18} />,
            dims: { middleRailCount: 0, tsukaCount: 0, kumikoVertCount: 0, kumikoHorizCount: 0, topRailWidth: 50, bottomRailWidth: 50 }
        },
        {
            id: 'glass-top',
            label: '上部ガラス',
            icon: <LayoutTemplate size={18} className="rotate-180" />,
            dims: { middleRailCount: 1, middleRailPosition: 900, tsukaCount: 0, kumikoVertCount: 0, kumikoHorizCount: 0 }
        },
        {
            id: 'kumiko-top',
            label: '上部組子',
            icon: <Power size={18} />,
            dims: { middleRailCount: 1, middleRailPosition: 900, kumikoVertCount: 5, kumikoHorizCount: 3, tsukaCount: 0 }
        },
        {
            id: 'glass-full',
            label: '全面ガラス',
            icon: <Maximize size={18} />,
            dims: { middleRailCount: 0, tsukaCount: 0, kumikoVertCount: 0, kumikoHorizCount: 0, topRailWidth: 60, bottomRailWidth: 60 }
        },
        {
            id: 'grid',
            label: '障子/格子',
            icon: <Grid size={18} />,
            dims: { middleRailCount: 0, tsukaCount: 0, kumikoVertCount: 3, kumikoHorizCount: 6 }
        }
    ];

    return (
        <div className="w-full flex justify-center py-2 bg-slate-900 border-b border-slate-800 z-10">
            <div className="flex items-center gap-1 bg-slate-800 border border-slate-700/50 p-1 rounded-full shadow-lg">
                {presets.map(p => (
                    <button
                        key={p.id}
                        onClick={() => apply(p.dims)}
                        className="p-2 rounded-full text-slate-400 hover:text-white hover:bg-slate-700 transition-all relative group"
                        title={p.label}
                    >
                        {p.icon}
                        <span className="absolute -bottom-8 left-1/2 -translate-x-1/2 bg-black text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50">
                            {p.label}
                        </span>
                    </button>
                ))}

                <div className="w-px h-6 bg-slate-700 mx-1"></div>

                <button
                    onClick={() => onToggleHumanScale(!showHumanScale)}
                    className={`p-2 rounded-full transition-all relative group ${showHumanScale ? 'bg-emerald-500/20 text-emerald-400' : 'text-slate-400 hover:text-white hover:bg-slate-700'}`}
                    title="人型スケール (160cm)"
                >
                    <User size={18} />
                    <span className="absolute -bottom-8 left-1/2 -translate-x-1/2 bg-black text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50">
                        {showHumanScale ? 'スケール OFF' : 'スケール ON'}
                    </span>
                    {/* Checkmark badge for explicit ON state request */}
                    {showHumanScale && (
                        <span className="absolute top-0 right-0 w-2 h-2 rounded-full bg-emerald-500 ring-2 ring-slate-800"></span>
                    )}
                </button>
            </div>
        </div>
    );
};
