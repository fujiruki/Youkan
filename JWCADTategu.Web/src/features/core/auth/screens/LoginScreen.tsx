import React, { useState } from 'react';
import { useLoginViewModel } from '../hooks/useLoginViewModel';
import { useAuth } from '../providers/AuthProvider';

export const LoginScreen: React.FC = () => {
    const { login, isLoading, error } = useLoginViewModel();
    const { login: globalLogin } = useAuth(); // Connect ViewModel to Global Context

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const success = await login(email, password);

        if (success) {
            // ViewModel's internal 'user' state is updated, but for global context we might pull from it
            // Actually useLoginViewModel handles the service call and returns true.
            // We can also let ViewModel call globalLogin if we passed it in, OR
            // ViewModel exposes the user object which we can then push to global.
            // Let's improve the flow: ViewModel handles logic, View connects results.
            // Ideally ViewModel should return the User/Tenant on success to be cleaner.
            // But standard MVVM ViewModel holds state.
            // Let's reload page for simplicity? Or fetch user again.
            // For now, reload to trigger AuthProvider checkAuth.
            window.location.reload();
        }
    };

    return (
        <div className="flex items-center justify-center min-h-screen bg-gray-100">
            <div className="w-full max-w-md p-8 bg-white rounded-lg shadow-md">
                <h2 className="mb-6 text-2xl font-bold text-center text-gray-800">
                    JBWOS Login
                </h2>

                {error && (
                    <div className="p-3 mb-4 text-sm text-red-700 bg-red-100 rounded">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit}>
                    <div className="mb-4">
                        <label className="block mb-2 text-sm font-bold text-gray-700" htmlFor="email">
                            Email
                        </label>
                        <input
                            id="email"
                            type="email"
                            className="w-full px-3 py-2 leading-tight text-gray-700 border rounded shadow appearance-none focus:outline-none focus:shadow-outline"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                        />
                    </div>

                    <div className="mb-6">
                        <label className="block mb-2 text-sm font-bold text-gray-700" htmlFor="password">
                            Password
                        </label>
                        <input
                            id="password"
                            type="password"
                            className="w-full px-3 py-2 mb-3 leading-tight text-gray-700 border rounded shadow appearance-none focus:outline-none focus:shadow-outline"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                        />
                    </div>

                    <div className="flex items-center justify-between">
                        <button
                            className={`w-full px-4 py-2 font-bold text-white bg-blue-500 rounded hover:bg-blue-700 focus:outline-none focus:shadow-outline ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                            type="submit"
                            disabled={isLoading}
                        >
                            {isLoading ? 'Signing In...' : 'Sign In'}
                        </button>
                    </div>
                </form>

                <div className="mt-4 text-center text-xs text-gray-400">
                    Secure Login &bull; Tategu Design Studio
                </div>
            </div>
        </div>
    );
};
