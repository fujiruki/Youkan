import { useState, useCallback, useEffect } from 'react';

interface MenuState {
    x: number;
    y: number;
    targetId: string | null;
}

interface UseItemContextMenuProps {
    onDelete: (id: string) => void;
}

export const useItemContextMenu = ({ onDelete }: UseItemContextMenuProps) => {
    const [menuState, setMenuState] = useState<MenuState | null>(null);
    const [lastTargetId, setLastTargetId] = useState<string | null>(null);

    const handleContextMenu = useCallback((e: React.MouseEvent, id: string) => {
        e.preventDefault();
        const newState = {
            x: e.clientX,
            y: e.clientY,
            targetId: id
        };
        setMenuState(newState);
        setLastTargetId(id);
    }, []);

    const closeMenu = useCallback(() => {
        setMenuState(null);
    }, []);

    // Global Shortcut Listener (Delete Key)
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Delete' && (menuState?.targetId || lastTargetId)) {
                const targetId = menuState?.targetId || lastTargetId;
                if (!targetId) return;

                // Precaution: Don't trigger if typing in an input
                if (
                    document.activeElement instanceof HTMLInputElement ||
                    document.activeElement instanceof HTMLTextAreaElement
                ) {
                    return;
                }

                e.preventDefault();
                onDelete(targetId);
                closeMenu();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [menuState, lastTargetId, onDelete, closeMenu]);

    return {
        menuState,
        lastTargetId,
        setLastTargetId, // Expose for left-click selection
        handleContextMenu,
        closeMenu
    };
};
