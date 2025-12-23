export interface EstimationSettings {
    pricePerM3: number;
    markup: number;
    taxRate: number;
    defaultMaterial?: string;
    // Margins (Allowances) in mm
    widthMargin: number;
    lengthMargin: number;
    thicknessMargin: number;
    hozoLength: number; // Tenon length per end
}

export const DefaultEstimationSettings: EstimationSettings = {
    pricePerM3: 200000,
    markup: 0.2, // 20%
    taxRate: 0.1, // 10%
    defaultMaterial: 'Spruce',
    widthMargin: 5,
    lengthMargin: 50,
    thicknessMargin: 3,
    hozoLength: 30
};
