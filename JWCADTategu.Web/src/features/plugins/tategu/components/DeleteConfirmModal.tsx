import React, { useState } from 'react';
import { AlertTriangle, Trash2 } from 'lucide-react';

interface DeleteConfirmModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (deleteTasks: boolean) => void;
    itemName: string;
    relatedTaskCount: number;
}

export const DeleteConfirmModal: React.FC<DeleteConfirmModalProps> = ({
    isOpen,
    onClose,
    onConfirm,
    itemName,
    relatedTaskCount
}) => {
    const [deleteTasks, setDeleteTasks] = useState(false);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-slate-900 border border-slate-700 rounded-lg shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="bg-red-500/10 border-b border-red-500/20 p-4 flex items-center gap-3">
                    <div className="p-2 bg-red-500/20 rounded-full text-red-500">
                        <AlertTriangle size={24} />
                    </div>
                    <h2 className="text-lg font-bold text-red-400">削除の確認</h2>
                </div>

                {/* Body */}
                <div className="p-6">
                    <p className="text-slate-300 mb-4">
                        <span className="font-bold text-white">{itemName}</span> を削除してもよろしいですか？
                        <br />
                        <span className="text-sm text-slate-400">この操作は取り消すことができません。</span>
                    </p>

                    {relatedTaskCount > 0 && (
                        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-3">
                            <label className="flex items-start gap-3 cursor-pointer group">
                                <input
                                    type="checkbox"
                                    checked={deleteTasks}
                                    onChange={(e) => setDeleteTasks(e.target.checked)}
                                    className="mt-1 w-4 h-4 rounded border-slate-600 bg-slate-700 text-red-500 focus:ring-red-500/50"
                                />
                                <div className="flex-1">
                                    <span className="text-slate-200 font-medium group-hover:text-white transition-colors">
                                        関連するタスクも削除する
                                    </span>
                                    <p className="text-xs text-slate-500 mt-1">
                                        このアイテムに関連付けられた <strong>{relatedTaskCount}件</strong> のタスクが同時に削除されます。
                                    </p>
                                </div>
                            </label>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="bg-slate-800/50 p-4 flex justify-end gap-3 border-t border-slate-800">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 rounded-md text-slate-400 hover:text-white hover:bg-slate-700 transition-colors text-sm font-medium"
                    >
                        キャンセル
                    </button>
                    <button
                        onClick={() => onConfirm(deleteTasks)}
                        className="px-4 py-2 rounded-md bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-500/20 flex items-center gap-2 text-sm font-bold transition-all"
                    >
                        <Trash2 size={16} />
                        削除を実行
                    </button>
                </div>
            </div>
        </div>
    );
};
