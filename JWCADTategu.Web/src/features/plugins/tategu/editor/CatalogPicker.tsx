import React, { useEffect, useState } from 'react';
import { CatalogItem } from '../domain/DoorSpecs';
import { CatalogService } from '../domain/CatalogService';
import { Search } from 'lucide-react';

interface CatalogPickerProps {
    onSelect: (item: CatalogItem) => void;
    onCancel: () => void;
}

export const CatalogPicker: React.FC<CatalogPickerProps> = ({ onSelect, onCancel }) => {
    const [items, setItems] = useState<CatalogItem[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [loading, setLoading] = useState(true);

    const loadItems = async () => {
        setLoading(true);
        const data = await CatalogService.search(searchQuery);
        setItems(data);
        setLoading(false);
    };

    useEffect(() => {
        loadItems();
    }, [searchQuery]);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-8">
            <div className="bg-slate-900 border border-slate-700 w-full max-w-5xl h-[80vh] rounded-xl shadow-2xl flex flex-col overflow-hidden">
                {/* Header */}
                <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950">
                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                        カタログから選択 (Select from Catalog)
                    </h2>
                    <button onClick={onCancel} className="text-slate-400 hover:text-white px-2">Close</button>
                </div>

                {/* Search */}
                <div className="p-4 bg-slate-900 border-b border-slate-800">
                    <div className="flex items-center gap-2 bg-slate-800 px-3 py-2 rounded-lg border border-slate-700 focus-within:border-emerald-500 transition-colors max-w-md">
                        <Search size={18} className="text-slate-500" />
                        <input
                            type="text"
                            placeholder="Search by name, category, or keyword..."
                            className="bg-transparent border-none outline-none text-sm w-full placeholder-slate-500 text-white"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            autoFocus
                        />
                    </div>
                </div>

                {/* Grid */}
                <div className="flex-1 overflow-y-auto p-6 bg-slate-950">
                    {loading ? (
                        <div className="text-center text-slate-500 mt-20">Loading...</div>
                    ) : items.length === 0 ? (
                        <div className="text-center text-slate-500 mt-20">
                            <p>No templates found.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                            {items.map(item => (
                                <div
                                    key={item.id}
                                    className="group relative bg-slate-900 border border-slate-800 rounded-lg overflow-hidden hover:border-emerald-500 hover:shadow-lg transition-all cursor-pointer"
                                    onClick={() => onSelect(item)}
                                >
                                    {/* Thumbnail */}
                                    <div className="aspect-[3/4] bg-black p-2 relative">
                                        {item.thumbnail ? (
                                            <img src={item.thumbnail} alt={item.name} className="w-full h-full object-contain" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-slate-700">No Image</div>
                                        )}
                                        {/* Hover Overlay */}
                                        <div className="absolute inset-0 bg-emerald-500/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                                    </div>

                                    {/* Info */}
                                    <div className="p-3">
                                        <div className="flex justify-between items-center mb-1">
                                            <span className="text-[10px] uppercase bg-slate-800 px-1.5 py-0.5 rounded text-slate-400 border border-slate-700">{item.category}</span>
                                        </div>
                                        <h3 className="font-bold text-slate-200 text-sm truncate">{item.name}</h3>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
