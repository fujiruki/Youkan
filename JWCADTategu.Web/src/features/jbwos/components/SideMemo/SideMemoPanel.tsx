import React, { useState } from 'react';
import { SideMemo } from '../../types';

interface SideMemoPanelProps {
    memos: SideMemo[];
    onAdd: (content: string) => void;
    onDelete: (id: string) => void;
    onMoveToInbox: (id: string) => void;
}

export const SideMemoPanel: React.FC<SideMemoPanelProps> = ({ memos, onAdd, onDelete, onMoveToInbox }) => {
    const [input, setInput] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (input.trim()) {
            onAdd(input);
            setInput('');
        }
    };

    return (
        <div className="fixed bottom-4 right-4 w-64 bg-white/90 backdrop-blur-sm border border-gray-200 rounded-lg shadow-lg flex flex-col max-h-96 overflow-hidden z-50">
            {/* Header */}
            <div className="bg-gray-100 p-2 text-xs font-bold text-gray-500 border-b border-gray-200 flex justify-between items-center">
                <span>Side Memo (忘れる場所)</span>
                <span className="bg-gray-200 px-1.5 rounded-full text-[10px]">{memos.length}</span>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto p-2 space-y-2">
                {memos.length === 0 && (
                    <div className="text-center py-4 text-xs text-gray-400">
                        なし
                    </div>
                )}
                {memos.map(memo => (
                    <div key={memo.id} className="group relative bg-white border border-gray-100 p-2 rounded hover:shadow-sm text-sm">
                        <div className="pr-6 break-words">{memo.content}</div>

                        {/* Actions (Hover) */}
                        <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity flex space-x-1">
                            <button
                                onClick={() => onMoveToInbox(memo.id)}
                                className="text-blue-400 hover:text-blue-600 p-0.5"
                                title="Inboxへ移動"
                            >
                                📥
                            </button>
                            <button
                                onClick={() => onDelete(memo.id)}
                                className="text-gray-300 hover:text-red-500 p-0.5"
                                title="削除"
                            >
                                ×
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            {/* Input */}
            <form onSubmit={handleSubmit} className="p-2 border-t border-gray-100 bg-gray-50">
                <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="ここに吐き出す..."
                    className="w-full text-xs p-1.5 border border-gray-300 rounded focus:outline-none focus:border-blue-400 bg-white"
                />
            </form>
        </div>
    );
};
