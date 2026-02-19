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
    const [name, setName] = useState('');
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

    // Initialize state based on context
    useEffect(() => {
        if (context.initialData) {
            // Edit Mode
            setName(context.initialData.title || context.initialData.name || '');
            setClientName(context.initialData.clientName || context.initialData.client || '');
            setGrossProfitTarget(context.initialData.grossProfitTarget?.toString() || '0');
            setColor(context.initialData.color || '#6366f1');
            setSelectedTenantId(context.initialData.tenantId || '');
            setAssignedTo(context.initialData.assigned_to);
            // Mode is irrelevant for editing, usually we don't change hierarchy in simple edit
            setCreationMode(context.initialData.parentId ? 'child' : 'root');
        } else if (context.parentProject) {
            setCreationMode('child');
            // If child, tenant is strictly parent's tenant
            setSelectedTenantId(context.parentProject.tenantId || '');
            setAssignedTo(context.parentProject.assigned_to);

            // Should also inherit some defaults
            if (context.parentProject.clientName) {
                setClientName(context.parentProject.clientName);
            }
        } else {
            setCreationMode('root');
            // [FIX] Default tenant: use defaultTenantId if provided, regardless of activeScope
            if (context.defaultTenantId) {
                setSelectedTenantId(context.defaultTenantId);
            } else if (context.joinedTenants.length > 0 && context.activeScope === 'company') {
                setSelectedTenantId(context.joinedTenants[0].id);
            } else {
                setSelectedTenantId(''); // Personal
            }
        }
    }, [context.parentProject, context.activeScope, context.defaultTenantId, context.initialData]);

    // When toggling mode from child -> root, enable tenant selection
    useEffect(() => {
        if (creationMode === 'root') {
            // [FIX] If no tenantId selected and defaultTenantId exists, use it
            if (!selectedTenantId && context.defaultTenantId) {
                setSelectedTenantId(context.defaultTenantId);
            } else if (!selectedTenantId && context.activeScope === 'company' && context.joinedTenants.length > 0) {
                setSelectedTenantId(context.joinedTenants[0].id);
            }
        } else if (creationMode === 'child' && context.parentProject) {
            // Revert to parent's tenant
            setSelectedTenantId(context.parentProject.tenantId || '');
        }
    }, [creationMode, context.activeScope]);

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
        name,
        clientName,
        grossProfitTarget,
        color,
        selectedTenantId,
        assignedTo,
        isSubmitting,

        // Setters
        setCreationMode,
        setName,
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
