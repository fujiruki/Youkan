import { ManufacturingProjectFields } from './manufacturing/components/ManufacturingProjectFields';

// 拡張ポイントの定義型
interface ExtensionDefinition {
    id: string;
    component: React.FC<any>;
    condition?: (context: any) => boolean;
}

interface ExtensionRegistry {
    [point: string]: ExtensionDefinition[];
}

/**
 * PluginRegistry
 * 
 * アプリケーション全体のプラグイン拡張ポイントを定義します。
 * 各プラグインはここで自身のコンポーネントを特定のポイントにフックします。
 */
export const PluginRegistry: ExtensionRegistry = {
    // プロジェクト作成モーダルのフィールド拡張
    'project-creation-fields': [
        {
            id: 'manufacturing-fields',
            component: ManufacturingProjectFields,
            // 会社スコープ かつ 製造業プラグインが有効な場合のみ表示
            condition: (context: any) => {
                return context.activeScope === 'company' &&
                    (context.tenant?.config?.plugins?.manufacturing === true ||
                        // フォールバック: configがない場合も会社モードなら一旦出すか、あるいはconfig必須にするか
                        // 現状の実装に合わせて config?.plugins?.manufacturing をチェック
                        context.tenant?.config?.plugins?.manufacturing);
            }
        }
    ]
};
