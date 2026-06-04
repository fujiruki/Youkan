import React, { useCallback, useEffect, useState } from 'react';
import { Calendar, RefreshCcw, Unlink, ExternalLink, Loader2 } from 'lucide-react';
import { GoogleCalendarApi, GoogleOAuthStatus } from '../../../../../api/googleCalendar';
import { useToast } from '../../../../../contexts/ToastContext';
import {
    DEFAULT_EXTERNAL_EVENTS_VIEWS,
    EXTERNAL_EVENTS_VIEWS_KEY,
    ExternalEventsViewMode,
    readExternalEventsViews,
} from '../../hooks/useExternalEvents';

const COOLDOWN_SECONDS = 60;

const formatRelativeTime = (epochSec: number): string => {
    const diffSec = Math.floor(Date.now() / 1000) - epochSec;
    if (diffSec < 0) return 'たった今';
    if (diffSec < 60) return `${diffSec} 秒前`;
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)} 分前`;
    if (diffSec < 86400) return `${Math.floor(diffSec / 3600)} 時間前`;
    return `${Math.floor(diffSec / 86400)} 日前`;
};

const formatDateTime = (epochSec: number): string => {
    const d = new Date(epochSec * 1000);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const mi = String(d.getMinutes()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd} ${hh}:${mi}`;
};

/**
 * R-034 Phase 2: Google カレンダー連携セクション
 * 仕様: docs/SPEC/03_画面設計.md §12.1
 *
 * - 未連携時: 説明 + Google でログインボタン
 * - 連携済み時: メール / 最終同期 / 今すぐ更新（60s クールダウン） / 連携解除
 * - Phase 2 では共有カレンダー振り分け UI はスケルトンのみ
 */
const VIEW_LABELS: Record<ExternalEventsViewMode, string> = {
    grid: 'グリッド',
    gantt: 'ガント',
    timeline: 'タイムライン',
};

const VIEW_ORDER: ExternalEventsViewMode[] = ['grid', 'gantt', 'timeline'];

