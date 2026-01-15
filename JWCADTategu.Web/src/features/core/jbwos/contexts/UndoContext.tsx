import React, { createContext, useContext, useState, useCallback, ReactNode, useEffect } from 'react';
import { ApiClient } from '../../../../api/client'; // Adjust path based on location
import { JudgmentStatus } from '../types';

// Types
type ActionType = 'decision' | 'complete' | 'delete' | 'update';

interface UndoAction {
    type: ActionType;
    id: string;
    previousStatus?: JudgmentStatus; // For decision/complete
    previousData?: any;      // For delete/complex update
    description: string;     // For Toast message
    timestamp: number;
}

interface UndoContextType {
    addUndoAction: (action: Omit<UndoAction, 'timestamp'>) => void;
    undo: () => Promise<void>;
    lastAction: UndoAction | null;
    clearUndo: () => void;
}

const UndoContext = createContext<UndoContextType | undefined>(undefined);

export const UndoProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [lastAction, setLastAction] = useState<UndoAction | null>(null);

    const addUndoAction = useCallback((action: Omit<UndoAction, 'timestamp'>) => {
        setLastAction({ ...action, timestamp: Date.now() });
    }, []);

    const clearUndo = useCallback(() => {
        setLastAction(null);
    }, []);

    const undo = useCallback(async () => {
        if (!lastAction) return;

        console.log('[Undo] Reverting action:', lastAction);

        try {
            switch (lastAction.type) {
                case 'decision':
                case 'complete':
                    // Revert status
                    if (lastAction.previousStatus) {
                        await ApiClient.updateItem(lastAction.id, { status: lastAction.previousStatus });
                    }
                    break;

                case 'delete':
                    // Need Re-create logic. 
                    // MVP: If soft delete (archive), just status update. 
                    // If hard delete, we need full data. 
                    // Current deleteItem in repository is destructive or archive?
                    // Repository says: API deleteItem.
                    // If we want to undo delete, we must have saved the data.
                    if (lastAction.previousData) {
                        // Re-create item with same ID if possible, or new ID
                        // API might not support setting ID. 
                        // For MVP: Let's assume we use 'archive' for deletion to enable easy undo?
                        // OR: Assume previousData contains full Item and we call createItem.
                        await ApiClient.createItem(lastAction.previousData);
                    }
                    break;

                case 'update':
                    if (lastAction.previousData) {
                        await ApiClient.updateItem(lastAction.id, lastAction.previousData);
                    }
                    break;
            }

            // Success
            setLastAction(null);
            // We might need to trigger a global refresh? 
            // The components using useJBWOSViewModel will likely not know they need to refresh 
            // unless we trigger a signal or they are polling.
            // For now, let's rely on manual refresh or assume the user navigates/acts.
            // Better: Dispatch a custom window event that ViewModel listens to?
            window.dispatchEvent(new Event('jbwos-data-changed'));

        } catch (error) {
            console.error('[Undo] Failed to undo:', error);
            alert('取り消しに失敗しました。');
        }
    }, [lastAction]);

    // Global Shortcut Listener for Ctrl+Z
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Ignore if typing in input/textarea
            const target = e.target as HTMLElement;
            if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;

            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
                e.preventDefault();
                undo();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [undo]);

    return (
        <UndoContext.Provider value={{ addUndoAction, undo, lastAction, clearUndo }}>
            {children}
        </UndoContext.Provider>
    );
};

export const useUndo = () => {
    const context = useContext(UndoContext);
    if (!context) {
        throw new Error('useUndo must be used within an UndoProvider');
    }
    return context;
};
