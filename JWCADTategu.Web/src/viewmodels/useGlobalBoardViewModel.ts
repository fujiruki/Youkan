import { useMemo } from 'react';
import { useJWOSEngine } from '../jbwos-core/engine';
import { TateguJBWOSAdapter } from '../adapters/tategu-jbwos';
import { JudgableItem } from '../jbwos-core/types';

// Singleton Adapter Instance (or Context-based in larger apps)
const adapter = new TateguJBWOSAdapter();

export function useGlobalBoardViewModel() {

    // Delegate logic to the Universal Engine
    const {
        inboxItems,
        readyItems,
        waitingItems,
        pendingItems,
        isInboxOverflowing,
        isStoppingEvent,
        canMoveToReady,
        move,
        reload
    } = useJWOSEngine(adapter);

    // If View needs specific formatting that Engine doesn't provide?
    // Engine provides basic formatting. View can customize via metadata if needed.

    // Exposed Interface matches what the View expects, but simpler.
    return {
        inboxItems,
        readyItems,
        waitingItems,
        pendingItems,
        isInboxOverflowing,
        isStoppingEvent,
        canMoveToReady,
        moveDoorToStatus: move, // Renaming to match existing prop name for minimal break, or refactor View.
        // Let's keep it 'move' logic but View might need update or we alias here.
        // View expects 'moveDoorToStatus'.
        refresh: reload
    };
}

// Re-export type for View consumption
export type { JudgableItem as DoorWithProject }; // Aliasing for View compatibility for now
