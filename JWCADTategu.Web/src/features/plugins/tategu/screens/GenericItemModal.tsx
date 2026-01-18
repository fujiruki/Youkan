import React, { useState, useEffect } from 'react';
import { Door } from '../../../../db/db';
import { ShoppingBag, Box, Hexagon, Wrench, X } from 'lucide-react';
import clsx from 'clsx';

interface GenericItemModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (item: Partial<Door>) => void;
    item?: Door | null;
    projectId: number;
}

export const GenericItemModal: React.FC<GenericItemModalProps> = ({ isOpen, onClose, onSave, item, projectId }) => {
    const [name, setName] = useState('');
    const [category, setCategory] = useState<'frame' | 'furniture' | 'hardware' | 'other'>('frame');
    const [width, setWidth] = useState(0);
    const [height, setHeight] = useState(0);
    const [depth, setDepth] = useState(0);
    const [count, setCount] = useState(1);
    const [unitPrice, setUnitPrice] = useState(0);
    const [unit, setUnit] = useState('式');
    const [note, setNote] = useState('');

    useEffect(() => {
        if (isOpen) {
            if (item) {
                setName(item.name);
                setCategory((item.category as any) || 'other');
                setWidth(item.dimensions.width);
                setHeight(item.dimensions.height);
                setDepth(item.dimensions.depth);
                setCount(item.count);
                // For generic items, price might be stored differently in future, but for now we assume it's calculated or stored in a generic spec
                // Let's assume genericSpecs has unit, and we use a simple calculation or field for price
                setUnit(item.genericSpecs?.unit || '式');
                setNote(item.genericSpecs?.note || '');
                // Cost handling is complex, for now we let users input Unit Price if we had a field, 
                // but Door table doesn't have explicit unitPrice field (it's calculated).
                // We might need to add one or abuse a spec field. 
                // Let's use `specs.unitPrice` for now.
                setUnitPrice(item.specs?.unitPrice || 0);
            } else {
                // Default new item
                setName('');
                setCategory('frame');
                setWidth(0);
                setHeight(0);
                setDepth(0);
                setCount(1);
                setUnitPrice(0);
                setUnit('式');
                setNote('');
            }
        }
    }, [isOpen, item]);

    const handleSave = () => {
        const newItem: Partial<Door> = {
            projectId,
            name: name || '名称未設定',
            category: category,
            tag: item?.tag || 'GEN-?', // Tag generation should be handled by parent or here
            count,
            dimensions: {
                width, height, depth,
                // Zero out irrelevant fields
                stileWidth: 0, topRailWidth: 0, bottomRailWidth: 0,
                middleRailCount: 0, middleRailWidth: 0,
                tsukaCount: 0, tsukaWidth: 0,
                kumikoVertCount: 0, kumikoVertWidth: 0,
                kumikoHorizCount: 0, kumikoHorizWidth: 0
            },
            specs: {
                unitPrice: unitPrice // Store price in specs
            },
            genericSpecs: {
                unit,
                note
            },
            createdAt: item ? item.createdAt : new Date(),
            updatedAt: new Date()
        };

        if (item?.id) {
            newItem.id = item.id;
        }

        onSave(newItem);
        onClose();
    };

    if (!isOpen) return null;

    const categories = [
        { id: 'frame', label: '建具枠', icon: Box, color: 'text-amber-400' },
        { id: 'furniture', label: '造作家具', icon: ShoppingBag, color: 'text-indigo-400' },
        { id: 'hardware', label: '金物', icon: Hexagon, color: 'text-slate-400' },
        { id: 'other', label: 'その他', icon: Wrench, color: 'text-emerald-400' },
    ];

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
            <div className="bg-slate-900 border border-slate-700 w-full max-w-lg rounded-xl shadow-2xl flex flex-col max-h-[90vh]">

                {/* Header */}
                <div className="flex justify-between items-center p-4 border-b border-slate-800">
                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                        {item ? '製作物を編集' : '新しい製作物を追加'}
                    </h2>
                    <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
                        <X size={24} />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 space-y-6 overflow-y-auto">

                    {/* Category Selection */}
                    <div className="grid grid-cols-4 gap-2">
                        {categories.map((cat) => (
                            <button
                                key={cat.id}
                                onClick={() => setCategory(cat.id as any)}
                                className={clsx(
                                    "flex flex-col items-center gap-2 p-3 rounded-lg border transition-all",
                                    category === cat.id
                                        ? "bg-slate-800 border-emerald-500 ring-1 ring-emerald-500"
                                        : "bg-slate-900 border-slate-700 hover:bg-slate-800"
                                )}
                            >
                                <cat.icon className={cat.color} size={24} />
                                <span className={clsx("text-xs font-bold", category === cat.id ? "text-white" : "text-slate-400")}>
                                    {cat.label}
                                </span>
                            </button>
                        ))}
                    </div>

                    {/* Basic Info */}
                    <div className="space-y-4">
                        <div>
                            <label className="block text-xs text-slate-500 uppercase font-bold mb-1">品名 (Item Name)</label>
                            <input
                                value={name}
                                onChange={e => setName(e.target.value)}
                                placeholder="例: リビング入口 枠"
                                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white focus:border-emerald-500 outline-none"
                            />
                        </div>

                        <div className="grid grid-cols-3 gap-4">
                            <div>
                                <label className="block text-xs text-slate-500 uppercase font-bold mb-1">数量 (Count)</label>
                                <input
                                    type="number"
                                    value={count}
                                    onChange={e => setCount(Number(e.target.value))}
                                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-center focus:border-emerald-500 outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-xs text-slate-500 uppercase font-bold mb-1">単位 (Unit)</label>
                                <input
                                    value={unit}
                                    onChange={e => setUnit(e.target.value)}
                                    placeholder="式, 本..."
                                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-center focus:border-emerald-500 outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-xs text-slate-500 uppercase font-bold mb-1">単価 (Price)</label>
                                <input
                                    type="number"
                                    value={unitPrice}
                                    onChange={e => setUnitPrice(Number(e.target.value))}
                                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-right focus:border-emerald-500 outline-none"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-3 gap-4">
                            <div>
                                <label className="block text-xs text-slate-500 uppercase font-bold mb-1">幅 (W)</label>
                                <div className="relative">
                                    <input
                                        type="number"
                                        value={width}
                                        onChange={e => setWidth(Number(e.target.value))}
                                        className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-3 pr-8 py-2 text-white text-right focus:border-emerald-500 outline-none"
                                    />
                                    <span className="absolute right-3 top-2 text-slate-500 text-xs">mm</span>
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs text-slate-500 uppercase font-bold mb-1">高さ (H)</label>
                                <div className="relative">
                                    <input
                                        type="number"
                                        value={height}
                                        onChange={e => setHeight(Number(e.target.value))}
                                        className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-3 pr-8 py-2 text-white text-right focus:border-emerald-500 outline-none"
                                    />
                                    <span className="absolute right-3 top-2 text-slate-500 text-xs">mm</span>
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs text-slate-500 uppercase font-bold mb-1">奥行/見込 (D)</label>
                                <div className="relative">
                                    <input
                                        type="number"
                                        value={depth}
                                        onChange={e => setDepth(Number(e.target.value))}
                                        className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-3 pr-8 py-2 text-white text-right focus:border-emerald-500 outline-none"
                                    />
                                    <span className="absolute right-3 top-2 text-slate-500 text-xs">mm</span>
                                </div>
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs text-slate-500 uppercase font-bold mb-1">メモ (Memo)</label>
                            <textarea
                                value={note}
                                onChange={e => setNote(e.target.value)}
                                placeholder="仕様詳細や注意事項..."
                                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white focus:border-emerald-500 outline-none min-h-[80px]"
                            />
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-slate-800 flex justify-end gap-2 bg-slate-900/50">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors font-bold text-sm"
                    >
                        キャンセル
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={!name}
                        className="px-6 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white shadow-lg shadow-emerald-900/20 font-bold text-sm transition-all"
                    >
                        保存する
                    </button>
                </div>

            </div>
        </div>
    );
};
