import React, { useRef, useState } from 'react';

const HOVER_DELAY_MS = 1000;

interface HoverTooltipProps {
  label: string;
  children: React.ReactNode;
}

// R-116: フロー操作パネルのボタン・スライダーに1000msホバーで小さなヒントを出す共通部品。
// position:fixedで表示するため、ラップ対象の既存absolute配置には一切影響しない
export const HoverTooltip: React.FC<HoverTooltipProps> = ({ label, children }) => {
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapperRef = useRef<HTMLSpanElement>(null);

  const clearTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const handleMouseEnter = () => {
    clearTimer();
    timerRef.current = setTimeout(() => {
      const rect = wrapperRef.current?.getBoundingClientRect();
      setCoords({ top: (rect?.bottom ?? 0) + 4, left: (rect?.left ?? 0) + (rect?.width ?? 0) / 2 });
    }, HOVER_DELAY_MS);
  };

  const hide = () => {
    clearTimer();
    setCoords(null);
  };

  return (
    <span ref={wrapperRef} onMouseEnter={handleMouseEnter} onMouseLeave={hide} onMouseDown={hide}>
      {children}
      {coords && (
        <span
          className="fixed z-50 -translate-x-1/2 whitespace-nowrap rounded bg-slate-800 px-2 py-1 text-xs text-white pointer-events-none"
          style={{ top: coords.top, left: coords.left }}
        >
          {label}
        </span>
      )}
    </span>
  );
};
