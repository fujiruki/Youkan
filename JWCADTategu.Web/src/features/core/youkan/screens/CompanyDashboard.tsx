/**
 * CompanyDashboard.tsx
 * Youkan Enterprise: Company Brain Dashboard
 * 
 * 思想:
 * - "Private Core, Public Volume": 個人の詳細は見せず、量感だけを見せる
 * - "Deep Blue": 忙しさをポジティブ（没頭）な色で表現
 */

import { Activity, Zap } from 'lucide-react';

export const CompanyDashboard: React.FC = () => {
    // Mock Data for Heatmap (3 months, 5 employees)
    // 0: Light Blue (Empty), 1-5: Blue gradients (Busy), 6: Ripple (Overload)

    const employees = ['Alice', 'Bob', 'Charlie', 'Dave', 'Eve'];
    const weeks = Array.from({ length: 12 }, (_, i) => `W${i + 1}`);

    return (
        <div className="p-8 bg-gray-50 min-h-full">
            <header className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-gray-800">Company Dashboard</h1>
                    <p className="text-gray-500">Organizational Overview & Resource Simulation</p>
                </div>
                <button className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg shadow flex items-center gap-2">
                    <Zap className="w-4 h-4" />
                    Simulate New Project
                </button>
            </header>

            {/* Heatmap Section */}
            <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
                <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
                    <Activity className="w-5 h-5 text-blue-600" />
                    Resource Heatmap (Deep Blue)
                </h2>

                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr>
                                <th className="w-32 text-left p-2 text-sm text-gray-500 font-normal">Employee</th>
                                {weeks.map(w => (
                                    <th key={w} className="w-12 text-center p-2 text-xs text-gray-400 font-normal border-l border-gray-100">{w}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {employees.map(emp => (
                                <tr key={emp} className="border-t border-gray-100">
                                    <td className="p-3 font-medium text-gray-700">{emp}</td>
                                    {weeks.map((w) => {
                                        // Mock random load
                                        const load = Math.random();
                                        return (
                                            <td key={w} className="p-1 border-l border-gray-100">
                                                <div
                                                    className="w-full h-8 rounded"
                                                    style={{
                                                        backgroundColor:
                                                            load > 0.9 ? '#1e3a8a' : // Deep Blue (Overloadish)
                                                                load > 0.7 ? '#1d4ed8' :
                                                                    load > 0.5 ? '#3b82f6' :
                                                                        load > 0.3 ? '#93c5fd' :
                                                                            '#eff6ff' // Light Blue (Free)
                                                    }}
                                                    title={`Load: ${Math.round(load * 100)}%`}
                                                />
                                            </td>
                                        );
                                    })}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <div className="mt-4 flex gap-4 text-xs text-gray-500 justify-end">
                    <div className="flex items-center gap-1"><div className="w-3 h-3 bg-blue-50 rounded"></div> Free</div>
                    <div className="flex items-center gap-1"><div className="w-3 h-3 bg-blue-500 rounded"></div> Busy</div>
                    <div className="flex items-center gap-1"><div className="w-3 h-3 bg-blue-900 rounded"></div> Deep Dive (Focused)</div>
                </div>
            </section>

            {/* Project Monitor Section */}
            <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                    <h2 className="text-lg font-bold text-gray-800 mb-4">Active Projects</h2>
                    <div className="space-y-4">
                        {['House A Renovation', 'Office B Furniture', 'Cafe C Interior'].map((proj, i) => (
                            <div key={proj}>
                                <div className="flex justify-between text-sm mb-1">
                                    <span className="font-medium text-gray-700">{proj}</span>
                                    <span className="text-gray-500">{70 - i * 15}%</span>
                                </div>
                                <div className="w-full bg-gray-100 rounded-full h-2">
                                    <div
                                        className="bg-indigo-500 h-2 rounded-full"
                                        style={{ width: `${70 - i * 15}%` }}
                                    ></div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 flex flex-col items-center justify-center text-center">
                    <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center mb-3">
                        <Zap className="w-6 h-6" />
                    </div>
                    <h3 className="text-lg font-bold text-gray-800">Pre-Sales Simulator</h3>
                    <p className="text-gray-500 text-sm mt-1 mb-4">
                        Check resource availability before accepting new orders.
                    </p>
                    <button className="text-indigo-600 hover:text-indigo-700 text-sm font-medium hover:underline">
                        Open Simulator &rarr;
                    </button>
                </div>
            </section>
        </div>
    );
};
