import React from 'react';
import { User, Shield, Briefcase } from 'lucide-react';
// import { AuthUser } from '../../auth/types';

interface MemberManagementProps {
    currentUser: any; // Using any for loose coupling for now, or use AuthUser
}

export const MemberManagement: React.FC<MemberManagementProps> = ({ currentUser }) => {
    // Mock members list based on current user (Real implementation would fetch from API)
    const members = [
        { id: currentUser.id, name: currentUser.name, email: currentUser.email, role: 'Admin', status: 'Active' },
        { id: 'mock-user-2', name: '山田 太郎', email: 'taro@example.com', role: 'Member', status: 'Active' },
        { id: 'mock-user-3', name: '佐藤 花子', email: 'hanako@example.com', role: 'Guest', status: 'Invited' },
    ];

    return (
        <div className="space-y-6">
            <header className="flex justify-between items-center mb-6">
                <div>
                    <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                        <UsersIcon />
                        メンバー管理
                    </h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                        現在 {members.length} 名のメンバーが所属しています。
                    </p>
                </div>
                <button
                    onClick={() => alert('招待機能は準備中です')}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-500 transition-colors shadow-sm"
                >
                    + メンバー招待
                </button>
            </header>

            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800">
                            <th className="p-4 text-sm font-semibold text-slate-600 dark:text-slate-400">名前</th>
                            <th className="p-4 text-sm font-semibold text-slate-600 dark:text-slate-400">メールアドレス</th>
                            <th className="p-4 text-sm font-semibold text-slate-600 dark:text-slate-400">権限</th>
                            <th className="p-4 text-sm font-semibold text-slate-600 dark:text-slate-400">ステータス</th>
                        </tr>
                    </thead>
                    <tbody>
                        {members.map((member) => (
                            <tr key={member.id} className="border-b border-slate-100 dark:border-slate-800/50 last:border-0 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                                <td className="p-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-300">
                                            <User size={16} />
                                        </div>
                                        <span className="font-medium text-slate-800 dark:text-slate-200">
                                            {member.name}
                                            {member.id === currentUser.id && <span className="ml-2 text-xs text-blue-500 font-bold">(You)</span>}
                                        </span>
                                    </div>
                                </td>
                                <td className="p-4 text-slate-600 dark:text-slate-400 font-mono text-sm">
                                    {member.email}
                                </td>
                                <td className="p-4">
                                    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold
                                        ${member.role === 'Admin' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400'}
                                    `}>
                                        {member.role === 'Admin' ? <Shield size={12} /> : <Briefcase size={12} />}
                                        {member.role}
                                    </span>
                                </td>
                                <td className="p-4">
                                    <span className={`px-2 py-1 rounded-full text-xs font-bold
                                        ${member.status === 'Active' ? 'text-green-600 bg-green-50 dark:text-green-400 dark:bg-green-900/20' : 'text-slate-500 bg-slate-100'}
                                    `}>
                                        {member.status}
                                    </span>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

// Helper component for icon
const UsersIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-indigo-500">
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path>
        <circle cx="9" cy="7" r="4"></circle>
        <path d="M22 21v-2a4 4 0 0 0-3-3.87"></path>
        <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
    </svg>
);
