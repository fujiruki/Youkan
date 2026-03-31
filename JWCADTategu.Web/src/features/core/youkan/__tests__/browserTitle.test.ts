import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

/**
 * R-004: ブラウザタブタイトルが「Youkan」であることを検証する
 */
describe('R-004: ブラウザタブタイトル', () => {
    it('index.htmlの<title>タグが「Youkan」であること', () => {
        const indexHtml = readFileSync(
            resolve(__dirname, '../../../../..', 'index.html'),
            'utf-8'
        );
        const match = indexHtml.match(/<title>(.*?)<\/title>/);
        expect(match).not.toBeNull();
        expect(match![1]).toBe('Youkan');
    });
});
