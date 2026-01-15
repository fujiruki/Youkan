import React, { useEffect, useState } from 'react';
import { Activity } from 'lucide-react';
import { ApiClient } from '../../../../../api/client';

export const HealthCheck: React.FC = () => {
    const [status, setStatus] = useState<'loading' | 'ok' | 'error'>('loading');
    const [details, setDetails] = useState<any>(null);
    const [showDetails, setShowDetails] = useState(false);

    const checkHealth = async () => {
        try {
            const data = await ApiClient.getHealth();
            setDetails(data);
            if (data.status === 'ok' || data.status === 'degraded') {
                setStatus('ok');
            } else {
                setStatus('error');
            }
        } catch (e) {
            setStatus('error');
        }
    };

    useEffect(() => {
        checkHealth();
        // Poll every 30 seconds
        const interval = setInterval(checkHealth, 30000);
        return () => clearInterval(interval);
    }, []);

    if (status === 'error') return null; // Or show red dot? User said "Blue dot if OK".

    return (
        <div className="relative flex items-center">
            {status === 'ok' && (
                <button
                    onClick={() => setShowDetails(!showDetails)}
                    className="relative flex items-center justify-center w-6 h-6 rounded-full hover:bg-slate-700 transition-colors"
                    title="System Status: Operational"
                >
                    <span className="relative flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500"></span>
                    </span>
                </button>
            )}

            {showDetails && details && (
                <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowDetails(false)} />
                    <div className="absolute top-full right-0 mt-2 w-64 p-4 bg-white dark:bg-slate-900 rounded-lg shadow-xl border border-slate-200 dark:border-slate-700 z-50 text-xs">
                        <h4 className="font-bold mb-2 flex items-center gap-2 text-slate-700 dark:text-slate-200">
                            <Activity size={14} /> System Status
                        </h4>
                        <div className="space-y-1 text-slate-600 dark:text-slate-400 font-mono">
                            <div className="flex justify-between">
                                <span>PHP:</span>
                                <span>{details.php?.version}</span>
                            </div>
                            <div className="flex justify-between">
                                <span>DB:</span>
                                <span className={details.database?.status === 'connected' ? 'text-green-500' : 'text-red-500'}>
                                    {details.database?.status}
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span>Items:</span>
                                <span>{details.database?.item_count}</span>
                            </div>
                            <div className="flex justify-between">
                                <span>Protocol:</span>
                                <span>{details.server?.protocol}</span>
                            </div>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};
