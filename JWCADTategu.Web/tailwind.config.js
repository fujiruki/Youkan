/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                // Emeraldをアクセントカラーとして採用
                // Slateをベース背景色として採用
            },
            fontFamily: {
                sans: ['Inter', 'sans-serif'],
                mono: ['JetBrains Mono', 'monospace'],
            },
            // R-064-Y2: landscape/portrait バリアント用スクリーン定義
            // R-064-Y4: landscape-compact = スマホ横専用（高さ500px以下の横向き）
            screens: {
                landscape: { raw: '(orientation: landscape)' },
                portrait: { raw: '(orientation: portrait)' },
                'landscape-compact': { raw: '(orientation: landscape) and (max-height: 500px)' },
            },
        },
    },
    plugins: [],
}
