import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const cssPath = resolve(dirname(fileURLToPath(import.meta.url)), './index.css');
const css = readFileSync(cssPath, 'utf-8');

describe('index.css 印刷用スタイル(R-102)', () => {
    it('@media print内でフローチャート(flow-canvas-root)を用紙サイズにフィットさせている', () => {
        const printBlockMatch = css.match(/@media print\s*{([\s\S]*)}\s*$/);
        expect(printBlockMatch).not.toBeNull();
        const printBlock = printBlockMatch![1];

        expect(printBlock).toMatch(/flow-canvas-root/);
        expect(printBlock).toMatch(/width:\s*100%/);
        expect(printBlock).toMatch(/height:\s*100vh/);
    });
});
