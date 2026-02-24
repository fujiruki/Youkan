import React, { useRef, useState } from 'react';
import { ApiClient } from '../../../../../api/client';
import { Download, Upload, AlertTriangle, X, CheckCircle2, FileJson } from 'lucide-react';
import { cn } from '../../../../../lib/utils';

interface Props {
    onClose: () => void;
}

export const ItemsBackupSettings: React.FC<Props> = ({ onClose }) => {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isRestoring, setIsRestoring] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    const handleDownload = () => {
        const url = ApiClient.getItemsBackupUrl();
        const a = document.createElement('a');
        a.href = url;
        a.download = '';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    };

    const handleRestoreClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!window.confirm('【確認】\nJSONファイルからアイテムをインポートします。\n既存のデータは削除されず、新規アイテムとして追加されます。\nよろしいですか？')) {
            if (fileInputRef.current) fileInputRef.current.value = '';
            return;
        }

        setIsRestoring(true);
        setMessage(null);

        try {
            const result = await ApiClient.restoreItems(file);
            setMessage({ type: 'success', text: result.message || `${result.imported}件のアイテムをインポートしました。` });
        } catch (error: any) {
            console.error(error);
            setMessage({ type: 'error', text: 'インポートに失敗しました: ' + (error.message || 'Unknown error') });
        } finally {
            setIsRestoring(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-slate-950 dark:to-indigo-950">
                    <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                        <FileJson size={20} className="text-blue-600" />
                        アイテムデータのバックアップ
                    </h2>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 space-y-6">
                    {/* Info */}
                    <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/30 rounded-lg p-3 text-xs text-blue-700 dark:text-blue-300">
                        あなたのアイテムをJSON形式でエクスポート/インポートします。
                        他のデバイスへの移行やバックアップにご利用ください。
                    </div>

                    {/* Download Section */}
                    <div>
                        <h3 className="text-sm font-bold text-slate-600 dark:text-slate-400 mb-2 flex items-center gap-2">
                            <Download size={16} />
                            エクスポート (ダウンロード)
                        </h3>
                        <button
                            onClick={handleDownload}
                            className="w-full py-3 bg-blue-500 text-white rounded-xl font-bold hover:bg-blue-600 transition-colors flex items-center justify-center gap-2 shadow-md"
                        >
                            <Download size={18} />
                            JSONファイルをダウンロード
                        </button>
                    </div>

                    <div className="h-px bg-slate-100 dark:bg-slate-800" />

                    {/* Import Section */}
                    <div>
                        <h3 className="text-sm font-bold text-slate-600 dark:text-slate-400 mb-2 flex items-center gap-2">
                            <Upload size={16} />
                            インポート (追加)
                        </h3>
                        <p className="text-xs text-slate-400 mb-3">
                            JSONファイルをインポートすると、新規アイテムとして追加されます（既存データは削除されません）。
                        </p>

                        <input
                            type="file"
                            accept=".json"
                            ref={fileInputRef}
                            className="hidden"
                            onChange={handleFileChange}
                        />

                        <button
                            onClick={handleRestoreClick}
                            disabled={isRestoring}
                            className={cn(
                                "w-full py-3 bg-white text-blue-600 dark:bg-transparent dark:text-blue-400 rounded-xl font-bold border-2 border-dashed border-blue-200 dark:border-blue-800 hover:border-blue-400 dark:hover:border-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/10 transition-colors flex items-center justify-center gap-2",
                                isRestoring && "opacity-50 cursor-wait"
                            )}
                        >
                            {isRestoring ? (
                                <>処理中...</>
                            ) : (
                                <>
                                    <Upload size={18} />
                                    JSONファイルを選択
                                </>
                            )}
                        </button>
                    </div>

                    {/* Message Toast */}
                    {message && (
                        <div className={cn(
                            "p-4 rounded-xl flex items-center gap-3 animate-in slide-in-from-bottom-2",
                            message.type === 'success' ? "bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-400" : "bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400"
                        )}>
                            {message.type === 'success' ? <CheckCircle2 size={20} /> : <AlertTriangle size={20} />}
                            <span className="text-sm font-bold">{message.text}</span>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
