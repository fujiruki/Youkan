# Youkan — R-031 実装タスク

**ブランチ**: `feature/R-031-foray-and-tts`
**Plan**: `C:\Users\fjtsu\.claude\plans\elegant-whistling-unicorn.md`
**目的**: 過去仕様書から発掘した目玉機能2つを復活実装
- F-19: ForAI機能（現フィルタ表示中アイテムを markdown 出力 → クリップボード/ダウンロード）
- F-20: タスク読み上げ機能（Web Speech API、優先順位順、歌詞型スクロール、一時停止/再生/10秒戻る）

## 絶対ルール
- 指揮AIはコード直接編集しない、Agent委譲、`model="sonnet"`
- TDD: テスト先行 → Red → 実装 → Green
- 仕様書先行 → コード実装
- ステップ単位で1コミット
- ステップ3-A と 3-B は並列実行（独立Agent、別コンポーネント）

## 過去仕様書（出典）
- `docs/SPEC/archives/ForAI機能.md`
- `docs/SPEC/archives/読み上げ機能.md`
- `docs/SPEC/archives/20260202_Youkanの概要と用語.md`

## 現コード適合の判断（仕様書曖昧点の解消）
| 項目 | 決定 |
|---|---|
| ForAI ボタン配置 | PC: ヘッダー / スマホ: メニュー |
| 読み上げ ボタン配置 | PC: ヘッダー / スマホ: フローティング |
| 出力形式 | markdown のみ（v1） |
| Someday を含めるか | 含めない |
| 完了済みを含めるか | 含めない |
| 読み上げ文言 | "{プロジェクト名} の {タイトル}" |

---

## ステップ

### ステップ1: 仕様書更新 [Agent-Spec]
- `docs/requests.md` → `docs/request_log.md` に R-031 移記（2026-05-07）
- `docs/SPEC/02_機能仕様.md` に F-19・F-20 追記
- `docs/SPEC/03_画面設計.md` に ForAiModal・SpeechView 仕様
- `docs/SPEC/05_技術設計.md` に Web Speech API ラッパー、clipboard ユーティリティ、リアクティブ伝播パターン
- `docs/SPEC/06_変更履歴.md` に R-031 エントリ
- コードは触らない

### ステップ2: 共通ユーティリティ実装 [Agent-Foundation]
- `src/lib/clipboard.ts` + テスト（copyToClipboard / downloadText / downloadMarkdown）
- `src/hooks/useMediaQuery.ts` + テスト（useMediaQuery / useIsMobile）
- `src/features/core/youkan/logic/speechSynthesis.ts` + テスト（YoukanSpeechSynthesis ラッパー）
- `src/features/core/youkan/hooks/useSpeechSynthesis.ts` + テスト
- `src/features/core/youkan/logic/forAiExporter.ts` + テスト（pure function）
- `src/features/core/youkan/logic/perspectiveLabel.ts` + テスト
- TDD: テスト先行

### ステップ3-A: ForAI機能実装 [Agent-ForAI、ステップ2と独立]
- `src/features/core/youkan/components/ForAi/ForAiButton.tsx`
- `src/features/core/youkan/components/ForAi/ForAiModal.tsx`
- `YoukanHeader.tsx` に PC 配置（Settings の隣）
- `MenuDrawer.tsx` に スマホ配置
- TDD: ForAiModal の挙動テスト

### ステップ3-B: 読み上げ機能実装 [Agent-Speech、ステップ3-Aと並列]
- `src/features/core/youkan/components/Speech/SpeechButton.tsx`
- `src/features/core/youkan/components/Speech/SpeechView.tsx`
- `YoukanHeader.tsx` に PC 配置（ForAI の隣）
- スマホは SideMemoWidget パターンで `fixed bottom-20 right-4 z-50` フローティング
- TDD: SpeechView の挙動テスト（Speech API モック）

### ステップ4: マージ＆デプロイ [指揮AI]
- ローカル動作確認（PC/スマホで両機能）
- master へマージ
- `upload.ps1` でデプロイ
- 本番動作確認

## メンテナンス則（恒久）
- ForAI 出力は markdown 1本に集約
- Speech は単一 hook で状態管理
- ボタン配置はヘッダー集約 + スマホ別経路
- Someday は ForAI/読み上げ対象外

## フォローアップ（R-031完了後・別タスク）
- R-032: archive 全体走査して未実装機能を発掘 → 仕様書化（実装はさらに後）
