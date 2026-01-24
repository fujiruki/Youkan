import React, { useEffect } from 'react';
import { useLoginViewModel } from '../hooks/useLoginViewModel';

export const LogoutScreen: React.FC = () => {
    const { logout } = useLoginViewModel();

    useEffect(() => {
        logout();
    }, []);

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-100 dark:bg-slate-900">
            <div className="text-center">
                <h2 className="text-xl font-bold mb-4">Logging out...</h2>
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            </div>
        </div>
    );
};
