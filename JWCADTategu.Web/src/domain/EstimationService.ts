
import { DoorDimensions } from './DoorDimensions';
import { EstimationSettings } from './EstimationSettings';

export interface EstimationItem {
    name: string;
    // Display Specs (mm)
    width: number;  // 見付 (Face Width)
    depth: number;  // 見込み (Thickness/Depth)
    length: number; // 長さ (Length without Hozo/Margin)
    count: number;

    // Calculation Details
    hozo: number;   // ホゾ長さ (one side)
    margins: { w: number, l: number, t: number }; // 余裕

    // Results
    volumeM3: number;
    cost: number;
    unitPrice: number; // Added unitPrice
    note: string; // Debug/Fallback string
}

export interface EstimationResult {
    items: EstimationItem[];
    totalCost: number;
    unitPrice: number;
}

export const calculateCost = (dim: DoorDimensions, settings: EstimationSettings): EstimationResult => {
    const items: EstimationItem[] = [];
    const priceM3 = settings.pricePerM3 || 200000;

    // Safety defaults
    const mW = settings.widthMargin || 5;
    const mL = settings.lengthMargin || 50;
    const mT = settings.thicknessMargin || 3;
    const hozoDefault = settings.hozoLength || 0;

    // Helper: Material Member Calculation
    // w: Face Width, d: Depth, l: Visible Length
    // hozoLen: One-side hozo length (default 0)
    const addMember = (name: string, w: number, d: number, l: number, count: number, hozoLen: number = 0) => {
        // Check for overrides
        const override = dim.estimationOverrides?.[name];

        // Effective Values (Override > Settings/Default)
        const effMW = override?.marginWidth ?? mW;
        const effMT = override?.marginThickness ?? mT;
        const effML = override?.marginLength ?? mL;
        const effHozo = override?.hozo ?? hozoLen;
        const effPriceM3 = override?.unitPrice ?? priceM3;

        // Wood Taking Dimensions (木取り寸法)
        const takeW = w + effMW;
        const takeT = d + effMT;
        const takeL = l + (effHozo * 2) + effML;

        // Volume (m3)
        const vol = (takeW * takeT * takeL * count) / 1_000_000_000;
        const cost = Math.floor(vol * effPriceM3);

        items.push({
            name,
            width: w,
            depth: d,
            length: l,
            count,
            hozo: effHozo,
            margins: { w: effMW, l: effML, t: effMT },
            volumeM3: vol,
            cost,
            unitPrice: effPriceM3, // Add unitPrice to result item
            note: `${w}x${d}x${l}(+${effHozo * 2})`
        });
    };

    // main logic
    // 1. 縦框 (Stiles) - Hozo: 0
    addMember("縦框", dim.stileWidth, dim.depth, dim.height, 2, 0);

    // Dynamic Hozo Definitions
    const railHozo = dim.stileWidth; // Rails penetrate/tenon into Stiles => Stile Depth? No, usually Stile Width context (Full tenon) or partial. Spec says "Stile Width x 2".
    // Actually Spec says: "Hozo: StileWidth * 2" (Total). So One side = StileWidth.
    const verticalHozo = hozoDefault; // For Tsuka/Kumiko Vert (Configurable, default 30)

    // 2. 上下桟 (Rails) - Hozo: StileWidth (per side)
    const railVisibleLen = dim.width - (dim.stileWidth * 2);
    addMember("上桟", dim.topRailWidth, dim.depth, railVisibleLen, 1, railHozo);
    addMember("下桟", dim.bottomRailWidth, dim.depth, railVisibleLen, 1, railHozo);

    // 3. 中桟 (Middle Rails) - Hozo: StileWidth (per side)
    if (dim.middleRailCount > 0 && dim.middleRailWidth > 0) {
        addMember("中桟", dim.middleRailWidth, dim.depth, railVisibleLen, dim.middleRailCount, railHozo);
    }

    // 4. 束 (Tsuka) - Hozo: VerticalHozo (30mm)
    const tsukaCount = dim.tsukaCount || 0;
    const tsukaWidth = dim.tsukaWidth || 30;
    if (tsukaCount > 0) {
        const innerH = dim.height - dim.topRailWidth - dim.bottomRailWidth;
        addMember("束", tsukaWidth, dim.depth, innerH, tsukaCount, verticalHozo);
    }

    // 5. 組子 タテ (Kumiko Vert) - Hozo: VerticalHozo (30mm)
    const kvCount = dim.kumikoVertCount || 0;
    const kvWidth = dim.kumikoVertWidth || 6;
    if (kvCount > 0) {
        const innerH = dim.height - dim.topRailWidth - dim.bottomRailWidth;
        addMember("組子 タテ", kvWidth, dim.depth, innerH, kvCount, verticalHozo);
    }

    // 6. 組子 ヨコ (Kumiko Horiz) - Hozo: StileWidth or Config? Spec says "Horizontal: Stile Width * 2"
    const khCount = dim.kumikoHorizCount || 0;
    const khWidth = dim.kumikoHorizWidth || 6;
    if (khCount > 0) {
        addMember("組子 ヨコ", khWidth, dim.depth, railVisibleLen, khCount, railHozo);
    }

    const totalCost = items.reduce((sum, i) => sum + i.cost, 0);
    const unitPrice = Math.floor(totalCost * (1 + (settings.markup || 0)));

    return { items, totalCost, unitPrice };
};
