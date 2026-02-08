/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                youkan: {
                    base: 'var(--youkan-bg-base)',
                    surface: 'var(--youkan-surface)',
                    text: 'var(--youkan-text)',
                    muted: 'var(--youkan-muted)',
                    primary: 'var(--youkan-primary)',
                    volume: 'var(--youkan-volume)',
                },
            },
            fontFamily: {
                sans: ['Inter', 'sans-serif'],
                mono: ['JetBrains Mono', 'monospace'],
            }
        },
    },
    plugins: [],
}
