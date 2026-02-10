import React, { useState } from 'react';
import { useMembersViewModel } from '../viewmodels/useMembersViewModel';
import { Loader2, Users, AlertCircle, Settings } from 'lucide-react';
import { SimpleModal } from '../components/Modal/SimpleModal';
import { WeeklyPatternEditor } from '../components/Settings/WeeklyPatternEditor';
import { CapacityProfile } from '../types';

export const MembersScreen: React.FC = () => {
    const { members, loading, error, updateMember } = useMembersViewModel();
    const [editingMemberId, setEditingMemberId] = useState<string | null>(null);

    const handleSavePattern = async (pattern: any) => {
        if (!editingMemberId) return;

        const member = members.find(m => m.id === editingMemberId);
        if (!member) return;

        const currentProfile = member.capacityProfile || {
            standardWeeklyPattern: {},
            exceptions: {}
        } as CapacityProfile;

        const newProfile: CapacityProfile = {
            ...currentProfile,
            standardWeeklyPattern: pattern,
            exceptions: currentProfile.exceptions || {}
        };

        await updateMember(editingMemberId, { capacityProfile: newProfile });
        setEditingMemberId(null);
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full text-slate-500 gap-2">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>読み込み中...</span>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex items-center justify-center h-full text-red-500 gap-2">
                <AlertCircle className="w-5 h-5" />
                <span>{error}</span>
            </div>
        );
    }

    const editingMember = members.find(m => m.id === editingMemberId);

    return (
        <div className="w-full h-full flex flex-col bg-slate-50 dark:bg-slate-900">
            {/* Header */}
            <div className="flex-none p-6 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg text-blue-600 dark:text-blue-400">
                        <Users size={24} />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-200">メンバー設定</h1>
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                            チームメンバーの役割と稼働キャパシティを設定します
                        </p>
                    </div>
                </div>

                <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2">
                    <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                        <p className="text-sm font-bold text-amber-800">メンバーの招待・削除について</p>
                        <p className="text-xs text-amber-700 mt-1">
                            新しいメンバーの招待や削除は、メニューの <span className="font-bold">「社員登録・メンバー管理」</span> 画面から行ってください。
                            （設定アイコンではなく、ビルアイコンのメニュー項目です）
                        </p>
                    </div>
                </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto p-6 max-w-5xl mx-auto w-full">
                <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
                    <table className="w-full text-left">
                        <thead className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-700 text-xs uppercase text-slate-500 font-semibold">
                            <tr>
                                <th className="px-6 py-4">メンバー</th>
                                <th className="px-6 py-4">主力設定 (Core)</th>
                                <th className="px-6 py-4">日次キャパシティ (基準)</th>
                                <th className="px-6 py-4">週間パターン</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                            {members.map(member => (
                                <tr key={member.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-slate-500 font-bold">
                                                {member.display_name.charAt(0)}
                                            </div>
                                            <div>
                                                <div className="font-medium text-slate-800 dark:text-slate-200">{member.display_name}</div>
                                                <div className="text-xs text-slate-500">{member.role}</div>
                                            </div>
                                        </div>
                                    </td>

                                    <td className="px-6 py-4">
                                        <label className="flex items-center cursor-pointer gap-2">
                                            <div className="relative">
                                                <input
                                                    type="checkbox"
                                                    className="sr-only peer"
                                                    checked={member.isCore}
                                                    onChange={(e) => updateMember(member.id, { isCore: e.target.checked })}
                                                />
                                                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                                            </div>
                                            <span className={`text-sm font-medium ${member.isCore ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400'}`}>
                                                {member.isCore ? '主力' : 'Off'}
                                            </span>
                                        </label>
                                    </td>

                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-2">
                                            <select
                                                className="bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 text-slate-900 dark:text-slate-100 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-2"
                                                value={member.dailyCapacityMinutes}
                                                onChange={(e) => updateMember(member.id, { dailyCapacityMinutes: Number(e.target.value) })}
                                            >
                                                <option value={240}>4時間 (240分)</option>
                                                <option value={360}>6時間 (360分)</option>
                                                <option value={420}>7時間 (420分)</option>
                                                <option value={480}>8時間 (480分)</option>
                                                <option value={540}>9時間 (540分)</option>
                                                <option value={600}>10時間 (600分)</option>
                                            </select>
                                            <span className="text-sm text-slate-500">
                                                = {member.dailyCapacityMinutes / 60}h
                                            </span>
                                        </div>
                                    </td>

                                    <td className="px-6 py-4">
                                        <button
                                            onClick={() => setEditingMemberId(member.id)}
                                            className="flex items-center gap-2 px-3 py-2 text-sm text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-md transition-colors border border-slate-200 dark:border-slate-700"
                                        >
                                            <Settings className="w-4 h-4" />
                                            <span>パターン設定</span>
                                        </button>
                                        {member.capacityProfile && (
                                            <div className="mt-1 text-xs text-blue-500">設定済み</div>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    {members.length === 0 && (
                        <div className="p-10 text-center text-slate-500">
                            メンバーがいません
                        </div>
                    )}
                </div>

                <div className="mt-4 text-xs text-slate-400 text-center">
                    ※ ここの設定は Quantity Calendar の負荷計算に使用されます。
                    <br />
                    ※ 「週間パターン」を設定すると、「日次キャパシティ(基準)」よりも優先されます。
                </div>
            </div>

            {/* Modal */}
            <SimpleModal
                isOpen={!!editingMemberId}
                onClose={() => setEditingMemberId(null)}
                title={editingMember ? `${editingMember.display_name} の稼働設定` : '稼働設定'}
            >
                {editingMember && (
                    <WeeklyPatternEditor
                        initialPattern={editingMember.capacityProfile?.standardWeeklyPattern}
                        onSave={handleSavePattern}
                        onCancel={() => setEditingMemberId(null)}
                    />
                )}
            </SimpleModal>
        </div>
    );
};
