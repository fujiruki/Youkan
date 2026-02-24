import React, { useState, useEffect } from 'react';
import { Trash2, Plus, MessageSquare } from 'lucide-react';
import { ApiClient } from '../../../../../api/client';

interface SideMemo {
    id: string;
    content: string;
    created_at: number;
}

export const SideMemoWidget = () => {
    const [memos, setMemos] = useState<SideMemo[]>([]);
    const [newMemo, setNewMemo] = useState('');
    const [isOpen, setIsOpen] = useState(false);

    const fetchMemos = async () => {
        try {
            const data = await ApiClient.getMemos();
            setMemos(data || []);
        } catch (e) {
            console.error(e);
        }
    };

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newMemo.trim()) return;

        try {
            await ApiClient.createMemo(newMemo);
            setNewMemo('');
            fetchMemos();
        } catch (e) {
            console.error(e);
        }
    };

    const handleDelete = async (id: string) => {
        try {
            await ApiClient.deleteMemo(id);
            fetchMemos();
        } catch (e) {
            console.error(e);
        }
    };

    useEffect(() => {
        if (isOpen) {
            fetchMemos();
        }
    }, [isOpen]);

    return (
        <div className={`fixed right-4 bottom-4 z-50 transition-all duration-300 ${isOpen ? 'w-80' : 'w-auto'}`}>
            {/* Toggle Button */}
            {!isOpen && (
                <button
                    onClick={() => setIsOpen(true)}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white p-3 rounded-full shadow-lg transition-transform hover:scale-110"
                    title="一時メモを開く"
                >
                    <MessageSquare size={24} />
                </button>
            )}

            {/* Panel */}
            {isOpen && (
                <div className="bg-white border border-slate-200 rounded-2xl shadow-xl flex flex-col max-h-[500px] overflow-hidden">
                    <div className="p-3 bg-indigo-50 border-b border-indigo-100 flex justify-between items-center">
                        <h3 className="text-sm font-bold text-indigo-800 flex items-center gap-2">
                            <MessageSquare size={14} /> 一時メモ
                        </h3>
                        <button
                            onClick={() => setIsOpen(false)}
                            className="text-indigo-400 hover:text-indigo-600 px-2"
                        >
                            ×
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50">
                        {memos.length === 0 ? (
                            <p className="text-xs text-slate-400 text-center py-4">メモはありません。</p>
                        ) : (
                            memos.map(memo => (
                                <div key={memo.id} className="bg-white p-3 rounded shadow-sm border border-slate-100 group relative">
                                    <p className="text-sm text-slate-700 whitespace-pre-wrap">{memo.content}</p>
                                    <button
                                        onClick={() => handleDelete(memo.id)}
                                        className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 text-slate-300 hover:text-rose-500 transition-all p-1"
                                    >
                                        <Trash2 size={12} />
                                    </button>
                                </div>
                            ))
                        )}
                    </div>

                    <form onSubmit={handleCreate} className="p-3 border-t border-slate-200 bg-white">
                        <div className="relative">
                            <input
                                type="text"
                                value={newMemo}
                                onChange={(e) => setNewMemo(e.target.value)}
                                placeholder="メモを入力..."
                                className="w-full pl-3 pr-8 py-2 bg-slate-100 border-none rounded-lg text-sm focus:ring-2 focus:ring-indigo-100"
                            />
                            <button
                                type="submit"
                                disabled={!newMemo.trim()}
                                className="absolute right-1 top-1/2 -translate-y-1/2 p-1 text-indigo-500 hover:bg-indigo-50 rounded"
                            >
                                <Plus size={16} />
                            </button>
                        </div>
                    </form>
                </div>
            )}
        </div>
    );
};
