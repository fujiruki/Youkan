import React, { useEffect, useRef } from 'react';
import { DoorDimensions } from '../domain/DoorDimensions';
import { GeometryPart } from '../../../../logic/GeometryGenerator';
import { X, Minus, Plus } from 'lucide-react';

interface MiniEditorProps {
    part: GeometryPart;
    dimensions: DoorDimensions;
    onChange: (dims: DoorDimensions) => void;
    onClose: () => void;
    canvasSize: { width: number; height: number };
    initialPosition?: { x: number; y: number };
}

// Custom hook for long press
const useLongPress = (callback: () => void, delay: number = 300, interval: number = 100) => {
    const savedCallback = useRef(callback);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    useEffect(() => {
        savedCallback.current = callback;
    }, [callback]);

    const clear = () => {
        if (timerRef.current) clearTimeout(timerRef.current);
        if (intervalRef.current) clearInterval(intervalRef.current);
    };

    const start = () => {
        savedCallback.current(); // Immediate fire
        timerRef.current = setTimeout(() => {
            intervalRef.current = setInterval(() => {
                savedCallback.current();
            }, interval);
        }, delay);
    };
    // ...

    // Cleanup on unmount
    useEffect(() => clear, []);

    return {
        onMouseDown: (e: React.MouseEvent) => {
            // Only left click
            if (e.button !== 0) return;
            start();
        },
        onMouseUp: clear,
        onMouseLeave: clear
    };
};

// Stepper component defined OUTSIDE MiniEditor prevent remounting issues
const Stepper = ({ label, value, onChange, min = 0, step = 1 }: { label: string, value: number, onChange: (val: number) => void, min?: number, step?: number }) => {

    const handleDecrement = () => {
        onChange(Math.max(min, value - step));
    };

    const handleIncrement = () => {
        onChange(value + step);
    };

    // 400ms delay before repeating, 100ms interval
    const decProps = useLongPress(handleDecrement, 400, 100);
    const incProps = useLongPress(handleIncrement, 400, 100);

    return (
        <div className="mb-3 last:mb-0">
            <div className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">{label}</div>
            <div className="flex items-center gap-2">
                <button
                    {...decProps}
                    className="w-8 h-8 rounded bg-slate-700 hover:bg-slate-600 text-slate-200 flex items-center justify-center transition-colors active:bg-emerald-600 select-none"
                >
                    <Minus size={14} />
                </button>
                <input
                    type="number"
                    value={value}
                    onChange={(e) => onChange(Number(e.target.value))}
                    className="flex-1 h-8 bg-slate-900 border border-slate-700 rounded text-center text-emerald-400 font-mono text-sm outline-none focus:border-emerald-500"
                />
                <button
                    {...incProps}
                    className="w-8 h-8 rounded bg-slate-700 hover:bg-slate-600 text-slate-200 flex items-center justify-center transition-colors active:bg-emerald-600 select-none"
                >
                    <Plus size={14} />
                </button>
            </div>
        </div>
    );
};

export const MiniEditor: React.FC<MiniEditorProps> = ({ part, dimensions, onChange, onClose }) => {

    // Helper to update specific field
    const update = (key: keyof DoorDimensions, val: number) => {
        onChange({ ...dimensions, [key]: val });
    };

    let title = '';
    let content = null;

    switch (part.type) {
        case 'stile':
            title = '縦框 (Stile)';
            content = (
                <Stepper label="見付幅 (Width)" value={dimensions.stileWidth} onChange={(v) => update('stileWidth', v)} min={20} step={10} />
            );
            break;
        case 'top-rail':
            title = '上桟 (Top Rail)';
            content = (
                <Stepper label="見付幅 (Width)" value={dimensions.topRailWidth} onChange={(v) => update('topRailWidth', v)} min={20} step={10} />
            );
            break;
        case 'bottom-rail':
            title = '下桟 (Bottom Rail)';
            content = (
                <Stepper label="見付幅 (Width)" value={dimensions.bottomRailWidth} onChange={(v) => update('bottomRailWidth', v)} min={20} step={10} />
            );
            break;
        case 'middle-rail':
            title = '中桟 (Middle Rail)';
            content = (
                <>
                    <Stepper label="本数 (Count)" value={dimensions.middleRailCount} onChange={(v) => update('middleRailCount', v)} min={0} step={1} />
                    <Stepper label="見付 (Width)" value={dimensions.middleRailWidth} onChange={(v) => update('middleRailWidth', v)} min={10} step={10} />
                    <Stepper label="高さ (Height)" value={dimensions.middleRailPosition || 0} onChange={(v) => update('middleRailPosition', v)} step={10} />
                    <div className="text-[10px] text-slate-500 mt-1">* 高さ 0 = 自動配置 (Auto)</div>
                </>
            );
            break;
        case 'kumiko-vert':
        case 'kumiko-horiz':
            title = '組子 (Kumiko)';
            content = (
                <>
                    <Stepper label="縦本数 (Vert Count)" value={dimensions.kumikoVertCount} onChange={(v) => update('kumikoVertCount', v)} min={0} step={1} />
                    <Stepper label="縦見付 (Vert Width)" value={dimensions.kumikoVertWidth} onChange={(v) => update('kumikoVertWidth', v)} min={1} step={1} />
                    <div className="h-px bg-slate-700/50 my-2"></div>
                    <Stepper label="横本数 (Horiz Count)" value={dimensions.kumikoHorizCount} onChange={(v) => update('kumikoHorizCount', v)} min={0} step={1} />
                    <Stepper label="横見付 (Horiz Width)" value={dimensions.kumikoHorizWidth} onChange={(v) => update('kumikoHorizWidth', v)} min={1} step={1} />
                </>
            );
            break;
        case 'tsuka':
            title = '束 (Tsuka/Mullion)';
            content = (
                <>
                    <Stepper label="本数 (Count)" value={dimensions.tsukaCount} onChange={(v) => update('tsukaCount', v)} min={0} step={1} />
                    <Stepper label="見付 (Width)" value={dimensions.tsukaWidth} onChange={(v) => update('tsukaWidth', v)} min={10} step={10} />
                </>
            );
            break;
        default:
            title = '詳細';
            content = <div className="text-sm text-slate-400">設定項目はありません</div>;
    }

    return (
        <div
            className="absolute top-4 right-4 z-40 w-64 bg-slate-800/95 backdrop-blur-md rounded-xl border border-slate-700 shadow-2xl overflow-hidden animate-in fade-in slide-in-from-right-4 duration-200"
            onClick={(e) => e.stopPropagation()}
        >
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700/50 bg-slate-800/50">
                <span className="font-bold text-sm text-emerald-100 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                    {title}
                </span>
                <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
                    <X size={16} />
                </button>
            </div>
            <div className="p-4 max-h-[70vh] overflow-y-auto">
                {content}
            </div>
        </div>
    );
};
