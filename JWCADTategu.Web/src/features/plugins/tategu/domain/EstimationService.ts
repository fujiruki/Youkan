
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
    const wasteMultiplier = 1 + (settings.wasteRate || 0);

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

        // Dimension Overrides
        const effW = override?.width ?? w;
        const effD = override?.depth ?? d;
        const effL = override?.length ?? l;

        // Wood Taking Dimensions (木取り寸法)
        const takeW = effW + effMW;
        const takeT = effD + effMT;
        const takeL = effL + (effHozo * 2) + effML;

        // Volume (m3) with Waste Rate
        const netVol = (takeW * takeT * takeL * count) / 1_000_000_000;
        const vol = netVol * wasteMultiplier;
        const cost = Math.floor(vol * effPriceM3);

        items.push({
            name,
            width: effW,
            depth: effD,
            length: effL,
            count,
            hozo: effHozo,
            margins: { w: effMW, l: effML, t: effMT },
            volumeM3: vol,
            cost,
            unitPrice: effPriceM3, // Add unitPrice to result item
            note: `${effW}x${effD}x${effL}(+${effHozo * 2})`
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

    // 4. 束 (Tsuka) logic update
    // Condition: Only if MiddleRailCount > 0
    const tsukaCount = dim.tsukaCount || 0;
    const tsukaWidth = dim.tsukaWidth || 30;
    if (tsukaCount > 0 && dim.middleRailCount > 0) {
        // Length: Bottom Middle Rail Bottom ~ Bottom Rail Top
        // But geometrically, Middle Rails are usually evenly spaced or centered.
        // Assuming Middle Rails are distributed.
        // Simplified Logic: 
        // If 1 Middle Rail: M1 Bottom ~ B Top
        // If Multiple: Lowest M Bottom ~ B Top

        // Calculate Bottom Rail Top Y: (0 + Brw)
        // Calculate Middle Rail Y. 
        // NOTE: Without full geometry engine here, we approximate.
        // Usually Middle Rail is centered. 
        // Let's assume Middle Rail Y range is roughly center of internal space.
        // For accurate estimation, we should strictly follow "Lowest Middle Rail".
        // Let's calculate Inner Height below lowest middle rail.

        // Approximation:
        // Total Inner Height = H - Trw - Brw
        // Middle Rail Total Height = Mrw * Count
        // Remainder Space = InnerH - MiddleH
        // Spaces count = Count + 1
        // One Space Height = Remainder / (Count + 1)

        const innerH = dim.height - dim.topRailWidth - dim.bottomRailWidth;
        const totalMrH = dim.middleRailWidth * dim.middleRailCount;
        const spaceH = (innerH - totalMrH) / (dim.middleRailCount + 1);

        // Tsuka Length is effectively "Bottom Space Height"
        const tsukaLen = Math.floor(spaceH); // Floor to int

        addMember("束", tsukaWidth, dim.depth, tsukaLen, tsukaCount, verticalHozo);
    }

    // 5. 組子 タテ (Kumiko Vert) logic update
    const kvCount = dim.kumikoVertCount || 0;
    const kvWidth = dim.kumikoVertWidth || 6;
    if (kvCount > 0) {
        let kvLen = 0;
        // Case A: No Middle Rail -> Top Rail Bottom ~ Bottom Rail Top
        if (dim.middleRailCount === 0) {
            kvLen = dim.height - dim.topRailWidth - dim.bottomRailWidth;
        }
        // Case B: Middle Rail Exists -> Top Rail Bottom ~ Top-most Middle Rail Top
        else {
            // Same approximation logic as Tsuka: Top Space Height
            const innerH = dim.height - dim.topRailWidth - dim.bottomRailWidth;
            const totalMrH = dim.middleRailWidth * dim.middleRailCount;
            const spaceH = (innerH - totalMrH) / (dim.middleRailCount + 1);
            kvLen = Math.floor(spaceH);
        }

        addMember("組子 タテ", kvWidth, dim.depth, kvLen, kvCount, verticalHozo);
    }

    // 6. 組子 ヨコ (Kumiko Horiz) - Hozo: StileWidth or Config? Spec says "Horizontal: Stile Width * 2"
    const khCount = dim.kumikoHorizCount || 0;
    const khWidth = dim.kumikoHorizWidth || 6;
    if (khCount > 0) {
        addMember("組子 ヨコ", khWidth, dim.depth, railVisibleLen, khCount, railHozo);
    }

    // 7. Panel / Glass (Simplified Area Calculation)
    // Area = (Total W - 2*StileW) * (Total H - TopH - BottomH)
    // Note: This ignores middle rails area subtraction for simplicity (Safety side)
    // Or we can subtract middle rails area.
    // Let's use Inner Area.
    const innerW = Math.max(0, dim.width - (dim.stileWidth * 2));
    const innerH = Math.max(0, dim.height - dim.topRailWidth - dim.bottomRailWidth);
    const panelAreaM2 = (innerW * innerH) / 1_000_000;

    // Determine Material Type from spec overrides or default?
    // Currently we don't have explicit material type in `dim` for estimation.
    // We can assume Panel if `Panel` geometry exists, but geometry is generated later.
    // Let's add "Glass" and "Panel" items clearly.
    // In Tategu, usually it's either Glass OR Panel (Wood) OR Shoji Paper.
    // We'll calculate BOTH as 0 count, and let user override count to 1?
    // Or better: defaulting to Glass if no middle rails?
    // Let's add "Glass/Panel" item with count 1, and user can change price/type?
    // For now, let's add "ガラス/鏡板" item.

    // We'll split into two items with count 0 or 1 based on heuristics?
    // Heuristic: If Kumiko > 0 -> Shoji Paper?
    // If no Kumiko -> Glass or Panel?
    // Let's just add "鏡板/ガラス" as a generic panel item.
    // Defaulting to "Glass" price unless overridden?
    // It's safer to add both as Count 0, and user sets Count 1 to the one they use.
    // Actually, let's assume 1 Panel item.
    // Name: "鏡板・ガラス"
    // Cost: Area * GlassPrice (default)
    const panelUnitP = settings.glassPricePerM2 || 5000;
    const panelCost = Math.floor(panelAreaM2 * panelUnitP);

    items.push({
        name: "鏡板・ガラス",
        width: innerW,
        depth: 0, // Thickness not used for area pricing
        length: innerH,
        count: 1, // Default 1
        hozo: 0,
        margins: { w: 0, l: 0, t: 0 },
        volumeM3: 0, // Not m3
        cost: panelCost,
        unitPrice: panelUnitP,
        note: `${(panelAreaM2).toFixed(2)}m2 (Area)`
    });

    const totalCost = items.reduce((sum, i) => sum + i.cost, 0);
    const unitPrice = Math.floor(totalCost * (1 + (settings.markup || 0)));

    return { items, totalCost, unitPrice };
};
