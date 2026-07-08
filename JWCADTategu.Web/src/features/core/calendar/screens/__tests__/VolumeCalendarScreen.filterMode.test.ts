import { describe, expect, it } from 'vitest';
import type { FilterMode, Item } from '../../../youkan/types';
import { isDisplayableCalendarItem } from '../VolumeCalendarScreen';

const filterByMode = (item: Pick<Item, 'tenantId' | 'domain'>, filterMode: FilterMode): boolean => {
	if (filterMode === 'all') return true;
	if (filterMode === 'personal') return (!item.tenantId || item.tenantId === '') && item.domain !== 'business';
	if (filterMode === 'company') return !!item.tenantId || item.domain === 'business';
	return item.tenantId === filterMode;
};

describe('VolumeCalendarScreen filterMode logic', () => {
	it('company includes business-domain items even when tenantId is empty', () => {
		expect(filterByMode({ tenantId: '', domain: 'business' }, 'company')).toBe(true);
	});

	it('personal excludes business-domain items even when tenantId is empty', () => {
		expect(filterByMode({ tenantId: '', domain: 'business' }, 'personal')).toBe(false);
	});

	it('tenant filter only includes the exact tenant', () => {
		expect(filterByMode({ tenantId: 'tenant-a', domain: 'business' }, 'tenant-a' as FilterMode)).toBe(true);
		expect(filterByMode({ tenantId: 'tenant-b', domain: 'business' }, 'tenant-a' as FilterMode)).toBe(false);
	});

	it('deleted or archived items are not displayable even when unfinished', () => {
		expect(isDisplayableCalendarItem({ status: 'inbox', deletedAt: 123, isArchived: false })).toBe(false);
		expect(isDisplayableCalendarItem({ status: 'focus', deletedAt: null, isArchived: true })).toBe(false);
		expect(isDisplayableCalendarItem({ status: 'trash', deletedAt: null, isArchived: false })).toBe(false);
		expect(isDisplayableCalendarItem({ status: 'archive', deletedAt: null, isArchived: false })).toBe(false);
		expect(isDisplayableCalendarItem({ status: 'inbox', deletedAt: null, isArchived: false })).toBe(true);
	});
});
