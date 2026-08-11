import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import simpleModalSource from '../../components/Modal/SimpleModal.tsx?raw';
import decisionModalSource from '../../components/Modal/DecisionDetailModal.tsx?raw';

const globalStyles = readFileSync('src/index.css', 'utf8');

describe('R-075: Flow 上のモーダル入力中は背景アニメーションを停止する', () => {
    it('共通モーダルと判断詳細モーダルが性能隔離用オーバーレイとして識別される', () => {
        expect(simpleModalSource).toContain('data-youkan-modal-overlay');
        expect(decisionModalSource).toContain('data-youkan-modal-overlay');
    });

    it('共通モーダルは大規模な背景画面を毎フレーム再合成する backdrop-filter を使わない', () => {
        expect(simpleModalSource).not.toContain('backdrop-blur');
        expect(decisionModalSource).not.toContain('backdrop-blur');
    });

    it('モーダル表示中だけ React Flow の animated edge を一時停止する', () => {
        expect(globalStyles).toMatch(
            /body:has\(\[data-youkan-modal-overlay\]\)[\s\S]*?\.react-flow__edge\.animated[\s\S]*?animation-play-state:\s*paused/
        );
    });
});
