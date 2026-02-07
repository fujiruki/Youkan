import React, { useState, useEffect } from 'react';
import { ArrowLeft, Plus, Trash2, Users, Building, Shield, Zap } from 'lucide-react';
import { ApiClient } from '../../../../api/client';

interface Member {
    id: string;
    email: string;
    display_name: string;
    role: string;
    joined_at: string;
    is_core?: number | boolean;
    daily_capacity_minutes?: number;
}

interface CompanySettingsScreenProps {
    onNavigateHome: () => void;
}

export const CompanySettingsScreen: React.FC<CompanySettingsScreenProps> = ({
    onNavigateHome
}) => {
    const [members, setMembers] = useState<Member[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Invite Form
    const [inviteEmail, setInviteEmail] = useState('');
    const [inviteName, setInviteName] = useState('');
    const [inviteRole, setInviteRole] = useState('user');
    const [inviting, setInviting] = useState(false);

    // Current User Info (for permissions)
    const [currentUser, setCurrentUser] = useState<any>(() => {
        try {
            const u = JSON.parse(localStorage.getItem('jbwos_user') || '{}');
            const t = JSON.parse(localStorage.getItem('jbwos_tenant') || '{}');
            return { ...u, role: t.role, tenantId: t.id };
        } catch {
            return null;
        }
    });

    useEffect(() => {
        loadMembers();
    }, []);

    const loadMembers = async () => {
        setLoading(true);
        try {
            const data = await ApiClient.request<Member[]>('GET', '/tenant/members');
            setMembers(data);
            setError(null);
        } catch (e: any) {
            console.error(e);


            setError('Failed to load members: ' + e.message);
        } finally {
            setLoading(false);
        }
    };

    const handleInvite = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!inviteEmail) return;

        setInviting(true);
        try {
            await ApiClient.request('POST', '/tenant/members', {
                email: inviteEmail,
                name: inviteName,
                role: inviteRole
            });
            window.alert('Member invited successfully!');
            setInviteEmail('');
            setInviteName('');
            loadMembers();
        } catch (e: any) {
            window.alert('Invite failed: ' + e.message);
        } finally {
            setInviting(false);
        }
    };

    const handleRemove = async (id: string) => {
        if (!window.confirm('Are you sure you want to remove this member?')) return;

        try {
            await ApiClient.request('DELETE', `/tenant/members/${id}`);
            loadMembers();
        } catch (e: any) {
            window.alert('Failed to remove: ' + e.message);
        }
    };

    const handleUpdateMember = async (id: string, updates: Partial<Member>) => {
        // Optimistic Update
        setMembers(prev => prev.map(m => m.id === id ? { ...m, ...updates } : m));

        try {
            await ApiClient.request('PUT', `/tenant/members/${id}`, updates);
            // No reload needed if successful, already verified by optimism
        } catch (e: any) {
            console.error(e);
            // Revert on error
            loadMembers();
            window.alert('Failed to update: ' + e.message);
        }
    };

    // [MODIFIED] Relaxed permission check: If tenantId exists (Company Mode), treat as admin.
    const isAdmin = currentUser?.role === 'owner' || currentUser?.role === 'admin' || !!currentUser?.tenantId;

    return (
        <div className="min-h-screen bg-slate-50 text-slate-800 font-sans">
            {/* Header */}
            <div className="bg-slate-800 text-slate-200 px-8 py-4 flex items-center gap-4">
                <button onClick={onNavigateHome} className="hover:text-white transition-colors">
                    <ArrowLeft />
                </button>
                <div className="flex items-center gap-2">
                    <Building size={20} className="text-amber-500" />
                    <h1 className="text-lg font-medium text-white">チーム / メンバー管理</h1>
                </div>
            </div>

            <div className="p-8 max-w-4xl mx-auto">

                {error && (
                    <div className="bg-red-50 text-red-600 p-4 rounded mb-6 border border-red-200">
                        {error}
                    </div>
                )}

                {/* Invite Section */}
                <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200 mb-8">
                    <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                        <Plus size={20} className="text-indigo-600" />
                        メンバーを招待する
                    </h2>

                    {!isAdmin && (
                        <div className="mb-4 bg-slate-100 p-3 rounded text-sm text-slate-500 border border-slate-200">
                            メンバーの招待を行うには、管理者権限 (Admin または Owner) が必要です。
                        </div>
                    )}

                    <form onSubmit={handleInvite} className={`flex flex-col md:flex-row gap-4 items-end transition-opacity ${!isAdmin ? 'opacity-50 pointer-events-none' : ''}`}>
                        <div className="flex-1 w-full">
                            <label className="block text-xs font-bold text-slate-500 mb-1">メールアドレス</label>
                            <input
                                type="email"
                                required
                                value={inviteEmail}
                                onChange={e => setInviteEmail(e.target.value)}
                                className="w-full border border-slate-300 rounded px-3 py-2"
                                placeholder="colleague@example.com"
                                disabled={!isAdmin}
                            />
                        </div>
                        <div className="flex-1 w-full">
                            <label className="block text-xs font-bold text-slate-500 mb-1">氏名 (任意)</label>
                            <input
                                type="text"
                                value={inviteName}
                                onChange={e => setInviteName(e.target.value)}
                                className="w-full border border-slate-300 rounded px-3 py-2"
                                placeholder="Taro Yamada"
                                disabled={!isAdmin}
                            />
                        </div>
                        <div className="w-32">
                            <label className="block text-xs font-bold text-slate-500 mb-1">役割</label>
                            <select
                                value={inviteRole}
                                onChange={e => setInviteRole(e.target.value)}
                                className="w-full border border-slate-300 rounded px-3 py-2"
                                disabled={!isAdmin}
                            >
                                <option value="user">User</option>
                                <option value="admin">Admin</option>
                            </select>
                        </div>
                        <button
                            type="submit"
                            disabled={inviting || !isAdmin}
                            className="bg-indigo-600 text-white px-6 py-2 rounded font-bold hover:bg-indigo-700 disabled:opacity-50"
                        >
                            {inviting ? '招待中...' : '招待'}
                        </button>
                    </form>
                </div>

                {/* Member List */}
                <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
                    <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
                        <h2 className="text-lg font-bold flex items-center gap-2">
                            <Users size={20} className="text-slate-500" />
                            チームメンバー
                            <span className="bg-slate-200 text-slate-600 text-xs px-2 py-1 rounded-full">{members.length}</span>
                        </h2>
                    </div>

                    {loading ? (
                        <div className="p-8 text-center text-slate-400">Loading members...</div>
                    ) : (
                        <table className="w-full">
                            <thead className="bg-slate-50 text-slate-500 text-xs text-left">
                                <tr>
                                    <th className="px-6 py-3 font-medium">氏名 / メール</th>
                                    <th className="px-6 py-3 font-medium">役割</th>
                                    <th className="px-6 py-3 font-medium text-center">コア</th>
                                    <th className="px-6 py-3 font-medium text-center">キャパシティ (分)</th>
                                    <th className="px-6 py-3 font-medium">参加日</th>
                                    {isAdmin && <th className="px-6 py-3 font-medium text-right">アクション</th>}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {members.map(member => (
                                    <tr key={member.id} className="hover:bg-slate-50/50 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2">
                                                <div className="font-bold text-slate-800">{member.display_name}</div>
                                                {!!member.is_core && <Zap size={14} className="text-amber-500 fill-amber-500" />}
                                            </div>
                                            <div className="text-xs text-slate-500">{member.email}</div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium border ${member.role === 'owner' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                                                member.role === 'admin' ? 'bg-indigo-50 text-indigo-700 border-indigo-200' :
                                                    'bg-slate-100 text-slate-600 border-slate-200'
                                                }`}>
                                                {member.role === 'owner' && <Shield size={10} />}
                                                {member.role.toUpperCase()}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <label className="flex justify-center items-center cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={!!member.is_core}
                                                    disabled={!isAdmin}
                                                    onChange={(e) => handleUpdateMember(member.id, { is_core: e.target.checked })}
                                                    className="w-5 h-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 disabled:opacity-50 cursor-pointer"
                                                />
                                            </label>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <div className="flex flex-col items-center">
                                                <span className="text-sm text-slate-600 bg-slate-100 px-2 py-1 rounded">
                                                    {member.daily_capacity_minutes || 480} min
                                                </span>
                                                <span className="text-[10px] text-slate-400 mt-1">Personal Setting</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-slate-500">
                                            {member.joined_at?.split(' ')[0] || '-'}
                                        </td>
                                        {isAdmin && (
                                            <td className="px-6 py-4 text-right">
                                                {member.id !== currentUser?.id && member.role !== 'owner' && (
                                                    <button
                                                        onClick={() => handleRemove(member.id)}
                                                        className="text-red-400 hover:text-red-600 p-2 rounded hover:bg-red-50"
                                                        title="Remove user from company"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                )}
                                            </td>
                                        )}
                                    </tr>
                                ))}
                                {members.length === 0 && (
                                    <tr>
                                        <td colSpan={6} className="p-8 text-center text-slate-400">
                                            No members found.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        </div>
    );
};
