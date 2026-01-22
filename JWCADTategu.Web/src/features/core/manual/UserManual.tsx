import React from 'react';

export const UserManual: React.FC = () => {
    return (
        <div className="space-y-8 max-w-4xl mx-auto pb-20">
            <section>
                <h2 className="text-2xl font-bold text-slate-800 dark:text-white mb-4 border-b pb-2">はじめに</h2>
                <div className="prose dark:prose-invert">
                    <p>
                        Tategu Design Studio JBWOS (Joinery Basic Work OS) へようこそ。<br />
                        このシステムは、建具屋さんのための見積・工程・顧客管理を統合したオールインワンシステムです。
                    </p>
                </div>
            </section>

            <section>
                <h2 className="text-2xl font-bold text-slate-800 dark:text-white mb-4 border-b pb-2">ダッシュボード (Dashboard)</h2>
                <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
                    <h3 className="text-lg font-semibold mb-2 text-blue-600">主な機能</h3>
                    <ul className="list-disc list-inside space-y-2 text-slate-600 dark:text-slate-300">
                        <li><strong>Inbox (今日やること):</strong> 未処理のタスクや案件がここに集まります。毎朝ここを確認して、今日の計画を立てましょう。</li>
                        <li><strong>Projects (案件一覧):</strong> 進行中の現場や見積依頼が一覧表示されます。</li>
                        <li><strong>Statistics (売上概況):</strong> 今月の売上見込みや工数状況をグラフで確認できます。</li>
                    </ul>
                    <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/30 rounded-lg text-sm text-blue-800 dark:text-blue-200">
                        <span className="font-bold">💡 Tip:</span> 案件が増えてきたら「Focus」タブを使って、今週やるべきことに集中しましょう。
                    </div>
                </div>
            </section>

            <section>
                <h2 className="text-2xl font-bold text-slate-800 dark:text-white mb-4 border-b pb-2">案件・建具管理 (Projects & Doors)</h2>
                <div className="space-y-4">
                    <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
                        <h3 className="text-lg font-semibold mb-2">案件の作成と見積</h3>
                        <p className="text-slate-600 dark:text-slate-300 mb-2">
                            新しい依頼が来たら、まず「プロジェクト」を作成します。
                        </p>
                        <ul className="list-disc list-inside space-y-1 text-slate-600 dark:text-slate-300">
                            <li><strong>詳細情報の入力:</strong> 現場名、元請け業者、納期などを入力します。</li>
                            <li><strong>建具表の作成:</strong> 「成果物 (Deliverables)」タブから、製作する建具や枠を追加します。JWCADデータのインポートにも対応しています。</li>
                            <li><strong>コスト計算:</strong> 材料費、労務費を入力すると、自動で見積金額が算出されます。</li>
                        </ul>
                    </div>
                </div>
            </section>

            <section>
                <h2 className="text-2xl font-bold text-slate-800 dark:text-white mb-4 border-b pb-2">クラウドモードとローカルモード</h2>
                <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
                    <p className="text-slate-600 dark:text-slate-300 mb-4">
                        設定画面から「Cloud APIを使用する」を切り替えることで、データの保存先を変更できます。
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="p-4 border border-green-200 bg-green-50 dark:bg-green-900/20 rounded-lg">
                            <h4 className="font-bold text-green-800 dark:text-green-300 mb-2">🌐 Cloud Mode (推奨)</h4>
                            <p className="text-sm text-green-700 dark:text-green-400">
                                データはサーバーに安全に保存されます。<br />
                                複数人での共有や、外出先からのアクセスが可能です。
                            </p>
                        </div>
                        <div className="p-4 border border-orange-200 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
                            <h4 className="font-bold text-orange-800 dark:text-orange-300 mb-2">💻 Local Mode</h4>
                            <p className="text-sm text-orange-700 dark:text-orange-400">
                                データはお使いのブラウザ内 (IndexedDB) にのみ保存されます。<br />
                                オフラインでも動作しますが、データのバックアップは自己責任となります。
                            </p>
                        </div>
                    </div>
                </div>
            </section>
        </div>
    );
};
