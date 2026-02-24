import React, { useState } from 'react';
import { useLoginViewModel } from '../hooks/useLoginViewModel';
import { Building2, User } from 'lucide-react';

type AccountTab = 'user' | 'tenant';

export const LoginScreen: React.FC = () => {
    const { login, isLoading, error, debugLogin } = useLoginViewModel();

    // Tab state
    const [activeTab, setActiveTab] = useState<AccountTab>('user');

    // Form States
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        login({ email, password }, activeTab);
    };

    return (
        <div className="min-h-screen bg-slate-100 dark:bg-slate-900 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-fade-in">
                <div className="p-8">
                    <div className="text-center mb-8">
                        <div className="w-16 h-16 bg-blue-600 rounded-2xl mx-auto flex items-center justify-center mb-4 shadow-lg shadow-blue-500/30">
                            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                            </svg>
                        </div>
                        <h1 className="text-2xl font-bold text-slate-800 dark:text-white mb-2">
                            おかえりなさい
                        </h1>
                        <p className="text-slate-500 text-sm">
                            Tategu Design Studioにログイン
                        </p>
                    </div>

                    {/* [v22] Account Type Tabs */}
                    <div className="flex bg-slate-200 dark:bg-slate-700 rounded-lg p-1 mb-6">
                        <button
                            type="button"
                            onClick={() => setActiveTab('user')}
                            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium rounded-md transition-all ${activeTab === 'user'
                                ? 'bg-white dark:bg-slate-600 shadow text-blue-600 dark:text-white'
                                : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
                                }`}
                        >
                            <User size={16} />
                            <span>ユーザーアカウント</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveTab('tenant')}
                            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium rounded-md transition-all ${activeTab === 'tenant'
                                ? 'bg-white dark:bg-slate-600 shadow text-blue-600 dark:text-white'
                                : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
                                }`}
                        >
                            <Building2 size={16} />
                            <span>会社アカウント</span>
                        </button>
                    </div>

                    {error && (
                        <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-lg text-sm border border-red-200">
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="animate-fade-in-up" style={{ animationDelay: '100ms' }}>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                {activeTab === 'tenant' ? '会社のメールアドレス' : 'メールアドレス'}
                            </label>
                            <input
                                type="email"
                                required
                                className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-colors"
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                placeholder={activeTab === 'tenant' ? 'info@company.com' : 'name@example.com'}
                            />
                        </div>

                        <div className="animate-fade-in-up" style={{ animationDelay: '200ms' }}>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                パスワード
                            </label>
                            <input
                                type="password"
                                required
                                className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-colors"
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                placeholder="••••••••"
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow-lg hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed mt-6 transform active:scale-95"
                        >
                            {isLoading ? '処理中...' : (activeTab === 'tenant' ? '会社でログイン' : 'ログイン')}
                        </button>
                    </form>

                    <div className="mt-6 text-center">
                        <button
                            onClick={() => window.location.href = './register'}
                            className="text-sm text-blue-600 hover:text-blue-500 dark:text-blue-400 font-medium hover:underline"
                        >
                            アカウントを新規作成する
                        </button>
                    </div>

                    <div className="mt-8 pt-6 border-t border-slate-200 dark:border-slate-700 space-y-2">
                        <button
                            type="button"
                            onClick={() => debugLogin('tenant')}
                            className="w-full text-center text-[10px] text-slate-400 hover:text-blue-500 transition-colors flex items-center justify-center gap-2 py-1 px-2 border border-dashed border-slate-200 dark:border-slate-700 rounded-md hover:bg-blue-50 dark:hover:bg-blue-900/10"
                        >
                            <span className="p-0.5 bg-slate-100 dark:bg-slate-700 rounded text-[8px]">🏢</span>
                            <span>デバッグ用会社アカウントとしてログイン</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => debugLogin('user')}
                            className="w-full text-center text-[10px] text-slate-400 hover:text-blue-500 transition-colors flex items-center justify-center gap-2 py-1 px-2 border border-dashed border-slate-200 dark:border-slate-700 rounded-md hover:bg-blue-50 dark:hover:bg-blue-900/10"
                        >
                            <span className="p-0.5 bg-slate-100 dark:bg-slate-700 rounded text-[8px]">👤</span>
                            <span>デバッグ用ユーザーアカウントとしてログイン</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* Documentation Link Footer */}
            <div className="fixed bottom-10 text-center w-full">
                <a
                    href="/docs/landing.html"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-slate-400 hover:text-indigo-500 text-sm font-medium transition-colors border-b border-transparent hover:border-indigo-500"
                >
                    Youkanとは？ (Introduction)
                </a>
            </div>

            <div className="fixed bottom-4 text-center w-full text-slate-400 text-xs">
                &copy; 2026 Tategu Design Studio. All rights reserved.
            </div>
        </div>
    );
};
