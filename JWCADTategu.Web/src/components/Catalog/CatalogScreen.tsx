import React, { useEffect, useState } from 'react';
import { CatalogItem } from '../../domain/DoorSpecs';
import { CatalogService } from '../../domain/CatalogService';
import { Search, Trash2 } from 'lucide-react';
// import { db } from '../../db/db';

interface CatalogScreenProps {
    onBack: () => void;
    onSelectTemplate?: (item: CatalogItem) => void; // Template selection mode
}

export const CatalogScreen: React.FC<CatalogScreenProps> = ({ onBack, onSelectTemplate }) => {
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

    const handleDelete = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (confirm('Are you sure you want to delete this template?')) {
            await CatalogService.delete(id);
            loadItems();
        }
    };

    return (
        <div className="flex flex-col h-full bg-slate-950 text-slate-200">
            {/* Header */}
            <header className="h-16 border-b border-slate-800 flex items-center justify-between px-6 bg-slate-900">
                <div className="flex items-center gap-4">
                    <button onClick={onBack} className="text-slate-400 hover:text-white">Back</button>
                    <h1 className="text-xl font-bold bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent">
                        My Catalog
                    </h1>
                </div>

                {/* Search Bar */}
                <div className="flex items-center gap-2 bg-slate-800 px-3 py-2 rounded-full w-96 border border-slate-700 focus-within:border-emerald-500 transition-colors">
                    <Search size={18} className="text-slate-500" />
                    <input
                        type="text"
                        placeholder="Search templates..."
                        className="bg-transparent border-none outline-none text-sm w-full placeholder-slate-500"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
            </header>

            {/* Grid Content */}
            <div className="flex-1 overflow-y-auto p-8">
                {loading ? (
                    <div className="text-center text-slate-500 mt-20">Loading...</div>
                ) : items.length === 0 ? (
                    <div className="text-center text-slate-500 mt-20">
                        <p>No templates found.</p>
                        <p className="text-xs mt-2">Create a door in the Editor and save it to Catalog.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        {items.map(item => (
                            <div
                                key={item.id}
                                className="group relative bg-slate-900 border border-slate-800 rounded-xl overflow-hidden hover:border-emerald-500/50 hover:shadow-lg hover:shadow-emerald-900/10 transition-all cursor-pointer"
                                onClick={() => onSelectTemplate?.(item)}
                            >
                                {/* Thumbnail */}
                                <div className="aspect-[3/4] bg-slate-950 relative">
                                    {item.thumbnail ? (
                                        <img src={item.thumbnail} alt={item.name} className="w-full h-full object-contain p-4" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-slate-700">No Image</div>
                                    )}

                                    {/* Overlay Actions */}
                                    <div className="absolute top-2 right-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button
                                            onClick={(e) => handleDelete(item.id, e)}
                                            className="p-2 bg-slate-900/80 rounded-full text-red-400 hover:text-red-300 hover:bg-red-900/50 backdrop-blur-sm"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </div>

                                {/* Info */}
                                <div className="p-4 border-t border-slate-800">
                                    <div className="flex justify-between items-start mb-1">
                                        <h3 className="font-bold text-slate-200 truncate pr-2">{item.name}</h3>
                                        <span className="text-[10px] uppercase bg-slate-800 px-2 py-0.5 rounded text-slate-400">{item.category}</span>
                                    </div>
                                    <div className="flex flex-wrap gap-1 mt-2">
                                        {item.keywords?.map(tag => (
                                            <span key={tag} className="text-[10px] text-slate-500 bg-slate-900 px-1.5 rounded-sm border border-slate-800">#{tag}</span>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};
