import React, { useState } from 'react';
import { User, Briefcase, Building, ArrowLeft, Loader2 } from 'lucide-react';
import { useLoginViewModel } from '../hooks/useLoginViewModel';

interface RegistrationFormProps {
    type: 'user' | 'proprietor' | 'company';
    onBack: () => void;
}

export const RegistrationForm: React.FC<RegistrationFormProps> = ({ type, onBack }) => {
    const { register, error, loading } = useLoginViewModel();
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [companyName, setCompanyName] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // Call ViewModel register
        await register(name, email, password, type, companyName);
        // Note: Redirect on success is handled by ViewModel/Router
    };

    const getFormTitle = () => {
        switch (type) {
            case 'user': return '働く人 (User) 登録';
            case 'proprietor': return '個人事業主 登録';
            case 'company': return '法人 (Company) 登録';
        }
    };

    const getFormDescription = () => {
        switch (type) {
            case 'user': return '基本情報を入力してアカウントを作成します。';
            case 'proprietor': return 'あなたのアカウントと、屋号（会社）を同時に作成します。';
            case 'company': return '会社アカウントと、管理者アカウントを作成します。';
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-4">
            <div className="max-w-md w-full bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl p-8">

                <button onClick={onBack} className="flex items-center text-sm text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 mb-6 transition-colors">
                    <ArrowLeft size={16} className="mr-1" />
                    戻る
                </button>

                <div className="text-center mb-8">
                    <div className="inline-flex p-3 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 mb-4">
                        {type === 'user' && <User size={24} />}
                        {type === 'proprietor' && <Briefcase size={24} />}
                        {type === 'company' && <Building size={24} />}
                    </div>
                    <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100">
                        {getFormTitle()}
                    </h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
                        {getFormDescription()}
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">
                    {/* Common: Name */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                            {type === 'company' ? '代表者 氏名' : 'お名前 (Full Name)'}
                        </label>
                        <input
                            type="text"
                            required
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-blue-500"
                            placeholder="山田 太郎"
                        />
                    </div>

                    {/* Common: Email */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                            メールアドレス
                        </label>
                        <input
                            type="email"
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-blue-500"
                            placeholder="your@email.com"
                        />
                    </div>

                    {/* Company Name (Proprietor & Company only) */}
                    {(type === 'proprietor' || type === 'company') && (
                        <div className="pt-2 animate-fade-in">
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                {type === 'proprietor' ? '屋号 (Store/Brand Name)' : '会社名 (Company Name)'}
                            </label>
                            <input
                                type="text"
                                required
                                value={companyName}
                                onChange={(e) => setCompanyName(e.target.value)}
                                className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-blue-500"
                                placeholder={type === 'proprietor' ? '山田建具店' : '株式会社 鈴木建設'}
                            />
                            <p className="text-xs text-slate-500 mt-1">
                                {type === 'proprietor'
                                    ? 'この名前で自動的に会社アカウントが作成されます。'
                                    : 'この名前でテナントが作成されます。'}
                            </p>
                        </div>
                    )}

                    {/* Common: Password */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                            パスワード
                        </label>
                        <input
                            type="password"
                            required
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-blue-500"
                            placeholder="・ ・ ・ ・ ・ ・ ・ ・"
                        />
                    </div>

                    {/* Error Message */}
                    {error && (
                        <div className="p-3 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-sm rounded-lg">
                            {error}
                        </div>
                    )}

                    {/* Submit Button */}
                    <button
                        type="submit"
                        disabled={loading}
                        className={`w-full py-3 rounded-lg font-bold text-white transition-all transform active:scale-95
                            ${loading ? 'opacity-70 cursor-wait' : ''}
                            ${type === 'proprietor'
                                ? 'bg-indigo-600 hover:bg-indigo-500 shadow-lg shadow-indigo-500/30'
                                : type === 'company'
                                    ? 'bg-amber-600 hover:bg-amber-500 shadow-lg shadow-amber-500/30'
                                    : 'bg-blue-600 hover:bg-blue-500 shadow-lg shadow-blue-500/30'
                            }
                        `}
                    >
                        {loading ? (
                            <span className="flex items-center justify-center gap-2">
                                <Loader2 className="animate-spin" size={18} />
                                処理中...
                            </span>
                        ) : (
                            '登録する'
                        )}
                    </button>
                </form>
            </div>
        </div>
    );
};
