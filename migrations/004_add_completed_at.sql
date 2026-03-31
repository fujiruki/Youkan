-- Migration: itemsテーブルにcompleted_atカラムを追加
-- completed_at: status=doneに変更した瞬間のUnixタイムスタンプ。done以外に戻したらNULLにリセット
ALTER TABLE items ADD COLUMN completed_at INTEGER;
