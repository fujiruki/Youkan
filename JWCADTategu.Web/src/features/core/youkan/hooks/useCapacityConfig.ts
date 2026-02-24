import { useState, useCallback, useEffect } from 'react';
import { CapacityConfig } from '../types';
import { CloudYoukanRepository } from '../repositories/CloudYoukanRepository';

import { getDailyCapacity, isHoliday } from '../logic/capacity';
import { YOUKAN_EVENTS } from '../../session/youkanKeys';

// Repository Factory (Simplified for Hook)
const getRepository = () => {
	// Default to Cloud for now as per useYoukanViewModel
	return CloudYoukanRepository;
};

export const useCapacityConfig = () => {
	const [capacityConfig, setCapacityConfig] = useState<CapacityConfig>({
		defaultDailyMinutes: 480,
		holidays: [{ type: 'weekly', value: '0' }], // Default Sunday
		exceptions: {}
	});

	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const refreshCapacityConfig = useCallback(async () => {
		setLoading(true);
		try {
			const config = await getRepository().getCapacityConfig();
			if (config) {
				setCapacityConfig(config);
			}
			setError(null);
		} catch (e) {
			console.error('Failed to load Capacity Config:', e);
			setError('キャパシティ設定の読み込みに失敗しました');
		} finally {
			setLoading(false);
		}
	}, []);

	const updateCapacityConfig = async (newConfig: CapacityConfig) => {
		// Optimistic Update
		setCapacityConfig(newConfig);
		try {
			await getRepository().saveCapacityConfig(newConfig);
		} catch (e) {
			console.error('Failed to save Capacity Config:', e);
			setError('キャパシティ設定の保存に失敗しました');
			// Revert or re-fetch could be done here
			refreshCapacityConfig();
		}
	};

	const toggleHoliday = async (date: Date) => {
		const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD
		const currentCapacity = getDailyCapacity(date, capacityConfig);
		const isCurrentlyHoliday = currentCapacity === 0;

		let newExceptions = { ...capacityConfig.exceptions };

		if (isCurrentlyHoliday) {
			// Holiday -> Work Day (Override)
			const isWeekly = isHoliday(date, { ...capacityConfig, exceptions: {} }); // Check base rule

			if (newExceptions[dateStr] === 0) {
				// Was explicitly set to 0. Remove exception to restore default.
				delete newExceptions[dateStr];
				// If base rule is holiday (e.g. Sunday), force it to WORK by setting capacity.
				if (isWeekly) {
					newExceptions[dateStr] = capacityConfig.defaultDailyMinutes;
				}
			} else if (isWeekly) {
				// Is holiday by base rule. Add exception to Work.
				newExceptions[dateStr] = capacityConfig.defaultDailyMinutes;
			}
		} else {
			// Work Day -> Holiday
			// Explicitly set 0
			newExceptions[dateStr] = 0;
		}

		const newConfig = { ...capacityConfig, exceptions: newExceptions };
		await updateCapacityConfig(newConfig);
	};

	// Initial Load
	useEffect(() => {
		refreshCapacityConfig();

		// Listen for global data changes if needed (e.g. from Settings screen)
		const handleGlobalRefresh = () => {
			refreshCapacityConfig();
		};

		window.addEventListener(YOUKAN_EVENTS.DATA_CHANGED, handleGlobalRefresh);
		return () => window.removeEventListener(YOUKAN_EVENTS.DATA_CHANGED, handleGlobalRefresh);
	}, [refreshCapacityConfig]);

	return {
		capacityConfig,
		loading,
		error,
		refreshCapacityConfig,
		updateCapacityConfig,
		toggleHoliday
	};
};
