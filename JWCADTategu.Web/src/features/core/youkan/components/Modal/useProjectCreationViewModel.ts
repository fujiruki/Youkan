import { useState, useEffect } from 'react';
import { Project, Member } from '../../types';
import { ApiClient } from '../../../../../api/client';

export interface ProjectCreationContext {
    parentProject?: Project | null;
    activeScope?: 'personal' | 'company';
    defaultTenantId?: string;
    joinedTenants: { id: string; name: string }[];
    initialData?: Project | null; // [NEW] For editing
}

export const useProjectCreationViewModel = (context: ProjectCreationContext) => {
    // Mode: 'child' (create under parent) or 'root' (create independent)
    const [creationMode, setCreationMode] = useState<'child' | 'root'>('root');

    // Form State
    const [title, setTitle] = useState('');
    const [clientName, setClientName] = useState('');
    const [grossProfitTarget, setGrossProfitTarget] = useState('0');
    const [color, setColor] = useState('#6366f1');
    const [selectedTenantId, setSelectedTenantId] = useState('');
    const [assignedTo, setAssignedTo] = useState<string | undefined>(undefined);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // [NEW] Fetch default assignee when tenant changes
    useEffect(() => {
        if (!selectedTenantId) {
            setAssignedTo(undefined);
            return;
        }

        const fetchDefaults = async () => {
            try {
                // We need to fetch members for the selected tenant
                // ApiClient.getMembers usually returns members for current tenant.
                // If the user is selecting a DIFFERENT tenant, we might need an API for that, 
                // OR assume they only create in tenants they are ALREADY in.
                // JoinedTenants info doesn't contain all members.
                // For now, if it's the current tenant, we can use ApiClient.getMembers().
                // If it's a different one, we might need a more specific API like /tenant/:id/members.

                // Assuming for now we use ApiClient.getMembers() which works for the active session context.
                // If this VM is used in a context where they switch tenants, it might need adjustment.
                const members = await ApiClient.getMembers();
                const defaultMember = members.find((m: Member) => m.isDefaultAssignee);
                if (defaultMember) {
                    setAssignedTo(defaultMember.id);
                }
            } catch (e) {
                console.error('Failed to fetch default assignee', e);
            }
        };

        fetchDefaults();
    }, [selectedTenantId]);

    // [NEW] Use a flag to prevent re-initialization on parent render if user already started editing
    const [isInitialized, setIsInitialized] = useState(false);

    // Initialize state based on context
    useEffect(() => {
        // Only run initialization if not yet initialized OR if initialData changed (editing different item)
        // [FIX] REMOVED activeScope from dependency. Parent re-renders (triggering dashboard changes) 
        // should NOT reset the dialog state while it's open.
        if (context.initialData) {
            // Edit Mode
            setTitle(context.initialData.title || context.initialData.name || '');
            setClientName(context.initialData.clientName || context.initialData.client || '');
            setGrossProfitTarget(context.initialData.grossProfitTarget?.toString() || '0');
            setColor(context.initialData.color || '#6366f1');
            setSelectedTenantId(context.initialData.tenantId || '');
            setAssignedTo(context.initialData.assigned_to);
            setCreationMode(context.initialData.parentId ? 'child' : 'root');
            setIsInitialized(true);
        } else if (context.parentProject && !isInitialized) {
            setCreationMode('child');
            setSelectedTenantId(context.parentProject.tenantId || '');
            setAssignedTo(context.parentProject.assigned_to);
            if (context.parentProject.clientName) {
                setClientName(context.parentProject.clientName);
            }
            setIsInitialized(true);
        } else if (!isInitialized) {
            setCreationMode('root');
            if (context.defaultTenantId) {
                setSelectedTenantId(context.defaultTenantId);
            } else if (context.joinedTenants.length > 0 && context.activeScope === 'company') {
                setSelectedTenantId(context.joinedTenants[0].id);
            } else {
                setSelectedTenantId(''); // Personal
            }
            setIsInitialized(true);
        }
    }, [context.parentProject, context.defaultTenantId, context.initialData, isInitialized]);

    // When toggling mode from child -> root, enable tenant selection
    useEffect(() => {
        // Only run logic if user MANUALLY toggles, but avoid resetting if already set
        if (creationMode === 'root') {
            if (!selectedTenantId && context.defaultTenantId) {
                setSelectedTenantId(context.defaultTenantId);
            } else if (!selectedTenantId && context.activeScope === 'company' && context.joinedTenants.length > 0) {
                setSelectedTenantId(context.joinedTenants[0].id);
            }
        } else if (creationMode === 'child' && context.parentProject) {
            setSelectedTenantId(context.parentProject.tenantId || '');
        }
    }, [creationMode]); // [FIX] Removed activeScope dependency

    const getEffectiveTenantId = () => {
        if (creationMode === 'child' && context.parentProject) {
            return context.parentProject.tenantId || null; // Child inherits strictly
        }
        // [FIX] Independent (Root) mode: Trust the selectedTenantId if present.
        // This covers:
        // 1. Company Account (Default selected)
        // 2. Personal Account -> Selected Company manually
        // 3. Personal Account -> Selected "Private" (='' -> returns null)
        return selectedTenantId || null;
    };

    const getEffectiveParentId = () => {
        return (creationMode === 'child' && context.parentProject) ? context.parentProject.id : undefined;
    };

    return {
        // State
        creationMode,
        title,
        clientName,
        grossProfitTarget,
        color,
        selectedTenantId,
        assignedTo,
        isSubmitting,

        // Setters
        setCreationMode,
        setTitle,
        setClientName,
        setGrossProfitTarget,
        setColor,
        setSelectedTenantId,
        setAssignedTo,
        setIsSubmitting,

        // Computed
        getEffectiveTenantId,
        getEffectiveParentId,

        // Helper
        // [FIX] Bug A: Allow tenant selection when joinedTenants exist, regardless of activeScope
        canSelectTenant: creationMode === 'root' && context.joinedTenants.length > 0,
        showLocationSelector: !!context.parentProject,
        parentProjectName: context.parentProject?.title || context.parentProject?.name
    };
};
