import React from 'react';
import { AuthUser } from '../../auth/types';

interface MemberManagementProps {
    currentUser: AuthUser;
    members?: AuthUser[]; // 本来はMember型を作るべきだが今回はAuthUserで代用
}

export const MemberManagement: React.FC<MemberManagementProps> = ({ currentUser, members = [] }) => {
    // 実際の実装ではAPIからメンバーリストを取得する
    // ここではcurrentUserだけを表示する

    const displayMembers = members.length > 0 ? members : [currentUser];

    return (
        <div className="space-y-6 max-w-4xl">
            <div className="bg-white shadow overflow-hidden sm:rounded-md border border-gray-200">
                <div className="px-4 py-5 sm:px-6 flex justify-between items-center">
                    <div>
                        <h3 className="text-lg leading-6 font-medium text-gray-900">メンバー管理 (Team Members)</h3>
                        <p className="mt-1 max-w-2xl text-sm text-gray-500">このテナントに所属するメンバー一覧です。</p>
                    </div>
                    <button
                        type="button"
                        className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                        onClick={() => alert('招待機能は未実装です')}
                    >
                        メンバーを招待 (Invite)
                    </button>
                </div>
                <ul className="divide-y divide-gray-200">
                    {displayMembers.map((member) => (
                        <li key={member.id}>
                            <div className="px-4 py-4 sm:px-6">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center">
                                        <div className="flex-shrink-0">
                                            <span className="inline-block h-10 w-10 rounded-full overflow-hidden bg-gray-100">
                                                <svg className="h-full w-full text-gray-300" fill="currentColor" viewBox="0 0 24 24">
                                                    <path d="M24 20.993V24H0v-2.996A14.977 14.977 0 0112.004 15c4.904 0 9.26 2.354 11.996 5.993zM16.002 8.999a4 4 0 11-8 0 4 4 0 018 0z" />
                                                </svg>
                                            </span>
                                        </div>
                                        <div className="ml-4">
                                            <div className="text-sm font-medium text-indigo-600 truncate">{member.name}</div>
                                            <div className="flex items-center text-sm text-gray-500">
                                                <svg className="flex-shrink-0 mr-1.5 h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                                                    <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                                                    <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
                                                </svg>
                                                {member.email}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex-shrink-0">
                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                            Active
                                        </span>
                                        {member.id === currentUser.id && (
                                            <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                                You
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </li>
                    ))}
                </ul>
            </div>
        </div>
    );
};
