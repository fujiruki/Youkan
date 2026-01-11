/**
 * JBWOS Core Types
 * 
 * Defines the contract for the "Universal Judgment Engine".
 * This layer knows NOTHING about "Doors", "Windows", or "Projects".
 */

export type JudgmentStatus = 'inbox' | 'ready' | 'waiting' | 'pending' | 'done';

export interface JudgableItem {
    id: string | number;
    title: string;
    status: JudgmentStatus;

    // Detailed description or context (optional)
    description?: string;

    // Tags for categorization (e.g., "Project A", "Urgent")
    // JBWOS uses these for display grouping but doesn't infer logic from them.
    tags?: string[];

    // Any metadata required by the adapter to write back to the source
    // (e.g., original DB ID, specific type identifiers)
    metadata?: Record<string, any>;
}

export interface JBWOSState {
    items: JudgableItem[];
    inboxItems: JudgableItem[];
    readyItems: JudgableItem[];
    waitingItems: JudgableItem[];
    pendingItems: JudgableItem[];

    // Computed States
    isInboxOverflowing: boolean;
    isStoppingEvent: boolean;
}

export interface JBWOSActions {
    move(id: string | number, to: JudgmentStatus): Promise<void>;
    canMoveToReady(): boolean;
}
