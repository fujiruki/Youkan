/// <reference types="vite/client" />

declare const __BUILD_TIMESTAMP__: string;

interface ImportMetaEnv {
    readonly VITE_API_URL: string
    // その他の環境変数...
}

interface ImportMeta {
    readonly env: ImportMetaEnv
}
