import React, { useState } from 'react';
import { KeyRound } from 'lucide-react';
import { format } from 'date-fns';
import { useApiTokens } from '../../hooks/useApiTokens';

const formatDay = (epochSec: number | null): string => (epochSec ? format(new Date(epochSec * 1000), 'M/d') : '—');

/**
 * R-140: 個人設定「外部連携トークン」（docs/SPEC/03_画面設計.md §20）
 * 一覧・発行・失効。平文トークンは発行直後にのみ表示。ブラウザダイアログは使わない。文言は事実のみ。
 */
export const ApiTokenSection: React.FC = () => {
    const { tokens, isLoading, issued, error, issue, revoke } = useApiTokens();
    const [label, setLabel] = useState('');
    const [isIssuing, setIsIssuing] = useState(false);
    const [confirmingId, setConfirmingId] = useState<string | null>(null);
    const [actionError, setActionError] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);

    const handleIssue = async () => {
        const trimmed = label.trim();
        if (!trimmed) return;
        setIsIssuing(true);
        setActionError(null);
        setCopied(false);
        try {
            await issue(trimmed);
            setLabel('');
        } catch (e) {
            setActionError(e instanceof Error ? e.message : '発行に失敗しました');
        } finally {
            setIsIssuing(false);
        }
    };

    const handleRevoke = async (id: string) => {
        setActionError(null);
        try {
            await revoke(id);
        } catch (e) {
            setActionError(e instanceof Error ? e.message : '失効に失敗しました');
        } finally {
            setConfirmingId(null);
        }
    };

    const handleCopy = async () => {
        if (!issued) return;
        try {
            await navigator.clipboard.writeText(issued.token);
            setCopied(true);
        } catch {
            setCopied(false);
        }
    };

    return (
        <section className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
            <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-4 pb-2 border-b border-slate-100 dark:border-slate-700 flex items-center gap-2">
                <KeyRound className="w-5 h-5 text-slate-500" />
                外部連携トークン
            </h2>
            <div className="space-y-4">
                <p className="text-sm text-slate-500 dark:text-slate-400">
                    番頭など外部プログラムが Authorization: Bearer で API を呼ぶためのトークンです。
                </p>

                <div className="flex gap-2">
                    <input
                        type="text"
                        value={label}
                        onChange={(e) => setLabel(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') void handleIssue(); }}
                        placeholder="ラベル（例: 番頭）"
                        className="flex-1 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 text-sm outline-none focus:ring-2 focus:ring-slate-400"
                    />
                    <button
                        type="button"
                        onClick={() => void handleIssue()}
                        disabled={!label.trim() || isIssuing}
                        className="px-4 py-2 rounded-lg text-sm bg-slate-800 dark:bg-slate-200 text-white dark:text-slate-900 disabled:opacity-40"
                    >
                        発行
                    </button>
                </div>

                {issued && (
                    <div className="rounded-lg bg-slate-100 dark:bg-slate-900 p-3 space-y-2">
                        <div className="flex items-center gap-2">
                            <code className="flex-1 font-mono text-sm break-all text-slate-800 dark:text-slate-100">{issued.token}</code>
                            <button
                                type="button"
                                onClick={() => void handleCopy()}
                                className="px-3 py-1 rounded text-xs border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200"
                            >
                                コピー
                            </button>
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                            {copied ? 'コピーしました。' : ''}この画面を離れると再表示できません
                        </div>
                    </div>
                )}

                {(error || actionError) && (
                    <p className="text-sm text-slate-600 dark:text-slate-300">{actionError ?? error}</p>
                )}

                {!isLoading && tokens.length === 0 && (
                    <p className="text-sm text-slate-500 dark:text-slate-400">発行済みのトークンはありません</p>
                )}
                {tokens.length > 0 && (
                    <ul className="divide-y divide-slate-100 dark:divide-slate-700">
                        {tokens.map(t => (
                            <li key={t.id} className="py-2 flex items-center gap-4 text-sm text-slate-700 dark:text-slate-200">
                                <span className="flex-1 truncate">{t.label}</span>
                                <span className="text-slate-500 dark:text-slate-400 whitespace-nowrap">発行 {formatDay(t.createdAt)}</span>
                                <span className="text-slate-500 dark:text-slate-400 whitespace-nowrap">最終利用 {formatDay(t.lastUsedAt)}</span>
                                {confirmingId === t.id ? (
                                    <span className="flex items-center gap-2 whitespace-nowrap">
                                        <span>失効しますか？</span>
                                        <button type="button" onClick={() => void handleRevoke(t.id)} className="px-2 py-1 rounded border border-slate-300 dark:border-slate-600 text-xs">はい</button>
                                        <button type="button" onClick={() => setConfirmingId(null)} className="px-2 py-1 rounded border border-slate-300 dark:border-slate-600 text-xs">いいえ</button>
                                    </span>
                                ) : (
                                    <button
                                        type="button"
                                        onClick={() => setConfirmingId(t.id)}
                                        className="px-2 py-1 rounded border border-slate-300 dark:border-slate-600 text-xs text-slate-600 dark:text-slate-300"
                                    >
                                        失効
                                    </button>
                                )}
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </section>
    );
};
