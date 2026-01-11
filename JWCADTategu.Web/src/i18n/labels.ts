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
            title: "インボックス",
            description: "放り込む",
            placeholder: "+ 放り込む（考えてはいけない）",
            empty: "頭の中は空っぽです"
        },
        waiting: {
            title: "誰か待ち",
            description: "返信待ち・依頼中",
            empty: "止まっているものはありません"
        },
        ready: {
            title: "今日やる",
            description: "Max 2件まで",
            emptyGeneric: "今日やることを\n1つだけ選びましょう",
            doneForDay: "今日はもう、十分です"
        },
        pending: {
            title: "いつか",
            description: "今は考えない"
        },
        done: {
            title: "今日の成果",
            description: "完了済み",
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
