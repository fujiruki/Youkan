import { useState } from 'react';
import { DEBUG_MODE, DEBUG_INFO } from '../../config/debug';
import { X } from 'lucide-react';

/**
 * Debug Banner Component
 * Displays build time and debug information at the top of all screens
 */
export const DebugBanner: React.FC = () => {
    const [isVisible, setIsVisible] = useState(true);

    if (!DEBUG_MODE || !isVisible) return null;

    return (
        <div style={{
            backgroundColor: '#1e293b',
            borderBottom: '2px solid #3b82f6',
            color: '#60a5fa',
            padding: '4px 12px',
            fontSize: '12px',
            fontFamily: 'monospace',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
            flexShrink: 0
        }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                    onClick={() => setIsVisible(false)}
                    style={{
                        background: 'none',
                        border: 'none',
                        color: 'inherit',
                        cursor: 'pointer',
                        padding: '2px',
                        display: 'flex',
                        alignItems: 'center'
                    }}
                    title="閉じる"
                >
                    <X size={14} />
                </button>
                <strong>🔧 DEBUG MODE</strong>
                <span style={{ marginLeft: '16px' }}>
                    ビルド時刻: <strong>{DEBUG_INFO.buildTime}</strong>
                </span>
            </div>
            <div style={{ fontSize: '10px', opacity: 0.8 }}>
                {DEBUG_INFO.mode.toUpperCase()}
            </div>
        </div>
    );
};

/**
 * DebugBanner用のスペーサー
 * メインコンテンツがバナーの下に隠れないようにする
 */
export const DebugBannerSpacer: React.FC = () => {
    if (!DEBUG_MODE) return null;

    return <div style={{ height: '28px' }} />;
};
