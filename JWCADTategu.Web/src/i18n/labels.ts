export const t = {
    dashboard: {
        title: "案件一覧",
        createNew: "新規作成",
        noProjects: "まだ案件がありません。新規作成ボタンから作成してください。",
        deleteConfirmProject: "プロジェクトを削除しますか？ 建具データも全て削除されます。",
        totalEstimation: "概算見積合計",
    },
    schedule: {
        title: "建具表",
        image: "イメージ",
        tag: "符号",
        name: "名称",
        dim: "寸法 (W x H)",
        material: "主仕様",
        qty: "数量",
        unitPrice: "単価",
        total: "金額",
        actions: "操作",
        noDoors: "建具が登録されていません。「エディタ」で追加してください。",
        deleteConfirm: "この建具を削除しますか？"
    },
    editor: {
        dimensions: "基本寸法",
        width: "全幅 (W)",
        height: "全高 (H)",
        depth: "見込み (D)",
        calc: "原価積算",
    },
    jbwos: {
        inbox: {
            title: "放り込み箱",
            description: "未分別",
            placeholder: "+ 放り込む（考えてはいけない）",
            empty: "頭の中は空っぽです"
        },
        scheduled: {
            title: "予定",
            description: "RDD未到達",
            empty: "先の予定はありません"
        },
        waiting: {
            title: "判断ボード", // GDB
            description: "今、決めないと詰まる判断",
            empty: "止まっているものはありません"
        },
        ready: {
            title: "今日", // Today
            description: "今日やること（最低限）",
            emptyGeneric: "今日やることを\n1つだけ選びましょう",
            doneForDay: "今日はもう、十分です"
        },
        execution: {
            title: "実行",
            description: "実行中",
            empty: "実行中のものはありません"
        },
        pending: {
            title: "いつか", // Deprecated or kept for legacy
            description: "今は考えない"
        },
        done: {
            title: "記録", // History
            description: "完了履歴",
            empty: "まだ何もありません"
        },
        common: {
            close: "閉じる",
            editPrompt: "タスク名を編集:",
            alerts: {
                readyLimit: "今日の判断リソースは限界です（2件まで）",
                moveFailed: "移動できませんでした"
            }
        }
    }
};
