import type { FilterMode } from '../types';

interface TenantRef {
  id: string;
  name: string;
  title?: string;
}

export function getPerspectiveLabel(
  filterMode: FilterMode,
  joinedTenants: TenantRef[],
): string {
  switch (filterMode) {
    case 'all': return 'すべて';
    case 'personal': return '個人';
    case 'company': return '会社';
    case 'someday': return 'いつかやる';
    default: {
      const tenant = joinedTenants.find((t) => t.id === filterMode);
      if (!tenant) return 'Unknown Tenant';
      return tenant.title || tenant.name;
    }
  }
}
