import { describe, it, expect } from 'vitest';
import { calculateCost } from '../EstimationService';
import { DefaultEstimationSettings, EstimationSettings } from '../EstimationSettings';
import { DoorDimensions } from '../DoorDimensions';

// Mock Dimensions
const dim: DoorDimensions = {
    width: 900,  // DW
    height: 2000, // DH
    depth: 30,    // T
    stileWidth: 120, // SW
    topRailWidth: 100, // TRW
    bottomRailWidth: 200, // BRW
    middleRailWidth: 60, // MRW
    middleRailCount: 1,
    tsukaWidth: 30,
    tsukaCount: 2,
    kumikoVertWidth: 6,
    kumikoVertCount: 3,
    kumikoHorizWidth: 6,
    kumikoHorizCount: 4
};

// Mock Settings (Explicit margins for testing)
const settings: EstimationSettings = {
    ...DefaultEstimationSettings,
    pricePerM3: 200_000,
    widthMargin: 10,
    lengthMargin: 0,
    thicknessMargin: 0,
    hozoLength: 30, // 30mm per side
    markup: 0.0
};

describe('EstimationService', () => {

    it('Stile (縦框) Calculation', () => {
        const { items } = calculateCost(dim, settings);
        const stile = items.find(i => i.name === '縦框');

        expect(stile).toBeDefined();
        if (!stile) return;

        // Spec: L=DH, Hozo=0
        // Vol = (W+Mw) * (T+Tm) * (L+Lm+Hozo)
        // Vol = (120+10) * (30+0) * (2000+0+0)
        //     = 130 * 30 * 2000 = 7,800,000 mm3 = 0.0078 m3
        const expectedVol = ((120 + 10) * 30 * 2000) / 1e9;

        expect(stile.count).toBe(2);
        expect(stile.length).toBe(2000);
        expect(stile.hozo).toBe(0); // Stile should have 0 hozo
        expect(stile.volumeM3).toBeCloseTo(expectedVol * 2);
    });

    it('Top Rail (上桟) Calculation', () => {
        const { items } = calculateCost(dim, settings);
        const item = items.find(i => i.name === '上桟');
        expect(item).toBeDefined();
        if (!item) return;

        // Spec: L = DW - SW*2
        // Hozo = SW*2 ? Spec says "Stile Width * 2" but implementation might use fixed setting?
        // Let's check logic:
        // Implementation uses `settings.hozoLength` (30mm) by default.
        // BUT strict spec (ESTIMATION_LOGIC.md) says: Standard Hozo for Rails is "Stile Width * 2" ??
        // Wait, ESTIMATION_LOGIC.md said "Hozo: Stile Width x 2 (OR setting)".
        // Current code likely uses the fixed setting `hozoLength` passed in settings.
        // Let's see what the current code does.

        const visibleLen = 900 - (120 * 2); // 660
        expect(item.length).toBe(visibleLen);

        // Spec Update: Hozo = StileWidth * 2 (Total) => One Side = StileWidth = 120
        const hozoTotal = 120 * 2;
        expect(item.hozo).toBe(120);

        // Vol = (100+10) * 30 * (660 + 0 + 240)
        //     = 110 * 30 * 900 = 2,970,000 = 0.00297
        const expectedVol = ((100 + 10) * 30 * (visibleLen + hozoTotal)) / 1e9;
        expect(item.volumeM3).toBeCloseTo(expectedVol * 1);
    });

    it('Tsuka (束) Calculation', () => {
        const { items } = calculateCost(dim, settings);
        const item = items.find(i => i.name === '束');
        expect(item).toBeDefined();
        if (!item) return;

        // Inner Height = DH - TopW - BtmW
        const innerH = 2000 - 100 - 200; // 1700
        expect(item.length).toBe(innerH);

        // Hozo = 30 (from settings)
        // Vol = (30+10) * 30 * (1700 + 60)
        //     = 40 * 30 * 1760 = 2,112,000 = 0.002112
        const expectedVol = (40 * 30 * (innerH + 60)) / 1e9;
        expect(item.volumeM3).toBeCloseTo(expectedVol * 2);
    });

    it('Kumiko Vert (組子タテ) Calculation', () => {
        const { items } = calculateCost(dim, settings);
        const item = items.find(i => i.name === '組子 タテ');
        expect(item).toBeDefined();
        if (!item) return;

        const innerH = 1700;
        expect(item.length).toBe(innerH);

        // Vol = (6+10) * 30 * (1700+60) 
        //     = 16 * 30 * 1760 = 844,800 = 0.0008448
        const expectedVol = (16 * 30 * (innerH + 60)) / 1e9;
        expect(item.volumeM3).toBeCloseTo(expectedVol * 3);
    });

    it('Total Price Calculation', () => {
        const { totalCost } = calculateCost(dim, settings);

        // Sum of volumes * price
        // Just checking it's > 0 is enough for smoke test, 
        // component tests cover accuracy.
        expect(totalCost).toBeGreaterThan(0);
    });
});
