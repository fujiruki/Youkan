import React, { useState, useEffect } from 'react';
import { Trash2, RefreshCw, Users, Key, Settings, UserCog, Building2 } from 'lucide-react';
import { AdminRepository, AdminUser, AdminTenant } from '../repositories/AdminRepository';

/* 
 * User Management Screen
 * Promoted from features/core/debug/UserListScreen.tsx
 * Now officially part of Admin/Management features.
 */

export const UserManagementScreen: React.FC = () => {
    const [users, setUsers] = useState<AdminUser[]>([]);
    const [tenants, setTenants] = useState<AdminTenant[]>([]);
    const [activeTab, setActiveTab] = useState<'users' | 'tenants'>('users');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [resetUserId, setResetUserId] = useState<string | null>(null);
    const [newPassword, setNewPassword] = useState('');

    const loadUsers = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const list = await AdminRepository.getUsers();
            setUsers(list);

            const tList = await AdminRepository.getTenants();
            setTenants(tList);
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
            await AdminRepository.deleteUser(userId);
            setUsers(prev => prev.filter(u => u.id !== userId));
        } catch (e: any) {
            alert('削除に失敗しました: ' + e.message);
        } finally {
            setDeletingId(null);
        }
    };

    const handleDeleteTenant = async (tenantId: string, name: string) => {
        if (!confirm(`会社「${name || tenantId}」を削除しますか？\n所属するメンバー、プロジェクト、建具データもすべて削除されます。\nこの操作は取り消せません。`)) {
            return;
        }

        setDeletingId(tenantId);
        try {
            await AdminRepository.deleteTenant(tenantId);
            setTenants(prev => prev.filter(t => t.id !== tenantId));
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
            await AdminRepository.resetPassword(userId, newPassword);
            alert('パスワードを更新しました');
            setResetUserId(null);
            setNewPassword('');
        } catch (e: any) {
            alert('パスワード更新に失敗しました: ' + e.message);
        }
    };

    const handleOpenCapacitySettings = (userId: string) => {
        // TODO: Navigate to Capacity Config Screen
        alert(`ユーザー ${userId} のキャパシティ設定は今後実装予定です。\n(Haruki Model Resource Management)`);
    };

    useEffect(() => {
        loadUsers();
    }, []);

    return (
        <div className="min-h-full bg-slate-100 dark:bg-slate-900 p-8">
            <div className="max-w-5xl mx-auto">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg">
                            <Users className="text-white" size={24} />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                                ユーザー管理
                            </h1>
                            <p className="text-sm text-slate-500">
                                システム利用者のアカウント管理とリソース設定
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={loadUsers}
                        disabled={isLoading}
                        className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg transition-colors shadow-sm"
                    >
                        <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
                        更新
                    </button>
                </div>

                {/* Error Message */}
                {error && (
                    <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-300 flex items-center gap-3">
                        <div className="p-1 bg-red-100 dark:bg-red-900/50 rounded-full">!</div>
                        {error}
                    </div>
                )}

                {/* User List */}
                <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
                    <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50 flex gap-4">
                        <button
                            onClick={() => setActiveTab('users')}
                            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${activeTab === 'users'
                                ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm'
                                : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                                }`}
                        >
                            <span className="flex items-center gap-2">
                                <Users size={16} />
                                ユーザー一覧 ({users.length})
                            </span>
                        </button>
                        <button
                            onClick={() => setActiveTab('tenants')}
                            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${activeTab === 'tenants'
                                ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm'
                                : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                                }`}
                        >
                            <span className="flex items-center gap-2">
                                <Building2 size={16} />
                                会社一覧 ({tenants.length})
                            </span>
                        </button>
                    </div>

                    {isLoading ? (
                        <div className="p-12 text-center text-slate-500">読み込み中...</div>
                    ) : activeTab === 'users' && users.length === 0 ? (
                        <div className="p-12 text-center text-slate-400">ユーザーがいません</div>
                    ) : activeTab === 'users' && (
                        <div className="divide-y divide-slate-100 dark:divide-slate-700">
                            {users.map(user => (
                                <div key={user.id} className="p-6 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50">
                                    <div className="flex items-start justify-between">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-bold text-lg">
                                                    {user.display_name ? user.display_name[0].toUpperCase() : '?'}
                                                </div>
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-bold text-slate-900 dark:text-white text-lg">
                                                            {user.display_name || '(名前なし)'}
                                                        </span>
                                                        <span className="text-xs px-2 py-0.5 bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 rounded font-mono">
                                                            ID: {user.id}
                                                        </span>
                                                    </div>
                                                    <div className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                                                        {user.email}
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="mt-3 pl-13 flex gap-6 text-xs text-slate-400">
                                                <span>作成日: {user.created_at}</span>
                                                {user.memberships && (
                                                    <span className="flex items-center gap-1">
                                                        <Users size={12} />
                                                        所属: {user.memberships}
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2">
                                            {/* Capacity Settings (Haruki Model) */}
                                            <button
                                                onClick={() => handleOpenCapacitySettings(user.id)}
                                                className="flex items-center gap-2 px-3 py-2 text-sm text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-colors border border-indigo-100 dark:border-indigo-900/30"
                                                title="キャパシティ設定 (稼働時間)"
                                            >
                                                <Settings size={16} />
                                                <span>稼働設定</span>
                                            </button>

                                            <div className="w-px h-8 bg-slate-200 dark:bg-slate-700 mx-2"></div>

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
                                                title="アカウント削除"
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        </div>
                                    </div>

                                    {/* Password Reset Form */}
                                    {resetUserId === user.id && (
                                        <div className="mt-4 ml-13 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-100 dark:border-blue-800/50 animate-in fade-in slide-in-from-top-2 duration-200">
                                            <h4 className="text-sm font-bold text-blue-800 dark:text-blue-300 mb-2 flex items-center gap-2">
                                                <UserCog size={16} />
                                                パスワードの再設定
                                            </h4>
                                            <div className="flex items-center gap-2">
                                                <input
                                                    type="text"
                                                    value={newPassword}
                                                    onChange={(e) => setNewPassword(e.target.value)}
                                                    placeholder="新しいパスワード（4文字以上）"
                                                    className="flex-1 max-w-md px-3 py-2 text-sm border border-blue-200 dark:border-blue-800 rounded-lg bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                />
                                                <button
                                                    onClick={() => handlePasswordReset(user.id)}
                                                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors shadow-sm"
                                                >
                                                    変更を保存
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

                    {/* Tenant List */}
                    {!isLoading && activeTab === 'tenants' && (
                        <div className="divide-y divide-slate-100 dark:divide-slate-700 block">
                            {tenants.length === 0 ? (
                                <div className="p-12 text-center text-slate-400">会社がありません</div>
                            ) : tenants.map(tenant => (
                                <div key={tenant.id} className="p-6 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50">
                                    <div className="flex items-start justify-between">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-lg bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center text-orange-600 dark:text-orange-400 font-bold text-lg">
                                                    <Building2 size={20} />
                                                </div>
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-bold text-slate-900 dark:text-white text-lg">
                                                            {tenant.name || '(名称なし)'}
                                                        </span>
                                                        <span className="text-xs px-2 py-0.5 bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 rounded font-mono">
                                                            ID: {tenant.id}
                                                        </span>
                                                    </div>
                                                    <div className="text-sm text-slate-500 dark:text-slate-400 mt-0.5 flex flex-col gap-1">
                                                        <div className="flex gap-4">
                                                            <span>作成日: {tenant.created_at}</span>
                                                            <span>メンバー数: {tenant.member_count}名</span>
                                                        </div>
                                                        {tenant.representative_name && (
                                                            <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400">
                                                                <span className="text-xs border border-indigo-200 dark:border-indigo-800 px-1 rounded">代表</span>
                                                                <span className="font-bold">{tenant.representative_name}</span>
                                                                <span className="text-xs text-slate-400">({tenant.representative_email})</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2">
                                            {tenant.owner_id && (
                                                <button
                                                    onClick={() => {
                                                        setResetUserId(resetUserId === tenant.owner_id ? null : (tenant.owner_id || null));
                                                        setNewPassword('');
                                                    }}
                                                    className={`p-2 rounded-lg transition-colors ${resetUserId === tenant.owner_id
                                                        ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/30'
                                                        : 'text-slate-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30'
                                                        }`}
                                                    title="代表者のパスワードリセット"
                                                >
                                                    <Key size={18} />
                                                </button>
                                            )}

                                            <button
                                                onClick={() => handleDeleteTenant(tenant.id, tenant.name)}
                                                disabled={deletingId === tenant.id}
                                                className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors disabled:opacity-50"
                                                title="会社を削除"
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer Link */}
                <div className="mt-8 text-center">
                    <button
                        onClick={() => window.location.href = '/contents/TateguDesignStudio/'}
                        className="text-slate-500 hover:text-indigo-600 underline font-medium"
                    >
                        ログイン画面に戻る
                    </button>
                </div>
            </div>
        </div>
    );
};
