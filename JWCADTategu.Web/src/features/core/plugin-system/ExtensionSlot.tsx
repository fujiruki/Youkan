import React from 'react';
import { PluginRegistry } from '../../plugins/registry';

interface ExtensionSlotProps {
    point: string;
    context: any;
}

/**
 * ExtensionSlot
 * 
 * 指定された拡張ポイント（point）に関連付けられたコンポーネントを
 * PluginRegistryから取得して描画します。
 * WordPressの `do_action` や `apply_filters` のような役割を果たします。
 */
export const ExtensionSlot: React.FC<ExtensionSlotProps> = ({ point, context }) => {
    // レジストリから拡張ポイントに紐づくコンポーネント定義を取得
    const extensions = PluginRegistry[point] || [];

    // 条件に合致するものだけをフィルタリング
    const activeExtensions = extensions.filter(ext => {
        if (!ext.condition) return true;
        return ext.condition(context);
    });

    if (activeExtensions.length === 0) return null;

    return (
        <>
            {activeExtensions.map(ext => {
                const Component = ext.component;
                return <Component key={ext.id} {...context} />;
            })}
        </>
    );
};
