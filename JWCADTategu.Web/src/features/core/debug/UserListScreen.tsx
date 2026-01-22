import React, { useState, useEffect } from 'react';
import { Trash2, RefreshCw, Users, AlertTriangle, Key } from 'lucide-react';
import { ApiClient } from '../../../api/client';

interface User {
    id: string;
    email: string;
    display_name: string;
    created_at: string;
    memberships: string | null;
}

export const UserListScreen: React.FC = () => {
    const [users, setUsers] = useState<User[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [resetUserId, setResetUserId] = useState<string | null>(null);
    const [newPassword, setNewPassword] = useState('');

    const loadUsers = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const res = await ApiClient.request<{ count: number; users: User[] }>('GET', '/debug/users');
            setUsers(res.users);
        } catch (e: any) {
            setError(e.message || 'ユーザー一覧の取得に失敗しました');
        } finally {
            setIsLoading(false);
        }
    };

    const handleDelete = async (userId: string, displayName: string) => {
        if (!confirm(`ユーザー「${displayName || userId}」を削除しますか？\nこの操作は取り消せません。`)) {
            return;
        }

        setDeletingId(userId);
        try {
            await ApiClient.request('DELETE', `/debug/users/${userId}`);
            setUsers(prev => prev.filter(u => u.id !== userId));
        } catch (e: any) {
            alert('削除に失敗しました: ' + e.message);
        } finally {
            setDeletingId(null);
        }
    };

    const handlePasswordReset = async (userId: string) => {
        if (!newPassword || newPassword.length < 4) {
            alert('パスワードは4文字以上で入力してください');
            return;
        }

        try {
            await ApiClient.request('PUT', `/debug/users/${userId}/password`, {
                newPassword: newPassword
            });
            alert('パスワードを更新しました');
            setResetUserId(null);
            setNewPassword('');
        } catch (e: any) {
            alert('パスワード更新に失敗しました: ' + e.message);
        }
    };

    useEffect(() => {
        loadUsers();
    }, []);

    return (
        <div className="min-h-screen bg-slate-100 dark:bg-slate-900 p-8">
            <div className="max-w-4xl mx-auto">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-amber-500 rounded-xl flex items-center justify-center">
                            <Users className="text-white" size={24} />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                                ユーザー一覧
                            </h1>
                            <p className="text-sm text-slate-500">
                                デバッグ用 - 本番環境では無効化してください
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={loadUsers}
                        disabled={isLoading}
                        className="flex items-center gap-2 px-4 py-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 rounded-lg transition-colors"
                    >
                        <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
                        更新
                    </button>
                </div>

                {/* Warning Banner */}
                <div className="mb-6 p-4 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 rounded-lg flex items-start gap-3">
                    <AlertTriangle className="text-amber-500 flex-shrink-0 mt-0.5" size={20} />
                    <div className="text-sm text-amber-800 dark:text-amber-200">
                        <strong>注意:</strong> このページは開発・デバッグ専用です。本番環境では <code>/api/debug/*</code> エンドポイントを無効化してください。
                    </div>
                </div>

                {/* Error Message */}
                {error && (
                    <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-300">
                        {error}
                    </div>
                )}

                {/* User List */}
                <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg overflow-hidden">
                    <div className="p-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
                        <span className="text-sm font-medium text-slate-600 dark:text-slate-400">
                            {users.length} ユーザー
                        </span>
                    </div>

                    {isLoading ? (
                        <div className="p-8 text-center text-slate-500">読み込み中...</div>
                    ) : users.length === 0 ? (
                        <div className="p-8 text-center text-slate-400">ユーザーがいません</div>
                    ) : (
                        <div className="divide-y divide-slate-100 dark:divide-slate-700">
                            {users.map(user => (
                                <div key={user.id} className="p-4">
                                    <div className="flex items-center justify-between">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2">
                                                <span className="font-medium text-slate-900 dark:text-white">
                                                    {user.display_name || '(名前なし)'}
                                                </span>
                                                <span className="text-xs px-2 py-0.5 bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 rounded">
                                                    {user.id}
                                                </span>
                                            </div>
                                            <div className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                                                {user.email}
                                            </div>
                                            <div className="text-xs text-slate-400 mt-1 flex gap-4">
                                                <span>作成: {user.created_at}</span>
                                                {user.memberships && (
                                                    <span>テナント: {user.memberships}</span>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => {
                                                    setResetUserId(resetUserId === user.id ? null : user.id);
                                                    setNewPassword('');
                                                }}
                                                className={`p-2 rounded-lg transition-colors ${resetUserId === user.id
                                                        ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/30'
                                                        : 'text-slate-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30'
                                                    }`}
                                                title="パスワードリセット"
                                            >
                                                <Key size={18} />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(user.id, user.display_name)}
                                                disabled={deletingId === user.id}
                                                className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors disabled:opacity-50"
                                                title="削除"
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        </div>
                                    </div>

                                    {/* Password Reset Form */}
                                    {resetUserId === user.id && (
                                        <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                                            <div className="flex items-center gap-2">
                                                <input
                                                    type="text"
                                                    value={newPassword}
                                                    onChange={(e) => setNewPassword(e.target.value)}
                                                    placeholder="新しいパスワード（4文字以上）"
                                                    className="flex-1 px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                />
                                                <button
                                                    onClick={() => handlePasswordReset(user.id)}
                                                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
                                                >
                                                    更新
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        setResetUserId(null);
                                                        setNewPassword('');
                                                    }}
                                                    className="px-3 py-2 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700 text-sm rounded-lg transition-colors"
                                                >
                                                    キャンセル
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Back Link */}
                <div className="mt-6 text-center">
                    <a
                        href="/"
                        className="text-sm text-blue-600 hover:text-blue-500 dark:text-blue-400 hover:underline"
                    >
                        ← ダッシュボードに戻る
                    </a>
                </div>
            </div>
        </div>
    );
};
