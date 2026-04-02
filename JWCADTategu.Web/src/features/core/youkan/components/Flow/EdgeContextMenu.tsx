import { useEffect, useRef } from 'react';

interface EdgeContextMenuProps {
  x: number;
  y: number;
  edgeId: string;
  onDelete: (edgeId: string) => void;
  onClose: () => void;
}

export const EdgeContextMenu: React.FC<EdgeContextMenuProps> = ({
  x,
  y,
  edgeId,
  onDelete,
  onClose,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as HTMLElement)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  return (
    <div
      ref={menuRef}
      className="fixed z-50 bg-white border border-slate-200 rounded-lg shadow-lg py-1 min-w-[160px]"
      style={{ left: x, top: y }}
    >
      <button
        className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 transition-colors"
        onClick={() => {
          onDelete(edgeId);
          onClose();
        }}
      >
        接続を削除
      </button>
    </div>
  );
};
