import React from 'react';

export const UserManual: React.FC = () => {
    return (
        <div className="space-y-12 max-w-4xl mx-auto pb-12">

            {/* Introduction Section */}
            <section className="animate-fade-in-up">
                <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl p-8 text-white shadow-lg">
                    <h2 className="text-3xl font-bold mb-4">Just Be With Out Stress</h2>
                    <p className="text-lg leading-relaxed opacity-90">
                        「Tategu Design Studio」は、建具屋の、建具屋による、建具屋のための生産管理システムです。<br />
                        見積から製作、そして施工まで。日々の業務におけるストレスを最小限にし、
                        「作る喜び」に集中できる環境を提供することを目指しています。
                    </p>
                </div>
            </section>

            {/* Features Grid */}
            <section className="animate-fade-in-up delay-100">
                <h3 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-6 flex items-center gap-2">
                    <span className="p-1 bg-indigo-100 dark:bg-indigo-900 rounded text-indigo-600 dark:text-indigo-400">⚡</span>
                    主な機能 (Main Features)
                </h3>
                <div className="grid md:grid-cols-2 gap-6">
                    <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
                        <h4 className="font-bold text-lg text-indigo-600 dark:text-indigo-400 mb-2">📁 プロジェクト管理</h4>
                        <p className="text-slate-600 dark:text-slate-400 text-sm">
                            物件ごとの情報管理。見積、図面、工程を一元管理し、過去のデータも瞬時に検索可能です。
                        </p>
                    </div>
                    <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
                        <h4 className="font-bold text-lg text-emerald-600 dark:text-emerald-400 mb-2">📝 デジタル建具表</h4>
                        <p className="text-slate-600 dark:text-slate-400 text-sm">
                            紙の建具表はもう不要です。仕様変更もリアルタイムに反映され、現場との共有もスムーズに。
                        </p>
                    </div>
                    <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
                        <h4 className="font-bold text-lg text-amber-600 dark:text-amber-400 mb-2">💰 自動積算・見積</h4>
                        <p className="text-slate-600 dark:text-slate-400 text-sm">
                            登録した寸法と仕様から、材料費と加工費を自動計算。見積書作成の手間を大幅に削減します。
                        </p>
                    </div>
                    <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
                        <h4 className="font-bold text-lg text-rose-600 dark:text-rose-400 mb-2">📐 JWCAD / DXF連携</h4>
                        <p className="text-slate-600 dark:text-slate-400 text-sm">
                            JWCADで作成した図面データをドラッグ＆ドロップで取り込み可能。二度手間をなくします。
                        </p>
                    </div>
                </div>
            </section>

            {/* Operation Guide */}
            <section className="animate-fade-in-up delay-200">
                <h3 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-6 flex items-center gap-2">
                    <span className="p-1 bg-green-100 dark:bg-green-900 rounded text-green-600 dark:text-green-400">📖</span>
                    操作ガイド (Quick Guide)
                </h3>

                <div className="space-y-6">
                    {/* Step 1 */}
                    <div className="flex gap-4">
                        <div className="flex-shrink-0 w-10 h-10 bg-slate-200 dark:bg-slate-700 rounded-full flex items-center justify-center font-bold text-slate-600 dark:text-slate-300">
                            1
                        </div>
                        <div className="flex-1">
                            <h4 className="text-lg font-bold text-slate-800 dark:text-slate-200 mb-2">プロジェクトの作成</h4>
                            <p className="text-slate-600 dark:text-slate-400 leading-relaxed mb-3">
                                ダッシュボードの「Inbox」またはプロジェクト一覧から「新規プロジェクト」を作成します。<br />
                                物件名を入力してEnterを押すだけで、専用のワークスペースが生成されます。
                            </p>
                            <div className="p-3 bg-slate-100 dark:bg-slate-900 rounded border border-slate-200 dark:border-slate-800 text-xs text-slate-500">
                                Tip: プロジェクト名は後からでも変更可能です。まずは仮称でもOKです。
                            </div>
                        </div>
                    </div>

                    {/* Step 2 */}
                    <div className="flex gap-4">
                        <div className="flex-shrink-0 w-10 h-10 bg-slate-200 dark:bg-slate-700 rounded-full flex items-center justify-center font-bold text-slate-600 dark:text-slate-300">
                            2
                        </div>
                        <div className="flex-1">
                            <h4 className="text-lg font-bold text-slate-800 dark:text-slate-200 mb-2">建具データの登録</h4>
                            <p className="text-slate-600 dark:text-slate-400 leading-relaxed mb-3">
                                プロジェクト内の「建具一覧」で「+ 追加」ボタンを押します。<br />
                                寸法（W, H, D）や仕様（樹種、框サイズ）を入力すると、自動的に展開図のプレビューが生成されます。
                            </p>
                        </div>
                    </div>

                    {/* Step 3 */}
                    <div className="flex gap-4">
                        <div className="flex-shrink-0 w-10 h-10 bg-slate-200 dark:bg-slate-700 rounded-full flex items-center justify-center font-bold text-slate-600 dark:text-slate-300">
                            3
                        </div>
                        <div className="flex-1">
                            <h4 className="text-lg font-bold text-slate-800 dark:text-slate-200 mb-2">見積書の出力</h4>
                            <p className="text-slate-600 dark:text-slate-400 leading-relaxed mb-3">
                                データが揃ったら「見積」タブへ移動。<br />
                                「一括見積計算」を実行すると、設定された単価とマスタ情報に基づいて金額が算出されます。<br />
                                必要に応じて手動で調整し、ExcelやPDFとしてエクスポートできます。
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            {/* Support Info */}
            <section className="animate-fade-in-up delay-300 pt-8 border-t border-slate-200 dark:border-slate-700">
                <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800 rounded-xl p-6">
                    <h3 className="text-lg font-bold text-blue-800 dark:text-blue-300 mb-2">お困りですか？</h3>
                    <p className="text-blue-700 dark:text-blue-400 text-sm mb-4">
                        システムの不具合や、操作方法に関するご質問は、開発チームへお問い合わせください。
                    </p>
                    <div className="flex flex-wrap gap-3">
                        <span className="px-3 py-1 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded border border-slate-200 dark:border-slate-700 text-xs shadow-sm">
                            Version: 1.0.0 (Beta)
                        </span>
                        <span className="px-3 py-1 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded border border-slate-200 dark:border-slate-700 text-xs shadow-sm">
                            Support: support@tategu-studio.com
                        </span>
                    </div>
                </div>
            </section>
        </div>
    );
};
