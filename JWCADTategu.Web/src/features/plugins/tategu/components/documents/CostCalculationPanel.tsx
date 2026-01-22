import React, { useState, useEffect } from 'react';
import { Plus, Trash2, RefreshCw } from 'lucide-react';
import { DocumentItem, CostDetail } from '../../domain/ManufacturingTypes';
import { WoodCalculatorModal } from './WoodCalculatorModal';

interface CostCalculationPanelProps {
    item: DocumentItem;
    onUpdate: (updates: Partial<DocumentItem>) => void;
}

export const CostCalculationPanel: React.FC<CostCalculationPanelProps> = ({ item, onUpdate }) => {
    const [detail, setDetail] = useState<CostDetail>(item.costDetail || { materials: [], laborCost: 0, laborHours: 0, markupRate: 1.3 });
    const [isCalculatorOpen, setIsCalculatorOpen] = useState(false);

    useEffect(() => {
        setDetail(item.costDetail || { materials: [], laborCost: 0, laborHours: 0, markupRate: 1.3 });
    }, [item]);

    // Recalculate totals whenever detail changes, but only commit on explicit save/update?
    // No, live update is better for UI, but "Commit to Sell Price" should be explicit logic?
    // User requirement: "Price doesn't change automatically unless requested".
    // So we calculate "Calculated Price" but don't overwrite "Unit Price" (= Manual Price) immediately?
    // Let's calculate total cost and suggested price.

    const totalMaterialCost = detail.materials?.reduce((sum, m) => sum + m.cost, 0) || 0;
    const totalCost = totalMaterialCost + (detail.laborCost || 0) + (detail.otherCost || 0);
    const calculatedPrice = Math.floor(totalCost * (detail.markupRate || 1.0));

    // Commit changes to parent (Item)
    const updateDetail = (newDetail: CostDetail) => {
        setDetail(newDetail);
        // We update the costDetail field, but NOT the item.unitPrice yet
        onUpdate({
            costDetail: newDetail
        });
    };

    const handleApplyPrice = () => {
        // Explicitly set item.unitPrice to calculatedPrice
        onUpdate({
            costDetail: { ...detail, calculatedPrice, manualPrice: calculatedPrice },
            unitPrice: calculatedPrice
        });
    };

    const addMaterial = (res: { cost: number; volume: number; description: string; dimensions: string }) => {
        const newMaterials = [
            ...(detail.materials || []),
            {
                name: res.description,
                dimensions: res.dimensions,
                volume: res.volume,
                unitPrice: 0, // Calculated from volume, so unit price per item is obscure, just cost
                cost: res.cost
            }
        ];
        updateDetail({ ...detail, materials: newMaterials });
    };

    const removeMaterial = (index: number) => {
        const newMaterials = [...(detail.materials || [])];
        newMaterials.splice(index, 1);
        updateDetail({ ...detail, materials: newMaterials });
    };

    return (
        <div className="h-full flex flex-col bg-slate-50 dark:bg-slate-900/50 border-l border-slate-200 dark:border-slate-800">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 font-bold text-slate-700 dark:text-slate-300">
                原価積算・売価計算
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-6">

                {/* 1. Materials */}
                <div>
                    <div className="flex justify-between items-center mb-2">
                        <h4 className="text-sm font-bold text-slate-600 dark:text-slate-400">材料費</h4>
                        <button
                            onClick={() => setIsCalculatorOpen(true)}
                            className="text-xs flex items-center gap-1 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 px-2 py-1 rounded hover:bg-slate-50"
                        >
                            <Plus size={12} /> 木材計算
                        </button>
                    </div>
                    <div className="space-y-2">
                        {detail.materials?.map((m, idx) => (
                            <div key={idx} className="flex justify-between items-center text-sm bg-white dark:bg-slate-800 p-2 rounded border border-slate-100 dark:border-slate-700">
                                <div>
                                    <div className="font-medium">{m.name}</div>
                                    <div className="text-xs text-slate-400">{m.dimensions}</div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span>¥{m.cost.toLocaleString()}</span>
                                    <button onClick={() => removeMaterial(idx)} className="text-slate-400 hover:text-red-500">
                                        <Trash2 size={12} />
                                    </button>
                                </div>
                            </div>
                        ))}
                        {(!detail.materials || detail.materials.length === 0) && (
                            <div className="text-xs text-slate-400 text-center py-2">材料なし</div>
                        )}
                        <div className="text-right text-sm font-bold mt-2">
                            小計: ¥{totalMaterialCost.toLocaleString()}
                        </div>
                    </div>
                </div>

                {/* 2. Labor & Others */}
                <div className="space-y-3">
                    <h4 className="text-sm font-bold text-slate-600 dark:text-slate-400">労務・その他</h4>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-xs text-slate-500">労務費</label>
                            <input
                                type="number"
                                value={detail.laborCost || 0}
                                onChange={e => updateDetail({ ...detail, laborCost: Number(e.target.value) })}
                                className="w-full p-1 border rounded text-right"
                            />
                        </div>
                        <div>
                            <label className="text-xs text-slate-500">時間 (h)</label>
                            <input
                                type="number"
                                value={detail.laborHours || 0}
                                onChange={e => updateDetail({ ...detail, laborHours: Number(e.target.value) })}
                                className="w-full p-1 border rounded text-right"
                            />
                        </div>
                        <div className="col-span-2">
                            <label className="text-xs text-slate-500">その他経費</label>
                            <input
                                type="number"
                                value={detail.otherCost || 0}
                                onChange={e => updateDetail({ ...detail, otherCost: Number(e.target.value) })}
                                className="w-full p-1 border rounded text-right"
                            />
                        </div>
                    </div>
                </div>

                <div className="border-t border-slate-200 dark:border-slate-700 pt-4">
                    <div className="flex justify-between text-sm mb-2">
                        <span>原価合計</span>
                        <span className="font-bold">¥{totalCost.toLocaleString()}</span>
                    </div>
                </div>

                {/* 3. Markup & Price */}
                <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl space-y-3 border border-blue-100 dark:border-blue-800">
                    <div>
                        <label className="text-xs font-bold text-blue-800 dark:text-blue-300">掛率 (Markup)</label>
                        <div className="flex items-center gap-2">
                            <input
                                type="number" step="0.1"
                                value={detail.markupRate || 1.3}
                                onChange={e => updateDetail({ ...detail, markupRate: Number(e.target.value) })}
                                className="w-20 p-1 border rounded text-right font-bold"
                            />
                            <span className="text-xs text-slate-500">x 原価</span>
                        </div>
                    </div>

                    <div className="flex justify-between items-center pt-2 border-t border-blue-200 dark:border-blue-700">
                        <div className="text-xs text-slate-500">算出売価</div>
                        <div className="text-lg font-bold text-slate-700 dark:text-slate-200">
                            ¥{calculatedPrice.toLocaleString()}
                        </div>
                    </div>

                    <div className="flex justify-between items-center">
                        <div className="text-xs text-slate-500">現在売価 (Manual)</div>
                        <div className="text-lg font-bold text-blue-700 dark:text-blue-300">
                            ¥{item.unitPrice.toLocaleString()}
                        </div>
                    </div>

                    <button
                        onClick={handleApplyPrice}
                        className="w-full mt-2 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg text-sm font-medium transition-colors"
                    >
                        <RefreshCw size={14} />
                        算出売価を適用
                    </button>
                    <p className="text-[10px] text-slate-500 text-center">
                        ※「適用」を押すまで見積金額は更新されません
                    </p>
                </div>
            </div>

            <WoodCalculatorModal
                isOpen={isCalculatorOpen}
                onClose={() => setIsCalculatorOpen(false)}
                onConfirm={addMaterial}
            />
        </div>
    );
};
