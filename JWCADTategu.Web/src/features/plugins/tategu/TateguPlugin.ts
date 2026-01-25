/**
 * Tategu Plugin - Entry Point
 * 
 * 建具プラグインをJBWOS Coreに登録するエントリーポイント。
 * アプリ起動時に initializeTateguPlugin() を呼び出して初期化する。
 */

// import { projectCategoryManager } from '../../core/jbwos/services/ProjectCategoryManager';
import { ProjectCategory } from '../../core/jbwos/types';

export const TATEGU_PLUGIN_ID = 'tategu-core';

/**
 * 建具プロジェクトカテゴリ定義
 */
const tateguCategories: ProjectCategory[] = [
    {
        id: 'tategu-standard',
        name: '建具プロジェクト（標準）',
        icon: '🚪',
        defaultTasks: [
            { title: '現地調査・採寸', estimatedMinutes: 120 },
            { title: '姿図作成', estimatedMinutes: 180 },
            { title: '見積書作成', estimatedMinutes: 60 },
            { title: '製作', estimatedMinutes: 480 },
            { title: '塗装', estimatedMinutes: 240 },
            { title: '取付', estimatedMinutes: 120 }
        ],
        isCustom: false,
        createdAt: Date.now()
    },
    {
        id: 'tategu-renovation',
        name: '建具リフォーム',
        icon: '🔧',
        defaultTasks: [
            { title: '現地調査', estimatedMinutes: 60 },
            { title: '見積書作成', estimatedMinutes: 30 },
            { title: '部材調達', estimatedMinutes: 60 },
            { title: '施工', estimatedMinutes: 180 }
        ],
        isCustom: false,
        createdAt: Date.now()
    }
];

/**
 * 建具プラグインを初期化し、JBWOS Coreにカテゴリを登録する
 */
export function initializeTateguPlugin(): void {
    // [Cloud Phase 9]
    // Categories should be managed via Repository/DB.
    // Plugin categories are temporarily disabled from auto-registration.
    // Ensure they are available via Repository seeder or migrations.
    /*
    projectCategoryManager.addCategoriesFromPlugin(
        TATEGU_PLUGIN_ID,
        tateguCategories
    );
    */
    console.log('[Tategu Plugin] Registered project categories:', tateguCategories.map(c => c.name));
}

/**
 * 建具プラグインを無効化し、カテゴリ登録を解除する
 */
export function unloadTateguPlugin(): void {
    // projectCategoryManager.removeCategoriesFromPlugin(TATEGU_PLUGIN_ID);
    console.log('[Tategu Plugin] Unregistered project categories');
}
