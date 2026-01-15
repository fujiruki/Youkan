import React, { useRef, useState } from 'react';
import { ApiClient } from '../../../../api/client';
import { Download, Upload, AlertTriangle, X, CheckCircle2 } from 'lucide-react';
import { cn } from '../../../../lib/utils'; // Assuming this utility exists

interface Props {
    onClose: () => void;
}

export const BackupSettings: React.FC<Props> = ({ onClose }) => {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isRestoring, setIsRestoring] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    const handleDownload = () => {
        // Direct link to download
        const url = ApiClient.getBackupUrl();
        // Create anchor and click
        const a = document.createElement('a');
        a.href = url;
        a.download = ''; // Browser handles filename
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    };

    const handleRestoreClick = () => {
        // Trigger file input
        fileInputRef.current?.click();
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Confirmation (Native confirm for simplicity, or we can build a proper step)
        if (!window.confirm('【警告】\n現在のデータベースはすべて上書きされ、失われます。\n本当によろしいですか？\n(安全のため、先にバックアップをダウンロードすることをお勧めします)')) {
            // Reset input
            if (fileInputRef.current) fileInputRef.current.value = '';
            return;
        }

        setIsRestoring(true);
        setMessage(null);

        try {
            await ApiClient.restoreDatabase(file);
            setMessage({ type: 'success', text: '復元が完了しました。ページをリロードします。' });
            setTimeout(() => {
                window.location.reload();
            }, 2000);
        } catch (error: any) {
            console.error(error);
            setMessage({ type: 'error', text: '復元に失敗しました: ' + (error.message || 'Unknown error') });
        } finally {
            setIsRestoring(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-950">
                    <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                        システム移行・バックアップ
                    </h2>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 space-y-8">
                    {/* Download Section */}
                    <div>
                        <h3 className="text-sm font-bold text-slate-600 dark:text-slate-400 mb-2 flex items-center gap-2">
                            <Download size={16} />
                            現在のデータを保存 (エクスポート)
                        </h3>
                        <p className="text-xs text-slate-400 mb-4">
                            現在のシステムの状態をファイルとしてダウンロードします。
                            定期的なバックアップや、別の環境への移行にお使いください。
                        </p>
                        <button
                            onClick={handleDownload}
                            className="w-full py-3 bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400 rounded-xl font-bold border border-blue-200 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors flex items-center justify-center gap-2"
                        >
                            <Download size={20} />
                            バックアップをダウンロード
                        </button>
                    </div>

                    <div className="h-px bg-slate-100 dark:bg-slate-800" />

                    {/* Restore Section */}
                    <div>
                        <h3 className="text-sm font-bold text-slate-600 dark:text-slate-400 mb-2 flex items-center gap-2 text-red-600 dark:text-red-400">
                            <Upload size={16} />
                            データを復元 (インポート)
                        </h3>
                        <div className="bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/30 rounded-lg p-3 mb-4 flex items-start gap-3">
                            <AlertTriangle size={16} className="text-red-500 shrink-0 mt-0.5" />
                            <p className="text-xs text-red-600 dark:text-red-400">
                                <strong>注意:</strong> ファイルを読み込むと、現在のデータは全て上書きされます。元に戻すことはできません。
                            </p>
                        </div>

                        <input
                            type="file"
                            accept=".sqlite"
                            ref={fileInputRef}
                            className="hidden"
                            onChange={handleFileChange}
                        />

                        <button
                            onClick={handleRestoreClick}
                            disabled={isRestoring}
                            className={cn(
                                "w-full py-3 bg-white text-red-600 dark:bg-transparent dark:text-red-400 rounded-xl font-bold border-2 border-dashed border-red-200 dark:border-red-900 hover:border-red-400 dark:hover:border-red-700 hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors flex items-center justify-center gap-2",
                                isRestoring && "opacity-50 cursor-wait"
                            )}
                        >
                            {isRestoring ? (
                                <>処理中...</>
                            ) : (
                                <>
                                    <Upload size={20} />
                                    バックアップから復元
                                </>
                            )}
                        </button>
                    </div>

                    {/* Message Toast (Inline) */}
                    {message && (
                        <div className={cn(
                            "p-4 rounded-xl flex items-center gap-3 animate-in slide-in-from-bottom-2",
                            message.type === 'success' ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
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
