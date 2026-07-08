import { describe, expect, it } from 'vitest';
import { buildCalendarItemsQuery } from './useVolumeCalendarViewModel';

describe('buildCalendarItemsQuery', () => {
	it('grid/range views keep date-range query without gantt mode', () => {
		const query = buildCalendarItemsQuery({
			start: '2026-07-01',
			end: '2026-07-31',
			viewMode: 'grid',
		});

		expect(query).toBe('/calendar/items?start_date=2026-07-01&end_date=2026-07-31');
	});

	it('gantt view asks backend for gantt mode so rows are not limited to visible dates', () => {
		const query = buildCalendarItemsQuery({
			start: '2026-07-01',
			end: '2026-07-31',
			viewMode: 'gantt',
			tenantId: 'tenant-a',
			projectId: 'project-1',
		});

		expect(query).toBe('/calendar/items?start_date=2026-07-01&end_date=2026-07-31&mode=gantt&tenantId=tenant-a&projectId=project-1');
	});
});
