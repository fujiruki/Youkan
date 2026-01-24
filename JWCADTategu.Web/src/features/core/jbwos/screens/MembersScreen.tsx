import React from 'react';
import { useMembersViewModel } from '../viewmodels/useMembersViewModel';
import { Loader2, Users, AlertCircle } from 'lucide-react';

export const MembersScreen: React.FC = () => {
    const { members, loading, error, updateMember } = useMembersViewModel();

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
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto p-6 max-w-4xl mx-auto w-full">
                <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
                    <table className="w-full text-left">
                        <thead className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-700 text-xs uppercase text-slate-500 font-semibold">
                            <tr>
                                <th className="px-6 py-4">メンバー</th>
                                <th className="px-6 py-4">主力設定 (Core)</th>
                                <th className="px-6 py-4">日次キャパシティ</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                            {members.map(member => (
                                <tr key={member.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-slate-500 font-bold">
                                                {member.username.charAt(0)}
                                            </div>
                                            <div>
                                                <div className="font-medium text-slate-800 dark:text-slate-200">{member.username}</div>
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
                    ※ ここの設定は Volume Calendar の負荷計算に使用されます。
                </div>
            </div>
        </div>
    );
};