export const GoogleCalendarSection: React.FC = () => {
    const { showToast } = useToast();
    const [status, setStatus] = useState<GoogleOAuthStatus | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isStarting, setIsStarting] = useState(false);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [isRevoking, setIsRevoking] = useState(false);
    const [cooldownRemaining, setCooldownRemaining] = useState(0);

    // R-039 Phase 3 UX: 表示するビュー設定
    const [enabledViews, setEnabledViews] = useState<ExternalEventsViewMode[]>(() => {
        const stored = readExternalEventsViews();
        return stored.length > 0 ? stored : [...DEFAULT_EXTERNAL_EVENTS_VIEWS];
    });

    const toggleView = useCallback((view: ExternalEventsViewMode) => {
        setEnabledViews((prev) => {
            const next = prev.includes(view)
                ? prev.filter((v) => v !== view)
                : [...prev, view];
            try {
                window.localStorage.setItem(EXTERNAL_EVENTS_VIEWS_KEY, JSON.stringify(next));
            } catch (_e) { /* noop */ }
            return next;
        });
    }, []);

    const fetchStatus = useCallback(async () => {
        try {
            const s = await GoogleCalendarApi.getStatus();
            setStatus(s);
        } catch (err) {
            console.error('[GoogleCalendarSection] getStatus failed', err);
            setStatus({ connected: false });
        } finally {
            setIsLoading(false);
        }
    }, []);

    // 初回ロード + OAuth コールバックの結果通知
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const oauthResult = params.get('google_oauth');
        if (oauthResult === 'success') {
            showToast({
                type: 'success',
                title: '連携完了',
                message: 'Google カレンダーと連携しました',
            });
            // URL から google_oauth クエリを取り除く
            params.delete('google_oauth');
            const newSearch = params.toString();
            const newUrl =
                window.location.pathname +
                (newSearch ? `?${newSearch}` : '') +
                window.location.hash;
            window.history.replaceState({}, '', newUrl);
        } else if (oauthResult === 'error') {
            showToast({
                type: 'error',
                title: '連携失敗',
                message: 'Google カレンダー連携に失敗しました。再度お試しください',
            });
            params.delete('google_oauth');
            const newSearch = params.toString();
            const newUrl =
                window.location.pathname +
                (newSearch ? `?${newSearch}` : '') +
                window.location.hash;
            window.history.replaceState({}, '', newUrl);
        }
        fetchStatus();
    }, [fetchStatus, showToast]);

    // クールダウンタイマー
    useEffect(() => {
        if (cooldownRemaining <= 0) return;
        const timer = setInterval(() => {
            setCooldownRemaining((prev) => {
                if (prev <= 1) {
                    clearInterval(timer);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
        return () => clearInterval(timer);
    }, [cooldownRemaining]);

    const handleStartOAuth = useCallback(async () => {
        try {
            setIsStarting(true);
            const { authUrl } = await GoogleCalendarApi.startOAuth();
            window.location.href = authUrl;
        } catch (err: any) {
            console.error('[GoogleCalendarSection] startOAuth failed', err);
            showToast({
                type: 'error',
                title: 'エラー',
                message: 'OAuth URL の取得に失敗しました',
            });
            setIsStarting(false);
        }
    }, [showToast]);

    const handleRefresh = useCallback(async () => {
        try {
            setIsRefreshing(true);
            const res = await GoogleCalendarApi.refresh();
            showToast({
                type: 'success',
                title: '更新しました',
                message: `${res.count} 件の予定を取得しました`,
            });
            setCooldownRemaining(COOLDOWN_SECONDS);
            // 最終同期日時を更新
            setStatus((prev) =>
                prev ? { ...prev, lastSyncAt: Math.floor(Date.now() / 1000) } : prev
            );
        } catch (err: any) {
            console.error('[GoogleCalendarSection] refresh failed', err);
            const message =
                err?.message?.includes('429')
                    ? 'クールダウン中です。しばらく待ってから再度お試しください'
                    : '更新に失敗しました';
            showToast({ type: 'error', title: '更新エラー', message });
        } finally {
            setIsRefreshing(false);
        }
    }, [showToast]);

    const handleRevoke = useCallback(async () => {
        const ok = window.confirm(
            'Google カレンダー連携を解除します。トークンとキャッシュデータが削除されます。よろしいですか？'
        );
        if (!ok) return;
        try {
            setIsRevoking(true);
            await GoogleCalendarApi.revoke();
            showToast({
                type: 'success',
                title: '連携解除しました',
                message: 'Google カレンダー連携を解除しました',
            });
            setStatus({ connected: false });
            setCooldownRemaining(0);
        } catch (err: any) {
            console.error('[GoogleCalendarSection] revoke failed', err);
            showToast({
                type: 'error',
                title: 'エラー',
                message: '連携解除に失敗しました',
            });
        } finally {
            setIsRevoking(false);
        }
    }, [showToast]);

    if (isLoading) {
        return (
            <section className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
                <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-4 pb-2 border-b border-slate-100 dark:border-slate-700 flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-blue-500" />
                    Google カレンダー連携
                </h2>
                <div className="flex items-center gap-2 text-sm text-slate-400">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    連携状態を読み込み中...
                </div>
            </section>
        );
    }

    const connected = !!status?.connected;

    return (
        <section className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
            <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-4 pb-2 border-b border-slate-100 dark:border-slate-700 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-blue-500" />
                Google カレンダー連携
            </h2>

            {!connected ? (
                <div className="space-y-4">
                    <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                        Google アカウントの primary カレンダーを Youkan に連携すると、
                        グリッドビューに予定が表示され、量感計算に反映されます。
                    </p>
                    <button
                        onClick={handleStartOAuth}
                        disabled={isStarting}
                        className="inline-flex items-center gap-2 px-5 py-2.5 bg-white text-slate-700 border border-slate-300 rounded-lg font-medium shadow-sm hover:bg-slate-50 transition-colors disabled:opacity-50"
                    >
                        {isStarting ? (
                            <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                            <svg className="w-5 h-5" viewBox="0 0 48 48" aria-hidden="true">
                                <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z" />
                                <path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z" />
                                <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z" />
                                <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303c-.792 2.237-2.231 4.166-4.087 5.571.001-.001.002-.001.003-.002l6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z" />
                            </svg>
                        )}
                        Google でログイン
                    </button>
                    <p className="text-xs text-slate-400 leading-relaxed">
                        ※ タイトル含めて保存します（晴樹さん専用）。いつでも連携解除できます。<br />
                        ※ unverified app の警告が出ますが、「詳細」→「安全でないページに移動」から進めてください。
                    </p>
                </div>
            ) : (
                <div className="space-y-5">
                    <div className="space-y-2">
                        <div className="flex items-center gap-2 text-sm">
                            <span className="text-slate-500 dark:text-slate-400">連携アカウント:</span>
                            <span className="font-medium text-slate-800 dark:text-slate-100">
                                {status?.email}
                            </span>
                        </div>
                        {status?.lastSyncAt && (
                            <div className="flex items-center gap-2 text-sm">
                                <span className="text-slate-500 dark:text-slate-400">最終同期:</span>
                                <span
                                    className="font-medium text-slate-700 dark:text-slate-200"
                                    title={formatDateTime(status.lastSyncAt)}
                                >
                                    {formatRelativeTime(status.lastSyncAt)}
                                </span>
                                <span className="text-xs text-slate-400">
                                    ({formatDateTime(status.lastSyncAt)})
                                </span>
                            </div>
                        )}
                    </div>

                    <div className="flex flex-wrap gap-3">
                        <button
                            onClick={handleRefresh}
                            disabled={isRefreshing || cooldownRemaining > 0}
                            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/30 dark:hover:bg-blue-900/50 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 rounded-lg font-medium text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isRefreshing ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                <RefreshCcw className="w-4 h-4" />
                            )}
                            {cooldownRemaining > 0
                                ? `更新待機中 (${cooldownRemaining}s)`
                                : '今すぐ更新'}
                        </button>

                        <button
                            onClick={handleRevoke}
                            disabled={isRevoking}
                            className="inline-flex items-center gap-2 px-4 py-2 bg-white hover:bg-red-50 dark:bg-slate-900 dark:hover:bg-red-900/10 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900/40 rounded-lg font-medium text-sm transition-colors disabled:opacity-50"
                        >
                            {isRevoking ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                <Unlink className="w-4 h-4" />
                            )}
                            連携解除
                        </button>
                    </div>

                    {cooldownRemaining > 0 && (
                        <p className="text-xs text-slate-400">
                            ※ 連続更新を避けるため {COOLDOWN_SECONDS} 秒のクールダウン中です。
                        </p>
                    )}

                    {/* R-039 Phase 3 UX: 表示するビュー */}
                    <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
                        <h3 className="text-sm font-semibold text-slate-600 dark:text-slate-400 mb-2">
                            表示するビュー
                        </h3>
                        <p className="text-xs text-slate-400 mb-3 leading-relaxed">
                            チェックを外したビューでは Google 予定は表示されず、量感計算にも反映されません。
                        </p>
                        <div className="flex flex-wrap gap-4">
                            {VIEW_ORDER.map((view) => (
                                <label
                                    key={view}
                                    className="inline-flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200 cursor-pointer"
                                >
                                    <input
                                        type="checkbox"
                                        checked={enabledViews.includes(view)}
                                        onChange={() => toggleView(view)}
                                        className="w-4 h-4 accent-blue-500"
                                    />
                                    {VIEW_LABELS[view]}
                                </label>
                            ))}
                        </div>
                    </div>

                    {/* Phase 3 共有カレンダー振り分け UI スケルトン */}
                    <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
                        <h3 className="text-sm font-semibold text-slate-600 dark:text-slate-400 mb-2 flex items-center gap-2">
                            共有カレンダー振り分け
                            <span className="text-xs font-normal text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
                                Phase 3 で実装予定
                            </span>
                        </h3>
                        <div className="bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-slate-100 dark:border-slate-800 p-4 opacity-60">
                            <div className="space-y-2 text-sm">
                                <div className="flex items-center justify-between">
                                    <span className="text-slate-500">家族カレンダー</span>
                                    <div className="flex gap-2 text-xs">
                                        <span className="px-2 py-1 bg-white dark:bg-slate-800 border rounded">個</span>
                                        <span className="px-2 py-1 bg-white dark:bg-slate-800 border rounded">会</span>
                                        <span className="px-2 py-1 bg-white dark:bg-slate-800 border rounded">無視</span>
                                    </div>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-slate-500">仕事用カレンダー</span>
                                    <div className="flex gap-2 text-xs">
                                        <span className="px-2 py-1 bg-white dark:bg-slate-800 border rounded">個</span>
                                        <span className="px-2 py-1 bg-white dark:bg-slate-800 border rounded">会</span>
                                        <span className="px-2 py-1 bg-white dark:bg-slate-800 border rounded">無視</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <p className="mt-2 text-xs text-slate-400 inline-flex items-center gap-1">
                            <ExternalLink className="w-3 h-3" />
                            共有カレンダー側の予定振り分けは Phase 3 で実装します。
                        </p>
                    </div>
                </div>
            )}
        </section>
    );
};
