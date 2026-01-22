import React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { DocumentItem } from '../../domain/ManufacturingTypes';

interface DocumentItemGridProps {
    items: DocumentItem[];
    onUpdateItems: (items: DocumentItem[]) => void;
    selectedItemId: string | null;
    onSelectItem: (item: DocumentItem) => void;
}

export const DocumentItemGrid: React.FC<DocumentItemGridProps> = ({
    items,
    onUpdateItems,
    selectedItemId,
    onSelectItem
}) => {
    const handleAddItem = () => {
        const newItem: DocumentItem = {
            id: `ditem_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            documentId: '', // Filled by parent or ignore
            tenantId: '', // Filled by parent
            name: '新規項目',
            quantity: 1,
            unitPrice: 0,
            position: items.length
        };
        onUpdateItems([...items, newItem]);
        onSelectItem(newItem);
    };

    const handleRemoveItem = (e: React.MouseEvent, index: number) => {
        e.stopPropagation();
        const newItems = [...items];
        newItems.splice(index, 1);
        onUpdateItems(newItems);
        if (selectedItemId === items[index].id) {
            onSelectItem(newItems[0] || null); // Select first or nothing
        }
    };

    const handleChange = (index: number, field: keyof DocumentItem, value: any) => {
        const newItems = [...items];
        newItems[index] = { ...newItems[index], [field]: value };
        onUpdateItems(newItems);
    };

    return (
        <div className="flex flex-col h-full bg-white dark:bg-slate-900 rounded-lg shadow-sm border border-slate-200 dark:border-slate-800">
            {/* Header */}
            <div className="flex justify-between items-center p-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
                <h3 className="font-bold text-slate-700 dark:text-slate-300 text-sm">明細一覧</h3>
                <button
                    onClick={handleAddItem}
                    className="flex items-center gap-1 text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg transition-colors"
                >
                    <Plus size={14} /> 行追加
                </button>
            </div>

            {/* Table Header */}
            <div className="grid grid-cols-12 gap-2 p-2 text-xs font-bold text-slate-500 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/20">
                <div className="col-span-6">品名</div>
                <div className="col-span-2 text-right">数量</div>
                <div className="col-span-3 text-right">単価</div>
                <div className="col-span-1"></div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto">
                {items.map((item, index) => (
                    <div
                        key={item.id}
                        onClick={() => onSelectItem(item)}
                        className={`grid grid-cols-12 gap-2 p-2 items-center border-b border-slate-100 dark:border-slate-800 cursor-pointer transition-colors ${selectedItemId === item.id
                                ? 'bg-blue-50 dark:bg-blue-900/20 ring-1 ring-inset ring-blue-500/30'
                                : 'hover:bg-slate-50 dark:hover:bg-slate-800'
                            }`}
                    >
                        <div className="col-span-6">
                            <input
                                type="text"
                                value={item.name}
                                onChange={e => handleChange(index, 'name', e.target.value)}
                                className="w-full bg-transparent border-none focus:ring-0 p-0 text-sm font-medium text-slate-800 dark:text-slate-200"
                                placeholder="品名を入力..."
                            />
                        </div>
                        <div className="col-span-2">
                            <input
                                type="number"
                                value={item.quantity}
                                onChange={e => handleChange(index, 'quantity', Number(e.target.value))}
                                className="w-full bg-transparent border-b border-transparent focus:border-blue-500 focus:ring-0 p-0 text-sm text-right font-mono"
                            />
                        </div>
                        <div className="col-span-3">
                            <input
                                type="number"
                                value={item.unitPrice}
                                onChange={e => handleChange(index, 'unitPrice', Number(e.target.value))}
                                className={`w-full bg-transparent border-b border-transparent focus:border-blue-500 focus:ring-0 p-0 text-sm text-right font-bold font-mono ${item.costDetail?.manualPrice && item.costDetail.manualPrice !== item.unitPrice
                                        ? 'text-amber-600 dark:text-amber-500' // Hint mismatch
                                        : 'text-slate-900 dark:text-white'
                                    }`}
                            />
                        </div>
                        <div className="col-span-1 flex justify-center">
                            <button
                                onClick={(e) => handleRemoveItem(e, index)}
                                className="text-slate-400 hover:text-red-500 p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                            >
                                <Trash2 size={14} />
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            {/* Footer / Total */}
            <div className="p-3 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 rounded-b-lg">
                <div className="flex justify-end items-center gap-4">
                    <span className="text-sm text-slate-500">合計金額 (税抜)</span>
                    <span className="text-xl font-bold text-slate-900 dark:text-white font-mono">
                        ¥{items.reduce((sum, item) => sum + (item.unitPrice * item.quantity), 0).toLocaleString()}
                    </span>
                </div>
            </div>
        </div>
    );
};
