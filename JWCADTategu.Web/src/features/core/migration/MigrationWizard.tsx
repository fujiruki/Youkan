import React, { useState } from 'react';
import { MigrationService, MigrationProgress } from './MigrationService';

export const MigrationWizard: React.FC = () => {
    const [progress, setProgress] = useState<MigrationProgress | null>(null);
    const [isRunning, setIsRunning] = useState(false);

    const handleStart = async () => {
        if (!confirm('Start migration to Cloud Server? Local data will not be deleted.')) return;

        setIsRunning(true);
        await MigrationService.getInstance().runMigration((p) => {
            setProgress(p);
        });
        setIsRunning(false);
    };

    return (
        <div className="p-6 bg-white rounded-lg shadow-md border border-gray-200">
            <h3 className="text-xl font-bold mb-4 text-gray-800">Cloud Migration Wizard (v7)</h3>

            <p className="text-sm text-gray-600 mb-6">
                Migrate your local data (IndexedDB) to the Cloud Server.
                This will create copies of your Projects and Doors on the server.
                The local data remains safe.
            </p>

            {!progress && !isRunning && (
                <button
                    onClick={handleStart}
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 font-bold"
                >
                    Start Migration
                </button>
            )}

            {progress && (
                <div className="space-y-4">
                    {/* Progress Bar */}
                    <div>
                        <div className="flex justify-between text-sm mb-1">
                            <span>Progress</span>
                            <span>{progress.current} / {progress.total}</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2.5">
                            <div
                                className={`h-2.5 rounded-full ${progress.status === 'error' ? 'bg-red-600' : 'bg-green-600'}`}
                                style={{ width: `${progress.total ? (progress.current / progress.total) * 100 : 0}%` }}
                            ></div>
                        </div>
                    </div>

                    {/* Log Area */}
                    <div className="h-48 overflow-y-auto bg-gray-900 text-green-400 p-3 rounded text-xs font-mono">
                        {progress.log.map((line, i) => (
                            <div key={i}>{line}</div>
                        ))}
                    </div>

                    {progress.status === 'completed' && (
                        <div className="p-3 bg-green-100 text-green-800 rounded">
                            ✅ Migration Complete! You can now switch data source to Cloud in Settings.
                        </div>
                    )}

                    {progress.status === 'error' && (
                        <div className="p-3 bg-red-100 text-red-800 rounded">
                            ❌ Migration Failed. Please check the log.
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
