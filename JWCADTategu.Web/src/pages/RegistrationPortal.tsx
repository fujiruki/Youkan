import React from 'react';
import { User, Briefcase, Building } from 'lucide-react';

interface RegistrationPortalProps {
    onSelectType: (type: 'user' | 'proprietor' | 'company') => void;
    onLogin: () => void;
}

export const RegistrationPortal: React.FC<RegistrationPortalProps> = ({ onSelectType, onLogin }) => {
    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-4">
            <div className="max-w-4xl w-full space-y-8">
                <div className="text-center">
                    <h1 className="text-3xl font-bold text-slate-800 dark:text-slate-100">
                        JBWOSへようこそ
                    </h1>
                    <p className="mt-2 text-slate-600 dark:text-slate-400">
                        働き方に合わせて、アカウントのタイプを選んでください。
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* 1. General User */}
                    <button
                        onClick={() => onSelectType('user')}
                        className="group flex flex-col items-center p-8 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 hover:border-blue-500 dark:hover:border-blue-500 hover:shadow-lg transition-all text-center"
                    >
                        <div className="w-16 h-16 bg-blue-50 dark:bg-blue-900/20 rounded-full flex items-center justify-center text-blue-600 dark:text-blue-400 mb-6 group-hover:scale-110 transition-transform">
                            <User size={32} />
                        </div>
                        <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-2">
                            働く人 (User)
                        </h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                            招待された方、またはフリーランスの方はこちら。<br />
                            まずは個人アカウントを作成します。
                        </p>
                    </button>

                    {/* 2. Sole Proprietor */}
                    <button
                        onClick={() => onSelectType('proprietor')}
                        className="group flex flex-col items-center p-8 bg-white dark:bg-slate-900 rounded-2xl border-2 border-indigo-500 dark:border-indigo-500 shadow-lg shadow-indigo-500/10 hover:shadow-indigo-500/20 transition-all text-center relative overflow-hidden"
                    >
                        <div className="absolute top-0 right-0 bg-indigo-500 text-white text-xs font-bold px-3 py-1 rounded-bl-lg">
                            おすすめ
                        </div>
                        <div className="w-16 h-16 bg-indigo-50 dark:bg-indigo-900/20 rounded-full flex items-center justify-center text-indigo-600 dark:text-indigo-400 mb-6 group-hover:scale-110 transition-transform">
                            <Briefcase size={32} />
                        </div>
                        <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-2">
                            個人事業主
                        </h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                            一人親方やフリーランスで、すぐにお店（屋号）を持ちたい方。<br />
                            <span className="font-bold text-indigo-600 dark:text-indigo-400">個人登録と会社作成</span>を一括で行います。
                        </p>
                    </button>

                    {/* 3. Company */}
                    <button
                        onClick={() => onSelectType('company')}
                        className="group flex flex-col items-center p-8 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 hover:border-amber-500 dark:hover:border-amber-500 hover:shadow-lg transition-all text-center"
                    >
                        <div className="w-16 h-16 bg-amber-50 dark:bg-amber-900/20 rounded-full flex items-center justify-center text-amber-600 dark:text-amber-400 mb-6 group-hover:scale-110 transition-transform">
                            <Building size={32} />
                        </div>
                        <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-2">
                            法人 (Company)
                        </h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                            組織として利用を開始する代表者の方。<br />
                            会社アカウントを作成し、その後メンバーを招待します。
                        </p>
                    </button>
                </div>

                <div className="text-center pt-8">
                    <p className="text-slate-600 dark:text-slate-400">
                        すでにアカウントをお持ちですか？{' '}
                        <button onClick={onLogin} className="text-blue-600 dark:text-blue-400 font-bold hover:underline">
                            ログイン
                        </button>
                    </p>
                </div>
            </div>
        </div>
    );
};
