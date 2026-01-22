import React, { useState } from 'react';
import { useLoginViewModel } from '../hooks/useLoginViewModel';

export const LoginScreen: React.FC = () => {
    const { login, register, isLoading, error } = useLoginViewModel();
    const [isRegisterMode, setIsRegisterMode] = useState(false);

    // Form States
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [name, setName] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (isRegisterMode) {
            register({ name, email, password });
        } else {
            login({ email, password });
        }
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
                            {isRegisterMode ? 'アカウント作成' : 'おかえりなさい'}
                        </h1>
                        <p className="text-slate-500 text-sm">
                            {isRegisterMode ? 'Design Studioへようこそ' : 'Tategu Design Studioにログイン'}
                        </p>
                    </div>

                    {error && (
                        <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-lg text-sm border border-red-200">
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-4">
                        {isRegisterMode && (
                            <div className="animate-fade-in-up" style={{ animationDelay: '0ms' }}>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                    お名前
                                </label>
                                <input
                                    type="text"
                                    required
                                    className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-colors"
                                    value={name}
                                    onChange={e => setName(e.target.value)}
                                    placeholder="山田 太郎"
                                />
                            </div>
                        )}

                        <div className="animate-fade-in-up" style={{ animationDelay: '100ms' }}>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                メールアドレス
                            </label>
                            <input
                                type="email"
                                required
                                className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-colors"
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                placeholder="name@example.com"
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
                            {isLoading ? '処理中...' : (isRegisterMode ? 'アカウントを作成' : 'ログイン')}
                        </button>
                    </form>

                    <div className="mt-6 text-center">
                        <button
                            onClick={() => {
                                setIsRegisterMode(!isRegisterMode);
                                setError(null);
                            }}
                            className="text-sm text-blue-600 hover:text-blue-500 dark:text-blue-400 font-medium hover:underline"
                        >
                            {isRegisterMode ? 'すでにアカウントをお持ちの方はこちら' : 'アカウントを新規作成する'}
                        </button>
                    </div>
                </div>
            </div>

            <div className="fixed bottom-4 text-center w-full text-slate-400 text-xs">
                &copy; 2026 Tategu Design Studio. All rights reserved.
            </div>
        </div>
    );
};
