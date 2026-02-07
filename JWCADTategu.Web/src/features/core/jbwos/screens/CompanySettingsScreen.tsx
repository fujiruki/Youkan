import React, { useState, useEffect } from 'react';
import { ApiClient } from '../../../../api/client';
import { Users, Building, Plus, Trash2, Edit2, Check } from 'lucide-react';
import { Member } from '../types'; // Import from central types

interface TenantInfo {
    id: string;
    name: string;
    created_at: string;
    member_count: number;
}

export const CompanySettingsScreen: React.FC<{ onBack: () => void }> = ({ onBack }) => {
    const [info, setInfo] = useState<TenantInfo | null>(null);
    const [members, setMembers] = useState<Member[]>([]);
    const [loading, setLoading] = useState(true);

    // Edit States
    const [isEditingInfo, setIsEditingInfo] = useState(false);
    const [newCompanyName, setNewCompanyName] = useState('');

    // Invite State
    const [isInviting, setIsInviting] = useState(false);
    const [inviteEmail, setInviteEmail] = useState('');
    const [inviteRole, setInviteRole] = useState<'admin' | 'user'>('user');

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const [infoData, membersData] = await Promise.all([
                ApiClient.getTenantInfo(),
                ApiClient.getMembers()
            ]);
            setInfo(infoData);
            setMembers(membersData);
            setNewCompanyName(infoData.name);
        } catch (e) {
            console.error('Failed to load company settings', e);
        } finally {
            setLoading(false);
        }
    };

    const handleUpdateInfo = async () => {
        if (!newCompanyName.trim()) return;
        try {
            await ApiClient.updateTenantInfo(newCompanyName);
            setIsEditingInfo(false);
            loadData();
        } catch (e) {
            alert('Failed to update company info');
        }
    };

    const handleInvite = async () => {
        if (!inviteEmail.trim()) return;
        try {
            await ApiClient.inviteMember(inviteEmail, inviteRole);
            setInviteEmail('');
            setIsInviting(false);
            loadData();
        } catch (e) {
            alert('Failed to invite member: ' + e);
        }
    };

    const handleRemoveMember = async (id: string) => {
        if (!window.confirm('Are you sure you want to remove this member?')) return;
        try {
            await ApiClient.removeMember(id);
            loadData();
        } catch (e) {
            alert('Failed to remove member');
        }
    };

    const handleRoleUpdate = async (id: string, newRole: 'admin' | 'user') => {
        try {
            await ApiClient.updateMember(id, { role: newRole });
            loadData();
        } catch (e) {
            console.error(e);
        }
    };

    if (loading) return <div className="p-8 text-center text-slate-500">Loading settings...</div>;

    return (
        <div className="min-h-screen bg-slate-50 text-slate-800 font-sans">
            <div className="bg-white border-b border-slate-200 px-8 py-4 flex items-center justify-between sticky top-0 z-10">
                <div className="flex items-center gap-4">
                    <button onClick={onBack} className="text-slate-400 hover:text-slate-600 transition-colors">
                        &larr; 戻る
                    </button>
                    <h1 className="text-xl font-bold flex items-center gap-2">
                        <Building size={20} className="text-indigo-600" />
                        会社設定
                    </h1>
                </div>
            </div>

            <div className="p-8 max-w-4xl mx-auto space-y-8">
                {/* Company Info Card */}
                <section className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
                    <div className="flex justify-between items-start mb-6">
                        <h2 className="text-lg font-bold text-slate-700">組織情報</h2>
                        {!isEditingInfo ? (
                            <button onClick={() => setIsEditingInfo(true)} className="text-indigo-600 text-sm hover:underline flex items-center gap-1">
                                <Edit2 size={14} /> 編集
                            </button>
                        ) : (
                            <div className="flex gap-2">
                                <button onClick={handleUpdateInfo} className="bg-indigo-600 text-white px-3 py-1 rounded text-sm hover:bg-indigo-700">保存</button>
                                <button onClick={() => setIsEditingInfo(false)} className="bg-slate-100 text-slate-600 px-3 py-1 rounded text-sm hover:bg-slate-200">キャンセル</button>
                            </div>
                        )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-1">会社名</label>
                            {isEditingInfo ? (
                                <input
                                    type="text"
                                    value={newCompanyName}
                                    onChange={e => setNewCompanyName(e.target.value)}
                                    className="w-full border border-slate-300 rounded px-3 py-2"
                                />
                            ) : (
                                <div className="text-xl font-medium text-slate-800">{info?.name}</div>
                            )}
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-1">会社ID</label>
                            <div className="font-mono text-slate-600 bg-slate-50 px-2 py-1 rounded inline-block text-sm">{info?.id}</div>
                        </div>
                    </div>
                </section>

                {/* Member Management */}
                <section className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
                    <div className="flex justify-between items-center mb-6">
                        <div>
                            <h2 className="text-lg font-bold text-slate-700 flex items-center gap-2">
                                <Users size={18} className="text-indigo-600" />
                                メンバー
                                <span className="text-sm font-normal text-slate-400 ml-2">({members.length})</span>
                            </h2>
                            <p className="text-sm text-slate-500 mt-1">社員のアカウント登録と役割を管理します。</p>
                        </div>
                        <button
                            onClick={() => setIsInviting(true)}
                            className="bg-slate-800 text-white px-4 py-2 rounded-md hover:bg-slate-700 flex items-center gap-2 text-sm"
                        >
                            <Plus size={16} /> 新しい社員を登録する
                        </button>
                    </div>

                    {isInviting && (
                        <div className="mb-6 p-4 bg-indigo-50 border border-indigo-100 rounded-lg animate-in fade-in slide-in-from-top-2">
                            <h3 className="text-sm font-bold text-indigo-900 mb-3">新しい社員を追加する</h3>
                            <div className="flex gap-4 items-end">
                                <div className="flex-1">
                                    <label className="block text-xs text-indigo-700 mb-1">メールアドレス</label>
                                    <input
                                        type="email"
                                        value={inviteEmail}
                                        onChange={e => setInviteEmail(e.target.value)}
                                        className="w-full border border-indigo-200 rounded px-3 py-2 focus:ring-2 focus:ring-indigo-500"
                                        placeholder="colleague@example.com"
                                    />
                                </div>
                                <div className="w-32">
                                    <label className="block text-xs text-indigo-700 mb-1">権限</label>
                                    <select
                                        value={inviteRole}
                                        onChange={e => setInviteRole(e.target.value as any)}
                                        className="w-full border border-indigo-200 rounded px-3 py-2"
                                    >
                                        <option value="user">ユーザー</option>
                                        <option value="admin">管理者</option>
                                    </select>
                                </div>
                                <button onClick={handleInvite} className="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700">登録を実行</button>
                                <button onClick={() => setIsInviting(false)} className="text-slate-500 px-3 py-2 hover:bg-slate-200 rounded">キャンセル</button>
                            </div>
                        </div>
                    )}

                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-slate-50 text-slate-500 font-medium">
                                <tr>
                                    <th className="px-4 py-3">メンバー</th>
                                    <th className="px-4 py-3">権限</th>
                                    <th className="px-4 py-3">ステータス</th>
                                    <th className="px-4 py-3 text-right">操作</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {members.map(m => (
                                    <tr key={m.id} className="hover:bg-slate-50/50">
                                        <td className="px-4 py-3">
                                            <div className="font-medium text-slate-800">{m.display_name}</div>
                                            <div className="text-xs text-slate-400">{m.email}</div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <select
                                                value={m.role}
                                                onChange={(e) => handleRoleUpdate(m.id, e.target.value as 'admin' | 'user')}
                                                disabled={m.role === 'owner'}
                                                className={`text-xs font-medium border rounded px-1 py-0.5 ${m.role === 'owner' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                                                    m.role === 'admin' ? 'bg-indigo-50 text-indigo-700 border-indigo-200' :
                                                        'bg-slate-100 text-slate-600 border-slate-200'
                                                    }`}
                                            >
                                                <option value="owner" disabled>オーナー</option>
                                                <option value="admin">管理者</option>
                                                <option value="user">ユーザー</option>
                                            </select>
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className="text-emerald-600 text-xs flex items-center gap-1">
                                                <Check size={12} /> アクティブ
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            {m.role !== 'owner' && (
                                                <button
                                                    onClick={() => handleRemoveMember(m.id)}
                                                    className="text-slate-400 hover:text-red-600 p-1 rounded hover:bg-red-50 transition-colors"
                                                    title="メンバーを除外"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </section>
            </div>
        </div>
    );
};
