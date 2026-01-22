import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Search, Filter } from 'lucide-react';
import { MasterItem, MasterCategory } from '../../domain/ManufacturingTypes';
import { ManufacturingService } from '../../services/ManufacturingService';
import { MasterItemEditor } from './MasterItemEditor';

export const MasterItemList: React.FC = () => {
    const [items, setItems] = useState<MasterItem[]>([]);
    const [category, setCategory] = useState<MasterCategory | 'all'>('all');
    const [searchTerm, setSearchTerm] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    // Editor State
    const [isEditorOpen, setIsEditorOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<MasterItem | null>(null);

    const loadItems = async () => {
        setIsLoading(true);
        try {
            const result = await ManufacturingService.getMasters(
                category === 'all' ? undefined : category
            );
            setItems(result);
        } catch (error) {
            console.error('Failed to load masters', error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadItems();
    }, [category]);

    const handleCreate = () => {
        setEditingItem(null);
        setIsEditorOpen(true);
    };

    const handleEdit = (item: MasterItem) => {
        setEditingItem(item);
        setIsEditorOpen(true);
    };

    const handleDelete = async (id: string) => {
        if (!confirm('本当に削除しますか？')) return;
        try {
            await ManufacturingService.deleteMaster(id);
            loadItems();
        } catch (error) {
            alert('削除に失敗しました');
        }
    };

    const handleSave = () => {
        loadItems();
    };

    // Filter by Search Term
    const filteredItems = items.filter(i =>
        i.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (i.supplier && i.supplier.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    return (
        <div className="w-full h-full flex flex-col bg-white dark:bg-slate-900">
            {/* Toolbar */}
            <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-4">
                    <h2 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
                        <span className="text-2xl">📦</span> マスタ管理
                    </h2>

                    {/* Category Filter */}
                    <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Filter size={14} className="text-slate-500" />
                        </div>
                        <select
                            value={category}
                            onChange={e => setCategory(e.target.value as any)}
                            className="pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="all">全カテゴリ</option>
                            <option value="material">材料</option>
                            <option value="hardware">金物</option>
                            <option value="labor">労務</option>
                            <option value="other">その他</option>
                        </select>
                    </div>

                    {/* Search */}
                    <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Search size={14} className="text-slate-500" />
                        </div>
                        <input
                            type="text"
                            placeholder="検索..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 w-48"
                        />
                    </div>
                </div>

                <button
                    onClick={handleCreate}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-sm transition-colors text-sm font-medium"
                >
                    <Plus size={16} />
                    新規登録
                </button>
            </div>

            {/* List */}
            <div className="flex-1 overflow-auto p-4">
                {isLoading ? (
                    <div className="flex items-center justify-center h-40 text-slate-500">
                        読み込み中...
                    </div>
                ) : filteredItems.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-64 text-slate-400 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 m-4">
                        <div className="text-4xl mb-2">🍃</div>
                        <p>アイテムが見つかりません</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {filteredItems.map(item => (
                            <div key={item.id} className="group bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 hover:shadow-md transition-shadow relative">
                                <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button onClick={() => handleEdit(item)} className="p-1.5 text-slate-500 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors">
                                        <Edit2 size={16} />
                                    </button>
                                    <button onClick={() => handleDelete(item.id)} className="p-1.5 text-slate-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors">
                                        <Trash2 size={16} />
                                    </button>
                                </div>

                                <div className="flex items-start gap-4">
                                    {/* Image or Icon */}
                                    <div className="w-16 h-16 bg-slate-100 dark:bg-slate-900 rounded-lg flex items-center justify-center shrink-0 overflow-hidden border border-slate-100 dark:border-slate-700">
                                        {item.imageUrl ? (
                                            <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
                                        ) : (
                                            <span className="text-2xl opacity-50">
                                                {item.category === 'material' ? '🪵' : item.category === 'hardware' ? '🔩' : '📦'}
                                            </span>
                                        )}
                                    </div>

                                    <div>
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className={`px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide rounded-full border 
                                                ${item.category === 'material' ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800' :
                                                    item.category === 'hardware' ? 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:border-slate-600' :
                                                        'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800'}`}>
                                                {item.category}
                                            </span>
                                        </div>
                                        <h3 className="font-bold text-slate-800 dark:text-slate-100 leading-tight mb-1">{item.name}</h3>
                                        <div className="text-sm font-mono text-slate-600 dark:text-slate-400">
                                            ¥{item.unitPrice.toLocaleString()}
                                        </div>
                                        {item.supplier && (
                                            <div className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                                                <span>🏢</span> {item.supplier}
                                            </div>
                                        )}
                                        {item.specs && (
                                            <div className="text-xs text-slate-400 mt-1">
                                                {item.specs.length}x{item.specs.width}x{item.specs.thickness}mm
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <MasterItemEditor
                isOpen={isEditorOpen}
                onClose={() => setIsEditorOpen(false)}
                onSave={handleSave}
                initialItem={editingItem}
            />
        </div>
    );
};
