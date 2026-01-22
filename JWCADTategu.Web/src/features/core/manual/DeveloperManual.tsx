import React from 'react';

export const DeveloperManual: React.FC = () => {
    return (
        <div className="space-y-8 max-w-4xl mx-auto pb-20">
            <section>
                <h2 className="text-2xl font-bold text-slate-800 dark:text-white mb-4 border-b pb-2">Architecture Overview</h2>
                <div className="bg-slate-900 text-slate-100 p-6 rounded-xl shadow-lg font-mono text-sm overflow-x-auto">
                    <pre>{`
[Frontend (React/Vite)]
   │
   ├── Features (Domain Driven Design)
   │     ├── core (Auth, Settings, Manual)
   │     └── plugins (Tategu, Estimate)
   │
   ├── ViewModel (MVVM)
   │     └── useLoginViewModel, useProjectViewModel...
   │
   ├── Infrastructure
   │     ├── ApiClient (Axios wrapper)
   │     └── Repositories (JBWOSRepository)
   │           ├── CloudJBWOSRepository (API)
   │           └── DexieJBWOSRepository (LocalDB)
   │
   ▼
[Backend (PHP 8.5)]
   │
   ├── Router (index.php) -> Controllers
   ├── Auth (JWT, Tenants)
   └── SQLite3 (Data Store)
`}</pre>
                </div>
            </section>

            <section>
                <h2 className="text-2xl font-bold text-slate-800 dark:text-white mb-4 border-b pb-2">Frontend Architecture</h2>
                <div className="space-y-4">
                    <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
                        <h3 className="text-lg font-semibold mb-2 text-purple-600">MVVM Pattern</h3>
                        <p className="text-slate-600 dark:text-slate-300 mb-2">
                            UIロジックと描画を分離するため、MVVM (Model-View-ViewModel) パターンを採用しています。
                        </p>
                        <ul className="list-disc list-inside text-sm text-slate-600 dark:text-slate-400">
                            <li><strong>View (Screens/Components):</strong> 描画のみを担当。ロジックは持ちません。</li>
                            <li><strong>ViewModel (Hooks):</strong> 状態管理とビジネスロジックを担当。テスト可能です。</li>
                            <li><strong>Model (Types/Services):</strong> データ構造とAPI通信を担当します。</li>
                        </ul>
                    </div>
                </div>
            </section>

            <section>
                <h2 className="text-2xl font-bold text-slate-800 dark:text-white mb-4 border-b pb-2">Backend API Specification</h2>
                <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-x-auto">
                    <table className="w-full text-left text-sm text-slate-600 dark:text-slate-300">
                        <thead className="text-xs uppercase bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200">
                            <tr>
                                <th className="px-4 py-2">Method</th>
                                <th className="px-4 py-2">Endpoint</th>
                                <th className="px-4 py-2">Description</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                            <tr>
                                <td className="px-4 py-2 font-mono text-green-600">POST</td>
                                <td className="px-4 py-2 font-mono">/api/auth/login</td>
                                <td className="px-4 py-2">Authenticate user & return JWT</td>
                            </tr>
                            <tr>
                                <td className="px-4 py-2 font-mono text-green-600">POST</td>
                                <td className="px-4 py-2 font-mono">/api/auth/register</td>
                                <td className="px-4 py-2">Create new user & tenant</td>
                            </tr>
                            <tr>
                                <td className="px-4 py-2 font-mono text-blue-600">GET</td>
                                <td className="px-4 py-2 font-mono">/api/projects</td>
                                <td className="px-4 py-2">List all projects for current tenant</td>
                            </tr>
                            <tr>
                                <td className="px-4 py-2 font-mono text-blue-600">GET</td>
                                <td className="px-4 py-2 font-mono">/api/doors</td>
                                <td className="px-4 py-2">List all doors (can filter by project_id)</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </section>

            <section>
                <h2 className="text-2xl font-bold text-slate-800 dark:text-white mb-4 border-b pb-2">Database Schema</h2>
                <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
                    <p className="text-slate-600 dark:text-slate-300 mb-4">
                        Multi-tenantアーキテクチャを採用しています。全てのビジネスデータ（Projects, Doors等）は <code>tenant_id</code> カラムを持ち、クエリ時に必ずフィルタリングされます。
                    </p>
                    <ul className="list-disc list-inside text-sm text-slate-600 dark:text-slate-400">
                        <li><strong>users:</strong> グローバルなユーザー情報</li>
                        <li><strong>tenants:</strong> 組織・ワークスペース</li>
                        <li><strong>memberships:</strong> ユーザーとテナントの多対多リレーション (Role付き)</li>
                    </ul>
                </div>
            </section>
        </div>
    );
};
